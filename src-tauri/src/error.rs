//! The single error type that crosses the IPC boundary.
//!
//! Every `#[tauri::command]` returns [`AppResult<T>`]. [`AppError`] serializes as its
//! `Display` string, so the wire format stays a plain JSON string and existing frontend
//! error handling keeps working unchanged. The gain is on the Rust side: `?` conversions
//! instead of a `map_err(|e| format!("...: {}", e))` at every call site, and messages
//! that consistently name the operation that failed rather than leaking a raw debug
//! representation of whatever the underlying library returned.
//!
//! Message style, applied throughout:
//! - Say what failed, then why, then what the user can do about it if anything.
//! - Never end with a period-less fragment or a bare `{:?}` dump.
//! - Include the interface index / server / path involved — these reports arrive as
//!   screenshots, so the message has to carry its own context.

use serde::{Serialize, Serializer};
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

/// Renders a raw Win32 status code as the system's own description.
///
/// `std::io::Error` knows how to ask Windows for the message text, which is far more
/// actionable than the bare number — "The parameter is incorrect. (os error 87)" beats
/// "error 87" in a bug report.
///
/// Takes `&u32` because thiserror binds fields by reference in `#[error(...)]` args.
fn os_error_message(code: &u32) -> String {
    std::io::Error::from_raw_os_error(*code as i32).to_string()
}

#[derive(Debug, Error)]
pub enum AppError {
    /// A Win32 / IP Helper call returned a non-success status code.
    #[error("{operation} failed: {}", os_error_message(.code))]
    Win32 { operation: &'static str, code: u32 },

    #[error("Network interface {0} was not found. It may have been unplugged, disabled, or removed since the list was last refreshed.")]
    InterfaceNotFound(u32),

    #[error("No network interface is currently routing traffic to the internet, so there is nothing to apply DNS settings to.")]
    NoActiveInterface,

    /// Bad or unusable arguments — almost always something the UI should have caught.
    #[error("{0}")]
    InvalidInput(String),

    /// The local DoH/DoT/DoQ proxy failed to start, stop, or serve.
    #[error("DNS proxy error: {0}")]
    Proxy(String),

    /// WMI / COM failures, which remain only on the adapter enable/disable path.
    #[error("Windows Management Instrumentation error: {0}")]
    Wmi(String),

    #[error("Could not reach DNS server: {0}")]
    Resolver(String),

    #[error("{context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },

    #[error("Could not read or write application data: {0}")]
    Store(String),

    /// A `spawn_blocking` / task join failure. Only surfaces if a worker panicked.
    #[error("A background task did not complete: {0}")]
    Task(String),

    /// Bridge for the modules that still return `Result<_, String>` — currently the DNS
    /// proxy engine in `dns/dns_server.rs`, which is large enough that converting it is
    /// its own change. `?` works across the boundary via the `From<String>` impl below.
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn win32(operation: &'static str, code: u32) -> Self {
        AppError::Win32 { operation, code }
    }

    pub fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        AppError::Io {
            context: context.into(),
            source,
        }
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        AppError::InvalidInput(message.into())
    }

    /// For failures that are I/O in nature but arrive as someone else's error type.
    pub fn io_like(context: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::Io {
            context: context.into(),
            source: std::io::Error::other(message.into()),
        }
    }

    /// A short, stable machine-readable tag. Used for log lines and for grouping in bug
    /// reports; deliberately not part of the serialized payload so the wire format stays
    /// a plain string.
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::Win32 { .. } => "win32",
            AppError::InterfaceNotFound(_) => "interface_not_found",
            AppError::NoActiveInterface => "no_active_interface",
            AppError::InvalidInput(_) => "invalid_input",
            AppError::Proxy(_) => "proxy",
            AppError::Wmi(_) => "wmi",
            AppError::Resolver(_) => "resolver",
            AppError::Io { .. } => "io",
            AppError::Store(_) => "store",
            AppError::Task(_) => "task",
            AppError::Internal(_) => "internal",
        }
    }
}

/// Lets `?` lift the string errors still produced by `dns/dns_server.rs`.
impl From<String> for AppError {
    fn from(message: String) -> Self {
        AppError::Internal(message)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Store(e.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Logs a failed result once, with the operation that produced it, then passes it
/// through unchanged.
///
/// The convention in this codebase: fallible helpers return errors without logging, and
/// the outermost caller that can name the operation logs it. That keeps one failure to
/// one log line instead of the same problem being reported at three nesting levels.
/// Functions that return `()` (background sweeps, event handlers) log for themselves,
/// since nothing above them can.
pub trait LogErr<T> {
    fn log_err(self, operation: &str) -> AppResult<T>;
}

impl<T> LogErr<T> for AppResult<T> {
    fn log_err(self, operation: &str) -> AppResult<T> {
        if let Err(ref e) = self {
            log::error!("{} failed [{}]: {}", operation, e.kind(), e);
        }
        self
    }
}
