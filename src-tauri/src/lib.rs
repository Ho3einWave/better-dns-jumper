mod dns;

#[tauri::command]
fn get_best_interface() {
    let interface = dns::interface::get_best_interface();
    let interface_idx = interface.unwrap_or(0);
    if interface_idx != 0 {
        let interface = dns::interface::get_interface_by_index(interface_idx);
        dbg!(&interface);
    }
}

#[tauri::command]
fn get_interfaces() -> Vec<dns::interface::Interface> {
    let interfaces = dns::interface::get_all_interfaces();
    if let Ok(interfaces) = interfaces {
        dbg!(&interfaces);
        interfaces
    } else {
        vec![]
    }
}

#[tauri::command(rename_all = "snake_case")]
fn set_dns(interface_idx: i8, dns_servers: Vec<String>) {
    dbg!(&interface_idx, &dns_servers);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_best_interface, get_interfaces, set_dns])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
