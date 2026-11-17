// The alerts connection that keeps running while the window is hidden. It holds the alerts stream open with an
// alerts-only token, posts a notification for each alert, and after a drop sends where it left off.
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const FIRST_RETRY_SECS: u64 = 1;
const LONGEST_RETRY_SECS: u64 = 60;

// What the connection keeps between launches, in the app's config folder.
#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Saved {
    enabled: Option<bool>,
    server: Option<String>,
    token: Option<String>,
    templates: HashMap<String, String>,
    names: HashMap<String, String>,
    epoch: String,
    seq: i64,
}

#[derive(Default)]
pub struct Alerts {
    task: Mutex<Option<JoinHandle<()>>>,
    connected: AtomicBool,
    // Held while the saved file is read and written back, so a change from the window and one from the connection
    // can't overwrite each other.
    saving: Mutex<()>,
}

#[derive(Serialize)]
pub struct Status {
    running: bool,
    connected: bool,
}

fn saved_path<R: Runtime>(app: &AppHandle<R>) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("alerts.json"))
}

fn load<R: Runtime>(app: &AppHandle<R>) -> Saved {
    saved_path(app).and_then(|path| std::fs::read_to_string(path).ok()).and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default()
}

fn store<R: Runtime>(app: &AppHandle<R>, saved: &Saved) {
    if let Some(path) = saved_path(app) {
        let _ = std::fs::create_dir_all(path.parent().unwrap());
        // Written beside the file and then renamed over it, so a read never sees a half-written file.
        let temporary = path.with_extension("json.tmp");
        if std::fs::write(&temporary, serde_json::to_string(saved).unwrap_or_default()).is_ok() {
            let _ = std::fs::rename(temporary, path);
        }
    }
}

fn update<R: Runtime>(app: &AppHandle<R>, change: impl FnOnce(&mut Saved)) -> Saved {
    let state = app.state::<Alerts>();
    let _saving = state.saving.lock().unwrap();
    let mut saved = load(app);
    change(&mut saved);
    store(app, &saved);
    saved
}

// Starts the connection at launch when the owner wants it and the app has signed in before.
pub fn resume<R: Runtime>(app: &AppHandle<R>) {
    let saved = load(app);
    if saved.enabled.unwrap_or(true) && saved.token.is_some() {
        spawn(app);
    }
}

fn spawn<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<Alerts>();
    let mut task = state.task.lock().unwrap();
    if let Some(old) = task.take() {
        old.abort();
    }
    let handle = app.clone();
    *task = Some(tauri::async_runtime::spawn(async move { run(handle).await }));
}

fn halt<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<Alerts>();
    if let Some(task) = state.task.lock().unwrap().take() {
        task.abort();
    }
    state.connected.store(false, Ordering::Relaxed);
}

// Connects, reads until the socket drops, then waits longer each time before trying again.
async fn run<R: Runtime>(app: AppHandle<R>) {
    let mut retry = FIRST_RETRY_SECS;
    loop {
        match follow(&app).await {
            Ok(Ending::SignedOut) => return,
            Ok(Ending::Dropped) => retry = FIRST_RETRY_SECS,
            Err(_) => {}
        }
        app.state::<Alerts>().connected.store(false, Ordering::Relaxed);
        tokio::time::sleep(Duration::from_secs(retry)).await;
        retry = (retry * 2).min(LONGEST_RETRY_SECS);
    }
}

enum Ending {
    Dropped,
    SignedOut,
}

async fn follow<R: Runtime>(app: &AppHandle<R>) -> Result<Ending, Box<dyn std::error::Error + Send + Sync>> {
    let saved = load(app);
    let (Some(server), Some(token)) = (saved.server, saved.token) else { return Ok(Ending::SignedOut) };
    let url = format!("{}/api/alerts", server.replacen("http", "ws", 1));
    let (mut socket, _) = connect_async(url).await?;
    let hello = json!({ "type": "hello", "token": token, "epoch": saved.epoch, "seq": saved.seq });
    socket.send(Message::Text(hello.to_string().into())).await?;
    let mut ping = tokio::time::interval(Duration::from_secs(25));
    loop {
        tokio::select! {
            _ = ping.tick() => socket.send(Message::Text(json!({ "type": "ping" }).to_string().into())).await?,
            message = socket.next() => match message {
                Some(Ok(Message::Text(text))) => {
                    if receive(app, &text) { return Ok(Ending::SignedOut); }
                }
                Some(Ok(_)) => {}
                _ => return Ok(Ending::Dropped),
            },
        }
    }
}

// Handles one message, and answers whether the server refused the token, which means the device was signed out.
fn receive<R: Runtime>(app: &AppHandle<R>, text: &str) -> bool {
    let Ok(message) = serde_json::from_str::<Value>(text) else { return false };
    match message["type"].as_str() {
        // The server took the token and the connection is caught up.
        Some("ready") => {
            app.state::<Alerts>().connected.store(true, Ordering::Relaxed);
            false
        }
        Some("alert") | Some("reset") => {
            app.state::<Alerts>().connected.store(true, Ordering::Relaxed);
            let epoch = message["epoch"].as_str().unwrap_or_default().to_string();
            let seq = message["seq"].as_i64().unwrap_or_default();
            let saved = update(app, |saved| (saved.epoch, saved.seq) = (epoch, seq));
            if message["type"] == "alert" {
                notify(app, &saved, &message["alert"]);
            }
            false
        }
        Some("error") if message["error"] == "unauthorized" => {
            update(app, |saved| saved.token = None);
            true
        }
        _ => false,
    }
}

// Posts the alert, unless the window is in front, where the app already shows what needs the owner.
fn notify<R: Runtime>(app: &AppHandle<R>, saved: &Saved, alert: &Value) {
    if window_in_front(app) {
        return;
    }
    let kind = alert["kind"].as_str().unwrap_or_default();
    let bot_id = alert["botId"].as_str().unwrap_or_default();
    let name = saved.names.get(bot_id).map(String::as_str).unwrap_or("A bot");
    let template = saved.templates.get(kind).map(String::as_str).unwrap_or("{bot} needs you");
    let _ = app.notification().builder().title("Botsman").body(template.replace("{bot}", name)).show();
}

fn window_in_front<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_webview_window(crate::MAIN_WINDOW).map(|window| window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)).unwrap_or(false)
}

#[tauri::command]
pub fn alerts_is_enabled(app: AppHandle) -> bool {
    load(&app).enabled.unwrap_or(true)
}

#[tauri::command]
pub fn alerts_set_enabled(app: AppHandle, enabled: bool) {
    update(&app, |saved| saved.enabled = Some(enabled));
}

// Saves the server, the alerts-only token, and the wording, then starts the connection.
#[tauri::command]
pub fn alerts_start(app: AppHandle, server: String, token: String, templates: HashMap<String, String>) {
    update(&app, |saved| (saved.server, saved.token, saved.templates) = (Some(server), Some(token), templates));
    spawn(&app);
}

// Stops the connection and drops its token, as when the owner signs out.
#[tauri::command]
pub fn alerts_stop(app: AppHandle) {
    halt(&app);
    update(&app, |saved| {
        saved.token = None;
        saved.epoch = String::new();
        saved.seq = 0;
    });
}

#[tauri::command]
pub fn alerts_set_bot_names(app: AppHandle, names: HashMap<String, String>) {
    update(&app, |saved| saved.names = names);
}

#[tauri::command]
pub fn alerts_status(app: AppHandle) -> Status {
    let state = app.state::<Alerts>();
    let running = state.task.lock().unwrap().is_some();
    Status { running, connected: state.connected.load(Ordering::Relaxed) }
}
