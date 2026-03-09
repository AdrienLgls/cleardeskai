use crate::db;
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

    // Persist watched folders to SQLite
    for folder in &folders {
        let _ = db::add_watched_folder(folder, interval_secs);
    }

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

#[tauri::command]
pub async fn get_saved_watched_folders() -> Result<Vec<String>, String> {
    let folders = db::get_watched_folders().map_err(|e| e.to_string())?;
    Ok(folders.into_iter().map(|(path, _, _)| path).collect())
}

#[tauri::command]
pub async fn remove_watched_folder(path: String) -> Result<(), String> {
    db::remove_watched_folder(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn auto_resume_watch(
    app: AppHandle,
    state: State<'_, WatchState>,
) -> Result<bool, String> {
    let enabled = db::get_setting("watch_auto_resume")
        .ok()
        .flatten()
        .map(|v| v == "true")
        .unwrap_or(false);

    if !enabled || state.running.load(Ordering::Relaxed) {
        return Ok(false);
    }

    let saved = db::get_watched_folders().map_err(|e| e.to_string())?;
    if saved.is_empty() {
        return Ok(false);
    }

    let folders: Vec<String> = saved.iter().map(|(p, _, _)| p.clone()).collect();
    let interval = saved.first().map(|(_, i, _)| *i as u64).unwrap_or(60);

    start_watch(app, state, folders, interval).await?;
    Ok(true)
}
