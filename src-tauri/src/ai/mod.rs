use crate::models::{FileInfo, Classification};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const OLLAMA_URL: &str = "http://localhost:11434";
const DEFAULT_MODEL: &str = "qwen3:4b";

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
    let client = Client::new();
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

    let has_model = models["models"]
        .as_array()
        .map(|arr| arr.iter().any(|m| {
            m["name"].as_str().unwrap_or("").starts_with("qwen3")
        }))
        .unwrap_or(false);

    if has_model {
        ("running".to_string(), Some(DEFAULT_MODEL.to_string()), version)
    } else {
        ("no_model".to_string(), None, version)
    }
}

pub async fn classify_files(files: &[FileInfo], base_folder: &str) -> Result<Vec<Classification>, String> {
    let client = Client::new();

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
        model: DEFAULT_MODEL.to_string(),
        prompt,
        stream: false,
        format: "json".to_string(),
    };

    let resp = client
        .post(format!("{}/api/generate", OLLAMA_URL))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

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
    let client = Client::new();
    client
        .post(format!("{}/api/pull", OLLAMA_URL))
        .json(&serde_json::json!({ "name": DEFAULT_MODEL, "stream": false }))
        .send()
        .await
        .map_err(|e| format!("Failed to pull model: {}", e))?;
    Ok(())
}
