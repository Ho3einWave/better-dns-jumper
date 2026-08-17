use crate::dns::dns_log_store::DnsLogStore;
use crate::dns::dns_rules::DnsRules;
use crate::dns::dns_types::{DnsQueryLog, DnsRule};
use crate::dns::{dns_server, dns_utils};
use crate::types::ServerTestResult;
use crate::win;
use crate::win::dns_settings::Family;
use crate::AppState;
use log::{debug, error, info, warn};
use std::net::IpAddr;
use std::sync::Arc;
use tauri_plugin_store::StoreExt;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{self, Duration, Instant};

#[tauri::command(rename_all = "snake_case")]
pub async fn test_server(
    server: String,
    domain: String,
    bootstrap_ip: Option<String>,
    bootstrap_resolver: Option<dns_server::BootstrapResolverInfo>,
) -> Result<ServerTestResult, String> {
    use hickory_proto::xfer::Protocol;
    use std::net::SocketAddr;

    // Try to detect if this is a plain IP address (plain DNS / UDP)
    let is_plain_ip = server.parse::<std::net::IpAddr>().is_ok();

    let resolver = if is_plain_ip {
        // Plain DNS over UDP
        let ip: std::net::IpAddr = server
            .parse()
            .map_err(|e| format!("Failed to parse IP: {}", e))?;
        let socket_addr = SocketAddr::new(ip, 53);

        let mut config = hickory_resolver::config::ResolverConfig::new();
        config.add_name_server(hickory_resolver::config::NameServerConfig {
            socket_addr,
            protocol: Protocol::Udp,
            tls_dns_name: None,
            http_endpoint: None,
            bind_addr: None,
            trust_negative_responses: true,
        });

        let opts = hickory_resolver::config::ResolverOpts::default();
        let connector = hickory_resolver::name_server::GenericConnector::<
            hickory_proto::runtime::TokioRuntimeProvider,
        >::default();

        hickory_resolver::Resolver::builder_with_config(config, connector)
            .with_options(opts)
            .build()
    } else {
        // URL-based protocol (https://, tls://, quic://, h3://)
        let (resolver_domain, port, proto, http_endpoint) =
            dns_server::DnsServer::parse_server_url(&server)?;

        // Priority: bootstrap_ip > bootstrap_resolver > system DNS
        let effective_ip = if bootstrap_ip.is_some() {
            bootstrap_ip
        } else if let Some(ref resolver_info) = bootstrap_resolver {
            Some(
                dns_server::DnsServer::resolve_via_bootstrap(resolver_info, &resolver_domain)
                    .await?,
            )
        } else {
            None
        };

        dns_server::DnsServer::create_dns_resolver(
            resolver_domain,
            port,
            proto,
            http_endpoint,
            effective_ip,
        )
        .map_err(|e| {
            error!("Failed to create DNS resolver: {:?}", e);
            format!("Failed to create DNS resolver: {:?}", e)
        })?
    };

    let timeout = Duration::from_secs(3);

    let start = Instant::now();
    let result = time::timeout(timeout, resolver.lookup_ip(domain.to_string())).await;
    let elapsed = start.elapsed();

    match result {
        Ok(Ok(lookup)) => {
            info!(
                "DNS lookup succeeded for {} via {} in {:?}",
                domain, server, elapsed
            );
            lookup.iter().for_each(|item| {
                debug!("Resolved: {:?}", item);
            });
            Ok(ServerTestResult {
                success: true,
                latency: elapsed.as_millis() as usize,
                error: None,
            })
        }
        Ok(Err(e)) => {
            error!(
                "DNS lookup failed for {} via {} after {:?}: {}",
                domain, server, elapsed, e
            );
            Err(format!("DNS lookup failed: {}", e))
        }
        Err(_) => {
            error!(
                "DNS lookup timed out for {} via {} after {:?}",
                domain, server, elapsed
            );
            Err(format!("DNS lookup timed out after {:?}", elapsed))
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_interface_dns_info(interface_idx: u32) -> Result<dns_utils::InterfaceDnsInfo, String> {
    let interface_idx = win::adapters::resolve_interface_index(interface_idx)?;
    dns_utils::get_interface_dns_info(interface_idx)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn set_dns(
    app_state: tauri::State<'_, Mutex<AppState>>,
    interface_index: u32,
    dns_servers: Vec<String>,
    dns_type: String,
    bootstrap_ip: Option<String>,
    bootstrap_resolver: Option<dns_server::BootstrapResolverInfo>,
) -> Result<(), String> {
    let interface_index = win::adapters::resolve_interface_index(interface_index)?;

    debug!(
        "interface_index: {}, dns_servers: {:?}, dns_type: {}",
        interface_index, dns_servers, dns_type
    );

    if dns_servers.is_empty() {
        return Err("No DNS server address was provided".to_string());
    }

    if dns_type == "doh" || dns_type == "dot" || dns_type == "doq" || dns_type == "doh3" {
        // Read the interface's IPv6 DNS state *before* changing anything, so the
        // decision below is based on what the user actually had configured.
        let needs_ipv6_redirect = win::has_real_ipv6_dns(interface_index);

        let ipv6_ready = {
            let mut app_state = app_state.lock().await;
            app_state
                .dns_server
                .run(dns_servers[0].to_string(), bootstrap_ip, bootstrap_resolver)
                .await?
        };

        win::dns_settings::set_interface_dns(
            interface_index,
            Family::V4,
            &[IpAddr::V4(win::PROXY_V4)],
        )
        .map_err(|e| format!("Failed to set IPv4 DNS: {}", e))?;

        // Close the IPv6 leak: the old WMI path (SetDNSServerSearchOrder) is IPv4-only,
        // so a dual-stack machine kept sending queries to its ISP's IPv6 resolver even
        // while "protected". Only redirect when the interface really has IPv6 DNS, and
        // only when the proxy actually managed to bind [::1]:53 — pointing IPv6 DNS at
        // a port nothing is listening on would break resolution outright.
        if needs_ipv6_redirect {
            if ipv6_ready {
                if let Err(e) = win::dns_settings::set_interface_dns(
                    interface_index,
                    Family::V6,
                    &[IpAddr::V6(win::PROXY_V6)],
                ) {
                    error!(
                        "Failed to set IPv6 DNS on interface {}: {}",
                        interface_index, e
                    );
                }
            } else {
                warn!(
                    "Interface {} has IPv6 DNS configured but the proxy could not bind [::1]:53 — IPv6 queries will bypass it",
                    interface_index
                );
            }
        }

        Ok(())
    } else if dns_type == "dns" {
        let (v4, v6): (Vec<IpAddr>, Vec<IpAddr>) = dns_servers
            .iter()
            .filter_map(|s| s.parse::<IpAddr>().ok())
            .partition(|ip| ip.is_ipv4());

        if v4.is_empty() && v6.is_empty() {
            return Err(format!(
                "None of the supplied DNS servers are valid IP addresses: {:?}",
                dns_servers
            ));
        }

        // Only touch a family we actually have servers for. Passing an empty list to
        // `set_interface_dns` reverts that family to DHCP, which would silently discard
        // the user's selection rather than apply it.
        if v4.is_empty() {
            warn!(
                "No IPv4 servers supplied for interface {} — leaving IPv4 DNS unchanged",
                interface_index
            );
        } else {
            win::dns_settings::set_interface_dns(interface_index, Family::V4, &v4)
                .map_err(|e| format!("Failed to set IPv4 DNS: {}", e))?;
        }

        if v6.is_empty() {
            debug!(
                "No IPv6 servers supplied for interface {} — IPv6 DNS left as-is (plain DNS mode can't fully close the leak without one)",
                interface_index
            );
        } else {
            win::dns_settings::set_interface_dns(interface_index, Family::V6, &v6)
                .map_err(|e| format!("Failed to set IPv6 DNS: {}", e))?;
        }

        Ok(())
    } else {
        error!("Invalid DNS type: {}", dns_type);
        Err(format!("Invalid DNS type: {}", dns_type))
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clear_dns(
    app_state: tauri::State<'_, Mutex<AppState>>,
    interface_index: u32,
) -> Result<(), String> {
    let interface_index = win::adapters::resolve_interface_index(interface_index)?;

    // Restore DNS *before* shutting the proxy down. While the interface still points at
    // 127.0.0.2 / ::1, the proxy is the only resolver it can reach — killing it first
    // and then failing the restore leaves the machine with no working DNS at all.
    let mut restore_failed = false;
    if let Err(e) = win::dns_settings::set_interface_dns(interface_index, Family::V4, &[]) {
        error!(
            "Failed to clear IPv4 DNS on interface {}: {}",
            interface_index, e
        );
        restore_failed = true;
    }
    if let Err(e) = win::dns_settings::set_interface_dns(interface_index, Family::V6, &[]) {
        debug!(
            "Failed to clear IPv6 DNS on interface {}: {} (may never have been redirected)",
            interface_index, e
        );
    }

    // `SetInterfaceDnsSettings` has historically reported success while doing nothing,
    // so verify against the adapter table rather than trusting the return code.
    if restore_failed || win::interface_uses_proxy_dns(interface_index) {
        warn!(
            "Interface {} still points at the proxy after the restore — running a full stale-DNS sweep",
            interface_index
        );
        win::clear_stale_doh_dns();
    }

    if win::interface_uses_proxy_dns(interface_index) {
        // Deliberately leave the proxy running: it is the only thing still answering
        // queries for this interface. Shutting it down here is what turns a failed
        // restore into a total DNS outage.
        return Err(format!(
            "Could not restore DNS on interface {}. The DoH proxy has been left running so name resolution keeps working — reset the DNS settings manually, then try again.",
            interface_index
        ));
    }

    debug!("shutting down dns server");
    let mut app_state = app_state.lock().await;
    app_state.dns_server.shutdown().await?;
    debug!("dns server shutdown");

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_dns_cache() -> Result<(), String> {
    let result = dns_utils::clear_dns_cache();
    return result;
}

// --- DNS Log commands ---

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dns_logs(
    log_store: tauri::State<'_, DnsLogStore>,
    filter: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<Vec<DnsQueryLog>, String> {
    Ok(log_store.get_logs(filter, offset, limit).await)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clear_dns_logs(log_store: tauri::State<'_, DnsLogStore>) -> Result<(), String> {
    log_store.clear_logs().await;
    Ok(())
}

// --- DNS Rule commands ---

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dns_rules(
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
) -> Result<Vec<DnsRule>, String> {
    let rules_guard = rules.read().await;
    Ok(rules_guard.to_vec())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_dns_rule(
    app_handle: tauri::AppHandle,
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
    rule: DnsRule,
) -> Result<(), String> {
    {
        let mut rules_guard = rules.write().await;
        rules_guard.add_rule(rule);
    }
    persist_rules(&app_handle, &rules).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_dns_rule(
    app_handle: tauri::AppHandle,
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
    id: String,
) -> Result<(), String> {
    {
        let mut rules_guard = rules.write().await;
        rules_guard.remove_rule(&id);
    }
    persist_rules(&app_handle, &rules).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn toggle_dns_rule(
    app_handle: tauri::AppHandle,
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
    id: String,
) -> Result<(), String> {
    {
        let mut rules_guard = rules.write().await;
        rules_guard.toggle_rule(&id);
    }
    persist_rules(&app_handle, &rules).await
}

async fn persist_rules(
    app_handle: &tauri::AppHandle,
    rules: &Arc<RwLock<DnsRules>>,
) -> Result<(), String> {
    let rules_vec = {
        let rules_guard = rules.read().await;
        rules_guard.to_vec()
    };

    let store = app_handle
        .store_builder("dns_rules.json")
        .build()
        .map_err(|e| format!("Failed to open rules store: {}", e))?;

    let rules_json = serde_json::to_value(&rules_vec)
        .map_err(|e| format!("Failed to serialize rules: {}", e))?;

    store.set("rules", rules_json);
    store
        .save()
        .map_err(|e| format!("Failed to save rules store: {}", e))?;

    debug!("Persisted {} DNS rules", rules_vec.len());
    Ok(())
}
