//! Win32 IP Helper bindings, replacing WMI for the DNS-configuration hot path.
//! See WMI_MIGRATION_PLAN.md for the rationale.

pub mod adapters;
pub mod device;
pub mod dns_legacy;
pub mod dns_settings;
pub mod notify;

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use log::{debug, error, info, warn};

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

/// Reverts one interface to its DHCP-provided DNS servers, escalating until it takes.
///
/// Returns whether the previously configured servers are actually gone.
///
/// Blocking on purpose: the exit handler has no async runtime, and leaving `127.0.0.2`
/// applied there is precisely the failure that strands a user with no working internet.
/// The async command wraps this in `spawn_blocking` so both paths share one
/// implementation — they diverged once before, and only the command got fixed.
///
/// Three mechanisms are tried in order, because they do not fail alike:
///
/// 1. `SetInterfaceDnsSettings` with a null `NameServer` — the documented spelling.
/// 2. The same call with an empty string. A null pointer appears to be ignored on some
///    systems even with `DNS_SETTING_NAMESERVER` set, so the call reports success while
///    the old servers stay exactly where they were.
/// 3. WMI's `SetDNSServerSearchOrder`, which this app used before the IP Helper
///    migration. IPv4-only, which is the family that matters — `127.0.0.2` is what
///    breaks name resolution when it is left behind.
pub fn restore_dhcp_dns_blocking(if_index: u32) -> bool {
    // Whatever is configured right now is what has to disappear. Snapshotting it works
    // for plain DNS too, where nothing points at the proxy and checking only for
    // 127.0.0.2 would report success without having changed anything at all.
    let applied: Vec<IpAddr> = match interface_dns_servers(if_index) {
        Ok(servers) => servers
            .into_iter()
            .filter(|ip| !is_default_ipv6_anycast(ip))
            .collect(),
        Err(e) => {
            error!("Cannot restore interface {}: {}", if_index, e);
            return false;
        }
    };

    if applied.is_empty() {
        debug!(
            "Interface {} has no configured DNS servers; nothing to restore",
            if_index
        );
        return true;
    }
    debug!(
        "Restoring interface {}, currently set to {:?}",
        if_index, applied
    );

    for family in [dns_settings::Family::V4, dns_settings::Family::V6] {
        if let Err(e) = dns_settings::set_interface_dns(if_index, family, &[]) {
            debug!(
                "Null-pointer clear failed for {:?} on interface {}: {}",
                family, if_index, e
            );
        }
    }
    if dns_restored(if_index, &applied) {
        return true;
    }

    warn!(
        "Interface {} unchanged after the null clear — retrying with an empty string",
        if_index
    );
    for family in [dns_settings::Family::V4, dns_settings::Family::V6] {
        if let Err(e) = dns_settings::clear_interface_dns_empty_string(if_index, family) {
            debug!(
                "Empty-string clear failed for {:?} on interface {}: {}",
                family, if_index, e
            );
        }
    }
    if dns_restored(if_index, &applied) {
        return true;
    }

    warn!(
        "Interface {} unchanged after both IP Helper forms — falling back to WMI",
        if_index
    );
    if let Err(e) = dns_legacy::set_interface_dns_wmi(if_index, dns_settings::Family::V4, &[]) {
        error!("WMI fallback failed on interface {}: {}", if_index, e);
    }
    dns_restored(if_index, &applied)
}

/// True once none of `applied` are still configured on the interface.
///
/// Polls rather than reading once: `GetAdaptersAddresses` does not always reflect a
/// `SetInterfaceDnsSettings` write immediately, so a single read taken straight
/// afterwards can report the old servers and make a good restore look like a failure.
/// Kept short — this runs during application exit.
fn dns_restored(if_index: u32, applied: &[IpAddr]) -> bool {
    const ATTEMPTS: usize = 4;
    const DELAY: std::time::Duration = std::time::Duration::from_millis(150);

    for attempt in 1..=ATTEMPTS {
        match interface_dns_servers(if_index) {
            Ok(current) => {
                let leftover: Vec<&IpAddr> =
                    applied.iter().filter(|ip| current.contains(ip)).collect();
                if leftover.is_empty() {
                    debug!(
                        "Interface {} restored to {:?} after {} read(s)",
                        if_index, current, attempt
                    );
                    return true;
                }
                debug!(
                    "Interface {} still shows {:?} on read {}/{}",
                    if_index, leftover, attempt, ATTEMPTS
                );
            }
            Err(e) => debug!(
                "Could not read DNS servers on interface {}: {}",
                if_index, e
            ),
        }
        if attempt < ATTEMPTS {
            std::thread::sleep(DELAY);
        }
    }
    false
}

/// Scans every interface for a stale proxy DNS entry — left over from a previous run
/// that did not shut down cleanly, or from this run on the way out — and reverts it.
///
/// Runs both at startup and from the exit handler, so it is the last line of defence
/// against leaving `127.0.0.2` on an adapter with nothing listening on it.
pub fn clear_stale_doh_dns() {
    let interfaces = match adapters::list_interfaces() {
        Ok(interfaces) => interfaces,
        Err(e) => {
            error!("clear_stale_doh_dns: failed to list interfaces: {}", e);
            return;
        }
    };

    let stale: Vec<&adapters::NetworkInterface> = interfaces
        .iter()
        .filter(|i| {
            i.dns_servers
                .iter()
                .filter_map(|s| s.parse::<IpAddr>().ok())
                .any(|ip| is_proxy_addr(&ip))
        })
        .collect();

    if stale.is_empty() {
        debug!("No interface is pointing at the proxy; nothing to clean up");
        return;
    }

    for iface in stale {
        info!(
            "Clearing stale proxy DNS on interface {} ({})",
            iface.interface_index, iface.name
        );
        if restore_dhcp_dns_blocking(iface.interface_index) {
            info!(
                "Interface {} ({}) restored to DHCP",
                iface.interface_index, iface.name
            );
        } else {
            error!(
                "Could not clear proxy DNS from interface {} ({}) — name resolution on it is likely broken",
                iface.interface_index, iface.name
            );
        }
    }
}
