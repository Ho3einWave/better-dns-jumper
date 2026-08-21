//! Network interface enumeration via `GetAdaptersAddresses` + `GetIfTable2`.
//!
//! Replaces the WMI `Win32_NetworkAdapter[Configuration]` queries the app polls every
//! ~5-10s from the frontend. Those were two unfiltered full-table WMI scans per call;
//! this is one syscall plus a lightweight per-adapter LUID→index conversion.
//!
//! Notes:
//! - The interface index comes from `adapter.Luid` via `ConvertInterfaceLuidToIndex`
//!   rather than the `IfIndex` member, which lives inside an anonymous union that is
//!   awkward to reach through windows-rs.
//! - `sockaddr_to_ip` deliberately avoids the typed `SOCKADDR_IN`/`SOCKADDR_IN6`
//!   accessors, whose nested unions differ between windows-rs versions, in favor of the
//!   stable documented wire layout from ws2def.h / ws2ipdef.h.
//!
//! This module typechecks cleanly against `x86_64-pc-windows-msvc`; see the isolated
//! check described in the migration notes if the windows-rs version is ever bumped.

use std::collections::HashMap;
use std::ffi::c_void;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::ptr;

use log::{error, info, warn};
use serde::Serialize;

use crate::error::{AppError, AppResult};
use windows::Win32::NetworkManagement::IpHelper::{
    ConvertInterfaceLuidToIndex, FreeMibTable, GetAdaptersAddresses, GetBestInterfaceEx,
    GetIfTable2, GAA_FLAG_INCLUDE_ALL_INTERFACES, GAA_FLAG_INCLUDE_GATEWAYS, GAA_FLAG_SKIP_ANYCAST,
    GAA_FLAG_SKIP_MULTICAST, GET_ADAPTERS_ADDRESSES_FLAGS, IP_ADAPTER_ADDRESSES_LH, MIB_IF_TABLE2,
};
use windows::Win32::NetworkManagement::Ndis::NET_LUID_LH;
use windows::Win32::Networking::WinSock::{AF_INET, AF_INET6, SOCKADDR, SOCKADDR_IN, SOCKADDR_IN6};

/// One network interface, flattened from `GetAdaptersAddresses` + `GetIfTable2`.
/// Replaces the old WMI-derived `{ adapter, config }` shape.
#[derive(Debug, Clone, Serialize)]
pub struct NetworkInterface {
    pub interface_index: u32,
    pub ipv6_interface_index: u32,
    pub name: String,
    pub description: String,
    pub mac_address: Option<String>,
    pub if_type: u32,
    pub is_up: bool,
    pub is_admin_disabled: bool,
    pub ip_addresses: Vec<String>,
    pub gateways: Vec<String>,
    pub dns_servers: Vec<String>,
}

// IF_OPER_STATUS / NET_IF_ADMIN_STATUS values (netioapi.h) — stable Win32 constants.
const IF_OPER_STATUS_UP: i64 = 1;
const NET_IF_ADMIN_STATUS_DOWN: i64 = 2;

// Plain Win32 error codes (WinError.h) — used instead of the typed `WIN32_ERROR`
// constants because `GetAdaptersAddresses` returns a bare `u32`, not `WIN32_ERROR`.
const ERROR_SUCCESS: u32 = 0;
const ERROR_BUFFER_OVERFLOW: u32 = 111;
const ERROR_NO_DATA: u32 = 232;

/// Lists all network interfaces with their current addresses, gateways, DNS servers,
/// and admin-enabled state.
pub fn list_interfaces() -> AppResult<Vec<NetworkInterface>> {
    let mut interfaces = read_adapters()?;
    let admin_disabled = read_admin_disabled_map();
    for iface in &mut interfaces {
        if let Some(disabled) = admin_disabled.get(&iface.interface_index) {
            iface.is_admin_disabled = *disabled;
        }
    }
    Ok(interfaces)
}

/// Picks the interface Windows would route internet traffic over.
///
/// Probes IPv4 first, then IPv6, and validates the answer against the adapter list.
///
/// Two traps here, both of which have produced the wrong adapter in practice:
///
/// - **Probing IPv6 first picks tunnels.** A machine with no native IPv6 still has
///   Teredo / 6to4 / ISATAP pseudo-adapters, and Windows will return a route to a global
///   IPv6 address through one of them. `GetBestInterfaceEx` then reports the tunnel,
///   not the Wi-Fi or Ethernet adapter the user actually browses through.
/// - **A route is not the same as a usable adapter.** Even on IPv4 the best route can
///   point at something that is down or synthetic, so the result is checked against
///   `list_interfaces()` before it is trusted.
///
/// The destinations are only routing probes — nothing is sent to them. They are
/// well-known public resolver addresses purely because they are guaranteed off-link.
pub fn best_interface_index() -> AppResult<u32> {
    // IPv4 first: it is what almost every machine actually routes over, and it cannot
    // be answered by an IPv6 tunnel adapter.
    let candidates: [IpAddr; 2] = [
        IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)),
        IpAddr::V6(Ipv6Addr::new(0x2001, 0x4860, 0x4860, 0, 0, 0, 0, 0x8888)),
    ];

    // If enumeration fails we cannot validate, so accept the raw routing answer rather
    // than refusing to pick anything at all.
    let interfaces = list_interfaces().unwrap_or_default();

    let mut unvalidated: Option<u32> = None;
    for dest in candidates {
        if let Some(index) = best_interface_for(dest) {
            if interfaces.is_empty() || is_usable_adapter(&interfaces, index) {
                // Logged at info, not debug: release builds log at info, and "which
                // adapter did Auto pick" is the first question when DNS is applied to
                // the wrong one.
                let name = interfaces
                    .iter()
                    .find(|i| i.interface_index == index)
                    .map(|i| i.name.as_str())
                    .unwrap_or("unknown");
                info!(
                    "Auto-selected interface {} ({}) via {} routing probe",
                    index,
                    name,
                    if dest.is_ipv4() { "IPv4" } else { "IPv6" }
                );
                return Ok(index);
            }
            warn!(
                "Routing probe to {} chose interface {}, which is not a usable adapter — ignoring",
                dest, index
            );
            unvalidated.get_or_insert(index);
        }
    }

    // Nothing routable passed validation. Fall back to the first adapter that is up,
    // real, and has a default gateway — which is what "connected to a network" means.
    if let Some(iface) = interfaces
        .iter()
        .find(|i| is_usable(i) && !i.gateways.is_empty())
    {
        warn!(
            "Falling back to interface {} ({}) by gateway",
            iface.interface_index, iface.name
        );
        return Ok(iface.interface_index);
    }

    // Last resort: whatever the routing table said, even though it looked synthetic.
    if let Some(index) = unvalidated {
        warn!(
            "Falling back to unvalidated routing result, interface {}",
            index
        );
        return Ok(index);
    }

    // No route to the internet at all — a disconnected machine, not a bug. The caller
    // turns this into an actionable message instead of a Win32 code.
    Err(AppError::NoActiveInterface)
}

// IANA ifType values (netioapi.h) for the adapter kinds that must never be auto-selected.
const IF_TYPE_SOFTWARE_LOOPBACK: u32 = 24;
const IF_TYPE_TUNNEL: u32 = 131;

fn is_usable(iface: &NetworkInterface) -> bool {
    iface.is_up
        && !iface.is_admin_disabled
        && iface.if_type != IF_TYPE_SOFTWARE_LOOPBACK
        && iface.if_type != IF_TYPE_TUNNEL
}

fn is_usable_adapter(interfaces: &[NetworkInterface], index: u32) -> bool {
    interfaces
        .iter()
        .any(|i| i.interface_index == index && is_usable(i))
}

fn best_interface_for(dest: IpAddr) -> Option<u32> {
    let mut if_index: u32 = 0;
    let status = unsafe {
        match dest {
            IpAddr::V4(v4) => {
                let mut sa = SOCKADDR_IN {
                    sin_family: AF_INET,
                    ..Default::default()
                };
                sa.sin_addr.S_un.S_addr = u32::from_ne_bytes(v4.octets());
                GetBestInterfaceEx(&sa as *const _ as *const SOCKADDR, &mut if_index)
            }
            IpAddr::V6(v6) => {
                let mut sa = SOCKADDR_IN6 {
                    sin6_family: AF_INET6,
                    ..Default::default()
                };
                sa.sin6_addr.u.Byte = v6.octets();
                GetBestInterfaceEx(&sa as *const _ as *const SOCKADDR, &mut if_index)
            }
        }
    };

    if status == ERROR_SUCCESS {
        Some(if_index)
    } else {
        None
    }
}

/// Maps the frontend's `0` = "Auto" sentinel to the real best-interface index.
pub fn resolve_interface_index(idx: u32) -> AppResult<u32> {
    if idx == 0 {
        best_interface_index()
    } else {
        Ok(idx)
    }
}

/// `InterfaceIndex -> is administratively disabled` via `GetIfTable2`.
/// `config_manager_error_code == 22` (WMI) doesn't have a direct IP Helper equivalent;
/// `AdminStatus == Down` is the closest match — "the user turned this adapter off",
/// distinct from `OperStatus == Down` (cable unplugged, no driver, etc).
fn read_admin_disabled_map() -> HashMap<u32, bool> {
    let mut map = HashMap::new();
    unsafe {
        let mut table_ptr: *mut MIB_IF_TABLE2 = ptr::null_mut();
        let status = GetIfTable2(&mut table_ptr);
        if status.0 != 0 || table_ptr.is_null() {
            error!("GetIfTable2 failed: {}", status.0);
            return map;
        }

        let table = &*table_ptr;
        let count = table.NumEntries as usize;
        // `Table` is declared as a 1-element array standing in for a C flexible array
        // member — the OS allocates `count` contiguous rows starting at that address.
        let rows = std::slice::from_raw_parts(table.Table.as_ptr(), count);
        for row in rows {
            let is_down = row.AdminStatus.0 as i64 == NET_IF_ADMIN_STATUS_DOWN;
            map.insert(row.InterfaceIndex, is_down);
        }

        FreeMibTable(table_ptr as *const c_void);
    }
    map
}

fn read_adapters() -> AppResult<Vec<NetworkInterface>> {
    let buffer = fetch_adapters_buffer()?;
    let mut interfaces = Vec::new();

    unsafe {
        let mut current = buffer.as_ptr() as *const IP_ADAPTER_ADDRESSES_LH;
        while !current.is_null() {
            let adapter = &*current;

            // Skip rather than defaulting to 0 — that is the frontend's "Auto"
            // sentinel, so a failed conversion would masquerade as a real interface.
            let interface_index = match luid_to_index(&adapter.Luid) {
                Some(idx) => idx,
                None => {
                    warn!("Skipping adapter with an unresolvable LUID");
                    current = adapter.Next;
                    continue;
                }
            };
            let name = wide_ptr_to_string(adapter.FriendlyName.0).unwrap_or_default();
            let description = wide_ptr_to_string(adapter.Description.0).unwrap_or_default();

            let mac_address = if adapter.PhysicalAddressLength > 0 {
                let len =
                    (adapter.PhysicalAddressLength as usize).min(adapter.PhysicalAddress.len());
                Some(
                    adapter.PhysicalAddress[..len]
                        .iter()
                        .map(|b| format!("{:02X}", b))
                        .collect::<Vec<_>>()
                        .join(":"),
                )
            } else {
                None
            };

            let is_up = adapter.OperStatus.0 as i64 == IF_OPER_STATUS_UP;

            let mut ip_addresses = Vec::new();
            let mut unicast = adapter.FirstUnicastAddress;
            while !unicast.is_null() {
                let node = &*unicast;
                if let Some(ip) = sockaddr_to_ip(node.Address.lpSockaddr) {
                    ip_addresses.push(ip.to_string());
                }
                unicast = node.Next;
            }

            let mut gateways = Vec::new();
            let mut gateway = adapter.FirstGatewayAddress;
            while !gateway.is_null() {
                let node = &*gateway;
                if let Some(ip) = sockaddr_to_ip(node.Address.lpSockaddr) {
                    gateways.push(ip.to_string());
                }
                gateway = node.Next;
            }

            let mut dns_servers = Vec::new();
            let mut dns = adapter.FirstDnsServerAddress;
            while !dns.is_null() {
                let node = &*dns;
                if let Some(ip) = sockaddr_to_ip(node.Address.lpSockaddr) {
                    dns_servers.push(ip.to_string());
                }
                dns = node.Next;
            }

            interfaces.push(NetworkInterface {
                interface_index,
                ipv6_interface_index: adapter.Ipv6IfIndex,
                name,
                description,
                mac_address,
                if_type: adapter.IfType,
                is_up,
                is_admin_disabled: false, // filled in by list_interfaces()
                ip_addresses,
                gateways,
                dns_servers,
            });

            current = adapter.Next;
        }
    }

    Ok(interfaces)
}

unsafe fn luid_to_index(luid: &NET_LUID_LH) -> Option<u32> {
    let mut index: u32 = 0;
    let status = ConvertInterfaceLuidToIndex(luid, &mut index);
    if status.0 == 0 {
        Some(index)
    } else {
        None
    }
}

/// Fetches the adapter list, retrying if the required buffer size changes between calls
/// (the adapter set can change mid-enumeration, especially during shutdown).
fn fetch_adapters_buffer() -> AppResult<Vec<u64>> {
    const MAX_TRIES: usize = 3;

    // Constructed from `.0` rather than via `|` to avoid depending on this newtype
    // implementing `BitOr`.
    let flags = GET_ADAPTERS_ADDRESSES_FLAGS(
        GAA_FLAG_SKIP_ANYCAST.0
            | GAA_FLAG_SKIP_MULTICAST.0
            | GAA_FLAG_INCLUDE_GATEWAYS.0
            | GAA_FLAG_INCLUDE_ALL_INTERFACES.0,
    );

    // Microsoft recommends starting at 15KB rather than making a separate sizing call.
    let mut buf_len: u32 = 15 * 1024;

    for _ in 0..MAX_TRIES {
        // `Vec<u64>` rather than `Vec<u8>` so the buffer satisfies the 8-byte alignment
        // `IP_ADAPTER_ADDRESSES_LH` requires.
        let mut buffer: Vec<u64> = vec![0; (buf_len as usize).div_ceil(8)];
        let ret = unsafe {
            GetAdaptersAddresses(
                0, // AF_UNSPEC
                flags,
                None,
                Some(buffer.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH),
                &mut buf_len,
            )
        };

        match ret {
            ERROR_SUCCESS => return Ok(buffer),
            ERROR_BUFFER_OVERFLOW => continue, // adapter set changed size mid-call, retry
            ERROR_NO_DATA => return Ok(Vec::new()),
            other => return Err(AppError::win32("GetAdaptersAddresses", other)),
        }
    }

    Err(AppError::win32(
        "GetAdaptersAddresses (buffer kept growing between attempts)",
        ERROR_BUFFER_OVERFLOW,
    ))
}

/// Extracts an `IpAddr` from a raw `sockaddr` using the stable, documented Win32 wire
/// layout (ws2def.h / ws2ipdef.h) — see the module-level confidence notes for why this
/// avoids the typed `SOCKADDR_IN`/`SOCKADDR_IN6` accessors.
unsafe fn sockaddr_to_ip(sa: *const SOCKADDR) -> Option<IpAddr> {
    if sa.is_null() {
        return None;
    }
    let bytes = sa as *const u8;
    // First 2 bytes of every sockaddr are the address family (ADDRESS_FAMILY / u16).
    let family = u16::from_ne_bytes([*bytes, *bytes.add(1)]);
    match family {
        2 => {
            // sockaddr_in: family(2) + port(2) + addr(4, network byte order)
            let a = std::slice::from_raw_parts(bytes.add(4), 4);
            Some(IpAddr::V4(Ipv4Addr::new(a[0], a[1], a[2], a[3])))
        }
        23 => {
            // sockaddr_in6: family(2) + port(2) + flowinfo(4) + addr(16)
            let a = std::slice::from_raw_parts(bytes.add(8), 16);
            let mut octets = [0u8; 16];
            octets.copy_from_slice(a);
            Some(IpAddr::V6(Ipv6Addr::from(octets)))
        }
        _ => None,
    }
}

unsafe fn wide_ptr_to_string(ptr: *const u16) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    let mut len = 0;
    while *ptr.add(len) != 0 {
        len += 1;
    }
    Some(String::from_utf16_lossy(std::slice::from_raw_parts(
        ptr, len,
    )))
}
