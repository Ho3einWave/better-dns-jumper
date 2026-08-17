use crate::dns::dns_log_store::DnsLogStore;
use crate::dns::dns_rules::DnsRules;
use crate::dns::dns_types::{DnsQueryLog, DnsRule};
use crate::dns::{dns_server, dns_utils};
use crate::error::{AppError, AppResult, LogErr};
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
) -> AppResult<ServerTestResult> {
    use hickory_proto::xfer::Protocol;
    use std::net::SocketAddr;

    // Try to detect if this is a plain IP address (plain DNS / UDP)
    let is_plain_ip = server.parse::<std::net::IpAddr>().is_ok();

    let resolver = if is_plain_ip {
        // Plain DNS over UDP
        let ip: std::net::IpAddr = server
            .parse()
            .map_err(|_| AppError::invalid(format!("\"{}\" is not a valid IP address.", server)))?;
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
            AppError::Resolver(format!("could not build a resolver for {}: {}", server, e))
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
            warn!(
                "DNS lookup failed for {} via {} after {:?}: {}",
                domain, server, elapsed, e
            );
            Err(AppError::Resolver(format!(
                "{} could not resolve {}: {}",
                server, domain, e
            )))
        }
        Err(_) => {
            warn!(
                "DNS lookup timed out for {} via {} after {:?}",
                domain, server, elapsed
            );
            Err(AppError::Resolver(format!(
                "{} did not answer within {:?}.",
                server, timeout
            )))
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_interface_dns_info(interface_idx: u32) -> AppResult<dns_utils::InterfaceDnsInfo> {
    let interface_idx = win::adapters::resolve_interface_index(interface_idx)?;
    dns_utils::get_interface_dns_info(interface_idx).log_err("get_interface_dns_info")
}

#[tauri::command(rename_all = "snake_case")]
pub async fn set_dns(
    app_state: tauri::State<'_, Mutex<AppState>>,
    interface_index: u32,
    dns_servers: Vec<String>,
    dns_type: String,
    bootstrap_ip: Option<String>,
    bootstrap_resolver: Option<dns_server::BootstrapResolverInfo>,
) -> AppResult<()> {
    set_dns_inner(
        app_state,
        interface_index,
        dns_servers,
        dns_type,
        bootstrap_ip,
        bootstrap_resolver,
    )
    .await
    .log_err("set_dns")
}

async fn set_dns_inner(
    app_state: tauri::State<'_, Mutex<AppState>>,
    interface_index: u32,
    dns_servers: Vec<String>,
    dns_type: String,
    bootstrap_ip: Option<String>,
    bootstrap_resolver: Option<dns_server::BootstrapResolverInfo>,
) -> AppResult<()> {
    let interface_index = win::adapters::resolve_interface_index(interface_index)?;

    debug!(
        "set_dns: interface={}, type={}, servers={:?}",
        interface_index, dns_type, dns_servers
    );

    if dns_servers.is_empty() {
        return Err(AppError::invalid(
            "No DNS server address was provided.".to_string(),
        ));
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
        )?;

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

        info!(
            "Applied {} DNS on interface {} via the local proxy (IPv6 redirect: {})",
            dns_type.to_uppercase(),
            interface_index,
            if needs_ipv6_redirect && ipv6_ready {
                "on"
            } else {
                "off"
            }
        );
        Ok(())
    } else if dns_type == "dns" {
        let (v4, v6): (Vec<IpAddr>, Vec<IpAddr>) = dns_servers
            .iter()
            .filter_map(|s| s.parse::<IpAddr>().ok())
            .partition(|ip| ip.is_ipv4());

        if v4.is_empty() && v6.is_empty() {
            return Err(AppError::invalid(format!(
                "None of the supplied DNS servers are valid IP addresses: {}.",
                dns_servers.join(", ")
            )));
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
            win::dns_settings::set_interface_dns(interface_index, Family::V4, &v4)?;
        }

        if v6.is_empty() {
            debug!(
                "No IPv6 servers supplied for interface {} — IPv6 DNS left as-is (plain DNS mode can't fully close the leak without one)",
                interface_index
            );
        } else {
            win::dns_settings::set_interface_dns(interface_index, Family::V6, &v6)?;
        }

        info!(
            "Applied plain DNS on interface {} ({} IPv4, {} IPv6 server(s))",
            interface_index,
            v4.len(),
            v6.len()
        );
        Ok(())
    } else {
        Err(AppError::invalid(format!(
            "\"{}\" is not a supported DNS type. Expected one of: dns, doh, dot, doq, doh3.",
            dns_type
        )))
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clear_dns(
    app_state: tauri::State<'_, Mutex<AppState>>,
    interface_index: u32,
) -> AppResult<()> {
    clear_dns_inner(app_state, interface_index)
        .await
        .log_err("clear_dns")
}

async fn clear_dns_inner(
    app_state: tauri::State<'_, Mutex<AppState>>,
    interface_index: u32,
) -> AppResult<()> {
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
        return Err(AppError::Proxy(format!(
            "Could not restore the original DNS settings on interface {}. The local proxy has been left running so name resolution keeps working — reset the adapter's DNS to automatic, then try again.",
            interface_index
        )));
    }

    debug!("Restoring DNS succeeded; shutting the local proxy down");
    let mut app_state = app_state.lock().await;
    app_state
        .dns_server
        .shutdown()
        .await
        .map_err(AppError::Proxy)?;

    info!(
        "Cleared DNS on interface {} and stopped the proxy",
        interface_index
    );
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_dns_cache() -> AppResult<()> {
    dns_utils::clear_dns_cache().log_err("clear_dns_cache")
}

// --- DNS Log commands ---

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dns_logs(
    log_store: tauri::State<'_, DnsLogStore>,
    filter: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> AppResult<Vec<DnsQueryLog>> {
    Ok(log_store.get_logs(filter, offset, limit).await)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clear_dns_logs(log_store: tauri::State<'_, DnsLogStore>) -> AppResult<()> {
    log_store.clear_logs().await;
    debug!("DNS query log buffer cleared");
    Ok(())
}

// --- DNS Rule commands ---

#[tauri::command(rename_all = "snake_case")]
pub async fn get_dns_rules(
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
) -> AppResult<Vec<DnsRule>> {
    let rules_guard = rules.read().await;
    Ok(rules_guard.to_vec())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_dns_rule(
    app_handle: tauri::AppHandle,
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
    rule: DnsRule,
) -> AppResult<()> {
    {
        let mut rules_guard = rules.write().await;
        rules_guard.add_rule(rule);
    }
    persist_rules(&app_handle, &rules)
        .await
        .log_err("save_dns_rule")
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_dns_rule(
    app_handle: tauri::AppHandle,
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
    id: String,
) -> AppResult<()> {
    {
        let mut rules_guard = rules.write().await;
        rules_guard.remove_rule(&id);
    }
    persist_rules(&app_handle, &rules)
        .await
        .log_err("delete_dns_rule")
}

#[tauri::command(rename_all = "snake_case")]
pub async fn toggle_dns_rule(
    app_handle: tauri::AppHandle,
    rules: tauri::State<'_, Arc<RwLock<DnsRules>>>,
    id: String,
) -> AppResult<()> {
    {
        let mut rules_guard = rules.write().await;
        rules_guard.toggle_rule(&id);
    }
    persist_rules(&app_handle, &rules)
        .await
        .log_err("toggle_dns_rule")
}

async fn persist_rules(
    app_handle: &tauri::AppHandle,
    rules: &Arc<RwLock<DnsRules>>,
) -> AppResult<()> {
    let rules_vec = {
        let rules_guard = rules.read().await;
        rules_guard.to_vec()
    };

    let store = app_handle
        .store_builder("dns_rules.json")
        .build()
        .map_err(|e| AppError::Store(format!("could not open dns_rules.json: {}", e)))?;

    let rules_json = serde_json::to_value(&rules_vec)?;

    store.set("rules", rules_json);
    store
        .save()
        .map_err(|e| AppError::Store(format!("could not write dns_rules.json: {}", e)))?;

    debug!("Persisted {} DNS rules", rules_vec.len());
    Ok(())
}
