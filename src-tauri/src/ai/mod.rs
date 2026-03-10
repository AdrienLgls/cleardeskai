use crate::models::{FileInfo, Classification};
use crate::db;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const OLLAMA_URL: &str = "http://localhost:11434";
const DEFAULT_MODEL: &str = "qwen3:4b";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(180);

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
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
}

#[derive(Serialize)]
struct OllamaOptions {
    /// Disable "thinking" mode in qwen3 models — drastically reduces response time
    #[serde(skip_serializing_if = "Option::is_none")]
    think: Option<bool>,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
    thinking: Option<String>,
}

#[derive(Deserialize)]
struct AiClassification {
    category: String,
    proposed_path: String,
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
        r#"You are a smart file organization AI. Analyze each file's name, extension, MIME type, and content preview to classify it into a precise, contextual folder structure.

Base folder: {base_folder}

IMPORTANT: Don't just sort by file type — understand WHAT the file IS and propose a meaningful path.

Examples of GOOD proposed_path values:
- An invoice PDF → "{base_folder}/Documents/Invoices/2026/"
- A resume → "{base_folder}/Documents/Career/CV/"
- A school assignment with "INF349" in name → "{base_folder}/Documents/School/INF349/"
- A vacation photo → "{base_folder}/Images/Trips/"
- A tax document → "{base_folder}/Documents/Finance/Taxes/"
- A pay slip → "{base_folder}/Documents/Work/Payslips/"
- A medical prescription → "{base_folder}/Documents/Medical/"
- An app installer → "{base_folder}/Archives/Installers/"
- A boarding pass → "{base_folder}/Documents/Travel/"
- A random PNG → "{base_folder}/Images/"

For each file (in order), respond with JSON:
{{
  "files": [
    {{
      "category": "top-level category (Documents, Images, Videos, Music, Code, Archives, Spreadsheets, Presentations, Invoices, Screenshots, Other)",
      "proposed_path": "full path from base folder with contextual subfolders — be specific!",
      "suggested_name": "cleaner-filename.ext or null to keep original",
      "confidence": 0.0 to 1.0,
      "reasoning": "brief explanation of WHY this path was chosen"
    }}
  ]
}}

Rules:
- proposed_path MUST start with "{base_folder}/"
- Use contextual subfolders: Career, School, Finance, Medical, Travel, Work, Invoices, etc.
- If you detect a course code (e.g. INF349, MAT101), use it as subfolder
- If you detect a year or date in the filename, add a year subfolder
- If unsure of context, fall back to category/extension grouping
- suggested_name: only set if the original name is messy (e.g. "doc(1).pdf" → "document.pdf")

Files:
{files_list}

Respond ONLY with valid JSON, no markdown."#,
        base_folder = base_folder,
        files_list = files_desc.join("\n")
    );

    let model = get_model();
    // Disable thinking for qwen3 models to avoid 90s+ delays
    let is_qwen3 = model.starts_with("qwen3");
    let request = OllamaRequest {
        model,
        prompt,
        stream: false,
        format: "json".to_string(),
        options: if is_qwen3 {
            Some(OllamaOptions { think: Some(false) })
        } else {
            None
        },
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

    // qwen3 models may put JSON in "thinking" field instead of "response"
    let raw_json = if body.response.trim().is_empty() {
        body.thinking.unwrap_or_default()
    } else {
        body.response
    };

    let ai_result: AiClassifications = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Failed to parse AI JSON: {} - Response was: {}", e, &raw_json[..raw_json.len().min(500)]))?;

    let classifications: Vec<Classification> = files
        .iter()
        .zip(ai_result.files.iter())
        .map(|(file, ai)| {
            // Use the AI's proposed_path directly if it starts with base_folder
            let folder = if ai.proposed_path.starts_with(base_folder) {
                ai.proposed_path.clone()
            } else {
                // Fallback: build from category
                format!("{}/{}", base_folder, ai.category)
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
