use crate::models::{FileChange, ApplyResult};
use crate::db;
use crate::fs_utils::{move_file, resolve_conflict};
use uuid::Uuid;
use chrono::Utc;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyProgress {
    processed: usize,
    total: usize,
    current_file: String,
}

#[tauri::command]
pub async fn apply_changes(app: AppHandle, changes: Vec<FileChange>) -> Result<ApplyResult, String> {
    let operation_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now().to_rfc3339();

    // Validate all source files exist before starting
    for change in &changes {
        let source = Path::new(&change.source);
        if !source.exists() {
            return Err(format!("Source file not found: {}", change.source));
        }
    }

    let mut db_changes = Vec::new();

    let total = changes.len();
    for (i, change) in changes.iter().enumerate() {
        let source_path = Path::new(&change.source);
        // Normalize path separators for Windows compatibility
        let normalized_dest = change.destination.replace('/', "\\");
        let mut dest_path = std::path::PathBuf::from(&normalized_dest);
        let file_name = source_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let _ = tauri::Emitter::emit(&app, "apply-progress", ApplyProgress {
            processed: i,
            total,
            current_file: file_name,
        });

        // Create destination directory
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }

        // Resolve naming conflicts
        dest_path = resolve_conflict(&dest_path);

        // Move file (with cross-fs fallback)
        move_file(source_path, &dest_path)?;

        db_changes.push((
            change.source.clone(),
            dest_path.to_string_lossy().to_string(),
            change.new_name.clone(),
            change.change_type.clone(),
        ));
    }

    let description = format!("Organized {} files", changes.len());
    db::save_operation(&operation_id, &timestamp, &description, &db_changes)
        .map_err(|e| format!("Failed to save operation: {}", e))?;

    Ok(ApplyResult { operation_id })
}
