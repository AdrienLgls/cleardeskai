use crate::db;

#[tauri::command]
pub fn save_setting(key: String, value: String) -> Result<(), String> {
    db::set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_setting(key: String) -> Result<Option<String>, String> {
    db::get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_setting(key: String) -> Result<(), String> {
    db::delete_setting(&key).map_err(|e| e.to_string())
}
