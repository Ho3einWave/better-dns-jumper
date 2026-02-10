use log::{error, info};
use std::mem::MaybeUninit;
use std::net::Ipv4Addr;
use std::ptr;
use wmi::{COMLibrary, WMIConnection};

use winapi::shared::guiddef::GUID;
use winapi::shared::ifdef::NET_LUID;
use winapi::um::iptypes::IP_ADAPTER_ADDRESSES_LH;
use winapi::shared::minwindef::ULONG;
use winapi::shared::winerror::ERROR_BUFFER_OVERFLOW;
use winapi::shared::ws2def::AF_INET;
use winapi::um::iphlpapi::GetAdaptersAddresses;

pub fn ipv4_to_u32(ipv4: Ipv4Addr) -> u32 {
    ipv4.into()
}

pub fn create_wmi_connection() -> Result<WMIConnection, String> {
    let com_con = unsafe { COMLibrary::assume_initialized() };
    let wmi_con = match WMIConnection::new(com_con) {
        Ok(wmi) => wmi,
        Err(e) => {
            error!("WMI connection failed: {:?}", e);
            let error_msg = format!("WMI connection failed: {:?}", e);
            return Err(error_msg);
        }
    };

    Ok(wmi_con)
}

/// Mirrors the Windows `DNS_INTERFACE_SETTINGS` structure (version 1).
#[repr(C)]
struct DnsInterfaceSettings {
    version: u32,
    flags: u64,
    domain: *const u16,
    name_server: *const u16,
    search_list: *const u16,
    registration_enabled: u32,
    register_adapter_name: u32,
    enable_llmnr: u64,
    query_adapter_name: u64,
    profile_name_server: *const u16,
}

const DNS_INTERFACE_SETTINGS_VERSION1: u32 = 1;
const DNS_SETTING_NAMESERVER: u64 = 0x1000;

// These functions are in iphlpapi.dll but not exposed by the winapi crate.
#[link(name = "iphlpapi")]
extern "system" {
    fn SetInterfaceDnsSettings(interface: GUID, settings: *const DnsInterfaceSettings) -> i32;
    fn ConvertInterfaceIndexToLuid(interface_index: u32, interface_luid: *mut NET_LUID) -> u32;
    fn ConvertInterfaceLuidToGuid(interface_luid: *const NET_LUID, interface_guid: *mut GUID) -> u32;
}

/// Scans all network interfaces for stale DoH proxy DNS (`127.0.0.2`) and clears them.
///
/// Uses the Windows IP Helper API directly — no COM/WMI dependency — so it works
/// reliably during Windows shutdown when COM services are already tearing down.
pub fn clear_stale_doh_dns() {
    unsafe {
        // Flags: skip unicast/anycast/multicast addresses (we only need DNS servers)
        let flags: ULONG = 0x0001 | 0x0002 | 0x0004;

        // First call: get required buffer size
        let mut buf_len: ULONG = 0;
        let ret = GetAdaptersAddresses(0, flags, ptr::null_mut(), ptr::null_mut(), &mut buf_len);
        if ret != ERROR_BUFFER_OVERFLOW {
            error!("GetAdaptersAddresses sizing call failed: {}", ret);
            return;
        }

        // Second call: fill adapter data
        let mut buffer = vec![0u8; buf_len as usize];
        let adapters = buffer.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH;
        let ret = GetAdaptersAddresses(0, flags, ptr::null_mut(), adapters, &mut buf_len);
        if ret != 0 {
            error!("GetAdaptersAddresses failed: {}", ret);
            return;
        }

        // Walk the linked list of adapters
        let mut current = adapters;
        while !current.is_null() {
            let adapter = &*current;
            let if_index = adapter.u.s().IfIndex;

            // Walk this adapter's DNS server list looking for 127.0.0.2
            let mut has_stale_dns = false;
            let mut dns = adapter.FirstDnsServerAddress;
            while !dns.is_null() {
                let dns_entry = &*dns;
                let sa = dns_entry.Address.lpSockaddr;
                if !sa.is_null() && (*sa).sa_family == AF_INET as u16 {
                    // SOCKADDR_IN layout: family(2) + port(2) + addr(4)
                    let addr = std::slice::from_raw_parts((sa as *const u8).add(4), 4);
                    if addr == [127, 0, 0, 2] {
                        has_stale_dns = true;
                        break;
                    }
                }
                dns = dns_entry.Next;
            }

            if has_stale_dns {
                let desc = wide_ptr_to_string(adapter.Description);
                info!(
                    "Clearing stale DoH DNS on interface {} ({})",
                    if_index,
                    desc.as_deref().unwrap_or("unknown")
                );

                // IfIndex → LUID → GUID
                let mut luid = MaybeUninit::<NET_LUID>::zeroed().assume_init();
                if ConvertInterfaceIndexToLuid(if_index, &mut luid) != 0 {
                    error!("Failed to get LUID for interface {}", if_index);
                    current = adapter.Next;
                    continue;
                }
                let mut guid = MaybeUninit::<GUID>::zeroed().assume_init();
                if ConvertInterfaceLuidToGuid(&luid, &mut guid) != 0 {
                    error!("Failed to get GUID for interface {}", if_index);
                    current = adapter.Next;
                    continue;
                }

                // Clear DNS via SetInterfaceDnsSettings (empty NameServer = revert to DHCP)
                let empty: [u16; 1] = [0];
                let settings = DnsInterfaceSettings {
                    version: DNS_INTERFACE_SETTINGS_VERSION1,
                    flags: DNS_SETTING_NAMESERVER,
                    domain: ptr::null(),
                    name_server: empty.as_ptr(),
                    search_list: ptr::null(),
                    registration_enabled: 0,
                    register_adapter_name: 0,
                    enable_llmnr: 0,
                    query_adapter_name: 0,
                    profile_name_server: ptr::null(),
                };

                let status = SetInterfaceDnsSettings(guid, &settings);
                if status != 0 {
                    error!(
                        "SetInterfaceDnsSettings failed for interface {}: 0x{:08x}",
                        if_index, status
                    );
                }
            }

            current = adapter.Next;
        }
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
