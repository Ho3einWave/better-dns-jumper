use tokio::sync::Mutex;

use crate::AppState;
use log::{debug, error};

pub mod dns_server;
pub mod dns_utils;
pub mod interface;
pub mod utils;

#[tauri::command]
pub fn get_best_interface() {
    let interface = interface::get_best_interface_idx();
    let interface_idx = interface.unwrap_or(0);
    if interface_idx != 0 {
        let interface = interface::get_interface_by_index(interface_idx);
        dbg!(&interface);
    }
}

#[tauri::command]
pub fn get_interfaces() -> Vec<interface::Interface> {
    let interfaces = interface::get_all_interfaces();
    if let Ok(interfaces) = interfaces {
        interfaces
    } else {
        vec![]
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_interface_dns_info(interface_idx: u32) -> Result<dns_utils::InterfaceDnsInfo, String> {
    let interface_idx = match interface_idx {
        0 => interface::get_best_interface_idx().unwrap_or(0),
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
