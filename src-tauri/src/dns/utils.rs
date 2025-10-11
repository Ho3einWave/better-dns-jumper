use std::net::Ipv4Addr;

use wmi::{COMLibrary, WMIConnection};

pub fn ipv4_to_u32(ipv4: Ipv4Addr) -> u32 {
    ipv4.into()
}

pub fn create_wmi_connection() -> Result<WMIConnection, String> {
    // Use a more robust approach that handles COM threading issues
    // The wmi crate should handle COM initialization internally
    let com_con = unsafe{ COMLibrary::assume_initialized()};
    
    
    // Create WMI connection with proper error handling
    let wmi_con = match WMIConnection::new(com_con) {
        Ok(wmi) => wmi,
        Err(e) => {
            let error_msg = format!("WMI connection failed: {}", e);
            
            return Err(error_msg);
        },
    };
    
    Ok(wmi_con)
}