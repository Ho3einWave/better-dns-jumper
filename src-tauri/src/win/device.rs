//! Adapter enable/disable via SetupAPI.
//!
//! Replaces `Win32_NetworkAdapter.Enable()`/`Disable()`. WMI was the last thing on this
//! path that required the WMI service to be running and a COM apartment to be set up
//! correctly, and it reported failures as opaque `WMIError` strings. SetupAPI is what
//! Device Manager itself uses, returns real Win32 error codes, and has been available
//! since Windows 2000 — comfortably below the app's Windows 10 floor.
//!
//! The mapping from an interface index to a device is done through the adapter's GUID:
//! every network device stores its `NetCfgInstanceId` (the adapter GUID, as a string) in
//! its driver registry key, and that is the only stable link between the SetupAPI device
//! list and the IP Helper interface table.

use log::debug;
use windows::core::{GUID, PCWSTR};
use windows::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiCallClassInstaller, SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo,
    SetupDiGetClassDevsW, SetupDiOpenDevRegKey, SetupDiSetClassInstallParamsW, DICS_DISABLE,
    DICS_ENABLE, DICS_FLAG_GLOBAL, DIF_PROPERTYCHANGE, DIGCF_PRESENT, DIREG_DRV, GUID_DEVCLASS_NET,
    SP_CLASSINSTALL_HEADER, SP_DEVINFO_DATA, SP_PROPCHANGE_PARAMS,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegQueryValueExW, HKEY, KEY_READ, REG_VALUE_TYPE,
};

use crate::error::{AppError, AppResult};

/// Enables or disables the network adapter whose GUID matches `adapter_guid`.
pub fn set_adapter_enabled(adapter_guid: GUID, enable: bool) -> AppResult<()> {
    let wanted = guid_to_braced_string(&adapter_guid);

    unsafe {
        // Only present devices — a disabled adapter is still present, but one that has
        // been physically removed should not be matched.
        let dev_info = SetupDiGetClassDevsW(
            Some(&GUID_DEVCLASS_NET),
            PCWSTR::null(),
            None,
            DIGCF_PRESENT,
        )
        .map_err(|e| AppError::win32("SetupDiGetClassDevs", e.code().0 as u32))?;

        let mut result = Err(AppError::invalid(format!(
            "No network device matching {} was found.",
            wanted
        )));

        let mut index = 0u32;
        loop {
            let mut dev_info_data = SP_DEVINFO_DATA {
                cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
                ..Default::default()
            };
            if SetupDiEnumDeviceInfo(dev_info, index, &mut dev_info_data).is_err() {
                // Exhausted the list (ERROR_NO_MORE_ITEMS) or hit a real failure; either
                // way there is nothing further to enumerate.
                break;
            }
            index += 1;

            match read_net_cfg_instance_id(dev_info, &dev_info_data) {
                Some(id) if id.eq_ignore_ascii_case(&wanted) => {
                    result = apply_property_change(dev_info, &mut dev_info_data, enable);
                    break;
                }
                _ => continue,
            }
        }

        // Always release the device list, including on the error paths above.
        let _ = SetupDiDestroyDeviceInfoList(dev_info);
        result
    }
}

/// Issues the DIF_PROPERTYCHANGE that actually enables or disables the device.
unsafe fn apply_property_change(
    dev_info: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    dev_info_data: &mut SP_DEVINFO_DATA,
    enable: bool,
) -> AppResult<()> {
    let params = SP_PROPCHANGE_PARAMS {
        ClassInstallHeader: SP_CLASSINSTALL_HEADER {
            cbSize: std::mem::size_of::<SP_CLASSINSTALL_HEADER>() as u32,
            InstallFunction: DIF_PROPERTYCHANGE,
        },
        StateChange: if enable { DICS_ENABLE } else { DICS_DISABLE },
        // Change the setting in every hardware profile rather than only the current one,
        // which is what Device Manager's enable/disable does.
        Scope: DICS_FLAG_GLOBAL,
        HwProfile: 0,
    };

    SetupDiSetClassInstallParamsW(
        dev_info,
        Some(dev_info_data),
        Some(&params.ClassInstallHeader as *const SP_CLASSINSTALL_HEADER),
        std::mem::size_of::<SP_PROPCHANGE_PARAMS>() as u32,
    )
    .map_err(|e| AppError::win32("SetupDiSetClassInstallParams", e.code().0 as u32))?;

    SetupDiCallClassInstaller(DIF_PROPERTYCHANGE, dev_info, Some(dev_info_data)).map_err(|e| {
        // ERROR_ACCESS_DENIED here almost always means "not running as administrator",
        // which is worth saying out loud since the app otherwise mostly works without it.
        AppError::win32("SetupDiCallClassInstaller", e.code().0 as u32)
    })?;

    debug!(
        "Device property change applied: {}",
        if enable { "enable" } else { "disable" }
    );
    Ok(())
}

/// Reads `NetCfgInstanceId` from a device's driver registry key.
unsafe fn read_net_cfg_instance_id(
    dev_info: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    dev_info_data: &SP_DEVINFO_DATA,
) -> Option<String> {
    let key: HKEY = SetupDiOpenDevRegKey(
        dev_info,
        dev_info_data,
        DICS_FLAG_GLOBAL.0,
        0,
        DIREG_DRV,
        KEY_READ.0,
    )
    .ok()?;

    let name: Vec<u16> = "NetCfgInstanceId\0".encode_utf16().collect();
    let mut buffer = [0u16; 128];
    let mut size = (buffer.len() * 2) as u32;
    let mut value_type = REG_VALUE_TYPE::default();

    let status = RegQueryValueExW(
        key,
        PCWSTR(name.as_ptr()),
        None,
        Some(&mut value_type),
        Some(buffer.as_mut_ptr() as *mut u8),
        Some(&mut size),
    );
    let _ = RegCloseKey(key);

    if status.is_err() {
        return None;
    }

    // `size` is in bytes and includes the terminating NUL.
    let len = (size as usize / 2).saturating_sub(1).min(buffer.len());
    Some(String::from_utf16_lossy(&buffer[..len]))
}

/// Formats a GUID the way the registry stores `NetCfgInstanceId`: braced, hyphenated.
fn guid_to_braced_string(guid: &GUID) -> String {
    let d4 = guid.data4;
    format!(
        "{{{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}}}",
        guid.data1, guid.data2, guid.data3, d4[0], d4[1], d4[2], d4[3], d4[4], d4[5], d4[6], d4[7]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_a_guid_the_way_the_registry_does() {
        let guid = GUID::from_values(
            0x1234ABCD,
            0x5678,
            0x9ABC,
            [0xDE, 0xF0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66],
        );
        assert_eq!(
            guid_to_braced_string(&guid),
            "{1234ABCD-5678-9ABC-DEF0-112233445566}"
        );
    }
}
