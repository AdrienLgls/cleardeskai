use crate::models::OllamaStatus;
use crate::ai;

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
