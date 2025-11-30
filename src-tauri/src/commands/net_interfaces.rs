use crate::net_interfaces::general;
use log::error;

#[tauri::command(rename_all = "snake_case")]
pub fn change_interface_state(interface_idx: u32, enable: bool) -> Result<(), String> {
    let path = general::get_network_adapter_path_by_ifidx(interface_idx)
        .map_err(|e| format!("Failed to get network adapter path: {}", e))?;

    let result = general::change_interface_state(path, enable);
    match result {
        Ok(_) => Ok(()),
        Err(e) => {
            error!("Failed to change interface state: {:?}", e);
            Err(format!("Failed to change interface state: {}", e))
        }
    }
}

#[tauri::command]
pub fn get_best_interface() {
    let interface = general::get_best_interface_idx();
    let interface_idx = interface.unwrap_or(0);
    if interface_idx != 0 {
        let interface = general::get_interface_by_index(interface_idx);
        dbg!(&interface);
    }
}

#[tauri::command]
pub fn get_interfaces() -> Vec<general::Interface> {
    let interfaces = general::get_all_interfaces();
    match interfaces {
        Ok(interfaces) => interfaces,
        Err(e) => {
            dbg!(&e);
            vec![]
        }
    }
}
