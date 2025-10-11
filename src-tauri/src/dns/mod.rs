
pub mod interface;
pub mod utils;
pub mod dns_utils;

#[tauri::command]
pub fn get_best_interface() {
    let interface = interface::get_best_interface_idx();
    let interface_idx = interface.unwrap_or(0);
    if interface_idx != 0 {
        let interface = interface::get_interface_by_index(interface_idx);
        dbg!(&interface);
    }
}

#[tauri::command]
pub fn get_interfaces() -> Vec<interface::Interface> {
    let interfaces = interface::get_all_interfaces();
    if let Ok(interfaces) = interfaces {
        interfaces
    } else {
        vec![]
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_dns(interface_idx: i8, dns_servers: Vec<String>) {
    dbg!(&interface_idx, &dns_servers);
}


#[tauri::command(rename_all = "snake_case")]
pub fn get_interface_dns_info(interface_idx: u32) -> Result<dns_utils::InterfaceDnsInfo, String> {
    let interface_idx = match interface_idx {
        0 => interface::get_best_interface_idx().unwrap_or(0),
        _ => interface_idx,
    };
       
    let result = dns_utils::get_interface_dns_info(interface_idx);
    return result;
}

