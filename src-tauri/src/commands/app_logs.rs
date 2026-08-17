//! IPC surface for the in-app log viewer.
//!
//! Reading is done on a blocking worker: the log file can reach a megabyte and parsing
//! it on the async runtime would stall every other command for the duration.

use log::{info, warn};
use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, AppResult, LogErr};
use crate::logging::{self, AppLogEntry};

/// Returns parsed log entries, newest first.
///
/// `filter` matches case-insensitively against the message and target. `levels` keeps
/// only the named levels (`"ERROR"`, `"WARN"`, …); an empty or absent list keeps all.
#[tauri::command(rename_all = "snake_case")]
pub async fn get_app_logs(
    filter: Option<String>,
    levels: Option<Vec<String>>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> AppResult<Vec<AppLogEntry>> {
    tauri::async_runtime::spawn_blocking(move || {
        let entries = logging::read_entries()?;

        let wanted: Option<Vec<String>> = levels
            .filter(|l| !l.is_empty())
            .map(|l| l.into_iter().map(|s| s.to_uppercase()).collect());
        let needle = filter.filter(|f| !f.is_empty()).map(|f| f.to_lowercase());

        let offset = offset.unwrap_or(0);
        let limit = limit
            .unwrap_or(logging::MAX_ENTRIES)
            .min(logging::MAX_ENTRIES);

        Ok(entries
            .into_iter()
            .filter(|e| match &wanted {
                Some(levels) => levels.iter().any(|l| l == &e.level),
                None => true,
            })
            .filter(|e| match &needle {
                Some(needle) => {
                    e.message.to_lowercase().contains(needle)
                        || e.target.to_lowercase().contains(needle)
                }
                None => true,
            })
            .skip(offset)
            .take(limit)
            .collect())
    })
    .await
    .map_err(|e| AppError::Task(e.to_string()))?
    .log_err("get_app_logs")
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_app_logs() -> AppResult<()> {
    let result = logging::clear().log_err("clear_app_logs");
    if result.is_ok() {
        info!("Log file cleared from the in-app viewer");
    }
    result
}

/// Absolute path of the active log file, for display and for "copy path".
#[tauri::command(rename_all = "snake_case")]
pub fn get_log_file_path() -> AppResult<String> {
    Ok(logging::log_file().to_string_lossy().to_string())
}

/// Reveals the log folder in Explorer.
#[tauri::command(rename_all = "snake_case")]
pub fn open_log_dir(app: tauri::AppHandle) -> AppResult<()> {
    let dir = logging::log_dir();
    // The folder only exists once something has been logged; create it so the action
    // never fails on a pristine install.
    if let Err(e) = std::fs::create_dir_all(&dir) {
        warn!("Could not create log directory {}: {}", dir.display(), e);
    }
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| AppError::io_like("Opening the log folder", e.to_string()))
        .log_err("open_log_dir")
}
