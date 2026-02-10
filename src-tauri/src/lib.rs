mod commands;
mod dns;
mod net_interfaces;
mod types;
mod utils;

use dns::dns_log_store::DnsLogStore;
use dns::dns_rules::DnsRules;
use dns::dns_server::DnsServer;
use dns::dns_types::DnsRule;
use log::{debug, error, info};
use std::env::temp_dir;
use std::sync::Arc;
use tauri_plugin_log::TargetKind;
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::StateFlags;

use commands::dns::{
    clear_dns, clear_dns_cache, clear_dns_logs, delete_dns_rule, get_dns_logs, get_dns_rules,
    get_interface_dns_info, save_dns_rule, set_dns, test_doh_server, toggle_dns_rule,
};
use commands::net_interfaces::{change_interface_state, get_best_interface, get_interfaces};
use tauri::RunEvent;
use tauri::{Manager, WindowEvent};
use tokio::sync::{Mutex, RwLock};

use crate::utils::clear_stale_doh_dns;

pub struct AppState {
    pub dns_server: DnsServer,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rules = Arc::new(RwLock::new(DnsRules::new()));

    // DnsLogStore::new() spawns a tokio task, so we need a runtime.
    // Tauri's setup hook runs inside a tokio context, so we defer creation there.
    // Instead, we'll create the log store inside a runtime or pass a channel.
    // Actually, the simplest approach: create a tokio runtime briefly for initialization,
    // or restructure to create log store in setup. Let's use setup.

    // We need the log_sender for DnsServer, but DnsLogStore needs tokio.
    // Solution: create a channel pair manually, create DnsLogStore in setup.
    let (log_sender, log_receiver) = tokio::sync::mpsc::unbounded_channel();

    let rules_clone = rules.clone();

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
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
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
            get_dns_logs,
            clear_dns_logs,
            get_dns_rules,
            save_dns_rule,
            delete_dns_rule,
            toggle_dns_rule,
        ])
        .manage(Mutex::new(AppState {
            dns_server: DnsServer::new(log_sender, rules.clone()),
        }))
        .manage(rules.clone())
        .setup(move |app| {
            // Clean up stale DoH DNS (127.0.0.2) left over from a previous
            // run that didn't shut down cleanly (e.g. Windows shutdown/crash).
            clear_stale_doh_dns();

            // Create and manage the log store, starting the receiver task
            let log_store = DnsLogStore::from_receiver(log_receiver);
            app.manage(log_store);

            // Load persisted rules from store
            let rules_for_setup = rules_clone.clone();
            if let Ok(store) = app.store_builder("dns_rules.json").build() {
                if let Some(rules_value) = store.get("rules") {
                    if let Ok(persisted_rules) = serde_json::from_value::<Vec<DnsRule>>(rules_value)
                    {
                        info!("Loaded {} DNS rules from store", persisted_rules.len());
                        // Use blocking since we're in setup (sync context)
                        let rt = tokio::runtime::Handle::current();
                        rt.block_on(async {
                            let mut rules_guard = rules_for_setup.write().await;
                            rules_guard.load_rules(persisted_rules);
                        });
                    }
                }
            }

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
