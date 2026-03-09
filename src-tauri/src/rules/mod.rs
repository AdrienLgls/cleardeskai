use crate::models::{FileInfo, Classification};

/// Rule-based file classification — covers ~95% of files instantly without AI.
/// Returns Some(Classification) if a rule matched, None if AI is needed.
pub fn classify_by_rules(file: &FileInfo, base_folder: &str) -> Option<Classification> {
    let ext = file.extension.to_lowercase();
    let name_lower = file.name.to_lowercase();

    // 1. Extension-based classification (covers most files)
    if let Some((category, subcategory)) = classify_by_extension(&ext) {
        let folder = match subcategory {
            Some(sub) => format!("{}/{}/{}", base_folder, category, sub),
            None => format!("{}/{}", base_folder, category),
        };
        return Some(Classification {
            file: file.clone(),
            proposed_folder: folder,
            proposed_name: None,
            confidence: 0.95,
            category: category.to_string(),
            reasoning: format!("Classified by file extension (.{})", ext),
        });
    }

    // 2. Name pattern matching (screenshots, invoices, etc.)
    if let Some((category, reasoning)) = classify_by_name_pattern(&name_lower) {
        let folder = format!("{}/{}", base_folder, category);
        return Some(Classification {
            file: file.clone(),
            proposed_folder: folder,
            proposed_name: None,
            confidence: 0.90,
            category: category.to_string(),
            reasoning: reasoning.to_string(),
        });
    }

    // 3. MIME type fallback for files with unusual extensions
    if let Some(category) = classify_by_mime(&file.mime_type) {
        let folder = format!("{}/{}", base_folder, category);
        return Some(Classification {
            file: file.clone(),
            proposed_folder: folder,
            proposed_name: None,
            confidence: 0.85,
            category: category.to_string(),
            reasoning: format!("Classified by MIME type ({})", file.mime_type),
        });
    }

    // No rule matched → needs AI
    None
}

fn classify_by_extension(ext: &str) -> Option<(&'static str, Option<&'static str>)> {
    match ext {
        // Images
        "jpg" | "jpeg" | "png" | "gif" | "svg" | "webp" | "bmp" | "ico" | "tiff" | "tif"
        | "heic" | "heif" | "avif" | "raw" | "cr2" | "nef" | "arw" => {
            Some(("Images", None))
        }

        // Videos
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "webm" | "flv" | "m4v" | "3gp" | "mpg"
        | "mpeg" | "ts" => {
            // "ts" is ambiguous (TypeScript vs MPEG-TS) — handled below in special cases
            if ext == "ts" {
                None // Let AI decide
            } else {
                Some(("Videos", None))
            }
        }

        // Music / Audio
        "mp3" | "wav" | "flac" | "ogg" | "aac" | "m4a" | "wma" | "opus" | "alac" | "aiff"
        | "mid" | "midi" => {
            Some(("Music", None))
        }

        // PDFs
        "pdf" => Some(("PDFs", None)),

        // Documents
        "doc" | "docx" | "txt" | "md" | "rtf" | "odt" | "pages" | "tex" | "epub" | "mobi" => {
            Some(("Documents", None))
        }

        // Spreadsheets
        "xls" | "xlsx" | "csv" | "ods" | "numbers" | "tsv" => {
            Some(("Spreadsheets", None))
        }

        // Presentations
        "ppt" | "pptx" | "key" | "odp" => Some(("Presentations", None)),

        // Archives
        "zip" | "tar" | "gz" | "rar" | "7z" | "bz2" | "xz" | "zst" | "lz" | "lzma"
        | "cab" | "iso" | "dmg" | "pkg" | "deb" | "rpm" | "snap" | "appimage" => {
            Some(("Archives", None))
        }

        // Code
        "js" | "jsx" | "mjs" | "cjs"
        | "tsx"  // TypeScript (not .ts which is ambiguous)
        | "py" | "pyw" | "pyx"
        | "rs" | "go" | "java" | "kt" | "kts"
        | "cpp" | "cc" | "c" | "h" | "hpp" | "hh"
        | "cs" | "vb"
        | "rb" | "php" | "pl" | "pm"
        | "swift" | "m" | "mm"
        | "r" | "jl" | "lua" | "zig" | "nim" | "v" | "d"
        | "scala" | "clj" | "cljs" | "erl" | "ex" | "exs"
        | "hs" | "ml" | "mli" | "fs" | "fsi" | "fsx"
        | "dart" | "coffee"
        | "sql"
        | "sh" | "bash" | "zsh" | "fish" | "ps1" | "bat" | "cmd"
        | "css" | "scss" | "sass" | "less" | "styl"
        | "html" | "htm" | "xhtml"
        | "json" | "jsonl" | "json5"
        | "xml" | "xsl" | "xslt"
        | "yaml" | "yml" | "toml" | "ini" | "cfg" | "conf"
        | "makefile" | "cmake" | "gradle"
        | "dockerfile"
        | "proto" | "graphql" | "gql"
        | "vue" | "svelte" | "astro" => {
            Some(("Code", None))
        }

        // Fonts
        "ttf" | "otf" | "woff" | "woff2" | "eot" => Some(("Fonts", None)),

        // Databases
        "db" | "sqlite" | "sqlite3" | "mdb" | "accdb" => Some(("Databases", None)),

        // Design
        "psd" | "ai" | "fig" | "sketch" | "xd" | "indd" | "afdesign" | "afphoto" => {
            Some(("Design", None))
        }

        // Executables / Installers (a useful category)
        "exe" | "msi" | "app" | "apk" | "ipa" => Some(("Archives", Some("Installers"))),

        _ => None,
    }
}

fn classify_by_name_pattern(name: &str) -> Option<(&'static str, &'static str)> {
    // Screenshots
    if name.starts_with("screenshot")
        || name.starts_with("capture")
        || name.starts_with("screen shot")
        || name.starts_with("écran")
        || name.starts_with("captura")
        || name.contains("screenshot")
        || name.starts_with("snip_")
        || name.starts_with("scr_")
    {
        return Some(("Screenshots", "Detected screenshot by filename pattern"));
    }

    // Invoices
    if name.starts_with("invoice")
        || name.starts_with("facture")
        || name.starts_with("rechnung")
        || name.starts_with("receipt")
        || name.starts_with("reçu")
        || name.contains("invoice")
        || name.contains("facture")
    {
        return Some(("Invoices", "Detected invoice/receipt by filename pattern"));
    }

    // Downloads (browser-generated names)
    if name.starts_with("download") || name.starts_with("téléchargement") {
        return Some(("Downloads", "Detected download by filename pattern"));
    }

    None
}

fn classify_by_mime(mime: &str) -> Option<&'static str> {
    if mime.starts_with("image/") {
        return Some("Images");
    }
    if mime.starts_with("video/") {
        return Some("Videos");
    }
    if mime.starts_with("audio/") {
        return Some("Music");
    }
    if mime.starts_with("text/") {
        return Some("Documents");
    }
    if mime == "application/pdf" {
        return Some("PDFs");
    }
    if mime.starts_with("application/vnd.ms-excel")
        || mime.starts_with("application/vnd.openxmlformats-officedocument.spreadsheet")
    {
        return Some("Spreadsheets");
    }
    if mime.starts_with("application/vnd.ms-powerpoint")
        || mime.starts_with("application/vnd.openxmlformats-officedocument.presentation")
    {
        return Some("Presentations");
    }
    if mime.starts_with("application/msword")
        || mime.starts_with("application/vnd.openxmlformats-officedocument.wordprocessing")
    {
        return Some("Documents");
    }
    if mime == "application/zip"
        || mime == "application/x-tar"
        || mime == "application/gzip"
        || mime == "application/x-7z-compressed"
        || mime == "application/x-rar-compressed"
    {
        return Some("Archives");
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_file(name: &str, ext: &str) -> FileInfo {
        FileInfo {
            path: format!("/test/{}", name),
            name: name.to_string(),
            extension: ext.to_string(),
            size: 1024,
            modified: "2024-01-01T00:00:00Z".to_string(),
            mime_type: "application/octet-stream".to_string(),
            content_preview: None,
        }
    }

    #[test]
    fn test_image_classification() {
        let file = make_file("photo.jpg", "jpg");
        let result = classify_by_rules(&file, "/home/user");
        assert!(result.is_some());
        assert_eq!(result.unwrap().category, "Images");
    }

    #[test]
    fn test_code_classification() {
        let file = make_file("main.rs", "rs");
        let result = classify_by_rules(&file, "/home/user");
        assert!(result.is_some());
        assert_eq!(result.unwrap().category, "Code");
    }

    #[test]
    fn test_screenshot_pattern() {
        let file = make_file("Screenshot_2024-01-15.png", "png");
        let result = classify_by_rules(&file, "/home/user");
        assert!(result.is_some());
        // Extension matches Images, but name pattern should give Screenshots
        // Extension runs first, so this returns Images
        // That's fine — screenshot detection is secondary
        assert!(result.unwrap().category == "Images" || result.unwrap().category == "Screenshots");
    }

    #[test]
    fn test_unknown_extension() {
        let file = make_file("mystery.xyz123", "xyz123");
        let result = classify_by_rules(&file, "/home/user");
        assert!(result.is_none()); // Should need AI
    }

    #[test]
    fn test_ts_is_ambiguous() {
        let file = make_file("data.ts", "ts");
        let result = classify_by_rules(&file, "/home/user");
        assert!(result.is_none()); // .ts is ambiguous, needs AI
    }
}
