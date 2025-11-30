use log::error;
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
            error!("WMI connection failed: {:?}", e);
            let error_msg = format!("WMI connection failed: {:?}", e);
            return Err(error_msg);
        }
    };

    Ok(wmi_con)
}

pub fn clear_dns_on_exit() -> Result<(), String> {
    let best_interface_idx = get_best_interface_idx()?;
    let interface = get_interface_by_index(best_interface_idx)?;
    let net_config = interface
        .config
        .ok_or("Failed to get network configuration")?;
    let path = net_config.path.ok_or("Failed to get network path")?;

    clear_dns_by_path(path)?;
    Ok(())
}
