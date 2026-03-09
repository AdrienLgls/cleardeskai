mod commands;
mod models;
mod db;
mod ai;

use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};
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

            // Database init
            let db_path = app_handle
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&db_path).ok();
            let db_file = db_path.join("cleardeskai.db");
            db::init(&db_file).expect("failed to init database");

            // System tray
            let show = MenuItem::with_id(app, "show", "Show ClearDeskAI", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .tooltip("ClearDeskAI")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

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
