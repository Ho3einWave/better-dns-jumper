use serde::{Deserialize, Serialize};

pub fn get_interface_dns_info(interface_idx: u32) -> Result<InterfaceDnsInfo, String> {
    let interface_info = super::interface::get_interface_by_index(interface_idx);
    let wmi_con = super::utils::create_wmi_connection().map_err(|e| format!("WMI connection failed: {}", e))?;
    
    let query = format!("SELECT * FROM Win32_NetworkAdapterConfiguration WHERE InterfaceIndex = {}", interface_idx);
    
    let result: Result<Vec<InterfaceInfoWmi>, String> = wmi_con.raw_query(query)
        .map_err(|e| format!("WMI query failed: {}", e));
    
    let interface_dns_info:Result<InterfaceDnsInfo,String>  = match result {
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
                })
            }
        },
        Err(e) => Err(e),
    };

    
    return interface_dns_info;
}

#[derive(Debug, Clone,Serialize,Deserialize,Default)]
#[serde(rename_all = "PascalCase")]
pub struct InterfaceInfoWmi {
    description: String,
    dns_server_search_order: Vec<String>,
    interface_index: u32,
    #[serde(rename = "IPConnectionMetric")]
    ip_connection_metric: Option<i16>,

}

#[derive(Debug, Clone,Serialize,Deserialize,Default)]
pub struct InterfaceDnsInfo {
    interface_index: u32,
    dns_servers: Vec<String>,
    interface_name: String,
}
