mod update;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

static QUITTING: AtomicBool = AtomicBool::new(false);
static UPDATE_DOWNLOAD: Mutex<bool> = Mutex::new(false);
const SERVICE: &str = "hermes-bots";
const ACCOUNT: &str = "login";

#[cfg(windows)]
fn set_aumid() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
    let wide: Vec<u16> = "com.hermesbots.phase0"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        SetCurrentProcessExplicitAppUserModelID(wide.as_ptr());
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn reveal(app: &AppHandle) {
    let _ = app.emit("tray-open", ());
    show_main(app);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("window icon".into()))?;
    TrayIconBuilder::with_id("tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Hermes Bots")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => reveal(app),
            "quit" => {
                QUITTING.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                reveal(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg(windows)]
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|err| err.to_string())
}

#[tauri::command]
fn vault_load() -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        match entry()?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(err.to_string()),
        }
    }
    #[cfg(not(windows))]
    {
        Err("The secure store is Windows Credential Manager.".into())
    }
}

#[tauri::command]
fn vault_save(payload: String) -> Result<(), String> {
    if payload.len() > 16_384 {
        return Err("vault payload is too large".into());
    }
    serde_json::from_str::<serde_json::Value>(&payload).map_err(|_| "vault payload is not json".to_string())?;
    #[cfg(windows)]
    {
        entry()?.set_password(&payload).map_err(|err| err.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = payload;
        Err("The secure store is Windows Credential Manager.".into())
    }
}

#[tauri::command]
fn vault_clear_secret() -> Result<(), String> {
    #[cfg(windows)]
    {
        let stored = entry()?;
        let raw = match stored.get_password() {
            Ok(value) => value,
            Err(keyring::Error::NoEntry) => return Ok(()),
            Err(err) => return Err(err.to_string()),
        };
        let mut value: serde_json::Value =
            serde_json::from_str(&raw).map_err(|_| "stored login is not json".to_string())?;
        if let Some(object) = value.as_object_mut() {
            object.insert("refreshToken".into(), serde_json::Value::String(String::new()));
        }
        stored
            .set_password(&value.to_string())
            .map_err(|err| err.to_string())
    }
    #[cfg(not(windows))]
    {
        Err("The secure store is Windows Credential Manager.".into())
    }
}

fn emit_update_progress(app: &AppHandle, received: u64, total: Option<u64>) {
    let _ = app.emit(
        "update-download-progress",
        serde_json::json!({ "received": received, "total": total }),
    );
}

#[tauri::command]
fn apply_update(
    app: tauri::AppHandle,
    url: String,
    sha256: String,
    size: u64,
    build: u64,
) -> Result<(), String> {
    {
        let mut busy = UPDATE_DOWNLOAD
            .lock()
            .map_err(|_| "An update download is already in progress.".to_string())?;
        if *busy {
            return Err("An update download is already in progress.".into());
        }
        *busy = true;
    }
    let result = apply_update_inner(&app, url, sha256, size, build);
    if let Ok(mut busy) = UPDATE_DOWNLOAD.lock() {
        *busy = false;
    }
    result
}

fn apply_update_inner(
    app: &AppHandle,
    url: String,
    sha256: String,
    size: u64,
    build: u64,
) -> Result<(), String> {
    let app_for_progress = app.clone();
    let path: PathBuf = update::download_verified_installer(
        &url,
        build,
        &sha256,
        size,
        move |received, total| emit_update_progress(&app_for_progress, received, total),
    )?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new(&path)
            .creation_flags(0x0000_0008 | 0x0000_0200)
            .spawn()
            .map_err(|error| format!("Could not start the installer {}: {error}", path.display()))?;
        QUITTING.store(true, Ordering::SeqCst);
        app.exit(0);
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, path);
        Err("The installer is a Windows exe.".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    set_aumid();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if QUITTING.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![vault_load, vault_save, vault_clear_secret, apply_update])
        .run(tauri::generate_context!())
        .expect("hermes bots failed to start");
}
