//! Application logging: where logs go, what a line looks like, and how to read them
//! back for the in-app viewer.
//!
//! Everything is written to a single rotating file, `%TEMP%\better-dns-jumper\
//! better-dns-jumper.log`, in a fixed format that [`parse_line`] can read back:
//!
//! ```text
//! 2026-08-17 14:32:07.812 [INFO ] [better_dns_jumper_lib::commands::dns] Applied DoH DNS to interface 12
//! ```
//!
//! The format is deliberately parseable rather than pretty: fixed-width timestamp
//! first, then level and target in brackets, then a free-form message. Anything that
//! does not match that shape is treated as a continuation of the previous entry, which
//! is what keeps multi-line payloads (panics, `{:#?}` dumps) readable in the viewer
//! instead of being split into fragments.

use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;

use serde::Serialize;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy, WEBVIEW_TARGET};

use crate::error::{AppError, AppResult};

/// Folder under the OS temp dir. Kept as a constant because the log viewer, the
/// "open folder" action and the logger configuration must all agree on it.
pub const LOG_DIR_NAME: &str = "better-dns-jumper";
/// File stem; the plugin appends `.log`.
pub const LOG_FILE_STEM: &str = "better-dns-jumper";

/// Rotate at 5 MB and keep three generations. The previous setting kept a single 10 MB
/// file, which meant the rotation that mattered — the one right after a crash — threw
/// away the evidence.
const MAX_FILE_SIZE: u128 = 5 * 1024 * 1024;
const KEEP_LOG_FILES: usize = 3;

/// Upper bound on how much of the tail we parse for the viewer. The file can reach
/// 5 MB; deserializing all of it on every 2s poll would be wasteful, and nobody scrolls
/// back that far in a UI list.
const MAX_TAIL_BYTES: u64 = 1024 * 1024;

/// Hard cap on entries handed to the frontend in one call.
pub const MAX_ENTRIES: usize = 5000;

pub fn log_dir() -> PathBuf {
    std::env::temp_dir().join(LOG_DIR_NAME)
}

pub fn log_file() -> PathBuf {
    log_dir().join(format!("{}.log", LOG_FILE_STEM))
}

/// One parsed log line, as shown in the in-app viewer.
#[derive(Debug, Clone, Serialize)]
pub struct AppLogEntry {
    /// Position in the file, oldest = 0. Only used as a stable React key.
    pub id: u64,
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// Builds the configured `tauri-plugin-log` plugin.
pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    // `Builder::new()` starts with Stdout + the OS log directory already registered, and
    // `.target()` appends rather than replaces. Using `.targets()` states the full set
    // explicitly, so the temp folder is the one and only place a release build writes —
    // previously the same lines were also going to %LOCALAPPDATA%\<bundle>\logs, which
    // meant bug reports arrived containing whichever copy the reporter happened to find.
    let mut targets = vec![Target::new(TargetKind::Folder {
        path: log_dir(),
        file_name: Some(LOG_FILE_STEM.to_string()),
    })];

    // Debug builds also mirror to stdout so `npm run tauri dev` shows the same lines.
    if cfg!(debug_assertions) {
        targets.push(Target::new(TargetKind::Stdout));
    }

    let builder = tauri_plugin_log::Builder::new()
        .targets(targets)
        .max_file_size(MAX_FILE_SIZE)
        .rotation_strategy(RotationStrategy::KeepSome(KEEP_LOG_FILES))
        .timezone_strategy(TimezoneStrategy::UseLocal)
        // Keep third-party crates out of the file — hickory and rustls are extremely
        // chatty at debug level and would bury the app's own lines. The webview target
        // is explicitly included so `@tauri-apps/plugin-log` calls from the React side
        // land in the same file, in order, instead of only in the devtools console.
        .filter(|metadata| {
            let target = metadata.target();
            target.starts_with("better_dns_jumper_lib") || target.starts_with(WEBVIEW_TARGET)
        })
        .format(|out, message, record| {
            out.finish(format_args!(
                "{} [{:<5}] [{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.level(),
                record.target(),
                message
            ))
        });

    // Debug builds record debug-level detail; release stays at info so a long-running
    // session doesn't rotate away useful history behind a wall of routine chatter.
    let builder = if cfg!(debug_assertions) {
        builder.level(log::LevelFilter::Debug)
    } else {
        builder.level(log::LevelFilter::Info)
    };

    builder.build()
}

/// Splits a log line into its parts, or returns `None` if it is a continuation line.
///
/// Expected shape: `<23-char timestamp> [LEVEL] [target] message`.
fn parse_line(line: &str, id: u64) -> Option<AppLogEntry> {
    // Timestamp is fixed width: "YYYY-MM-DD HH:MM:SS.mmm".
    const TS_LEN: usize = 23;
    if line.len() < TS_LEN + 2 || !line.is_char_boundary(TS_LEN) {
        return None;
    }
    let (timestamp, rest) = line.split_at(TS_LEN);
    // Cheap shape check — avoids treating a message that merely happens to be long as
    // the start of a new entry.
    if !timestamp.starts_with(|c: char| c.is_ascii_digit()) || timestamp.as_bytes()[10] != b' ' {
        return None;
    }

    let rest = rest.strip_prefix(' ')?;
    let rest = rest.strip_prefix('[')?;
    let (level, rest) = rest.split_once(']')?;
    let rest = rest.strip_prefix(" [")?;
    let (target, message) = rest.split_once(']')?;

    Some(AppLogEntry {
        id,
        timestamp: timestamp.to_string(),
        level: level.trim().to_string(),
        target: target.to_string(),
        message: message.strip_prefix(' ').unwrap_or(message).to_string(),
    })
}

/// Reads the tail of the log file and parses it into entries, newest first.
///
/// Returns an empty list rather than an error when the file does not exist yet — that
/// is the normal state on a first run, not a failure worth surfacing to the user.
pub fn read_entries() -> AppResult<Vec<AppLogEntry>> {
    let path = log_file();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut file = fs::File::open(&path)
        .map_err(|e| AppError::io(format!("Opening {}", path.display()), e))?;
    let len = file
        .metadata()
        .map_err(|e| AppError::io(format!("Reading metadata for {}", path.display()), e))?
        .len();

    let start = len.saturating_sub(MAX_TAIL_BYTES);
    file.seek(SeekFrom::Start(start))
        .map_err(|e| AppError::io(format!("Seeking in {}", path.display()), e))?;

    let mut buffer = Vec::with_capacity((len - start) as usize);
    file.read_to_end(&mut buffer)
        .map_err(|e| AppError::io(format!("Reading {}", path.display()), e))?;

    // The file is UTF-8, but a tail read can slice a multi-byte character in half.
    let text = String::from_utf8_lossy(&buffer);
    let mut lines = text.lines().peekable();
    // Drop the first line when we started mid-file: it is almost certainly a fragment.
    if start > 0 {
        lines.next();
    }

    let mut entries: Vec<AppLogEntry> = Vec::new();
    let mut id: u64 = 0;
    for line in lines {
        match parse_line(line, id) {
            Some(entry) => {
                entries.push(entry);
                id += 1;
            }
            None => {
                // Continuation of a multi-line message. If we have no entry to attach it
                // to (the tail began mid-message), the fragment is not useful on its own.
                if let Some(last) = entries.last_mut() {
                    last.message.push('\n');
                    last.message.push_str(line);
                }
            }
        }
    }

    entries.reverse();
    Ok(entries)
}

/// Truncates the log file in place.
///
/// The logger keeps its own append-mode handle open. Rust opens files on Windows with
/// read/write/delete sharing, so truncating from a second handle succeeds, and because
/// the logger appends rather than seeking, its next write lands at the new end of file
/// instead of leaving a sparse gap.
pub fn clear() -> AppResult<()> {
    let path = log_file();
    if !path.exists() {
        return Ok(());
    }
    fs::OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(&path)
        .map_err(|e| AppError::io(format!("Truncating {}", path.display()), e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_well_formed_line() {
        let line = "2026-08-17 14:32:07.812 [INFO ] [better_dns_jumper_lib::commands::dns] Applied DoH DNS to interface 12";
        let entry = parse_line(line, 0).expect("should parse");
        assert_eq!(entry.timestamp, "2026-08-17 14:32:07.812");
        assert_eq!(entry.level, "INFO");
        assert_eq!(entry.target, "better_dns_jumper_lib::commands::dns");
        assert_eq!(entry.message, "Applied DoH DNS to interface 12");
    }

    #[test]
    fn rejects_continuation_lines() {
        assert!(parse_line("    at some::stack::frame", 0).is_none());
        assert!(parse_line("", 0).is_none());
        assert!(parse_line("short", 0).is_none());
    }

    #[test]
    fn keeps_brackets_inside_the_message() {
        let line =
            "2026-08-17 14:32:07.812 [WARN ] [better_dns_jumper_lib::win] Interface [12] is down";
        let entry = parse_line(line, 0).expect("should parse");
        assert_eq!(entry.level, "WARN");
        assert_eq!(entry.message, "Interface [12] is down");
    }

    #[test]
    fn handles_multibyte_messages() {
        let line =
            "2026-08-17 14:32:07.812 [ERROR] [better_dns_jumper_lib] Could not bind — port in use";
        let entry = parse_line(line, 0).expect("should parse");
        assert_eq!(entry.level, "ERROR");
        assert_eq!(entry.message, "Could not bind — port in use");
    }
}
