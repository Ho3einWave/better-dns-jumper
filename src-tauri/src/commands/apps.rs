use crate::error::AppResult;
use crate::types::InstalledApp;
use std::net::ToSocketAddrs;
use std::time::{Duration, Instant};
use std::collections::BTreeSet;
use windows::core::PCWSTR;
use windows::Win32::System::Registry::{
    RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER,
    HKEY_LOCAL_MACHINE, KEY_READ, REG_EXPAND_SZ, REG_SZ, REG_VALUE_TYPE,
};

const UNINSTALL_PATHS: &[&str] = &[
    "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

#[tauri::command(rename_all = "snake_case")]
pub fn list_installed_apps() -> AppResult<Vec<InstalledApp>> {
    let mut seen: BTreeSet<String> = BTreeSet::new();
    let mut apps: Vec<InstalledApp> = Vec::new();

    let roots = [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER];
    for root in roots {
        for sub in UNINSTALL_PATHS {
            let key_path = format!("{}\\{}", root_name(root), sub);
            // open via full path from root
            unsafe {
                if let Some(hkey) = open_key(root, sub) {
                    enumerate_uninstall(hkey, &mut seen, &mut apps);
                    let _ = RegCloseKey(hkey);
                }
            }
            let _ = key_path;
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

fn root_name(root: HKEY) -> &'static str {
    if root == HKEY_LOCAL_MACHINE {
        "HKLM"
    } else {
        "HKCU"
    }
}

unsafe fn open_key(root: HKEY, subkey: &str) -> Option<HKEY> {
    let wide: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
    let mut hkey = HKEY::default();
    if RegOpenKeyExW(root, PCWSTR(wide.as_ptr()), Some(0), KEY_READ, &mut hkey).is_ok() {
        Some(hkey)
    } else {
        None
    }
}

unsafe fn enumerate_uninstall(hkey: HKEY, seen: &mut BTreeSet<String>, apps: &mut Vec<InstalledApp>) {
    let mut index = 0u32;
    loop {
        let mut name_buf = vec![0u16; 256];
        let mut name_len = name_buf.len() as u32;
        let res = RegEnumKeyExW(
            hkey,
            index,
            Some(windows::core::PWSTR(name_buf.as_mut_ptr())),
            &mut name_len,
            None,
            None,
            None,
            None,
        );
        if res.is_err() {
            break;
        }
        index += 1;
        let subkey_name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
        if subkey_name.is_empty() {
            continue;
        }
        // open subkey
        let full = subkey_name.clone();
        let mut sub_hkey = HKEY::default();
        let wide: Vec<u16> = full.encode_utf16().chain(std::iter::once(0)).collect();
        if RegOpenKeyExW(hkey, PCWSTR(wide.as_ptr()), Some(0), KEY_READ, &mut sub_hkey).is_err() {
            continue;
        }

        let display_name = query_string(sub_hkey, "DisplayName");
        let publisher = query_string(sub_hkey, "Publisher");
        let install_location = query_string(sub_hkey, "InstallLocation");

        let _ = RegCloseKey(sub_hkey);

        if let Some(name) = display_name {
            let trimmed = name.trim().to_string();
            if trimmed.is_empty() {
                continue;
            }
            // filter system components
            if is_system_component(&trimmed, publisher.as_deref()) {
                continue;
            }
            let key = trimmed.to_lowercase();
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            apps.push(InstalledApp {
                name: trimmed,
                publisher,
                install_location: if install_location.as_deref().unwrap_or("").trim().is_empty() {
                    None
                } else {
                    install_location
                },
            });
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn test_tcp_connect(host: String, port: u16) -> AppResult<usize> {
    let addrs: Vec<_> = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|e| crate::error::AppError::invalid(format!("resolve failed: {}", e)))?
        .collect();
    if addrs.is_empty() {
        return Err(crate::error::AppError::invalid("no addresses resolved".to_string()));
    }
    let start = Instant::now();
    let mut last_err = None;
    for addr in addrs {
        match std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(5)) {
            Ok(stream) => {
                drop(stream);
                return Ok(start.elapsed().as_millis() as usize);
            }
            Err(e) => last_err = Some(e),
        }
    }
    Err(crate::error::AppError::invalid(format!(
        "connect failed: {}",
        last_err.unwrap()
    )))
}

fn is_system_component(name: &str, publisher: Option<&str>) -> bool {
    let lower = name.to_lowercase();
    let system_keywords = [
        "microsoft",
        "windows",
        ".net",
        "visual c++",
        "visual studio",
        "update for",
        "security update",
        "hotfix",
        "redistributable",
        "runtime",
    ];
    for kw in system_keywords {
        if lower.contains(kw) {
            return true;
        }
    }
    if let Some(p) = publisher {
        let pl = p.to_lowercase();
        if pl.contains("microsoft") {
            return true;
        }
    }
    false
}

unsafe fn query_string(hkey: HKEY, value_name: &str) -> Option<String> {
    let name_wide: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();
    let mut ty = REG_VALUE_TYPE::default();
    let mut size: u32 = 0;
    // first call to get size
    if RegQueryValueExW(
        hkey,
        PCWSTR(name_wide.as_ptr()),
        None,
        Some(&mut ty),
        None,
        Some(&mut size),
    )
    .is_err()
    {
        return None;
    }
    if ty != REG_SZ && ty != REG_EXPAND_SZ {
        return None;
    }
    if size == 0 {
        return None;
    }
    let mut buf = vec![0u8; size as usize];
    if RegQueryValueExW(
        hkey,
        PCWSTR(name_wide.as_ptr()),
        None,
        Some(&mut ty),
        Some(buf.as_mut_ptr()),
        Some(&mut size),
    )
    .is_err()
    {
        return None;
    }
    // decode UTF-16
    let u16s: Vec<u16> = buf
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    let s = String::from_utf16_lossy(&u16s);
    let s = s.trim_end_matches('\0').trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}