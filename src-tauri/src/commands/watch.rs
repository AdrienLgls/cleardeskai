use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct WatchState {
    pub running: Arc<AtomicBool>,
    pub folders: Arc<Mutex<Vec<String>>>,
}

impl Default for WatchState {
    fn default() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            folders: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[tauri::command]
pub async fn start_watch(
    state: State<'_, WatchState>,
    folders: Vec<String>,
    interval_secs: u64,
) -> Result<(), String> {
    if state.running.load(Ordering::Relaxed) {
        return Err("Watch mode is already running".to_string());
    }

    state.running.store(true, Ordering::Relaxed);
    *state.folders.lock().await = folders.clone();

    let running = state.running.clone();
    let _folders = folders.clone();

    tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(interval_secs);
        while running.load(Ordering::Relaxed) {
            // TODO: scan folders for new files and classify them
            // For now, just sleep and check again
            tokio::time::sleep(interval).await;
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_watch(state: State<'_, WatchState>) -> Result<(), String> {
    state.running.store(false, Ordering::Relaxed);
    state.folders.lock().await.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_watch_status(state: State<'_, WatchState>) -> Result<(bool, Vec<String>), String> {
    let running = state.running.load(Ordering::Relaxed);
    let folders = state.folders.lock().await.clone();
    Ok((running, folders))
}
