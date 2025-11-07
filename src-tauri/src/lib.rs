mod commands;
mod dns;
mod net_interfaces;
mod types;
mod utils;

use dns::dns_server::DnsServer;

use commands::dns::{clear_dns, clear_dns_cache, get_interface_dns_info, set_dns, test_doh_server};
use commands::net_interfaces::{change_interface_state, get_best_interface, get_interfaces};

use tokio::sync::Mutex;

pub struct AppState {
    pub dns_server: DnsServer,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {}))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_best_interface,
            get_interfaces,
            set_dns,
            get_interface_dns_info,
            clear_dns,
            clear_dns_cache,
            test_doh_server,
            change_interface_state,
        ])
        .manage(Mutex::new(AppState {
            dns_server: DnsServer::new(),
        }))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
