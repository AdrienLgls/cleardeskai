use crate::models::{FileInfo, ScanResult};
use crate::ai;
use walkdir::WalkDir;
use std::fs;
use chrono::{DateTime, Utc};

#[tauri::command]
pub async fn scan_folder(path: String) -> Result<ScanResult, String> {
    let files = collect_files(&path)?;
    let classifications = ai::classify_files(&files, &path).await?;

    Ok(ScanResult {
        files: files.len(),
        classifications,
    })
}

fn collect_files(path: &str) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();

    for entry in WalkDir::new(path).max_depth(5).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path();
        let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;

        let name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let extension = file_path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        let mime_type = mime_guess::from_path(file_path)
            .first_or_octet_stream()
            .to_string();

        let modified: DateTime<Utc> = metadata
            .modified()
            .map(|t| t.into())
            .unwrap_or_else(|_| Utc::now());

        let content_preview = read_preview(file_path, &mime_type);

        files.push(FileInfo {
            path: file_path.to_string_lossy().to_string(),
            name,
            extension,
            size: metadata.len(),
            modified: modified.to_rfc3339(),
            mime_type,
            content_preview,
        });
    }

    Ok(files)
}

fn read_preview(path: &std::path::Path, mime_type: &str) -> Option<String> {
    if mime_type.starts_with("text/") || mime_type == "application/json" {
        fs::read_to_string(path)
            .ok()
            .map(|s| s.chars().take(500).collect())
    } else {
        None
    }
}
