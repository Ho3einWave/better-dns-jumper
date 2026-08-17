use crate::error::{AppError, AppResult};
use crate::win;
use log::debug;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;

// `DnsFlushResolverCache` is an undocumented dnsapi.dll export — it isn't part of the
// official Win32 metadata windows-rs generates from, so it can't move to `crate::win`
// the way the rest of the DNS configuration surface did. This is the sole remaining
// hand-written `extern` block in the codebase.
#[link(name = "dnsapi")]
extern "system" {
    fn DnsFlushResolverCache() -> i32;
}

pub fn get_interface_dns_info(interface_idx: u32) -> AppResult<InterfaceDnsInfo> {
    let interfaces = win::adapters::list_interfaces()?;
    interfaces
        .into_iter()
        .find(|i| i.interface_index == interface_idx)
        .map(|i| InterfaceDnsInfo {
            interface_index: i.interface_index,
            interface_name: i.name,
            // `GetAdaptersAddresses` reports both families, and most machines carry
            // Windows' default site-local IPv6 anycast servers even when the user has
            // configured none. Showing those in the UI would be noise — the old
            // WMI-backed field was IPv4-only and never included them.
            dns_servers: i
                .dns_servers
                .into_iter()
                .filter(|s| {
                    s.parse::<IpAddr>()
                        .map(|ip| !win::is_default_ipv6_anycast(&ip))
                        .unwrap_or(true)
                })
                .collect(),
        })
        .ok_or(AppError::InterfaceNotFound(interface_idx))
}

pub fn clear_dns_cache() -> AppResult<()> {
    // Undocumented export: returns non-zero on success, and does not set last-error in
    // a documented way, so there is no code worth reporting back.
    let result = unsafe { DnsFlushResolverCache() };
    debug!("DnsFlushResolverCache returned {}", result);
    match result {
        1 => Ok(()),
        _ => Err(AppError::Internal(
            "Windows refused to flush the DNS resolver cache. Try running the app as administrator."
                .to_string(),
        )),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InterfaceDnsInfo {
    pub interface_index: u32,
    pub dns_servers: Vec<String>,
    pub interface_name: String,
}
