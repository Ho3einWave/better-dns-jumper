use crate::error::{AppError, AppResult, LogErr};
use crate::net_interfaces::general;
use crate::win;
use log::info;

#[tauri::command(rename_all = "snake_case")]
pub async fn change_interface_state(interface_idx: u32, enable: bool) -> AppResult<()> {
    // Runs on a dedicated blocking thread: `COMLibrary::new()` calls
    // `CoInitializeEx(COINIT_MULTITHREADED)`, which fails with RPC_E_CHANGED_MODE if
    // the thread was already initialized into an STA (as the WebView/main thread is).
    let result = tauri::async_runtime::spawn_blocking(move || {
        general::set_interface_enabled(interface_idx, enable)
    })
    .await
    .map_err(|e| AppError::Task(e.to_string()))?
    .log_err("change_interface_state");

    if result.is_ok() {
        info!(
            "{} network interface {}",
            if enable { "Enabled" } else { "Disabled" },
            interface_idx
        );
    }
    result
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_best_interface() -> AppResult<win::adapters::NetworkInterface> {
    let idx = win::adapters::best_interface_index()?;
    win::adapters::list_interfaces()?
        .into_iter()
        .find(|i| i.interface_index == idx)
        .ok_or(AppError::InterfaceNotFound(idx))
        .log_err("get_best_interface")
}

/// Returns an empty list rather than an error when enumeration fails.
///
/// This is polled by the UI every few seconds; surfacing a toast on each transient
/// failure would be worse than showing nothing, so the error is logged and swallowed
/// here deliberately.
#[tauri::command(rename_all = "snake_case")]
pub fn get_interfaces() -> Vec<win::adapters::NetworkInterface> {
    win::adapters::list_interfaces()
        .log_err("get_interfaces")
        .unwrap_or_default()
}
