//! Per-interface DNS configuration.
//!
//! Two implementations sit behind [`set_interface_dns`]:
//!
//! - **`SetInterfaceDnsSettings`** (IP Helper) on Windows 10 build 18362 (1903) and
//!   later. This is the only one that can configure the IPv6 name servers, so it is the
//!   only one that can close the IPv6 DNS leak. See WMI_MIGRATION_PLAN.md section 1.1.
//! - **`Win32_NetworkAdapterConfiguration.SetDNSServerSearchOrder`** (WMI) everywhere
//!   else. IPv4-only, which is exactly why the migration happened — but it is what
//!   Windows 10 builds before 1903 have, including LTSC 2019 (1809).
//!
//! ## Why the symbol is resolved at runtime
//!
//! `SetInterfaceDnsSettings` does not exist in `iphlpapi.dll` before 1903. Windows
//! resolves an executable's static imports at *load* time, so a single static reference
//! to a missing export stops the process from starting at all — the user sees "The
//! procedure entry point could not be located", with no hint as to why. Linking it
//! statically would therefore make the whole app refuse to launch on every Windows 10
//! build before 1903 — LTSC 2019 among them — not merely lose the IPv6 feature.
//! `GetProcAddress` turns that load-time failure into a runtime capability check we can
//! fall back from.
//!
//! (Windows 7 and 8.1 are out of reach regardless: the Rust standard library links
//! `ProcessPrng` and `WaitOnAddress` into every binary built for the default
//! `x86_64-pc-windows-msvc` target, and those are Windows 10 and Windows 8 APIs.)
//!
//! There is deliberately no `GetInterfaceDnsSettings` wrapper here. Its documentation
//! states the `Flags` field "must be empty" on input, so it offers no way to select an
//! address family for reading. Reads go through `GetAdaptersAddresses` instead (see
//! `crate::win::interface_dns_servers`), which returns both families in one call and
//! works back to Windows XP.

use std::mem::MaybeUninit;
use std::net::IpAddr;
use std::sync::OnceLock;

use log::{info, warn};
use windows::core::{GUID, PCSTR, PCWSTR, PWSTR};
use windows::Win32::NetworkManagement::IpHelper::{
    ConvertInterfaceIndexToLuid, ConvertInterfaceLuidToGuid, DNS_INTERFACE_SETTINGS,
    DNS_INTERFACE_SETTINGS_VERSION1, DNS_SETTING_IPV6, DNS_SETTING_NAMESERVER,
};
use windows::Win32::NetworkManagement::Ndis::NET_LUID_LH;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Family {
    V4,
    V6,
}

impl Family {
    /// `DNS_SETTING_NAMESERVER` (0x0002) selects the *NameServer* member; adding
    /// `DNS_SETTING_IPV6` (0x0001) applies it to the IPv6 stack instead of the IPv4
    /// one. `SetInterfaceDnsSettings` ignores any member whose flag bit is not set,
    /// so a wrong value here makes the whole call a silent no-op.
    fn flags(self) -> u64 {
        match self {
            Family::V4 => DNS_SETTING_NAMESERVER as u64,
            Family::V6 => (DNS_SETTING_NAMESERVER | DNS_SETTING_IPV6) as u64,
        }
    }
}

/// Signature of `SetInterfaceDnsSettings` as documented in netioapi.h.
type SetInterfaceDnsSettingsFn =
    unsafe extern "system" fn(GUID, *const DNS_INTERFACE_SETTINGS) -> u32;

/// Resolved once per process. `None` means this Windows build predates 1903.
static SET_INTERFACE_DNS_SETTINGS: OnceLock<Option<SetInterfaceDnsSettingsFn>> = OnceLock::new();

fn resolve_set_interface_dns_settings() -> Option<SetInterfaceDnsSettingsFn> {
    unsafe {
        let name: Vec<u16> = "iphlpapi.dll\0".encode_utf16().collect();
        let module = LoadLibraryW(PCWSTR(name.as_ptr())).ok()?;
        let proc = GetProcAddress(
            module,
            PCSTR(c"SetInterfaceDnsSettings".as_ptr() as *const u8),
        )?;
        // Transmuting the returned FARPROC to the documented signature is the standard
        // GetProcAddress idiom; the Win32 model offers no safe alternative.
        Some(std::mem::transmute::<
            unsafe extern "system" fn() -> isize,
            SetInterfaceDnsSettingsFn,
        >(proc))
    }
}

fn set_interface_dns_settings() -> Option<SetInterfaceDnsSettingsFn> {
    *SET_INTERFACE_DNS_SETTINGS.get_or_init(|| {
        let resolved = resolve_set_interface_dns_settings();
        match resolved {
            Some(_) => {
                info!("Using SetInterfaceDnsSettings — IPv4 and IPv6 DNS can both be configured")
            }
            None => warn!(
                "SetInterfaceDnsSettings is unavailable (Windows older than 10 build 18362); \
                 falling back to WMI, which can only configure IPv4 DNS"
            ),
        }
        resolved
    })
}

/// True when the running Windows can configure IPv6 name servers.
///
/// Callers use this to decide whether redirecting IPv6 DNS to the proxy is possible at
/// all; on the WMI fallback path it is not, and pretending otherwise would leave IPv6
/// queries going to the ISP resolver while the UI claims protection.
pub fn supports_ipv6_dns() -> bool {
    set_interface_dns_settings().is_some()
}

pub(crate) fn interface_guid(if_index: u32) -> AppResult<GUID> {
    unsafe {
        let mut luid = MaybeUninit::<NET_LUID_LH>::zeroed().assume_init();
        let status = ConvertInterfaceIndexToLuid(if_index, &mut luid);
        if status.0 != 0 {
            // The usual cause is that the adapter disappeared between enumeration and
            // this call, so report it as a missing interface rather than a raw Win32
            // code the user can do nothing with.
            return Err(AppError::InterfaceNotFound(if_index));
        }

        let mut guid = MaybeUninit::<GUID>::zeroed().assume_init();
        let status = ConvertInterfaceLuidToGuid(&luid, &mut guid);
        if status.0 != 0 {
            return Err(AppError::win32(
                "ConvertInterfaceLuidToGuid",
                status.0 as u32,
            ));
        }

        Ok(guid)
    }
}

/// Sets the name server list for one address family on an interface.
/// An empty `servers` slice reverts that family to the DHCP-provided servers.
pub fn set_interface_dns(if_index: u32, family: Family, servers: &[IpAddr]) -> AppResult<()> {
    match set_interface_dns_settings() {
        Some(set_fn) => set_via_ip_helper(set_fn, if_index, family, servers),
        None => super::dns_legacy::set_interface_dns_wmi(if_index, family, servers),
    }
}

fn set_via_ip_helper(
    set_fn: SetInterfaceDnsSettingsFn,
    if_index: u32,
    family: Family,
    servers: &[IpAddr],
) -> AppResult<()> {
    let guid = interface_guid(if_index)?;

    // DNS_INTERFACE_SETTINGS documents NameServer as "a series of comma- or
    // space-separated DNS servers", e.g. L"1.1.1.1,8.8.8.8".
    let mut wide: Vec<u16> = if servers.is_empty() {
        Vec::new()
    } else {
        let text = servers
            .iter()
            .map(|ip| ip.to_string())
            .collect::<Vec<_>>()
            .join(",");
        text.encode_utf16().chain(std::iter::once(0)).collect()
    };

    let name_server = if wide.is_empty() {
        PWSTR::null()
    } else {
        PWSTR(wide.as_mut_ptr())
    };

    unsafe {
        let settings = DNS_INTERFACE_SETTINGS {
            Version: DNS_INTERFACE_SETTINGS_VERSION1,
            Flags: family.flags(),
            Domain: PWSTR::null(),
            NameServer: name_server,
            SearchList: PWSTR::null(),
            RegistrationEnabled: 0,
            RegisterAdapterName: 0,
            EnableLLMNR: 0,
            QueryAdapterName: 0,
            ProfileNameServer: PWSTR::null(),
        };

        let status = set_fn(guid, &settings);
        if status != 0 {
            return Err(AppError::win32("SetInterfaceDnsSettings", status));
        }
    }

    // `wide` backs the pointer handed to the call above and must outlive it.
    drop(wide);
    Ok(())
}
