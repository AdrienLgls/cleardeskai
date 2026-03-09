use crate::models::{FileChange, ApplyResult};
use crate::db;
use uuid::Uuid;
use chrono::Utc;
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn apply_changes(changes: Vec<FileChange>) -> Result<ApplyResult, String> {
    let operation_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now().to_rfc3339();

    let mut db_changes = Vec::new();

    for change in &changes {
        let dest_path = Path::new(&change.destination);

        // Create destination directory
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }

        // Move/rename file
        fs::rename(&change.source, &change.destination)
            .map_err(|e| format!("Failed to move {}: {}", change.source, e))?;

        db_changes.push((
            change.source.clone(),
            change.destination.clone(),
            change.new_name.clone(),
            change.change_type.clone(),
        ));
    }

    let description = format!("Organized {} files", changes.len());
    db::save_operation(&operation_id, &timestamp, &description, &db_changes)
        .map_err(|e| format!("Failed to save operation: {}", e))?;

    Ok(ApplyResult { operation_id })
}
