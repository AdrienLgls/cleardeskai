use std::fs;
use std::path::Path;
use uuid::Uuid;

/// Move a file, falling back to copy+delete if rename fails (cross-filesystem)
pub fn move_file(source: &Path, dest: &Path) -> Result<(), String> {
    match fs::rename(source, dest) {
        Ok(()) => Ok(()),
        Err(_) => {
            fs::copy(source, dest)
                .map_err(|e| format!("Failed to copy {}: {}", source.display(), e))?;
            fs::remove_file(source)
                .map_err(|e| format!("Copied but failed to remove original {}: {}", source.display(), e))?;
            Ok(())
        }
    }
}

/// Generate a unique destination path if a conflict exists
pub fn resolve_conflict(dest: &Path) -> std::path::PathBuf {
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

    parent.join(format!("{}-{}{}", stem, Uuid::new_v4(), ext))
}
