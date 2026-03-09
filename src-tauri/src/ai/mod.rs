use crate::models::{FileInfo, Classification};
use crate::db;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const OLLAMA_URL: &str = "http://localhost:11434";
const DEFAULT_MODEL: &str = "qwen3:4b";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

/// Get the user-configured model or fall back to default
pub fn get_model() -> String {
    db::get_setting("ai_model")
        .ok()
        .flatten()
        .unwrap_or_else(|| DEFAULT_MODEL.to_string())
}

/// List all models installed in Ollama
pub async fn list_models() -> Result<Vec<String>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let resp = client
        .get(format!("{}/api/tags", OLLAMA_URL))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models = body["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    format: String,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

#[derive(Deserialize)]
struct AiClassification {
    category: String,
    subcategory: Option<String>,
    suggested_name: Option<String>,
    confidence: f32,
    reasoning: String,
}

#[derive(Deserialize)]
struct AiClassifications {
    files: Vec<AiClassification>,
}

pub async fn check_status() -> (String, Option<String>, Option<String>) {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let version = match client.get(format!("{}/api/version", OLLAMA_URL)).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                let body: serde_json::Value = resp.json().await.unwrap_or_default();
                body["version"].as_str().map(|s| s.to_string())
            } else {
                return ("not_installed".to_string(), None, None);
            }
        }
        Err(_) => return ("not_installed".to_string(), None, None),
    };

    let models = match client.get(format!("{}/api/tags", OLLAMA_URL)).send().await {
        Ok(resp) => resp.json::<serde_json::Value>().await.unwrap_or_default(),
        Err(_) => return ("not_installed".to_string(), None, None),
    };

    let current_model = get_model();
    let model_prefix = current_model.split(':').next().unwrap_or(&current_model);
    let has_model = models["models"]
        .as_array()
        .map(|arr| arr.iter().any(|m| {
            m["name"].as_str().unwrap_or("").starts_with(model_prefix)
        }))
        .unwrap_or(false);

    if has_model {
        ("running".to_string(), Some(current_model), version)
    } else {
        ("no_model".to_string(), None, version)
    }
}

/// Classify a single batch of files
pub async fn classify_batch_public(files: &[FileInfo], base_folder: &str) -> Result<Vec<Classification>, String> {
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    classify_batch(&client, files, base_folder).await
}

async fn classify_batch(client: &Client, files: &[FileInfo], base_folder: &str) -> Result<Vec<Classification>, String> {
    let files_desc: Vec<String> = files.iter().enumerate().map(|(i, f)| {
        let preview = f.content_preview.as_deref().unwrap_or("(no preview)");
        format!(
            "{}. name=\"{}\" ext=\"{}\" size={}KB mime=\"{}\" preview=\"{}\"",
            i + 1, f.name, f.extension, f.size / 1024, f.mime_type,
            &preview[..preview.len().min(200)]
        )
    }).collect();

    let prompt = format!(
        r#"You are a file organization AI. Classify these files into a logical folder structure.

Base folder: {base_folder}

For each file (in order), respond with JSON:
{{
  "files": [
    {{
      "category": "folder name",
      "subcategory": "optional subfolder or null",
      "suggested_name": "descriptive-filename.ext or null to keep original",
      "confidence": 0.0 to 1.0,
      "reasoning": "brief explanation"
    }}
  ]
}}

Categories to use: Documents, Images, Videos, Music, Code, Archives, Spreadsheets, Presentations, PDFs, Invoices, Screenshots, Downloads, Other

Files:
{files_list}

Respond ONLY with valid JSON, no markdown."#,
        base_folder = base_folder,
        files_list = files_desc.join("\n")
    );

    let request = OllamaRequest {
        model: get_model(),
        prompt,
        stream: false,
        format: "json".to_string(),
    };

    let resp = client
        .post(format!("{}/api/generate", OLLAMA_URL))
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "AI classification timed out. Try scanning fewer files or check if Ollama is running.".to_string()
            } else {
                format!("Ollama request failed: {}", e)
            }
        })?;

    let body: OllamaResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let ai_result: AiClassifications = serde_json::from_str(&body.response)
        .map_err(|e| format!("Failed to parse AI JSON: {} - Response was: {}", e, &body.response[..body.response.len().min(500)]))?;

    let classifications: Vec<Classification> = files
        .iter()
        .zip(ai_result.files.iter())
        .map(|(file, ai)| {
            let folder = match &ai.subcategory {
                Some(sub) if !sub.is_empty() => format!("{}/{}/{}", base_folder, ai.category, sub),
                _ => format!("{}/{}", base_folder, ai.category),
            };
            Classification {
                file: file.clone(),
                proposed_folder: folder,
                proposed_name: ai.suggested_name.clone(),
                confidence: ai.confidence,
                category: ai.category.clone(),
                reasoning: ai.reasoning.clone(),
            }
        })
        .collect();

    Ok(classifications)
}

pub async fn pull_model() -> Result<(), String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client
        .post(format!("{}/api/pull", OLLAMA_URL))
        .json(&serde_json::json!({ "name": get_model(), "stream": false }))
        .send()
        .await
        .map_err(|e| format!("Failed to pull model: {}", e))?;
    Ok(())
}
