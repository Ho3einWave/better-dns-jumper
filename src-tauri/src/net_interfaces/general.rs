use crate::utils::create_wmi_connection;
use serde::{Deserialize, Serialize};

/// Enables or disables a network adapter.
///
/// This is the only remaining WMI usage in the app — adapter enable/disable has no
/// public IP Helper equivalent. Enumeration and DNS configuration moved to
/// `crate::win`.
///
/// Both the path lookup and the method invocation share a single `WMIConnection` so
/// COM is initialized once per call rather than twice. Must be run on a thread that
/// has not already been initialized into an STA — see the caller, which dispatches it
/// via `spawn_blocking` for exactly that reason.
pub fn set_interface_enabled(index: u32, enable: bool) -> Result<(), String> {
    let wmi_con =
        create_wmi_connection().map_err(|e| format!("Failed to create WMI connection: {}", e))?;

    let query = format!(
        "SELECT * FROM Win32_NetworkAdapter WHERE InterfaceIndex = {}",
        index
    );

    let result: Vec<NetworkAdapterWmi> = wmi_con
        .raw_query(query)
        .map_err(|e| format!("Failed to get network adapter path: {}", e))?;

    let path = result
        .first()
        .and_then(|adapter| adapter.path.clone())
        .ok_or_else(|| format!("No network adapter found with interface index {}", index))?;

    let method = if enable { "Enable" } else { "Disable" };

    wmi_con
        .exec_instance_method::<NetworkAdapterWmi, _>(path, method, ())
        .map_err(|e| e.to_string())
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
