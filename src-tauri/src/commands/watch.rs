use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;
use walkdir::WalkDir;

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
    app: AppHandle,
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
    let watched_folders = folders.clone();

    tokio::spawn(async move {
        let interval = std::time::Duration::from_secs(interval_secs);
        let mut known_files: std::collections::HashSet<String> = std::collections::HashSet::new();

        // Initial scan to populate known files
        for folder in &watched_folders {
            for entry in WalkDir::new(folder).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    known_files.insert(entry.path().to_string_lossy().to_string());
                }
            }
        }

        while running.load(Ordering::Relaxed) {
            tokio::time::sleep(interval).await;

            if !running.load(Ordering::Relaxed) {
                break;
            }

            let mut new_files = Vec::new();
            let mut current_files: std::collections::HashSet<String> = std::collections::HashSet::new();

            for folder in &watched_folders {
                for entry in WalkDir::new(folder).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                    if entry.file_type().is_file() {
                        let path = entry.path().to_string_lossy().to_string();
                        if !known_files.contains(&path) {
                            new_files.push(path.clone());
                        }
                        current_files.insert(path);
                    }
                }
            }

            if !new_files.is_empty() {
                let count = new_files.len();
                let body = if count == 1 {
                    format!("New file detected: {}", new_files[0].rsplit('/').next().unwrap_or(&new_files[0]))
                } else {
                    format!("{} new files detected in watched folders", count)
                };

                let _ = app.notification()
                    .builder()
                    .title("ClearDeskAI")
                    .body(&body)
                    .show();

                // Emit event to frontend
                let _ = tauri::Emitter::emit(&app, "watch-new-files", &new_files);
            }

            known_files = current_files;
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
