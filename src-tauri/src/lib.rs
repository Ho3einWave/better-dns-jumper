mod commands;
mod dns;
mod error;
mod logging;
mod net_interfaces;
mod types;
mod utils;
mod win;

use dns::dns_log_store::DnsLogStore;
use dns::dns_rules::DnsRules;
use dns::dns_server::DnsServer;
use dns::dns_types::DnsRule;
use log::{debug, error, info};
use std::sync::Arc;
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::StateFlags;

use commands::app_logs::{clear_app_logs, get_app_logs, get_log_file_path, open_log_dir};
use commands::dns::{
    clear_dns, clear_dns_cache, clear_dns_logs, delete_dns_rule, get_dns_logs, get_dns_rules,
    get_interface_dns_info, save_dns_rule, set_dns, test_server, toggle_dns_rule,
};
use commands::net_interfaces::{change_interface_state, get_best_interface, get_interfaces};
use tauri::RunEvent;
use tauri::{Manager, WindowEvent};
use tokio::sync::{Mutex, RwLock};

use crate::win::clear_stale_doh_dns;

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
        .plugin(logging::plugin())
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
            test_server,
            change_interface_state,
            get_dns_logs,
            clear_dns_logs,
            get_dns_rules,
            save_dns_rule,
            delete_dns_rule,
            toggle_dns_rule,
            get_app_logs,
            clear_app_logs,
            get_log_file_path,
            open_log_dir,
        ])
        .manage(Mutex::new(AppState {
            dns_server: DnsServer::new(log_sender, rules.clone()),
        }))
        .manage(rules.clone())
        .setup(move |app| {
            info!(
                "Better DNS Jumper {} starting — logging to {}",
                env!("CARGO_PKG_VERSION"),
                logging::log_file().display()
            );

            // Clean up stale DoH DNS (127.0.0.2) left over from a previous
            // run that didn't shut down cleanly (e.g. Windows shutdown/crash).
            clear_stale_doh_dns();

            // Create and manage the log store, starting the receiver task
            let log_store = DnsLogStore::from_receiver(log_receiver);
            app.manage(log_store);

            // Load persisted rules from store.
            //
            // This hook is NOT a plain sync context: `main` is `#[tokio::main]` and Tauri
            // runs `setup` from the event loop's `Ready` event on that same thread, so we
            // are inside a tokio async context. Any blocking acquisition here panics —
            // `Handle::block_on` and `RwLock::blocking_write` both refuse to block a
            // thread that is driving async tasks. That is what made the app die on launch
            // as soon as the user had saved a single rule.
            //
            // `try_write` never blocks. Nothing else can realistically hold the lock this
            // early, but if it does we fall back to an async write rather than dropping
            // the user's rules on the floor.
            let rules_for_setup = rules_clone.clone();
            match app.store_builder("dns_rules.json").build() {
                Ok(store) => match store.get("rules") {
                    Some(rules_value) => {
                        match serde_json::from_value::<Vec<DnsRule>>(rules_value) {
                            Ok(persisted_rules) => {
                                info!("Loading {} DNS rules from store", persisted_rules.len());
                                // Separate handle: the `try_write()` scrutinee keeps
                                // `rules_for_setup` borrowed across every arm of the
                                // match, so it can't be moved into the deferred task.
                                let rules_deferred = rules_for_setup.clone();
                                match rules_for_setup.try_write() {
                                    Ok(mut rules_guard) => rules_guard.load_rules(persisted_rules),
                                    Err(_) => {
                                        debug!("DNS rules lock busy during setup, deferring load");
                                        tokio::spawn(async move {
                                            rules_deferred
                                                .write()
                                                .await
                                                .load_rules(persisted_rules);
                                        });
                                    }
                                }
                            }
                            Err(e) => error!("Failed to parse persisted DNS rules: {}", e),
                        }
                    }
                    None => debug!("No persisted DNS rules found"),
                },
                Err(e) => error!("Failed to open DNS rules store: {}", e),
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, _event| match &_event {
            RunEvent::ExitRequested { .. } => {
                info!("Exit requested — restoring DNS settings before shutdown");
                // Synchronous cleanup — no tokio dependency, completes before
                // Windows force-kills the process during shutdown.
                clear_stale_doh_dns();
            }
            RunEvent::WindowEvent {
                event: WindowEvent::CloseRequested { .. },
                label,
                ..
            } => {
                debug!("Window '{}' close requested", label);
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
