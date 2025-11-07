use crate::dns::{dns_server, dns_utils};
use crate::net_interfaces::general;
use crate::types::DoHTestResult;
use crate::AppState;
use log::{debug, error, info};
use tokio::sync::Mutex;
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
    if resolver.is_err() {
        return Err(resolver.err().unwrap());
    }
    let resolver = resolver.unwrap();
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
        0 => general::get_best_interface_idx().unwrap_or(0),
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
        let result = dns_utils::apply_dns_by_path(path, vec!["127.0.0.2".to_string()]);
        if result.is_err() {
            error!(
                "Failed to apply dns by path: {}",
                result.as_ref().err().unwrap().to_string()
            );
            return result;
        }
        return Ok(());
    } else {
        let result = dns_utils::apply_dns_by_path(path, dns_servers);
        return result;
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
