//! Legacy DNS configuration for Windows builds without `SetInterfaceDnsSettings`
//! (anything older than Windows 10 build 18362 / version 1903).
//!
//! This is the path the app used before the IP Helper migration, kept alive purely as a
//! fallback so older systems still work. It is IPv4-only: WMI's `SetDNSServerSearchOrder`
//! has no IPv6 equivalent, which is the whole reason the migration happened. On these
//! systems the IPv6 DNS leak cannot be closed, so `crate::commands::dns` never redirects
//! IPv6 — see [`super::dns_settings::supports_ipv6_dns`].

use std::net::IpAddr;

use log::warn;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::utils::create_wmi_connection;

use super::dns_settings::Family;

/// Applies (or clears, with an empty list) the IPv4 name servers on one interface.
///
/// An IPv6 request is not an error here — the caller may legitimately try to clear both
/// families during cleanup, and failing that would turn a successful IPv4 restore into a
/// reported failure. It is logged and skipped instead.
pub fn set_interface_dns_wmi(if_index: u32, family: Family, servers: &[IpAddr]) -> AppResult<()> {
    if family == Family::V6 {
        warn!(
            "Ignoring IPv6 DNS change on interface {}: this Windows version can only \
             configure IPv4 name servers",
            if_index
        );
        return Ok(());
    }

    // WMI takes dotted-quad strings. Anything that is not IPv4 cannot be represented.
    let addresses: Vec<String> = servers
        .iter()
        .filter(|ip| ip.is_ipv4())
        .map(|ip| ip.to_string())
        .collect();
    if addresses.len() != servers.len() {
        warn!(
            "Dropped {} non-IPv4 server(s) for interface {}: unsupported on this Windows version",
            servers.len() - addresses.len(),
            if_index
        );
    }

    let wmi_con = create_wmi_connection()?;

    let query = format!(
        "SELECT * FROM Win32_NetworkAdapterConfiguration WHERE InterfaceIndex = {}",
        if_index
    );
    let result: Vec<NetworkAdapterConfigurationWmi> = wmi_con.raw_query(query).map_err(|e| {
        AppError::Wmi(format!(
            "querying adapter configuration {}: {}",
            if_index, e
        ))
    })?;

    let path = result
        .first()
        .and_then(|config| config.path.clone())
        .ok_or(AppError::InterfaceNotFound(if_index))?;

    // An empty array reverts the adapter to the DHCP-provided servers, which is exactly
    // the semantics `set_interface_dns` promises for an empty slice.
    let params = SetDnsServerSearchOrderParams {
        dns_servers: addresses,
    };

    wmi_con
        .exec_instance_method::<NetworkAdapterConfigurationWmi, _>(
            path,
            "SetDNSServerSearchOrder",
            params,
        )
        .map_err(|e| {
            AppError::Wmi(format!(
                "could not set DNS servers on interface {}: {}. This requires administrator rights.",
                if_index, e
            ))
        })
}

#[derive(Debug, Clone, Serialize)]
struct SetDnsServerSearchOrderParams {
    #[serde(rename = "DNSServerSearchOrder")]
    dns_servers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename = "Win32_NetworkAdapterConfiguration")]
#[serde(rename_all(deserialize = "PascalCase", serialize = "snake_case"))]
pub struct NetworkAdapterConfigurationWmi {
    pub interface_index: u32,
    pub description: Option<String>,
    #[serde(rename(deserialize = "__Path", serialize = "path"))]
    pub path: Option<String>,
}
