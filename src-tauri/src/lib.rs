mod commands;
mod models;
mod db;
mod ai;

use tauri::Manager;
use commands::{scan, organize, history, ai_status, watch, license};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(watch::WatchState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let db_path = app_handle
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&db_path).ok();
            let db_file = db_path.join("cleardeskai.db");
            db::init(&db_file).expect("failed to init database");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan::scan_folder,
            organize::apply_changes,
            history::undo_operation,
            history::get_history,
            ai_status::check_ollama_status,
            ai_status::setup_ollama,
            watch::start_watch,
            watch::stop_watch,
            watch::get_watch_status,
            license::get_license_info,
            license::activate_license,
            license::deactivate_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
