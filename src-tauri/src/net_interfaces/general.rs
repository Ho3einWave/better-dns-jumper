use crate::utils::create_wmi_connection;

use crate::utils::ipv4_to_u32;
use log::error;
use serde::{Deserialize, Serialize};
use std::net::Ipv4Addr;
use winapi::shared::{minwindef::DWORD, winerror::ERROR_SUCCESS};

use winapi::um::iphlpapi::GetBestInterface;

pub fn get_best_interface_idx() -> Result<u32, String> {
    let dest_ip = Ipv4Addr::new(8, 8, 8, 8);
    let dest_ip_u32 = ipv4_to_u32(dest_ip);

    let mut if_index: DWORD = 0;

    let result = unsafe { GetBestInterface(dest_ip_u32, &mut if_index) };

    if result != ERROR_SUCCESS {
        error!("Failed to get best interface index: {}", result);
        return Err(format!("Failed to get best interface index: {}", result));
    }
    let interface_index: u32 = if_index.into();

    return Ok(interface_index);
}

pub fn get_all_interfaces() -> Result<Vec<Interface>, String> {
    let wmi_con =
        create_wmi_connection().map_err(|e| format!("Failed to create WMI connection: {}", e))?;

    let net_adapter_query =
        format!("SELECT * FROM Win32_NetworkAdapter WHERE NetEnabled = TRUE OR NetEnabled = FALSE");

    let net_adapter_config_query = format!("SELECT * FROM Win32_NetworkAdapterConfiguration");

    let net_adapter_result: Vec<NetworkAdapterWmi> = wmi_con
        .raw_query(net_adapter_query)
        .map_err(|e| format!("Failed to get all interfaces: {}", e))?;

    let net_adapter_config_result: Vec<NetworkAdapterConfigurationWmi> = wmi_con
        .raw_query(net_adapter_config_query)
        .map_err(|e| format!("Failed to get all interfaces configuration: {}", e))?;

    let interfaces = net_adapter_result
        .iter()
        .map(|net_adapter| {
            let net_adapter_config = net_adapter_config_result.iter().find(|net_adapter_config| {
                net_adapter_config.interface_index == net_adapter.interface_index
            });

            Interface {
                adapter: net_adapter.clone(),
                config: net_adapter_config.cloned(),
            }
        })
        .collect();
    return Ok(interfaces);
}

pub fn get_interface_by_index(index: u32) -> Result<Interface, String> {
    let interfaces = get_all_interfaces()?;
    let interface = interfaces
        .iter()
        .find(|interface| interface.adapter.interface_index == index);
    if let Some(interface) = interface {
        return Ok(Interface {
            adapter: interface.adapter.clone(),
            config: interface.config.clone(),
        });
    } else {
        error!("Interface with index {} not found", index);
        return Err(format!("Interface with index {} not found", index));
    }
}

pub fn get_network_adapter_path_by_ifidx(index: u32) -> Result<String, String> {
    let wmi_connection =
        create_wmi_connection().map_err(|e| format!("Failed to create WMI connection: {}", e))?;

    let query = format!(
        "SELECT * FROM Win32_NetworkAdapter WHERE InterfaceIndex = {}",
        index
    );

    let result: Vec<NetworkAdapterWmi> = wmi_connection
        .raw_query(query)
        .map_err(|e| format!("Failed to get network adapter path: {}", e))?;

    let path = result.first().cloned().unwrap_or_default().path;

    Ok(path.unwrap_or_default())
}

pub fn change_interface_state(path: String, enable: bool) -> Result<(), String> {
    let wmi_con =
        create_wmi_connection().map_err(|e| format!("Failed to create WMI connection: {}", e))?;

    let method = if enable { "Enable" } else { "Disable" };

    let result: Result<(), wmi::WMIError> =
        wmi_con.exec_instance_method::<NetworkAdapterWmi, _>(path, method, ());

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename = "Win32_NetworkAdapter")]
#[serde(rename_all(deserialize = "PascalCase", serialize = "snake_case"))]
pub struct NetworkAdapterWmi {
    pub description: Option<String>,
    pub device_id: String,
    pub guid: Option<String>,
    pub index: u32,
    pub interface_index: u32,
    pub mac_address: Option<String>,
    pub manufacturer: Option<String>,
    #[serde(rename(deserialize = "NetConnectionID", serialize = "name"))]
    pub name: Option<String>,
    pub net_connection_id: Option<String>,
    pub net_enabled: bool,
    pub config_manager_error_code: Option<u32>,
    pub service_name: Option<String>,
    #[serde(rename(deserialize = "__Path", serialize = "path"))]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename = "Win32_NetworkAdapterConfiguration")]
#[serde(rename_all(deserialize = "PascalCase", serialize = "snake_case"))]
pub struct NetworkAdapterConfigurationWmi {
    pub default_ip_gateway: Option<Vec<String>>,
    pub description: Option<String>,
    pub dhcp_enabled: bool,
    pub dhcp_server: Option<String>,
    pub dns_host_name: Option<String>,
    pub dns_server_search_order: Option<Vec<String>>,
    pub index: u32,
    pub interface_index: u32,
    pub ip_address: Option<Vec<String>>,
    pub ip_connection_metric: Option<i16>,
    pub ip_enabled: bool,
    pub ip_subnet: Option<Vec<String>>,
    pub mac_address: Option<String>,
    #[serde(rename(deserialize = "__Path", serialize = "path"))]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(deserialize = "PascalCase", serialize = "snake_case"))]
pub struct Interface {
    pub adapter: NetworkAdapterWmi,
    pub config: Option<NetworkAdapterConfigurationWmi>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    pub ip: String,
    pub subnet: Option<String>,
    pub gateway: Option<String>,
}
