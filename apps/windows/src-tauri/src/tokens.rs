//! The session's tokens, kept in Windows Credential Manager so they outlive the app and stay out of its files.

use keyring::v1::{Entry, Error};
use tauri::AppHandle;

const ACCOUNT: &str = "session";

// Each app keeps its own entry under its app id, so the preview app never shares the real app's sign-in.
fn entry(app: &AppHandle) -> Result<Entry, String> {
    Entry::new(&app.config().identifier, ACCOUNT).map_err(|error| error.to_string())
}

/// The stored tokens, or nothing when the owner is signed out.
#[tauri::command]
pub fn load_tokens(app: AppHandle) -> Result<Option<String>, String> {
    match entry(&app)?.get_password() {
        Ok(tokens) => Ok(Some(tokens)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn save_tokens(app: AppHandle, tokens: String) -> Result<(), String> {
    entry(&app)?.set_password(&tokens).map_err(|error| error.to_string())
}

/// Removes the tokens. Having none to remove is not an error.
#[tauri::command]
pub fn clear_tokens(app: AppHandle) -> Result<(), String> {
    match entry(&app)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}
