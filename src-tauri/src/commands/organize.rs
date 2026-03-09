use crate::models::{FileChange, ApplyResult};
use crate::db;
use uuid::Uuid;
use chrono::Utc;
use std::fs;
use std::path::Path;

/// Move a file, falling back to copy+delete if rename fails (cross-filesystem)
fn move_file(source: &Path, dest: &Path) -> Result<(), String> {
    match fs::rename(source, dest) {
        Ok(()) => Ok(()),
        Err(_) => {
            // Fallback: copy then delete original
            fs::copy(source, dest)
                .map_err(|e| format!("Failed to copy {}: {}", source.display(), e))?;
            fs::remove_file(source)
                .map_err(|e| format!("Copied but failed to remove original {}: {}", source.display(), e))?;
            Ok(())
        }
    }
}

/// Generate a unique destination path if a conflict exists
fn resolve_conflict(dest: &Path) -> std::path::PathBuf {
    if !dest.exists() {
        return dest.to_path_buf();
    }

    let stem = dest.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = dest.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let parent = dest.parent().unwrap_or(Path::new("."));

    for i in 1..100 {
        let candidate = parent.join(format!("{} ({}){}", stem, i, ext));
        if !candidate.exists() {
            return candidate;
        }
    }

    // Extremely unlikely fallback
    parent.join(format!("{}-{}{}", stem, Uuid::new_v4(), ext))
}

#[tauri::command]
pub async fn apply_changes(changes: Vec<FileChange>) -> Result<ApplyResult, String> {
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

    for change in &changes {
        let source_path = Path::new(&change.source);
        let mut dest_path = std::path::PathBuf::from(&change.destination);

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
