//! The session's tokens, kept in Windows Credential Manager so they outlive the app and stay out of its files.

use keyring::v1::{Entry, Error};

const SERVICE: &str = "dev.botsman.app";
const ACCOUNT: &str = "session";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

/// The stored tokens, or nothing when the owner is signed out.
#[tauri::command]
pub fn load_tokens() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(tokens) => Ok(Some(tokens)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn save_tokens(tokens: String) -> Result<(), String> {
    entry()?.set_password(&tokens).map_err(|error| error.to_string())
}

/// Removes the tokens. Having none to remove is not an error.
#[tauri::command]
pub fn clear_tokens() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}
