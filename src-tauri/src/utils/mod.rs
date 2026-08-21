use wmi::{COMLibrary, WMIConnection, WMIError};

use crate::error::{AppError, AppResult};

/// Initializes COM on the calling thread and opens a WMI connection.
///
/// WMI is now reached only from the legacy DNS path (`crate::win::dns_legacy`), used on
/// Windows builds without `SetInterfaceDnsSettings`. Enumeration, DNS configuration on
/// modern builds, and adapter enable/disable all go through `crate::win` instead.
///
/// ## Why `RPC_E_CHANGED_MODE` is tolerated
///
/// `COMLibrary::new()` calls `CoInitializeEx(COINIT_MULTITHREADED)`, which fails with
/// `RPC_E_CHANGED_MODE` when the thread was already initialized into a single-threaded
/// apartment. The UI thread is an STA, and two things run on it: the stale-DNS sweep at
/// startup and the DNS restore on exit. Treating that as a failure would mean the exit
/// cleanup silently doing nothing on legacy Windows — leaving 127.0.0.2 applied with no
/// working internet, which is the exact bug this whole area exists to prevent.
///
/// The error does not mean COM is unavailable. It means COM is *already* initialized,
/// just in a different apartment model, and WMI is perfectly usable from an STA.
pub fn create_wmi_connection() -> AppResult<WMIConnection> {
    let com_con = match COMLibrary::new() {
        Ok(com_con) => com_con,
        Err(WMIError::HResultError { hres }) if hres == RPC_E_CHANGED_MODE => {
            // SAFETY: `RPC_E_CHANGED_MODE` is only returned when the calling thread has
            // already been through `CoInitializeEx`, so the initialization this asserts
            // has definitely happened.
            unsafe { COMLibrary::assume_initialized() }
        }
        Err(e) => {
            return Err(AppError::Wmi(format!(
                "COM could not be initialized: {}",
                e
            )))
        }
    };

    WMIConnection::new(com_con)
        .map_err(|e| AppError::Wmi(format!("could not connect to the WMI service: {}", e)))
}

/// `windows::Win32::Foundation::RPC_E_CHANGED_MODE`, as the `i32` the wmi crate reports.
const RPC_E_CHANGED_MODE: i32 = 0x8001_0106_u32 as i32;
