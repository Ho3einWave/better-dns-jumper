use std::net::Ipv4Addr;

use wmi::{COMLibrary, WMIConnection};

use crate::{
    dns::dns_utils::clear_dns_by_path,
    net_interfaces::general::{get_best_interface_idx, get_interface_by_index},
};

pub fn ipv4_to_u32(ipv4: Ipv4Addr) -> u32 {
    ipv4.into()
}

pub fn create_wmi_connection() -> Result<WMIConnection, String> {
    let com_con = unsafe { COMLibrary::assume_initialized() };
    let wmi_con = match WMIConnection::new(com_con) {
        Ok(wmi) => wmi,
        Err(e) => {
            let error_msg = format!("WMI connection failed: {}", e);

            return Err(error_msg);
        }
    };

    Ok(wmi_con)
}

pub fn clear_dns_on_exit() -> Result<(), String> {
    let best_interface_idx = get_best_interface_idx().unwrap();
    let interface = get_interface_by_index(best_interface_idx).unwrap();
    let path = interface.config.unwrap().path.unwrap();

    clear_dns_by_path(path).unwrap();
    Ok(())
}
