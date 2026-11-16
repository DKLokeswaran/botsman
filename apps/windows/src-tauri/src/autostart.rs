// Starting Botsman with Windows, hidden in the tray, so alerts arrive without opening the app.
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

pub const HIDDEN_ARG: &str = "--hidden";

#[tauri::command]
pub fn autostart_is_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn autostart_set(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    let result = if enabled { launcher.enable() } else { launcher.disable() };
    result.map_err(|error| error.to_string())
}
