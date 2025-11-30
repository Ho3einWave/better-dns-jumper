mod commands;
mod dns;
mod net_interfaces;
mod types;
mod utils;

use dns::dns_server::DnsServer;
use log::{debug, error};

use commands::dns::{clear_dns, clear_dns_cache, get_interface_dns_info, set_dns, test_doh_server};
use commands::net_interfaces::{change_interface_state, get_best_interface, get_interfaces};
use tauri::RunEvent;
use tauri::{Manager, WindowEvent};
use tokio::sync::{oneshot, Mutex};

use crate::utils::clear_dns_on_exit;

pub struct AppState {
    pub dns_server: DnsServer,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let main_window = app.get_webview_window("main");
            match main_window {
                Some(window) => {
                    debug!("Main window found");
                    let _ = window.set_focus();
                }
                None => {
                    error!("Failed to get main window");
                }
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(prevent_default())
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, _event| match &_event {
            RunEvent::ExitRequested { .. } => {
                let app_handle = _app_handle.clone();
                let (tx, rx) = oneshot::channel();
                tokio::spawn(async move {
                    let app_state = app_handle.state::<Mutex<AppState>>();
                    let mut guard = app_state.lock().await;
                    if guard.dns_server.is_running().await {
                        let result =
                            guard.dns_server.shutdown().await.map_err(|e| {
                                format!("Error while shutting down DNS server: {}", e)
                            });

                        if result.is_err() {
                            error!("Error while shutting down DNS server: {:?}", result.err());
                        }

                        let result = clear_dns_on_exit()
                            .map_err(|e| format!("Error while clearing DNS: {}", e));
                        let _ = tx.send(result);
                    } else {
                        let _ = tx.send(Ok(()));
                    }
                });

                let result = futures::executor::block_on(rx)
                    .expect("error waiting for cleanup channel")
                    .map_err(|e| format!("Error while clearing DNS: {}", e));
                match result {
                    Ok(_) => {
                        debug!("DNS cleared successfully");
                    }
                    Err(e) => {
                        error!("Error while clearing DNS: {}", e);
                    }
                }
            }
            RunEvent::WindowEvent {
                event: WindowEvent::CloseRequested { .. },
                label,
                ..
            } => {
                println!("closing window... {}", label);
            }
            _ => (),
        })
}

#[cfg(debug_assertions)]
fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    use tauri_plugin_prevent_default::Flags;

    tauri_plugin_prevent_default::Builder::new()
        .with_flags(Flags::all().difference(Flags::DEV_TOOLS | Flags::RELOAD))
        .build()
}

#[cfg(not(debug_assertions))]
fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_prevent_default::init()
}
