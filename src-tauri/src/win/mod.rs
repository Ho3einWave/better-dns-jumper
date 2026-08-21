//! Win32 IP Helper bindings, replacing WMI for the DNS-configuration hot path.
//! See WMI_MIGRATION_PLAN.md for the rationale.

pub mod adapters;
pub mod device;
pub mod dns_legacy;
pub mod dns_settings;
pub mod notify;

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use log::{error, info, warn};

use crate::error::AppResult;

/// Loopback addresses the local DoH/DoT/DoQ/DoH3 proxy binds to.
pub const PROXY_V4: Ipv4Addr = Ipv4Addr::new(127, 0, 0, 2);
pub const PROXY_V6: Ipv6Addr = Ipv6Addr::LOCALHOST; // ::1

/// True if this address is one of the proxy's own loopback addresses.
pub fn is_proxy_addr(ip: &IpAddr) -> bool {
    *ip == IpAddr::V4(PROXY_V4) || *ip == IpAddr::V6(PROXY_V6)
}

/// Windows' default site-local IPv6 DNS anycast addresses.
///
/// These are present on most systems even when the user has never configured IPv6 DNS,
/// so they must not be counted as "real" configured servers — otherwise every
/// activation would think IPv6 DNS needs redirecting, and the UI would list them as
/// though the user had set them.
pub fn is_default_ipv6_anycast(ip: &IpAddr) -> bool {
    const DEFAULTS: [Ipv6Addr; 3] = [
        Ipv6Addr::new(0xfec0, 0, 0, 0xffff, 0, 0, 0, 1),
        Ipv6Addr::new(0xfec0, 0, 0, 0xffff, 0, 0, 0, 2),
        Ipv6Addr::new(0xfec0, 0, 0, 0xffff, 0, 0, 0, 3),
    ];
    matches!(ip, IpAddr::V6(v6) if DEFAULTS.contains(v6))
}

/// Reads the DNS servers currently configured on one interface, both address families.
///
/// Uses `GetAdaptersAddresses` rather than `GetInterfaceDnsSettings` — see the note at
/// the top of `dns_settings.rs` for why the latter can't be used to read a specific
/// family.
pub fn interface_dns_servers(if_index: u32) -> AppResult<Vec<IpAddr>> {
    let iface = adapters::list_interfaces()?
        .into_iter()
        .find(|i| i.interface_index == if_index)
        .ok_or(crate::error::AppError::InterfaceNotFound(if_index))?;

    Ok(iface
        .dns_servers
        .iter()
        .filter_map(|s| s.parse::<IpAddr>().ok())
        .collect())
}

/// True if the interface has real (user- or DHCP-configured, non-anycast-default) IPv6
/// DNS servers that would bypass an IPv4-only proxy.
pub fn has_real_ipv6_dns(if_index: u32) -> bool {
    match interface_dns_servers(if_index) {
        Ok(servers) => servers
            .iter()
            .any(|ip| ip.is_ipv6() && !is_default_ipv6_anycast(ip) && !is_proxy_addr(ip)),
        Err(e) => {
            error!(
                "Failed to read DNS servers on interface {}: {}",
                if_index, e
            );
            false
        }
    }
}

/// True if the interface still points at the proxy loopback on either family.
pub fn interface_uses_proxy_dns(if_index: u32) -> bool {
    match interface_dns_servers(if_index) {
        Ok(servers) => servers.iter().any(is_proxy_addr),
        Err(e) => {
            error!(
                "Failed to verify DNS state on interface {}: {}",
                if_index, e
            );
            false
        }
    }
}

/// Scans every interface for a stale proxy DNS entry (left over from a previous run
/// that didn't shut down cleanly) and reverts it to the DHCP-provided servers, for both
/// address families. Verifies the clear actually took effect — an earlier
/// implementation used the wrong `SetInterfaceDnsSettings` flag value and silently
/// failed to clear anything while reporting success.
pub fn clear_stale_doh_dns() {
    let interfaces = match adapters::list_interfaces() {
        Ok(interfaces) => interfaces,
        Err(e) => {
            error!("clear_stale_doh_dns: failed to list interfaces: {}", e);
            return;
        }
    };

    let mut cleared_any = false;
    for iface in &interfaces {
        let servers: Vec<IpAddr> = iface
            .dns_servers
            .iter()
            .filter_map(|s| s.parse::<IpAddr>().ok())
            .collect();

        let has_v4_proxy = servers.contains(&IpAddr::V4(PROXY_V4));
        let has_v6_proxy = servers.contains(&IpAddr::V6(PROXY_V6));

        if has_v4_proxy {
            info!(
                "Clearing stale IPv4 DoH DNS on interface {} ({})",
                iface.interface_index, iface.name
            );
            if let Err(e) = dns_settings::set_interface_dns(
                iface.interface_index,
                dns_settings::Family::V4,
                &[],
            ) {
                error!(
                    "Failed to clear IPv4 DNS on interface {}: {}",
                    iface.interface_index, e
                );
            }
            cleared_any = true;
        }
        if has_v6_proxy {
            info!(
                "Clearing stale IPv6 DoH DNS on interface {} ({})",
                iface.interface_index, iface.name
            );
            if let Err(e) = dns_settings::set_interface_dns(
                iface.interface_index,
                dns_settings::Family::V6,
                &[],
            ) {
                error!(
                    "Failed to clear IPv6 DNS on interface {}: {}",
                    iface.interface_index, e
                );
            }
            cleared_any = true;
        }
    }

    if !cleared_any {
        return;
    }

    // Verify — a previous implementation returned success from the OS while doing
    // nothing. Never assume the clear worked.
    match adapters::list_interfaces() {
        Ok(remaining) => {
            let still_stale: Vec<u32> = remaining
                .iter()
                .filter(|i| {
                    i.dns_servers
                        .iter()
                        .filter_map(|s| s.parse::<IpAddr>().ok())
                        .any(|ip| is_proxy_addr(&ip))
                })
                .map(|i| i.interface_index)
                .collect();
            if still_stale.is_empty() {
                info!("Cleared stale DoH DNS successfully");
            } else {
                warn!(
                    "DoH proxy DNS still set after cleanup on interface(s) {:?} — DNS resolution is likely broken",
                    still_stale
                );
            }
        }
        Err(e) => error!("clear_stale_doh_dns: verification scan failed: {}", e),
    }
}
