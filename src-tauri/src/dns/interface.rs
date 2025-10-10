use winapi::shared::{minwindef::DWORD, winerror::ERROR_SUCCESS};

use super::utils::ipv4_to_u32;
use std::net::Ipv4Addr;

use network_interface::{NetworkInterface, NetworkInterfaceConfig};
use winapi::um::iphlpapi::GetBestInterface;

pub fn get_best_interface() -> Result<u32, String> {
    let dest_ip = Ipv4Addr::new(8, 8, 8, 8);
    let dest_ip_u32 = ipv4_to_u32(dest_ip);

    let mut if_index: DWORD = 0;

    let result = unsafe { GetBestInterface(dest_ip_u32, &mut if_index) };

    if result == ERROR_SUCCESS {
        println!("if_index: {}", if_index);
    } else {
        println!("error: {}", result);
        return Err(format!("error: {}", result));
    }
    let interface_index: u32 = if_index.into();

    return Ok(interface_index);
}

pub fn get_all_interfaces() -> Result<Vec<NetworkInterface>, String> {
    let interfaces = NetworkInterface::show();
    if let Ok(interfaces) = interfaces {
        return Ok(interfaces);
    } else {
        return Err(format!("error: {}", interfaces.err().unwrap()));
    }
}

pub fn get_interface_by_index(index: u32) -> Result<NetworkInterface, String> {
    let interfaces = get_all_interfaces()?;
    let interface = interfaces.iter().find(|interface| interface.index == index);
    if let Some(interface) = interface {
        return Ok(interface.clone());
    } else {
        return Err(format!("interface not found"));
    }
}
