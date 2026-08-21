//! Adapter enable/disable.
//!
//! The WMI implementation this replaces needed the WMI service running and a correctly
//! initialized COM apartment, and surfaced failures as opaque error strings. It now goes
//! through SetupAPI (`crate::win::device`), the same mechanism Device Manager uses,
//! which works back to Windows 2000 and returns real Win32 error codes.

use crate::error::AppResult;
use crate::win::{device, dns_settings};

/// Enables or disables a network adapter by interface index.
///
/// Requires administrator rights; without them SetupAPI reports ERROR_ACCESS_DENIED,
/// which surfaces as a Win32 error with the system's own description.
pub fn set_interface_enabled(index: u32, enable: bool) -> AppResult<()> {
    let guid = dns_settings::interface_guid(index)?;
    device::set_adapter_enabled(guid, enable)
}
