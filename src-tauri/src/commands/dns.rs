use crate::dns::dns_log_store::DnsLogStore;
use crate::dns::dns_rules::DnsRules;
use crate::dns::dns_types::{DnsQueryLog, DnsRule};
use crate::dns::{dns_server, dns_utils};
use crate::net_interfaces::general;
use crate::types::DoHTestResult;
use crate::AppState;
use log::{debug, error, info};
use std::sync::Arc;
use tauri_plugin_store::StoreExt;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{self, Duration, Instant};

#[tauri::command(rename_all = "snake_case")]
pub async fn test_doh_server(server: String, domain: String) -> Result<DoHTestResult, String> {
    let server_url =
        url::Url::parse(&server).map_err(|e| format!("Failed to parse server: {}", e))?;

    let protocol = server_url.scheme();
    if protocol != "https" {
        error!("Invalid protocol: {}", protocol);
        return Err(format!("Invalid protocol: {}", protocol));
    }

    let resolver_domain = server_url.host().ok_or("Failed to get domain")?;
    let port = server_url.port().unwrap_or(443);
    let path = server_url.path();
    let resolver = dns_server::DnsServer::create_dns_resolver(
        resolver_domain.to_string(),
        port,
        Some(path.to_string()),
    );

    let resolver = match resolver {
        Ok(resolver) => resolver,
        Err(e) => {
            error!("Failed to create DNS resolver: {:?}", e);
            return Err(format!("Failed to create DNS resolver: {:?}", e));
        }
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
                dbg!(&item);
            });
            Ok(DoHTestResult {
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
    let interface_idx = match interface_idx {
        0 => general::get_best_interface_idx()
            .map_err(|e| format!("Failed to get best interface index: {}", e))?,
        _ => interface_idx,
    };
    let result = dns_utils::get_interface_dns_info(interface_idx);
    return result;
}

#[tauri::command(rename_all = "snake_case")]
pub async fn set_dns(
    app_state: tauri::State<'_, Mutex<AppState>>,
    path: String,
    dns_servers: Vec<String>,
    dns_type: String,
) -> Result<(), String> {
    debug!(
        "path: {}, dns_servers: {:?}, dns_type: {}",
        path, dns_servers, dns_type
    );
    if dns_type == "doh" {
        let mut app_state = app_state.lock().await;
        app_state.dns_server.run(dns_servers[0].to_string()).await?;

        dns_utils::apply_dns_by_path(path, vec!["127.0.0.2".to_string()])
            .map_err(|e| format!("Failed to apply dns by path: {}", e))?;

        return Ok(());
    } else if dns_type == "dns" {
        let result = dns_utils::apply_dns_by_path(path, dns_servers);
        return result;
    } else {
        error!("Invalid DNS type: {}", dns_type);
        todo!()
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clear_dns(
    app_state: tauri::State<'_, Mutex<AppState>>,
    path: String,
) -> Result<(), String> {
    debug!("getting app state");
    let mut app_state = app_state.lock().await;
    debug!("shutting down dns server");
    app_state.dns_server.shutdown().await?;
    debug!("dns server shutdown");
    debug!("clearing dns for path: {}", path);
    let result = dns_utils::clear_dns_by_path(path);
    debug!("dns cleared");
    return result;
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
