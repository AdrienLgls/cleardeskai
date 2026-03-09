use crate::models::{FileInfo, ScanResult, Classification};
use crate::commands::license;
use crate::{ai, db, rules};
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
    rule_classified: usize,
    ai_classified: usize,
}

#[tauri::command]
pub async fn scan_folder(app: AppHandle, path: String) -> Result<ScanResult, String> {
    // Track this folder as recently scanned
    let _ = db::add_recent_folder(&path);

    let mut files = collect_files(&path)?;

    let total = files.len();

    // Emit file count
    let _ = tauri::Emitter::emit(&app, "scan-progress", ScanProgress {
        phase: "collecting".to_string(),
        processed: total,
        total,
        rule_classified: 0,
        ai_classified: 0,
    });

    // Enforce free tier file limit
    if let Some(limit) = license::get_file_limit() {
        if files.len() > limit {
            files.truncate(limit);
        }
    }

    let classifications = classify_hybrid(&app, &files, &path).await?;

    Ok(ScanResult {
        files: files.len(),
        classifications,
    })
}

/// Hybrid classification: rules first (instant), AI only for ambiguous files.
async fn classify_hybrid(
    app: &AppHandle,
    files: &[FileInfo],
    base_folder: &str,
) -> Result<Vec<Classification>, String> {
    let total = files.len();
    let mut all_classifications: Vec<(usize, Classification)> = Vec::with_capacity(total);
    let mut needs_ai: Vec<(usize, FileInfo)> = Vec::new();

    // Phase 1: Rule-based classification (instant)
    for (idx, file) in files.iter().enumerate() {
        if let Some(classification) = rules::classify_by_rules(file, base_folder) {
            all_classifications.push((idx, classification));
        } else {
            needs_ai.push((idx, file.clone()));
        }
    }

    let rule_count = all_classifications.len();

    let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
        phase: "rules_done".to_string(),
        processed: rule_count,
        total,
        rule_classified: rule_count,
        ai_classified: 0,
    });

    // Phase 2: AI classification for remaining files (if any and Ollama is available)
    if !needs_ai.is_empty() {
        let ai_files: Vec<&FileInfo> = needs_ai.iter().map(|(_, f)| f).collect();

        // Check if Ollama is available before attempting AI classification
        let (status, _, _) = ai::check_status().await;
        if status == "running" {
            let batch_size = 8;
            let ai_total = ai_files.len();
            let mut ai_processed = 0;

            for chunk_indices in (0..ai_files.len()).collect::<Vec<_>>().chunks(batch_size) {
                let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
                    phase: "classifying".to_string(),
                    processed: rule_count + ai_processed,
                    total,
                    rule_classified: rule_count,
                    ai_classified: ai_processed,
                });

                let chunk_files: Vec<FileInfo> = chunk_indices.iter()
                    .map(|&i| ai_files[i].clone())
                    .collect();

                match ai::classify_batch_public(&chunk_files, base_folder).await {
                    Ok(batch_results) => {
                        for (ci, result) in chunk_indices.iter().zip(batch_results) {
                            let original_idx = needs_ai[*ci].0;
                            all_classifications.push((original_idx, result));
                        }
                        ai_processed += chunk_files.len();
                    }
                    Err(e) => {
                        // AI failed — classify remaining as "Other" with low confidence
                        for &ci in chunk_indices {
                            let original_idx = needs_ai[ci].0;
                            let file = &needs_ai[ci].1;
                            all_classifications.push((original_idx, Classification {
                                file: file.clone(),
                                proposed_folder: format!("{}/Other", base_folder),
                                proposed_name: None,
                                confidence: 0.3,
                                category: "Other".to_string(),
                                reasoning: format!("AI classification failed: {}. Filed as Other.", e),
                            }));
                            ai_processed += 1;
                        }
                    }
                }
            }

            let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
                phase: "done".to_string(),
                processed: total,
                total,
                rule_classified: rule_count,
                ai_classified: ai_total,
            });
        } else {
            // Ollama not available — classify remaining as "Other"
            for (original_idx, file) in &needs_ai {
                all_classifications.push((*original_idx, Classification {
                    file: file.clone(),
                    proposed_folder: format!("{}/Other", base_folder),
                    proposed_name: None,
                    confidence: 0.3,
                    category: "Other".to_string(),
                    reasoning: "No rule matched and AI is not available. Install Ollama for better classification.".to_string(),
                }));
            }

            let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
                phase: "done".to_string(),
                processed: total,
                total,
                rule_classified: rule_count,
                ai_classified: 0,
            });
        }
    } else {
        // All files classified by rules — no AI needed
        let _ = tauri::Emitter::emit(app, "scan-progress", ScanProgress {
            phase: "done".to_string(),
            processed: total,
            total,
            rule_classified: rule_count,
            ai_classified: 0,
        });
    }

    // Sort by original file order
    all_classifications.sort_by_key(|(idx, _)| *idx);
    Ok(all_classifications.into_iter().map(|(_, c)| c).collect())
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
            Err(_) => continue,
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
