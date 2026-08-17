//! Per-interface DNS configuration via `SetInterfaceDnsSettings` (IP Helper).
//!
//! Replaces the old WMI `SetDNSServerSearchOrder` path, which is IPv4-only and was
//! silently leaving IPv6 DNS pointed at the ISP resolver while "DoH mode" was active.
//! See WMI_MIGRATION_PLAN.md section 1.1.
//!
//! There is deliberately no `GetInterfaceDnsSettings` wrapper here. Its documentation
//! states the `Flags` field "must be empty" on input, so it offers no way to select an
//! address family for reading — and it requires Windows 10 build 19041 against 18362
//! for the setter, which would raise the app's minimum OS for no benefit. Reads go
//! through `GetAdaptersAddresses` instead (see `crate::win::interface_dns_servers`),
//! which returns both families in one call.

use std::mem::MaybeUninit;
use std::net::IpAddr;

use windows::core::{GUID, PWSTR};
use windows::Win32::NetworkManagement::IpHelper::{
    ConvertInterfaceIndexToLuid, ConvertInterfaceLuidToGuid, SetInterfaceDnsSettings,
    DNS_INTERFACE_SETTINGS, DNS_INTERFACE_SETTINGS_VERSION1, DNS_SETTING_IPV6,
    DNS_SETTING_NAMESERVER,
};
use windows::Win32::NetworkManagement::Ndis::NET_LUID_LH;

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

fn interface_guid(if_index: u32) -> Result<GUID, String> {
    unsafe {
        let mut luid = MaybeUninit::<NET_LUID_LH>::zeroed().assume_init();
        let status = ConvertInterfaceIndexToLuid(if_index, &mut luid);
        if status.0 != 0 {
            return Err(format!(
                "ConvertInterfaceIndexToLuid({}) failed: {}",
                if_index, status.0
            ));
        }

        let mut guid = MaybeUninit::<GUID>::zeroed().assume_init();
        let status = ConvertInterfaceLuidToGuid(&luid, &mut guid);
        if status.0 != 0 {
            return Err(format!("ConvertInterfaceLuidToGuid failed: {}", status.0));
        }

        Ok(guid)
    }
}

/// Sets the name server list for one address family on an interface.
/// An empty `servers` slice reverts that family to the DHCP-provided servers.
pub fn set_interface_dns(if_index: u32, family: Family, servers: &[IpAddr]) -> Result<(), String> {
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

        let status = SetInterfaceDnsSettings(guid, &settings);
        if status.0 != 0 {
            return Err(format!(
                "SetInterfaceDnsSettings failed: 0x{:08x}",
                status.0
            ));
        }
    }

    // `wide` backs the pointer handed to the call above and must outlive it.
    drop(wide);
    Ok(())
}
