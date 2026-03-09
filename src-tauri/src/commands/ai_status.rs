use crate::models::OllamaStatus;
use crate::ai;
use tauri::AppHandle;

#[tauri::command]
pub async fn check_ollama_status() -> Result<OllamaStatus, String> {
    let (status, model, version) = ai::check_status().await;
    Ok(OllamaStatus { status, model, version })
}

#[tauri::command]
pub async fn setup_ollama() -> Result<(), String> {
    ai::pull_model().await
}

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<String>, String> {
    ai::list_models().await
}

#[tauri::command]
pub fn get_current_model() -> String {
    ai::get_model()
}

/// Install Ollama automatically from within the app.
/// - macOS/Linux: downloads and runs the official install script
/// - Windows: downloads the installer .exe and runs it silently
#[tauri::command]
pub async fn install_ollama(app: AppHandle) -> Result<(), String> {
    use std::process::Command;

    let _ = tauri::Emitter::emit(&app, "ollama-install-progress", serde_json::json!({
        "phase": "downloading",
        "message": "Downloading Ollama..."
    }));

    #[cfg(target_os = "windows")]
    {
        // Download the Windows installer
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let resp = client
            .get("https://ollama.com/download/OllamaSetup.exe")
            .send()
            .await
            .map_err(|e| format!("Failed to download Ollama installer: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Download failed with status: {}", resp.status()));
        }

        let bytes = resp.bytes().await
            .map_err(|e| format!("Failed to read installer: {}", e))?;

        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join("OllamaSetup.exe");
        std::fs::write(&installer_path, &bytes)
            .map_err(|e| format!("Failed to save installer: {}", e))?;

        let _ = tauri::Emitter::emit(&app, "ollama-install-progress", serde_json::json!({
            "phase": "installing",
            "message": "Installing Ollama..."
        }));

        // Run the installer silently
        let output = Command::new(&installer_path)
            .args(["/VERYSILENT", "/NORESTART"])
            .output()
            .map_err(|e| format!("Failed to run installer: {}", e))?;

        if !output.status.success() {
            return Err("Ollama installer failed. Try installing manually from ollama.com".to_string());
        }

        // Clean up
        let _ = std::fs::remove_file(installer_path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        // macOS and Linux: use the official install script
        let _ = tauri::Emitter::emit(&app, "ollama-install-progress", serde_json::json!({
            "phase": "installing",
            "message": "Installing Ollama via official script..."
        }));

        let output = Command::new("sh")
            .args(["-c", "curl -fsSL https://ollama.com/install.sh | sh"])
            .output()
            .map_err(|e| format!("Failed to run install script: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Installation failed: {}", stderr));
        }
    }

    // Wait for Ollama to start (it may auto-start after install)
    let _ = tauri::Emitter::emit(&app, "ollama-install-progress", serde_json::json!({
        "phase": "starting",
        "message": "Starting Ollama..."
    }));

    // Give Ollama a moment to start
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    // Try starting Ollama serve if it's not already running
    let (status, _, _) = ai::check_status().await;
    if status == "not_installed" {
        // Try to start it manually
        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("ollama")
                .arg("serve")
                .spawn();
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }

    // Now pull the default model
    let _ = tauri::Emitter::emit(&app, "ollama-install-progress", serde_json::json!({
        "phase": "pulling_model",
        "message": "Downloading AI model (this may take a few minutes)..."
    }));

    ai::pull_model().await?;

    let _ = tauri::Emitter::emit(&app, "ollama-install-progress", serde_json::json!({
        "phase": "done",
        "message": "Ollama installed and ready!"
    }));

    Ok(())
}
