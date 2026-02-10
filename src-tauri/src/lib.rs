mod commands;
mod dns;
mod net_interfaces;
mod types;
mod utils;

use dns::dns_server::DnsServer;
use log::{debug, error, info};
use std::env::temp_dir;
use tauri_plugin_log::TargetKind;

use commands::dns::{clear_dns, clear_dns_cache, get_interface_dns_info, set_dns, test_doh_server};
use commands::net_interfaces::{change_interface_state, get_best_interface, get_interfaces};
use tauri::RunEvent;
use tauri::{Manager, WindowEvent};
use tokio::sync::Mutex;

use crate::utils::clear_stale_doh_dns;

pub struct AppState {
    pub dns_server: DnsServer,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(TargetKind::Folder {
                    path: temp_dir().join("better-dns-jumper"),
                    file_name: Some("better-dns-jumper".to_string()),
                }))
                .max_file_size(1024 * 1024 * 10) // 10MB
                .filter(|metadata| metadata.target().contains("better_dns_jumper_lib"))
                .build(),
        )
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
        .setup(|_app| {
            // Clean up stale DoH DNS (127.0.0.2) left over from a previous
            // run that didn't shut down cleanly (e.g. Windows shutdown/crash).
            clear_stale_doh_dns();
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, _event| match &_event {
            RunEvent::ExitRequested { .. } => {
                // Synchronous cleanup — no tokio dependency, completes before
                // Windows force-kills the process during shutdown.
                clear_stale_doh_dns();
            }
            RunEvent::WindowEvent {
                event: WindowEvent::CloseRequested { .. },
                label,
                ..
            } => {
                info!("closing window... {}", label);
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
