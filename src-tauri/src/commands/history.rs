use crate::models::{Operation, FileChange};
use crate::db;
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn get_history() -> Result<Vec<Operation>, String> {
    let ops = db::get_all_operations().map_err(|e| e.to_string())?;

    let mut operations = Vec::new();
    for (id, timestamp, description, undone) in ops {
        let changes_raw = db::get_operation_changes(&id).map_err(|e| e.to_string())?;
        let changes: Vec<FileChange> = changes_raw
            .into_iter()
            .map(|(source, dest, new_name, change_type)| FileChange {
                source,
                destination: dest,
                new_name,
                change_type,
            })
            .collect();

        operations.push(Operation {
            id,
            timestamp,
            description,
            changes,
            undone,
        });
    }

    Ok(operations)
}

#[tauri::command]
pub async fn undo_operation(operation_id: String) -> Result<(), String> {
    let changes = db::get_operation_changes(&operation_id).map_err(|e| e.to_string())?;

    // Reverse all changes
    for (source, dest, _new_name, _change_type) in changes.iter().rev() {
        let dest_path = Path::new(dest);
        let source_path = Path::new(source);

        if dest_path.exists() {
            // Ensure source parent dir exists
            if let Some(parent) = source_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create dir for undo: {}", e))?;
            }
            fs::rename(dest_path, source_path)
                .map_err(|e| format!("Failed to undo move: {}", e))?;
        }
    }

    db::mark_undone(&operation_id).map_err(|e| e.to_string())?;
    Ok(())
}
