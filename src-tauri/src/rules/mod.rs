pub mod context;

use crate::models::{FileInfo, Classification};
use std::collections::HashMap;
use context::{DetectedProject, file_in_project, get_project_destination};

/// Rule-based file classification — covers ~95% of files instantly without AI.
/// Returns Some(Classification) if a rule matched, None if AI is needed.
/// Now accepts detected projects for context-aware classification.
pub fn classify_by_rules(
    file: &FileInfo,
    base_folder: &str,
    projects: &HashMap<String, DetectedProject>,
    dev_folder: Option<&str>,
    best_practice: bool,
) -> Option<Classification> {
    // 0. Context-aware: check if file belongs to a detected project
    if let Some(classification) = classify_by_project(file, projects, dev_folder) {
        return Some(classification);
    }

    let ext = file.extension.to_lowercase();
    let name_lower = file.name.to_lowercase();

    // 1. Semantic name analysis (runs FIRST — detects CV, boarding pass, devoir, etc.)
    if let Some((category, subcategory, reasoning)) = classify_by_semantic_name(&name_lower) {
        let folder = if best_practice {
            best_practice_folder(category, Some(subcategory))
        } else {
            format!("{}/{}/{}", base_folder, category, subcategory)
        };
        return Some(Classification {
            file: file.clone(),
            proposed_folder: folder,
            proposed_name: None,
            confidence: 0.93,
            category: category.to_string(),
            reasoning: reasoning.to_string(),
        });
    }

    // 2. Extension-based classification (covers most remaining files)
    if let Some((category, subcategory)) = classify_by_extension(&ext) {
        let folder = if best_practice {
            best_practice_folder(category, subcategory)
        } else {
            match subcategory {
                Some(sub) => format!("{}/{}/{}", base_folder, category, sub),
                None => format!("{}/{}", base_folder, category),
            }
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

    // 3. Legacy name pattern matching (screenshots, downloads)
    if let Some((category, reasoning)) = classify_by_name_pattern(&name_lower) {
        let folder = if best_practice {
            best_practice_folder(category, None)
        } else {
            format!("{}/{}", base_folder, category)
        };
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
        let folder = if best_practice {
            best_practice_folder(category, None)
        } else {
            format!("{}/{}", base_folder, category)
        };
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

/// Classify a file as part of a detected project.
/// Proposes moving it to ~/dev/project-name/ preserving internal structure.
fn classify_by_project(
    file: &FileInfo,
    projects: &HashMap<String, DetectedProject>,
    dev_folder: Option<&str>,
) -> Option<Classification> {
    let (project, relative_dir) = file_in_project(&file.path, projects)?;
    let dest = get_project_destination(project, dev_folder);
    let proposed_folder = if relative_dir.is_empty() {
        dest.to_string_lossy().to_string()
    } else {
        dest.join(&relative_dir).to_string_lossy().to_string()
    };

    Some(Classification {
        file: file.clone(),
        proposed_folder,
        proposed_name: None,
        confidence: 0.92,
        category: "Projects".to_string(),
        reasoning: format!(
            "Part of {} project '{}' — moving to ~/dev/{}",
            project.project_type, project.name, project.name
        ),
    })
}

/// Map category to best-practice XDG-style paths (~/Images, ~/Documents, etc.)
fn best_practice_folder(category: &str, subcategory: Option<&str>) -> String {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| "/home/user".to_string());

    let base = match category {
        "Images" => format!("{}/Images", home),
        "Videos" => format!("{}/Videos", home),
        "Music" => format!("{}/Music", home),
        "Documents" => format!("{}/Documents", home),
        "PDFs" => format!("{}/Documents/PDFs", home),
        "Spreadsheets" => format!("{}/Documents/Spreadsheets", home),
        "Presentations" => format!("{}/Documents/Presentations", home),
        "Screenshots" => format!("{}/Images/Screenshots", home),
        "Invoices" => format!("{}/Documents/Invoices", home),
        "Downloads" => format!("{}/Downloads", home),
        "Archives" => format!("{}/Archives", home),
        "Code" => format!("{}/dev", home),
        "Fonts" => format!("{}/Fonts", home),
        "Design" => format!("{}/Design", home),
        "Databases" => format!("{}/Databases", home),
        _ => format!("{}/Other", home),
    };

    match subcategory {
        Some(sub) => format!("{}/{}", base, sub),
        None => base,
    }
}

/// Smart semantic classification based on filename content.
/// Returns (category, subcategory, reasoning) for contextual folder placement.
fn classify_by_semantic_name(name: &str) -> Option<(&'static str, &'static str, &'static str)> {
    // === CV / Resume ===
    if name.contains("cv") || name.contains("resume") || name.contains("curriculum") {
        return Some(("Documents", "CV", "Detected CV/resume by filename"));
    }

    // === Travel ===
    if name.contains("boarding") || name.contains("billet")
        || name.contains("ticket") || name.contains("flight")
        || name.contains("booking") || name.contains("réservation")
        || name.contains("reservation") || name.contains("itinerary")
        || name.contains("itinéraire") || name.contains("eticket")
        || name.contains("e-ticket")
    {
        return Some(("Documents", "Travel", "Detected travel document by filename"));
    }

    // === Insurance ===
    if name.contains("assurance") || name.contains("insurance")
        || name.contains("police") || name.contains("mutuelle")
        || name.contains("couverture")
    {
        return Some(("Documents", "Insurance", "Detected insurance document by filename"));
    }

    // === School / University ===
    if name.contains("devoir") || name.contains("assignment")
        || name.contains("homework") || name.contains("tp-")
        || name.contains("tp_") || name.starts_with("tp")
        || name.contains("exam") || name.contains("partiel")
        || name.contains("cours") || name.contains("lecture")
        || name.contains("evaluation") || name.contains("évaluation")
        || name.contains("note") || name.contains("uga")
        || name.contains("uqac") || name.contains("inf3")
        || name.contains("inf2") || name.contains("inf1")
        || name.contains("brmie") || name.contains("semester")
        || name.contains("semestre")
    {
        return Some(("Documents", "School", "Detected school/university document by filename"));
    }

    // === Administrative ===
    if name.contains("attestation") || name.contains("certificat")
        || name.contains("certificate") || name.contains("permis")
        || name.contains("permit") || name.contains("visa")
        || name.contains("passport") || name.contains("passeport")
        || name.contains("carte_identité") || name.contains("id_card")
        || name.contains("recapitulatif") || name.contains("récapitulatif")
        || name.contains("déclaration") || name.contains("declaration")
        || name.contains("code_canada") || name.contains("immigration")
    {
        return Some(("Documents", "Admin", "Detected administrative document by filename"));
    }

    // === Invoices / Receipts (enhanced from old pattern) ===
    if name.contains("invoice") || name.contains("facture")
        || name.contains("receipt") || name.contains("reçu")
        || name.contains("rechnung") || name.contains("quittance")
        || name.contains("bon_de_commande") || name.contains("order")
    {
        return Some(("Documents", "Invoices", "Detected invoice/receipt by filename"));
    }

    // === Shopping / E-commerce ===
    if name.contains("commande") || name.contains("purchase")
        || name.contains("blue-tomato") || name.contains("amazon")
        || name.contains("paypal") || name.contains("stripe")
        || name.contains("confirmation") || name.contains("livraison")
        || name.contains("delivery") || name.contains("tracking")
    {
        return Some(("Documents", "Shopping", "Detected shopping/order document by filename"));
    }

    // === Work / Professional ===
    if name.contains("contrat") || name.contains("contract")
        || name.contains("conductix") || name.contains("entreprise")
        || name.contains("company") || name.contains("salary")
        || name.contains("salaire") || name.contains("paie")
        || name.contains("fiche_de_paie") || name.contains("payslip")
        || name.contains("employment") || name.contains("embauche")
        || name.contains("lettre_de_motivation") || name.contains("cover_letter")
    {
        return Some(("Documents", "Work", "Detected work/professional document by filename"));
    }

    // === Tax / Finance ===
    if name.contains("tax") || name.contains("impôt") || name.contains("impot")
        || name.contains("fiscal") || name.contains("rib")
        || name.contains("bank") || name.contains("banque")
        || name.contains("relevé") || name.contains("releve")
        || name.contains("statement")
    {
        return Some(("Documents", "Finance", "Detected financial document by filename"));
    }

    // === Medical / Health ===
    if name.contains("médical") || name.contains("medical")
        || name.contains("ordonnance") || name.contains("prescription")
        || name.contains("santé") || name.contains("health")
        || name.contains("vaccin") || name.contains("labo")
        || name.contains("analyse") || name.contains("radio")
    {
        return Some(("Documents", "Medical", "Detected medical document by filename"));
    }

    // === Screenshots ===
    if name.starts_with("screenshot") || name.starts_with("capture")
        || name.starts_with("screen shot") || name.starts_with("écran")
        || name.contains("screenshot") || name.starts_with("snip_")
    {
        return Some(("Images", "Screenshots", "Detected screenshot by filename pattern"));
    }

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

    fn empty_projects() -> HashMap<String, DetectedProject> {
        HashMap::new()
    }

    #[test]
    fn test_image_classification() {
        let file = make_file("photo.jpg", "jpg");
        let result = classify_by_rules(&file, "/home/user", &empty_projects(), None, false);
        assert!(result.is_some());
        assert_eq!(result.unwrap().category, "Images");
    }

    #[test]
    fn test_code_classification() {
        let file = make_file("main.rs", "rs");
        let result = classify_by_rules(&file, "/home/user", &empty_projects(), None, false);
        assert!(result.is_some());
        assert_eq!(result.unwrap().category, "Code");
    }

    #[test]
    fn test_screenshot_pattern() {
        let file = make_file("Screenshot_2024-01-15.png", "png");
        let result = classify_by_rules(&file, "/home/user", &empty_projects(), None, false);
        assert!(result.is_some());
        // Extension matches Images first — that's fine
        let cat = result.unwrap().category;
        assert!(cat == "Images" || cat == "Screenshots");
    }

    #[test]
    fn test_unknown_extension() {
        let file = make_file("mystery.xyz123", "xyz123");
        let result = classify_by_rules(&file, "/home/user", &empty_projects(), None, false);
        assert!(result.is_none());
    }

    #[test]
    fn test_ts_is_ambiguous() {
        let file = make_file("data.ts", "ts");
        let result = classify_by_rules(&file, "/home/user", &empty_projects(), None, false);
        assert!(result.is_none());
    }

    #[test]
    fn test_project_detection_classifies_files() {
        let mut projects = HashMap::new();
        projects.insert("/home/user/docs/my-app".to_string(), DetectedProject {
            name: "my-app".to_string(),
            project_type: "Node.js",
        });

        let file = FileInfo {
            path: "/home/user/docs/my-app/src/index.js".to_string(),
            name: "index.js".to_string(),
            extension: "js".to_string(),
            size: 1024,
            modified: "2024-01-01T00:00:00Z".to_string(),
            mime_type: "application/javascript".to_string(),
            content_preview: None,
        };

        let result = classify_by_rules(&file, "/home/user/docs", &projects, None, false);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.category, "Projects");
        assert!(c.proposed_folder.contains("dev/my-app/src"));
        assert!(c.reasoning.contains("Node.js"));
    }
}
