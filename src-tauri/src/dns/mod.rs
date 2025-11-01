use rustls::lock::Mutex;

use crate::AppState;

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
pub fn set_dns(
    app_state: tauri::State<Mutex<AppState>>,
    path: String,
    dns_servers: Vec<String>,
    dns_type: String,
) -> Result<(), String> {
    println!("app_state: {:?}", app_state);
    println!(
        "path: {}, dns_servers: {:?}, dns_type: {}",
        path, dns_servers, dns_type
    );
    if dns_type == "doh" {
        let mut app_state = app_state.lock().unwrap();
        let result =
            app_state
                .dns_server
                .create_dns_resolver("dns.dynx.pro".to_string(), 443, None);
        return Err("Doh is not supported yet".to_string());
    } else {
        let result = dns_utils::apply_dns_by_path(path, dns_servers);
        return result;
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_dns(path: String) -> Result<(), String> {
    let result = dns_utils::clear_dns_by_path(path);
    return result;
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_dns_cache() -> Result<(), String> {
    let result = dns_utils::clear_dns_cache();
    return result;
}
