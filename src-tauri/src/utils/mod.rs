use wmi::{COMLibrary, WMIConnection};

use crate::error::{AppError, AppResult};

/// Initializes COM on the calling thread and opens a WMI connection.
///
/// `COMLibrary::new()` performs a real `CoInitializeEx` call scoped to the calling
/// thread (safe to call repeatedly — COM reference-counts it per thread), unlike the
/// previous `COMLibrary::assume_initialized()`, which merely *asserted* initialization
/// had already happened. Tauri commands can run on arbitrary pool threads that never
/// called `CoInitializeEx`, so that assumption was unsound.
///
/// This is the only remaining WMI entry point in the app — DNS configuration and
/// interface enumeration have moved to `crate::win` (IP Helper). WMI is now used only
/// for adapter enable/disable (`net_interfaces::general::set_interface_enabled`),
/// which has no public IP Helper equivalent.
pub fn create_wmi_connection() -> AppResult<WMIConnection> {
    let com_con = COMLibrary::new()
        .map_err(|e| AppError::Wmi(format!("COM could not be initialized: {}", e)))?;

    WMIConnection::new(com_con)
        .map_err(|e| AppError::Wmi(format!("could not connect to the WMI service: {}", e)))
}
