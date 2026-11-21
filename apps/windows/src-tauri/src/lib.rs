mod alerts;
mod alerts_stream;
mod autostart;
mod tokens;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_opener::OpenerExt;

pub const MAIN_WINDOW: &str = "main";

// Starts the app: one copy only, HTTP from Rust, the updater, token storage, the tray icon, notifications,
// auto-start, links opened in the browser, and the alerts connection.
pub fn run() {
    let context = tauri::generate_context!();
    // The product name, so a preview app that fails to start says Botsman Preview.
    let name = context.package_info().name.clone();
    tauri::Builder::default()
        // Starting Botsman again, for example from the Start menu while it sits in the tray, shows the running copy.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main_window(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![autostart::HIDDEN_ARG])))
        .manage(alerts::Alerts::default())
        .invoke_handler(tauri::generate_handler![
            tokens::load_tokens,
            tokens::save_tokens,
            tokens::clear_tokens,
            alerts::alerts_is_enabled,
            alerts::alerts_set_enabled,
            alerts::alerts_start,
            alerts::alerts_stop,
            alerts::alerts_set_bot_names,
            alerts::alerts_status,
            autostart::autostart_is_enabled,
            autostart::autostart_set,
            open_link
        ])
        .on_window_event(|window, event| {
            // Closing the window keeps Botsman in the tray, so alerts keep arriving. Quit is in the tray menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            build_tray(app.handle())?;
            if std::env::args().any(|arg| arg == autostart::HIDDEN_ARG) {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.hide();
                }
            }
            alerts::resume(app.handle());
            Ok(())
        })
        .run(context)
        .unwrap_or_else(|error| panic!("{name} could not start: {error}"));
}

// Adds the tray icon with its menu: open the window, or quit.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", format!("Open {}", app.package_info().name), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    // The product name tells the preview app's tray icon apart from the real app's.
    let mut tray = TrayIconBuilder::new().tooltip(&app.package_info().name).menu(&menu);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_tray_icon_event(|tray, event| {
        if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
            show_main_window(tray.app_handle());
        }
    })
    .on_menu_event(|app, event| match event.id.as_ref() {
        "open" => show_main_window(app),
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;
    Ok(())
}

// Opens a web or mail link from a reply in the default browser or mail app, never in the app's own window.
#[tauri::command]
fn open_link(app: AppHandle, url: String) {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:") {
        let _ = app.opener().open_url(url, None::<&str>);
    }
}

// Brings the main window back from the tray.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
