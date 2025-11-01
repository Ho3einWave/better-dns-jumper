use serde::{Deserialize, Serialize};

#[link(name = "dnsapi")]
extern "system" {
    fn DnsFlushResolverCache() -> i32;
}

pub fn get_interface_dns_info(interface_idx: u32) -> Result<InterfaceDnsInfo, String> {
    let interface_info = super::interface::get_interface_by_index(interface_idx);
    let wmi_con = super::utils::create_wmi_connection()
        .map_err(|e| format!("WMI connection failed: {}", e))?;

    let query = format!(
        "SELECT * FROM Win32_NetworkAdapterConfiguration WHERE InterfaceIndex = {}",
        interface_idx
    );

    let result: Result<Vec<InterfaceInfoWmi>, String> = wmi_con
        .raw_query(query)
        .map_err(|e| format!("WMI query failed: {}", e));

    let interface_dns_info: Result<InterfaceDnsInfo, String> = match result {
        Ok(result) => {
            if result.is_empty() {
                Err(format!("No interface found"))
            } else {
                let interface_info_wmi = result.first().cloned().unwrap_or_default();
                let interface_info = match interface_info {
                    Ok(interface_info) => interface_info,
                    Err(e) => return Err(e),
                };
                Ok(InterfaceDnsInfo {
                    interface_index: interface_info_wmi.interface_index,
                    dns_servers: interface_info_wmi.dns_server_search_order.clone(),
                    interface_name: interface_info.name,
                    path: interface_info_wmi.path,
                })
            }
        }
        Err(e) => Err(e),
    };

    return interface_dns_info;
}

// TODO: Change this method to use native windows api instead of wmi on windows 8+ or newer
pub fn apply_dns_by_path(path: String, dns_servers: Vec<String>) -> Result<(), String> {
    let wmi_con = super::utils::create_wmi_connection()
        .map_err(|e| format!("WMI connection failed: {}", e))?;

    let params = SetDNSServerParams { dns_servers };

    let result: Result<(), wmi::WMIError> = wmi_con.exec_instance_method::<InterfaceInfoWmi, _>(
        path,
        "SetDNSServerSearchOrder",
        params,
    );

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn clear_dns_by_path(path: String) -> Result<(), String> {
    let wmi_con = super::utils::create_wmi_connection()
        .map_err(|e| format!("WMI connection failed: {}", e))?;

    let params = SetDNSServerParams {
        dns_servers: vec![],
    };

    let result: Result<(), wmi::WMIError> = wmi_con.exec_instance_method::<InterfaceInfoWmi, _>(
        path,
        "SetDNSServerSearchOrder",
        params,
    );

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn clear_dns_cache() -> Result<(), String> {
    unsafe {
        let result = DnsFlushResolverCache();

        println!("result: {}", result);
        match result {
            1 => Ok(()),
            _ => Err(format!("Failed to clear DNS cache")),
        }
    }
}

#[derive(Serialize, Debug)]
struct SetDNSServerParams {
    #[serde(rename = "DNSServerSearchOrder")]
    dns_servers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename = "Win32_NetworkAdapterConfiguration")]
#[serde(rename_all = "PascalCase")]
pub struct InterfaceInfoWmi {
    description: String,
    dns_server_search_order: Vec<String>,
    interface_index: u32,
    #[serde(rename = "IPConnectionMetric")]
    ip_connection_metric: Option<i16>,
    #[serde(rename = "__Path")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InterfaceDnsInfo {
    interface_index: u32,
    dns_servers: Vec<String>,
    interface_name: String,
    pub path: Option<String>,
}
