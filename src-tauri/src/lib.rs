mod dns;

#[tauri::command]
fn get_best_interface() {
    let interface = dns::interface::get_best_interface();
    let interface_idx = interface.unwrap_or(0);
    if interface_idx != 0 {
        let interface = dns::interface::get_interface_by_index(interface_idx);
        dbg!(&interface);
    }
    // let interfaces = dns::interface::get_all_interfaces();
    // if let Ok(interfaces) = interfaces {
    //     for interface in interfaces {
    //         dbg!(&interface);
    //     }
    // }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_best_interface])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
