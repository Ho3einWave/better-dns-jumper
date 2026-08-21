//! Push notification of network changes, via `NotifyIpInterfaceChange`.
//!
//! Replaces polling as the *trigger* for refreshing the UI. The frontend previously
//! refetched interfaces and DNS state on a fixed 5-10s timer, so plugging in a cable or
//! switching Wi-Fi took up to ten seconds to show up, and the app kept doing syscalls
//! forever while sitting idle in the tray.
//!
//! Windows delivers these callbacks on its own worker thread, so the callback does the
//! minimum possible: emit a Tauri event and return. All the real work happens in the
//! frontend's event handler.
//!
//! Available since Windows Vista, so this needs no runtime capability check — unlike
//! `SetInterfaceDnsSettings`, see `dns_settings.rs`.

use std::sync::Mutex;

use log::{debug, info, warn};
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::NetworkManagement::IpHelper::{
    CancelMibChangeNotify2, NotifyIpInterfaceChange, MIB_IPINTERFACE_ROW, MIB_NOTIFICATION_TYPE,
};
use windows::Win32::Networking::WinSock::AF_UNSPEC;

/// Event name the frontend listens on. Any change to the interface table — link up or
/// down, address change, adapter added or removed — produces one.
pub const NETWORK_CHANGED_EVENT: &str = "network-changed";

/// Handle kept alive for the lifetime of the process so the registration is not dropped.
/// `CancelMibChangeNotify2` must be called before the callback can safely be freed.
static NOTIFY_HANDLE: Mutex<Option<isize>> = Mutex::new(None);

/// The app handle the callback emits through.
///
/// A raw `static` is unavoidable: `NotifyIpInterfaceChange` takes a bare C function
/// pointer plus a `*mut c_void` caller context, and Windows will invoke it from a thread
/// we do not own. Storing the handle here rather than leaking it through the context
/// pointer keeps the unsafe surface to this one module.
static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

/// Called by Windows on its own worker thread whenever the IP interface table changes.
///
/// Must stay cheap and must not block: the OS serializes these callbacks, and a slow one
/// delays every subsequent network notification process-wide.
unsafe extern "system" fn on_interface_change(
    _caller_context: *const std::ffi::c_void,
    _row: *const MIB_IPINTERFACE_ROW,
    notification_type: MIB_NOTIFICATION_TYPE,
) {
    debug!(
        "Network interface change notification: type {}",
        notification_type.0
    );

    // `lock()` can only fail if a previous holder panicked; there is nothing useful to
    // do about that inside an OS callback, so the notification is simply dropped.
    let Ok(guard) = APP_HANDLE.lock() else {
        return;
    };
    if let Some(app) = guard.as_ref() {
        if let Err(e) = app.emit(NETWORK_CHANGED_EVENT, ()) {
            warn!("Could not emit {}: {}", NETWORK_CHANGED_EVENT, e);
        }
    }
}

/// Registers for interface-change notifications. Idempotent.
///
/// Failure is not fatal: the frontend keeps a slow poll as a safety net, so the app
/// degrades to its previous behavior rather than going blind to network changes.
pub fn register(app: AppHandle) {
    {
        let Ok(mut guard) = APP_HANDLE.lock() else {
            warn!("Network notification state is poisoned; not registering");
            return;
        };
        *guard = Some(app);
    }

    let Ok(mut handle_guard) = NOTIFY_HANDLE.lock() else {
        return;
    };
    if handle_guard.is_some() {
        return;
    }

    let mut handle = HANDLE::default();
    let status = unsafe {
        NotifyIpInterfaceChange(
            AF_UNSPEC,
            Some(on_interface_change),
            None,
            // `initial_notification = false`: the frontend already loads current state
            // on mount, and an immediate callback would just duplicate that work.
            false,
            &mut handle,
        )
    };

    if status.is_ok() {
        *handle_guard = Some(handle.0 as isize);
        info!("Subscribed to network interface change notifications");
    } else {
        warn!(
            "Could not subscribe to interface change notifications ({}); the UI will \
             fall back to polling",
            status.0
        );
    }
}

/// Cancels the subscription. Called before shutdown so Windows is not left holding a
/// callback into a process that is tearing down.
pub fn unregister() {
    let Ok(mut handle_guard) = NOTIFY_HANDLE.lock() else {
        return;
    };
    if let Some(raw) = handle_guard.take() {
        let status = unsafe { CancelMibChangeNotify2(HANDLE(raw as *mut std::ffi::c_void)) };
        if status.is_err() {
            warn!("CancelMibChangeNotify2 failed: {}", status.0);
        } else {
            debug!("Unsubscribed from network interface change notifications");
        }
    }
    if let Ok(mut guard) = APP_HANDLE.lock() {
        *guard = None;
    }
}
