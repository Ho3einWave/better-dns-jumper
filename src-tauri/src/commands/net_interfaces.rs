use crate::net_interfaces::general;
use crate::win;
use log::error;

#[tauri::command(rename_all = "snake_case")]
pub async fn change_interface_state(interface_idx: u32, enable: bool) -> Result<(), String> {
    // Runs on a dedicated blocking thread: `COMLibrary::new()` calls
    // `CoInitializeEx(COINIT_MULTITHREADED)`, which fails with RPC_E_CHANGED_MODE if
    // the thread was already initialized into an STA (as the WebView/main thread is).
    tauri::async_runtime::spawn_blocking(move || {
        general::set_interface_enabled(interface_idx, enable)
    })
    .await
    .map_err(|e| format!("Failed to run interface state change: {}", e))?
    .map_err(|e| {
        error!("Failed to change interface state: {:?}", e);
        format!("Failed to change interface state: {}", e)
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_best_interface() -> Result<win::adapters::NetworkInterface, String> {
    let idx = win::adapters::best_interface_index()?;
    win::adapters::list_interfaces()?
        .into_iter()
        .find(|i| i.interface_index == idx)
        .ok_or_else(|| format!("Interface with index {} not found", idx))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_interfaces() -> Vec<win::adapters::NetworkInterface> {
    win::adapters::list_interfaces().unwrap_or_else(|e| {
        error!("Failed to get interfaces: {}", e);
        vec![]
    })
}
