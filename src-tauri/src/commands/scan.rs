use crate::models::{FileInfo, ScanResult, Classification};
use crate::commands::license;
use crate::{ai, db};
use walkdir::WalkDir;
use std::fs;
use chrono::{DateTime, Utc};
use tauri::AppHandle;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    phase: String,
    processed: usize,
    total: usize,
}

#[tauri::command]
pub async fn scan_folder(app: AppHandle, path: String) -> Result<ScanResult, String> {
    // Track this folder as recently scanned
    let _ = db::add_recent_folder(&path);

    let mut files = collect_files(&path)?;

    // Emit file count so frontend shows "Found X files, classifying..."
    let _ = tauri::Emitter::emit(&app, "scan-progress", ScanProgress {
        phase: "collecting".to_string(),
        processed: files.len(),
        total: files.len(),
    });

    // Enforce free tier file limit
    if let Some(limit) = license::get_file_limit() {
        if files.len() > limit {
            files.truncate(limit);
        }
    }

    let classifications = classify_with_progress(&app, &files, &path).await?;

    Ok(ScanResult {
        files: files.len(),
        classifications,
    })
}

async fn classify_with_progress(
    app: &AppHandle,
    files: &[FileInfo],
    base_folder: &str,
) -> Result<Vec<Classification>, String> {
    let batch_size = 8;
    let total = files.len();
    let mut all = Vec::new();
    let mut processed = 0;

    for chunk in files.chunks(batch_size) {
        let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
            phase: "classifying".to_string(),
            processed,
            total,
        });

        let batch = ai::classify_batch_public(chunk, base_folder).await?;
        processed += chunk.len();
        all.extend(batch);
    }

    let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
        phase: "done".to_string(),
        processed: total,
        total,
    });

    Ok(all)
}

#[tauri::command]
pub fn get_recent_folders() -> Result<Vec<(String, String, i64)>, String> {
    db::get_recent_folders(10).map_err(|e| e.to_string())
}

fn collect_files(path: &str) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();

    // Read configurable scan depth (default: 5)
    let max_depth: usize = db::get_setting("scan_depth")
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5);

    // Read user-defined exclude patterns (comma-separated)
    let extra_excludes: Vec<String> = db::get_setting("scan_excludes")
        .ok()
        .flatten()
        .map(|v| v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();

    // Read configurable min file size in bytes (default: 1 = skip empty only)
    let min_size: u64 = db::get_setting("scan_min_size")
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);

    // Default excludes always applied
    let default_excludes = ["node_modules", "__pycache__", "Thumbs.db", ".git", "target", "dist", "build"];

    let walker = WalkDir::new(path)
        .max_depth(max_depth)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            if name.starts_with('.') { return false; }
            if default_excludes.iter().any(|ex| name == *ex) { return false; }
            if extra_excludes.iter().any(|ex| name == *ex) { return false; }
            true
        });

    for entry in walker.filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path();
        let metadata = match fs::metadata(file_path) {
            Ok(m) => m,
            Err(_) => continue, // Skip files with permission/symlink errors
        };

        if metadata.len() < min_size {
            continue;
        }

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
