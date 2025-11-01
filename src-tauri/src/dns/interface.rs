use serde::{Deserialize, Serialize};
use winapi::shared::{minwindef::DWORD, winerror::ERROR_SUCCESS};

use super::utils::ipv4_to_u32;
use std::net::Ipv4Addr;

use network_interface::{NetworkInterface, NetworkInterfaceConfig};
use winapi::um::iphlpapi::GetBestInterface;

pub fn get_best_interface_idx() -> Result<u32, String> {
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

pub fn get_all_interfaces() -> Result<Vec<Interface>, String> {
    let interfaces = NetworkInterface::show();
    if let Ok(interfaces) = interfaces {
        return Ok(interfaces
            .iter()
            .map(|interface| Interface {
                name: interface.name.clone(),
                index: interface.index,
                mac: interface.mac_addr.clone(),
                addrs: interface
                    .addr
                    .iter()
                    .map(|addr| Address {
                        ip: addr.ip().to_string(),
                        subnet: addr.netmask().map(|netmask| netmask.to_string()),
                        gateway: addr.broadcast().map(|broadcast| broadcast.to_string()),
                    })
                    .collect(),
            })
            .collect());
    } else {
        return Err(format!("error: {}", interfaces.err().unwrap()));
    }
}

pub fn get_interface_by_index(index: u32) -> Result<Interface, String> {
    let interfaces = get_all_interfaces()?;
    let interface = interfaces.iter().find(|interface| interface.index == index);
    if let Some(interface) = interface {
        return Ok(Interface {
            name: interface.name.clone(),
            index: interface.index,
            mac: interface.mac.clone(),
            addrs: interface
                .addrs
                .iter()
                .map(|addr| Address {
                    ip: addr.ip.clone(),
                    subnet: addr.subnet.clone(),
                    gateway: addr.gateway.clone(),
                })
                .collect(),
        });
    } else {
        return Err(format!("interface not found"));
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interface {
    pub name: String,
    pub index: u32,
    pub mac: Option<String>,
    pub addrs: Vec<Address>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    pub ip: String,
    pub subnet: Option<String>,
    pub gateway: Option<String>,
}
