use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// A detected project with its root directory and metadata.
/// The root path is also stored as the HashMap key for lookups.
#[derive(Debug, Clone)]
pub struct DetectedProject {
    pub name: String,
    pub project_type: &'static str,
}

/// Project marker files and their associated project types.
const PROJECT_MARKERS: &[(&str, &str)] = &[
    ("package.json", "Node.js"),
    ("Cargo.toml", "Rust"),
    ("pyproject.toml", "Python"),
    ("setup.py", "Python"),
    ("requirements.txt", "Python"),
    ("go.mod", "Go"),
    ("pom.xml", "Java (Maven)"),
    ("build.gradle", "Java (Gradle)"),
    ("build.gradle.kts", "Kotlin (Gradle)"),
    ("Gemfile", "Ruby"),
    ("composer.json", "PHP"),
    ("pubspec.yaml", "Flutter/Dart"),
    ("mix.exs", "Elixir"),
    ("dune-project", "OCaml"),
    ("stack.yaml", "Haskell"),
    ("CMakeLists.txt", "C/C++ (CMake)"),
    ("Makefile", "C/C++"),
    ("*.sln", "C#/.NET"),
    ("*.csproj", "C#/.NET"),
    ("*.xcodeproj", "Swift/Obj-C (Xcode)"),
];

/// Detect project roots from a list of file paths.
/// Scans for marker files and returns a map of directory → DetectedProject.
pub fn detect_projects(file_paths: &[String]) -> HashMap<String, DetectedProject> {
    let mut projects: HashMap<String, DetectedProject> = HashMap::new();

    for path_str in file_paths {
        let path = Path::new(path_str);
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let parent = match path.parent() {
            Some(p) => p.to_string_lossy().to_string(),
            None => continue,
        };

        // Skip if this directory is already detected
        if projects.contains_key(&parent) {
            continue;
        }

        for &(marker, project_type) in PROJECT_MARKERS {
            let matched = if marker.starts_with('*') {
                // Glob pattern like *.sln, *.csproj
                let suffix = &marker[1..];
                file_name.ends_with(suffix)
            } else {
                file_name == marker
            };

            if matched {
                let project_name = Path::new(&parent)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown-project".to_string());

                projects.insert(parent.clone(), DetectedProject {
                    name: project_name,
                    project_type,
                });
                break;
            }
        }
    }

    // Remove nested projects — keep the outermost root only.
    // If /home/user/docs/monorepo and /home/user/docs/monorepo/packages/lib both detected,
    // keep only monorepo.
    let roots: Vec<String> = projects.keys().cloned().collect();
    let mut to_remove = Vec::new();
    for root in &roots {
        for other in &roots {
            if root != other && root.starts_with(&format!("{}/", other)) {
                to_remove.push(root.clone());
            }
        }
    }
    for key in to_remove {
        projects.remove(&key);
    }

    projects
}

/// Get the best-practice destination for a project.
/// Returns ~/dev/project-name as the target directory.
pub fn get_project_destination(project: &DetectedProject) -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| "/home/user".to_string());

    Path::new(&home).join("dev").join(&project.name)
}

/// Check if a file belongs to a detected project and return the project + relative path.
pub fn file_in_project<'a>(
    file_path: &str,
    projects: &'a HashMap<String, DetectedProject>,
) -> Option<(&'a DetectedProject, String)> {
    for (root, project) in projects {
        if file_path.starts_with(&format!("{}/", root)) || file_path.starts_with(root) {
            // Compute relative path from project root
            let relative = file_path
                .strip_prefix(root)
                .unwrap_or(file_path)
                .trim_start_matches('/');

            // Get the relative directory (without the filename)
            let relative_dir = Path::new(relative)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            return Some((project, relative_dir));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_node_project() {
        let files = vec![
            "/home/user/docs/my-app/package.json".to_string(),
            "/home/user/docs/my-app/src/index.js".to_string(),
            "/home/user/docs/my-app/README.md".to_string(),
        ];
        let projects = detect_projects(&files);
        assert_eq!(projects.len(), 1);
        let project = projects.get("/home/user/docs/my-app").unwrap();
        assert_eq!(project.name, "my-app");
        assert_eq!(project.project_type, "Node.js");
    }

    #[test]
    fn test_detect_rust_project() {
        let files = vec![
            "/home/user/docs/my-crate/Cargo.toml".to_string(),
            "/home/user/docs/my-crate/src/main.rs".to_string(),
        ];
        let projects = detect_projects(&files);
        assert!(projects.contains_key("/home/user/docs/my-crate"));
    }

    #[test]
    fn test_nested_projects_dedup() {
        let files = vec![
            "/home/user/docs/monorepo/package.json".to_string(),
            "/home/user/docs/monorepo/packages/lib/package.json".to_string(),
        ];
        let projects = detect_projects(&files);
        // Should keep only the outermost
        assert_eq!(projects.len(), 1);
        assert!(projects.contains_key("/home/user/docs/monorepo"));
    }

    #[test]
    fn test_no_project_markers() {
        let files = vec![
            "/home/user/docs/report.pdf".to_string(),
            "/home/user/docs/photo.jpg".to_string(),
        ];
        let projects = detect_projects(&files);
        assert!(projects.is_empty());
    }

    #[test]
    fn test_file_in_project() {
        let mut projects = HashMap::new();
        projects.insert("/home/user/docs/my-app".to_string(), DetectedProject {
            name: "my-app".to_string(),
            project_type: "Node.js",
        });

        let result = file_in_project("/home/user/docs/my-app/src/index.js", &projects);
        assert!(result.is_some());
        let (project, rel_dir) = result.unwrap();
        assert_eq!(project.name, "my-app");
        assert_eq!(rel_dir, "src");
    }

    #[test]
    fn test_file_not_in_project() {
        let projects = HashMap::new();
        let result = file_in_project("/home/user/docs/random.pdf", &projects);
        assert!(result.is_none());
    }
}
