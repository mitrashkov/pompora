use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::json;
use super::{secrets, settings};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRunResult {
    pub output: String,
    pub updated_content: Option<String>,
}

fn messages_to_plain_input(messages: &[ChatMessage]) -> String {
    let mut out: Vec<String> = Vec::with_capacity(messages.len());
    for m in messages {
        let role = m.role.trim();
        let content = m.content.trim();
        if content.is_empty() {
            continue;
        }
        out.push(format!("{role}: {content}"));
    }
    out.join("\n\n")
}

fn extract_pompora_output(response_json: &serde_json::Value) -> Option<String> {
    // New Pompora AI shape: { ok: true, result: { assistant_message, edits, ... } }
    if let Some(result) = response_json.get("result") {
        if result.is_object() || result.is_array() {
            if let Ok(s) = serde_json::to_string(result) {
                let t = s.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
        }

        if let Some(s) = result.as_str() {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }

    if let Some(s) = response_json.get("output").and_then(|v| v.as_str()) {
        let t = s.trim();
        if !t.is_empty() {
            return Some(t.to_string());
        }
    }

    // Fallback for OpenAI-compatible shapes, just in case.
    if let Some(choices) = response_json.get("choices").and_then(|c| c.as_array()) {
        if let Some(first_choice) = choices.first() {
            if let Some(message) = first_choice.get("message") {
                if let Some(content) = extract_openai_message_content(message) {
                    return Some(content);
                }
            }
        }
    }

    None
}

pub async fn ai_chat_with_model(
    messages: Vec<ChatMessage>,
    encryption_password: Option<&str>,
    model_override: Option<&str>,
    thinking: Option<&str>,
) -> Result<AiChatResult> {
    let s = settings::load()?;
    if s.offline_mode {
        return Err(anyhow!("offline mode is enabled"));
    }

    let provider = s
        .active_provider
        .as_deref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow!("no provider is configured"))?;

    let mut msgs: Vec<ChatMessage> = vec![];
    msgs.push(ChatMessage {
        role: "system".to_string(),
        content: "You are a coding assistant inside an editor. Be direct and helpful. IMPORTANT: Respond ONLY with a single valid JSON object (no markdown, no code fences). Schema: {\"assistant_message\": string, \"edits\": [{\"op\": \"write\"|\"patch\"|\"delete\"|\"rename\"|\"run\", \"path\"?: string, \"content\"?: string, \"from\"?: string, \"to\"?: string}], \"summary\"?: string }. Never put code in assistant_message; code must only appear inside edits[].content. If you have no edits, return {\"assistant_message\": <answer>, \"edits\": []}.".to_string(),
    });
    msgs.extend(messages);

    let text = request_chat_completion(provider, encryption_password, msgs, 0.4, model_override, thinking).await?;

    let direct = serde_json::from_str::<StructuredChatOut>(&text).ok();
    let extracted = extract_first_json_object(&text)
        .and_then(|j| serde_json::from_str::<StructuredChatOut>(&j).ok());

    if let Some(parsed) = direct.or(extracted) {
        let msg = parsed
            .assistant_message
            .or(parsed.summary)
            .unwrap_or_else(|| "".to_string());

        let edits_len = parsed.edits.as_ref().map(|e| e.len()).unwrap_or(0);
        if msg.trim().is_empty() && edits_len == 0 {
            return Err(anyhow!(
                "No content found in API response: {}",
                shorten_for_error(&text)
            ));
        }
        return Ok(AiChatResult {
            output: msg,
            edits: parsed.edits,
        });
    }

    Ok(AiChatResult {
        output: text,
        edits: None,
    })
}

pub async fn openrouter_list_models() -> Result<Vec<OpenRouterModelInfo>> {
    let client = reqwest::Client::new();
    let url = "https://openrouter.ai/api/v1/models";
    let response = client
        .get(url)
        .send()
        .await
        .with_context(|| format!("OpenRouter models request failed to: {url}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .with_context(|| "Failed to read OpenRouter models response")?;

    if !status.is_success() {
        return Err(anyhow!("OpenRouter models request failed (status {status}): {body}"));
    }

    let parsed: OpenRouterModelsResponse = serde_json::from_str(&body)
        .with_context(|| format!("Invalid OpenRouter models JSON response: {body}"))?;
    Ok(parsed.data)
}

pub async fn provider_list_models(provider: &str, encryption_password: Option<&str>) -> Result<Vec<ProviderModelInfo>> {
    // #region agent log
    let log_msg = serde_json::json!({
        "location": "ai.rs:146",
        "message": "provider_list_models called",
        "data": {
            "provider": provider,
            "has_encryption_password": encryption_password.is_some()
        },
        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
        "sessionId": "debug-session",
        "runId": "run1",
        "hypothesisId": "E"
    });
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
        use std::io::Write;
        let _ = writeln!(file, "{}", log_msg);
    }
    // #endregion
    
    let (base_url, _default_model, needs_auth) = get_provider_info(provider)?;
    
    let api_key = if needs_auth {
        match secrets::provider_key_get(provider, encryption_password) {
            Ok(key) => {
                // #region agent log
                let log_msg = serde_json::json!({
                    "location": "ai.rs:152",
                    "message": "API key retrieved",
                    "data": {
                        "provider": provider,
                        "key_length": key.len()
                    },
                    "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "E"
                });
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
                    use std::io::Write;
                    let _ = writeln!(file, "{}", log_msg);
                }
                // #endregion
                key
            },
            Err(e) => {
                // #region agent log
                let log_msg = serde_json::json!({
                    "location": "ai.rs:167",
                    "message": "Failed to get API key",
                    "data": {
                        "provider": provider,
                        "error": format!("{}", e)
                    },
                    "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "E"
                });
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
                    use std::io::Write;
                    let _ = writeln!(file, "{}", log_msg);
                }
                // #endregion
                return Err(anyhow!("API key not configured for provider: {provider}"));
            },
        }
    } else {
        String::new()
    };

    let client = reqwest::Client::new();

    // Handle different provider APIs
    match provider {
        "openai" | "groq" | "deepseek" | "mistral" | "together" | "xai" | "cohere" | "custom" => {
            // OpenAI-compatible API
            let url = format!("{}/models", base_url.trim_end_matches('/'));
            // #region agent log
            let log_msg = serde_json::json!({
                "location": "ai.rs:162",
                "message": "Making OpenAI-compatible models request",
                "data": {
                    "provider": provider,
                    "url": url,
                    "needs_auth": needs_auth,
                    "has_api_key": !api_key.is_empty()
                },
                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "E"
            });
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
                use std::io::Write;
                let _ = writeln!(file, "{}", log_msg);
            }
            // #endregion
            let mut request = client.get(&url);
            if needs_auth && !api_key.is_empty() {
                request = request.bearer_auth(&api_key);
            }
            
            let response = request
                .send()
                .await
                .with_context(|| format!("Models request failed to: {url}"))?;

            let status = response.status();
            let body = response
                .text()
                .await
                .with_context(|| "Failed to read models response")?;

            // #region agent log
            let log_msg = serde_json::json!({
                "location": "ai.rs:185",
                "message": "Models API response received",
                "data": {
                    "provider": provider,
                    "status": status.as_u16(),
                    "body_length": body.len(),
                    "is_success": status.is_success()
                },
                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "E"
            });
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
                use std::io::Write;
                let _ = writeln!(file, "{}", log_msg);
            }
            // #endregion

            if !status.is_success() {
                // #region agent log
                let log_msg = serde_json::json!({
                    "location": "ai.rs:200",
                    "message": "Models API request failed",
                    "data": {
                        "provider": provider,
                        "status": status.as_u16(),
                        "error_body": shorten_for_error(&body)
                    },
                    "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "E"
                });
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
                    use std::io::Write;
                    let _ = writeln!(file, "{}", log_msg);
                }
                // #endregion
                return Err(anyhow!("Models request failed (status {status}): {}", shorten_for_error(&body)));
            }

            let parsed: OpenAIModelsResponse = serde_json::from_str(&body)
                .with_context(|| format!("Invalid models JSON response: {}", shorten_for_error(&body)))?;
            
            let models: Vec<ProviderModelInfo> = parsed.data.into_iter().map(|m| ProviderModelInfo {
                id: m.id,
                name: m.owned_by,
            }).collect();
            
            // #region agent log
            let log_msg = serde_json::json!({
                "location": "ai.rs:215",
                "message": "Models parsed successfully",
                "data": {
                    "provider": provider,
                    "model_count": models.len(),
                    "model_ids": models.iter().take(3).map(|m| &m.id).collect::<Vec<_>>()
                },
                "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(),
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "E"
            });
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("/home/mitrashkov/pompora/.cursor/debug.log") {
                use std::io::Write;
                let _ = writeln!(file, "{}", log_msg);
            }
            // #endregion
            
            Ok(models)
        }
        "anthropic" => {
            // Anthropic doesn't have a public models endpoint, return comprehensive model list
            Ok(vec![
                ProviderModelInfo { id: "claude-3-5-sonnet-20241022".to_string(), name: Some("Claude 3.5 Sonnet (Latest)".to_string()) },
                ProviderModelInfo { id: "claude-3-5-sonnet-20240620".to_string(), name: Some("Claude 3.5 Sonnet".to_string()) },
                ProviderModelInfo { id: "claude-3-opus-20240229".to_string(), name: Some("Claude 3 Opus".to_string()) },
                ProviderModelInfo { id: "claude-3-sonnet-20240229".to_string(), name: Some("Claude 3 Sonnet".to_string()) },
                ProviderModelInfo { id: "claude-3-haiku-20240307".to_string(), name: Some("Claude 3 Haiku".to_string()) },
            ])
        }
        "openrouter" => {
            // OpenRouter has its own endpoint
            let url = "https://openrouter.ai/api/v1/models";
            let mut request = client.get(url);
            if !api_key.is_empty() {
                request = request.bearer_auth(&api_key);
            }
            
            let response = request
                .send()
                .await
                .with_context(|| format!("OpenRouter models request failed"))?;

            let status = response.status();
            let body = response
                .text()
                .await
                .with_context(|| "Failed to read OpenRouter models response")?;

            if !status.is_success() {
                return Err(anyhow!("OpenRouter models request failed (status {status}): {}", shorten_for_error(&body)));
            }

            let parsed: serde_json::Value = serde_json::from_str(&body)
                .with_context(|| format!("Invalid OpenRouter models JSON response: {}", shorten_for_error(&body)))?;
            
            let mut models = Vec::new();
            if let Some(data) = parsed.get("data").and_then(|d| d.as_array()) {
                for model in data {
                    if let Some(id) = model.get("id").and_then(|i| i.as_str()) {
                        let name = model.get("name").and_then(|n| n.as_str()).map(|s| s.to_string());
                        models.push(ProviderModelInfo {
                            id: id.to_string(),
                            name,
                        });
                    }
                }
            }
            Ok(models)
        }
        "perplexity" => {
            // Perplexity uses OpenAI-compatible format but different endpoint
            let url = format!("{}/models", base_url.trim_end_matches('/'));
            let mut request = client.get(&url);
            if needs_auth && !api_key.is_empty() {
                request = request.bearer_auth(&api_key);
            }
            
            let response = request
                .send()
                .await
                .with_context(|| format!("Perplexity models request failed to: {url}"))?;

            let status = response.status();
            let body = response
                .text()
                .await
                .with_context(|| "Failed to read Perplexity models response")?;

            if !status.is_success() {
                // Fallback to known models
                return Ok(vec![
                    ProviderModelInfo { id: "llama-3.1-sonar-large-128k-online".to_string(), name: Some("Sonar Large (Online)".to_string()) },
                    ProviderModelInfo { id: "llama-3.1-sonar-small-128k-online".to_string(), name: Some("Sonar Small (Online)".to_string()) },
                    ProviderModelInfo { id: "llama-3.1-sonar-huge-128k-online".to_string(), name: Some("Sonar Huge (Online)".to_string()) },
                    ProviderModelInfo { id: "llama-3.1-sonar-large-128k-chat".to_string(), name: Some("Sonar Large (Chat)".to_string()) },
                    ProviderModelInfo { id: "llama-3.1-sonar-small-128k-chat".to_string(), name: Some("Sonar Small (Chat)".to_string()) },
                ]);
            }

            let parsed: OpenAIModelsResponse = serde_json::from_str(&body)
                .with_context(|| format!("Invalid Perplexity models JSON response: {}", shorten_for_error(&body)))?;
            
            Ok(parsed.data.into_iter().map(|m| ProviderModelInfo {
                id: m.id,
                name: m.owned_by,
            }).collect())
        }
        "gemini" => {
            // Gemini models endpoint
            let url = format!("{}/models?key={}", base_url.trim_end_matches('/'), api_key);
            let response = client
                .get(&url)
                .send()
                .await
                .with_context(|| format!("Gemini models request failed to: {url}"))?;

            let status = response.status();
            let body = response
                .text()
                .await
                .with_context(|| "Failed to read Gemini models response")?;

            if !status.is_success() {
                if status.as_u16() == 401 || status.as_u16() == 403 {
                    return Err(anyhow!(
                        "Gemini authorization failed: your API key is invalid, missing permissions, or the API is not enabled for your project. ({status}) {}",
                        shorten_for_error(&body)
                    ));
                }
                return Err(anyhow!("Gemini models request failed (status {status}): {}", shorten_for_error(&body)));
            }

            let parsed: serde_json::Value = serde_json::from_str(&body)
                .with_context(|| format!("Invalid Gemini models JSON response: {}", shorten_for_error(&body)))?;
            
            let mut models = Vec::new();
            if let Some(models_array) = parsed.get("models").and_then(|m| m.as_array()) {
                for model in models_array {
                    let supported = model
                        .get("supportedGenerationMethods")
                        .and_then(|m| m.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str())
                                .any(|s| s.eq_ignore_ascii_case("generateContent"))
                        })
                        .unwrap_or(true);
                    if !supported {
                        continue;
                    }

                    if let Some(raw_name) = model.get("name").and_then(|n| n.as_str()) {
                        let id = raw_name.strip_prefix("models/").unwrap_or(raw_name).to_string();
                        let display_name = model.get("displayName").and_then(|n| n.as_str()).map(|s| s.to_string());
                        models.push(ProviderModelInfo { id, name: display_name });
                    }
                }
            }
            Ok(models)
        }
        "ollama" | "lmstudio" => {
            // Local providers - try to fetch models
            let url = format!("{}/models", base_url.trim_end_matches('/'));
            let response = client
                .get(&url)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    let body = resp.text().await.unwrap_or_default();
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                        let mut models = Vec::new();
                        if let Some(models_array) = parsed.get("data").or_else(|| parsed.get("models")).and_then(|m| m.as_array()) {
                            for model in models_array {
                                if let Some(id) = model.get("id").or_else(|| model.get("name")).and_then(|n| n.as_str()) {
                                    models.push(ProviderModelInfo {
                                        id: id.to_string(),
                                        name: None,
                                    });
                                }
                            }
                        }
                        if !models.is_empty() {
                            return Ok(models);
                        }
                    }
                }
                _ => {}
            }
            
            // Fallback to default models
            Ok(vec![
                ProviderModelInfo { id: "llama3.2".to_string(), name: Some("Llama 3.2".to_string()) },
                ProviderModelInfo { id: "llama3".to_string(), name: Some("Llama 3".to_string()) },
                ProviderModelInfo { id: "mistral".to_string(), name: Some("Mistral".to_string()) },
            ])
        }
        _ => Err(anyhow!("Provider not supported for model listing: {provider}")),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiEditOp {
    pub op: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatResult {
    pub output: String,
    #[serde(default)]
    pub edits: Option<Vec<AiEditOp>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenRouterModelInfo {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenRouterModelsResponse {
    #[serde(default)]
    data: Vec<OpenRouterModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderModelInfo {
    pub id: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIModelsResponse {
    #[serde(default)]
    data: Vec<OpenAIModelData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIModelData {
    pub id: String,
    #[serde(default)]
    pub object: Option<String>,
    #[serde(default)]
    pub created: Option<u64>,
    #[serde(default)]
    pub owned_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StructuredOut {
    #[serde(default)]
    updated_content: Option<String>,
    #[serde(default)]
    summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StructuredChatOut {
    #[serde(default)]
    assistant_message: Option<String>,
    #[serde(default)]
    edits: Option<Vec<AiEditOp>>,
    #[serde(default)]
    summary: Option<String>,
}

fn get_provider_info(provider: &str) -> Result<(String, String, bool)> {
    match provider {
        "openai" => Ok(("https://api.openai.com/v1".to_string(), "gpt-4o-mini".to_string(), true)),
        "anthropic" => Ok(("https://api.anthropic.com/v1".to_string(), "claude-3-5-sonnet-20241022".to_string(), true)),
        "groq" => Ok(("https://api.groq.com/openai/v1".to_string(), "llama-3.1-70b-versatile".to_string(), true)),
        "deepseek" => Ok(("https://api.deepseek.com/v1".to_string(), "deepseek-chat".to_string(), true)),
        "gemini" => Ok(("https://generativelanguage.googleapis.com/v1beta".to_string(), "gemini-1.5-flash".to_string(), true)),
        "mistral" => Ok(("https://api.mistral.ai/v1".to_string(), "mistral-medium".to_string(), true)),
        "together" => Ok(("https://api.together.xyz/v1".to_string(), "meta-llama/Llama-3-70b-chat-hf".to_string(), true)),
        "perplexity" => Ok(("https://api.perplexity.ai".to_string(), "llama-3.1-sonar-small-128k-online".to_string(), true)),
        "openrouter" => Ok(("https://openrouter.ai/api/v1".to_string(), "openai/gpt-4o-mini".to_string(), true)),
        "xai" => Ok(("https://api.x.ai/v1".to_string(), "grok-beta".to_string(), true)),
        "cohere" => Ok(("https://api.cohere.ai/v1".to_string(), "command-r-plus".to_string(), true)),
        "pompora" => Ok(("https://ai.pompora.dev/v1".to_string(), "pompora".to_string(), true)),
        "ollama" => Ok(("http://127.0.0.1:11434/v1".to_string(), "llama3.2".to_string(), false)),
        "lmstudio" => Ok(("http://127.0.0.1:1234/v1".to_string(), "local-model".to_string(), false)),
        "custom" => Ok(("https://api.openai.com/v1".to_string(), "gpt-4o-mini".to_string(), true)),
        _ => Err(anyhow!("Provider not supported: {provider}")),
    }
}

fn strip_code_fences(s: &str) -> &str {
    let t = s.trim();
    if let Some(rest) = t.strip_prefix("```") {
        // Strip optional language identifier up to first newline.
        let rest = rest.strip_prefix("json").unwrap_or(rest);
        let rest = rest.trim_start_matches(|c: char| c != '\n');
        let rest = rest.strip_prefix('\n').unwrap_or(rest);
        if let Some(end) = rest.rfind("```") {
            return rest[..end].trim();
        }
    }
    t
}

fn extract_first_json_object(s: &str) -> Option<String> {
    let t = strip_code_fences(s);
    let mut depth: i32 = 0;
    let mut start: Option<usize> = None;
    let mut in_str = false;
    let mut escape = false;

    for (i, ch) in t.char_indices() {
        if in_str {
            if escape {
                escape = false;
                continue;
            }
            if ch == '\\' {
                escape = true;
                continue;
            }
            if ch == '"' {
                in_str = false;
            }
            continue;
        }

        if ch == '"' {
            in_str = true;
            continue;
        }

        if ch == '{' {
            if depth == 0 {
                start = Some(i);
            }
            depth += 1;
            continue;
        }
        if ch == '}' {
            depth -= 1;
            if depth == 0 {
                if let Some(st) = start {
                    return Some(t[st..=i].to_string());
                }
            }
        }
    }

    None
}

fn shorten_for_error(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        return "<empty response body>".to_string();
    }
    let max = 1200usize;
    if t.len() <= max {
        return t.to_string();
    }
    format!("{}…", &t[..max])
}

fn extract_openai_message_content(message: &serde_json::Value) -> Option<String> {
    let content = message.get("content")?;
    if let Some(s) = content.as_str() {
        let t = s.trim();
        if t.is_empty() {
            return None;
        }
        return Some(t.to_string());
    }

    // OpenRouter (and some OpenAI-compatible providers) can return `content` as an array:
    // [{"type":"text","text":"..."}, ...]
    if let Some(arr) = content.as_array() {
        let mut out: Vec<String> = vec![];
        for part in arr {
            if let Some(s) = part.as_str() {
                let t = s.trim();
                if !t.is_empty() {
                    out.push(t.to_string());
                }
                continue;
            }
            if let Some(obj) = part.as_object() {
                if let Some(text) = obj.get("text").and_then(|t| t.as_str()) {
                    let t = text.trim();
                    if !t.is_empty() {
                        out.push(t.to_string());
                    }
                }
            }
        }
        if out.is_empty() {
            return None;
        }
        return Some(out.join(""));
    }

    None
}

async fn request_chat_completion(
    provider: &str,
    _encryption_password: Option<&str>,
    messages: Vec<ChatMessage>,
    temperature: f32,
    model_override: Option<&str>,
    thinking: Option<&str>,
) -> Result<String> {
    let (base_url, mut model, needs_auth) = get_provider_info(provider)?;
    
    // Use model_override if provided, otherwise check settings for active_model
    if let Some(m) = model_override {
        let t = m.trim();
        if !t.is_empty() {
            model = t.to_string();
        }
    } else {
        // Check settings for active_model
        let s = settings::load().ok();
        if let Some(settings) = s {
            if let Some(active_prov) = &settings.active_provider {
                if active_prov == provider {
                    if let Some(active_mod) = &settings.active_model {
                        let t = active_mod.trim();
                        if !t.is_empty() {
                            model = t.to_string();
                        }
                    }
                }
            }
        }
    }
    
    let api_key = if needs_auth {
        match secrets::provider_key_get(provider, _encryption_password) {
            Ok(key) => key,
            Err(e) => return Err(anyhow!("Failed to get API key: {}", e)),
        }
    } else {
        String::new()
    };

    let client = reqwest::Client::new();

    if provider == "pompora" {
        let url = format!("{}/ai", base_url.trim_end_matches('/'));
        let input = messages_to_plain_input(&messages);
        let thinking = thinking
            .map(|v| v.trim())
            .filter(|v| !v.is_empty())
            .unwrap_or("slow");
        let request_body = json!({
            "input": input,
            "apiKey": api_key,
            "thinking": thinking,
        });

        let mut request = client.post(&url).json(&request_body);
        if !api_key.trim().is_empty() {
            request = request
                .bearer_auth(api_key.trim())
                .header("X-API-Key", api_key.trim());
        }

        let response = request
            .send()
            .await
            .with_context(|| format!("Pompora AI request failed to: {url}"))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .with_context(|| "Failed to read Pompora AI response text")?;

        if !status.is_success() {
            if let Ok(response_json) = serde_json::from_str::<serde_json::Value>(&body) {
                let err = response_json.get("error").and_then(|e| e.as_str()).unwrap_or("");
                if err == "non_json_output" {
                    if let Some(raw) = response_json.get("raw").and_then(|v| v.as_str()) {
                        let t = raw.trim();
                        if !t.is_empty() {
                            return Ok(t.to_string());
                        }
                    }
                }
            }
            return Err(anyhow!(
                "Pompora AI request failed (status {status}): {url}\n{}",
                shorten_for_error(&body)
            ));
        }

        let response_json: serde_json::Value = serde_json::from_str(&body)
            .with_context(|| format!("Invalid Pompora AI JSON response: {}", shorten_for_error(&body)))?;

        if let Some(err) = response_json.get("error").and_then(|e| e.as_str()) {
            if !err.trim().is_empty() {
                return Err(anyhow!("Pompora AI error: {err}"));
            }
        }

        if let Some(out) = extract_pompora_output(&response_json) {
            return Ok(out);
        }

        return Err(anyhow!(
            "No content found in Pompora AI response: {}",
            shorten_for_error(&body)
        ));
    }

    let response_text = if provider == "gemini" {
        // Gemini uses different API format
        let model_path = model.trim();
        let model_path = model_path.strip_prefix("models/").unwrap_or(model_path);
        let url = format!("{}/models/{}:generateContent?key={}", base_url.trim_end_matches('/'), model_path, api_key);
        
        let gemini_messages: Vec<serde_json::Value> = messages.iter().map(|msg| {
            json!({
                "role": if msg.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": msg.content }]
            })
        }).collect();

        let request_body = json!({
            "contents": gemini_messages,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 8192
            }
        });

        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .with_context(|| format!("Gemini API request failed to: {url}"))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .with_context(|| "Failed to read Gemini response text")?;

        if !status.is_success() {
            return Err(anyhow!(
                "Gemini API request failed (status {status}): {url}\n{body}"
            ));
        }

        body
    } else {
        // OpenAI-compatible format
        let request_body = json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 4096
        });

        let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
        
        let mut request = client.post(&url).json(&request_body);
        
        if provider == "anthropic" {
            // Anthropic uses different header format
            request = request
                .header("anthropic-version", "2023-06-01")
                .header("x-api-key", &api_key);
        } else if needs_auth && !api_key.is_empty() {
            request = request.bearer_auth(&api_key);
        }

        if provider == "openrouter" {
            // OpenRouter recommends sending these headers.
            request = request
                .header("HTTP-Referer", "https://pompora.local")
                .header("X-Title", "Pompora");
        }

        let response = request
            .send()
            .await
            .with_context(|| format!("API request failed to: {url}"))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .with_context(|| "Failed to read response text")?;

        if !status.is_success() {
            return Err(anyhow!("API request failed (status {status}): {url}\n{body}"));
        }

        body
    };

    // Parse response based on provider
    if provider == "gemini" {
        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .with_context(|| format!("Invalid Gemini JSON response: {response_text}"))?;

        if let Some(candidates) = response_json.get("candidates").and_then(|c| c.as_array()) {
            if let Some(first_candidate) = candidates.first() {
                if let Some(content) = first_candidate.get("content") {
                    if let Some(parts) = content.get("parts").and_then(|p| p.as_array()) {
                        if let Some(first_part) = parts.first() {
                            if let Some(text) = first_part.get("text").and_then(|t| t.as_str()) {
                                return Ok(text.to_string());
                            }
                        }
                    }
                }
            }
        }
        
        Err(anyhow!(
            "No content found in Gemini API response: {}",
            shorten_for_error(&response_text)
        ))
    } else {
        // OpenAI-compatible response parsing
        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .with_context(|| format!("Invalid JSON response: {response_text}"))?;

        if let Some(choices) = response_json.get("choices").and_then(|c| c.as_array()) {
            if let Some(first_choice) = choices.first() {
                if let Some(message) = first_choice.get("message") {
                    if let Some(content) = extract_openai_message_content(message) {
                        return Ok(content);
                    }

                    // Some providers/models return tool calls with empty content.
                    // In that case, the structured JSON is often inside tool_calls[].function.arguments.
                    if let Some(tool_calls) = message.get("tool_calls").and_then(|t| t.as_array()) {
                        for tc in tool_calls {
                            if let Some(args) = tc
                                .get("function")
                                .and_then(|f| f.get("arguments"))
                                .and_then(|a| a.as_str())
                            {
                                if !args.trim().is_empty() {
                                    return Ok(args.to_string());
                                }
                            }
                        }
                    }

                    // Legacy function_call shape.
                    if let Some(args) = message
                        .get("function_call")
                        .and_then(|fc| fc.get("arguments"))
                        .and_then(|a| a.as_str())
                    {
                        if !args.trim().is_empty() {
                            return Ok(args.to_string());
                        }
                    }
                }

                // Some providers still return completion-style responses.
                if let Some(text) = first_choice.get("text").and_then(|t| t.as_str()) {
                    if !text.trim().is_empty() {
                        return Ok(text.to_string());
                    }
                }
            }
        }

        Err(anyhow!(
            "No content found in API response: {}",
            shorten_for_error(&response_text)
        ))
    }
}

pub async fn ai_chat(
    messages: Vec<ChatMessage>,
    encryption_password: Option<&str>,
    thinking: Option<&str>,
) -> Result<AiChatResult> {
    let s = settings::load()?;
    #[cfg(debug_assertions)]
    println!("DEBUG: ai_chat loaded settings - offline_mode: {}, active_provider: {:?}", s.offline_mode, s.active_provider);
    
    if s.offline_mode {
        return Err(anyhow!("offline mode is enabled"));
    }

    let provider = s
        .active_provider
        .as_deref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow!("no provider is configured"))?;

    let mut msgs: Vec<ChatMessage> = vec![];
    msgs.push(ChatMessage {
        role: "system".to_string(),
        content: "You are a coding assistant inside an editor. Be direct and helpful. IMPORTANT: Respond ONLY with a single valid JSON object (no markdown, no code fences). Schema: {\"assistant_message\": string, \"edits\": [{\"op\": \"write\"|\"patch\"|\"delete\"|\"rename\"|\"run\", \"path\"?: string, \"content\"?: string, \"from\"?: string, \"to\"?: string}], \"summary\"?: string }. Never put code in assistant_message; code must only appear inside edits[].content. If you have no edits, return {\"assistant_message\": <answer>, \"edits\": []}.".to_string(),
    });
    msgs.extend(messages);

    let text = request_chat_completion(provider, encryption_password, msgs, 0.4, None, thinking).await?;

    let direct = serde_json::from_str::<StructuredChatOut>(&text).ok();
    let extracted = extract_first_json_object(&text)
        .and_then(|j| serde_json::from_str::<StructuredChatOut>(&j).ok());

    if let Some(parsed) = direct.or(extracted) {
        let msg = parsed
            .assistant_message
            .or(parsed.summary)
            .unwrap_or_else(|| "".to_string());

        let edits_len = parsed.edits.as_ref().map(|e| e.len()).unwrap_or(0);
        if msg.trim().is_empty() && edits_len == 0 {
            return Err(anyhow!(
                "No content found in API response: {}",
                shorten_for_error(&text)
            ));
        }
        return Ok(AiChatResult {
            output: msg,
            edits: parsed.edits,
        });
    }

    Ok(AiChatResult {
        output: text,
        edits: None,
    })
}

pub async fn ai_run_action(
    action: &str,
    rel_path: Option<&str>,
    content: &str,
    selection: Option<&str>,
    encryption_password: Option<&str>,
    thinking: Option<&str>,
) -> Result<AiRunResult> {
    let s = settings::load()?;
    if s.offline_mode {
        return Err(anyhow!("offline mode is enabled"));
    }

    let provider = s
        .active_provider
        .as_deref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow!("no provider is configured"))?;

    let sys = ChatMessage {
        role: "system".to_string(),
        content: "You are a precise coding assistant inside an editor. Follow the user instructions exactly.".to_string(),
    };

    let path_line = rel_path.map(|p| format!("File: {p}\n")).unwrap_or_default();

    let user_content = match action {
        "explain" => {
            let sel = selection.unwrap_or(content);
            format!(
                "{path_line}Explain the following code concisely with key points and any risks:\n\n{sel}"
            )
        }
        "fix" => {
            let sel_note = selection
                .map(|s| format!("Selection (fix this region; keep other code intact):\n{s}\n\n"))
                .unwrap_or_default();
            format!(
                "{path_line}Fix issues in this code. Return ONLY valid JSON with keys: updated_content (full file), summary.\n\n{sel_note}Full file:\n{content}"
            )
        }
        "refactor" => {
            let sel_note = selection
                .map(|s| format!("Selection (refactor this region; keep other code intact):\n{s}\n\n"))
                .unwrap_or_default();
            format!(
                "{path_line}Refactor the code to improve readability/structure without changing behavior. Return ONLY valid JSON with keys: updated_content (full file), summary.\n\n{sel_note}Full file:\n{content}"
            )
        }
        "tests" => {
            let sel_note = selection
                .map(|s| format!("Selection (focus tests for this region):\n{s}\n\n"))
                .unwrap_or_default();
            format!(
                "{path_line}Generate a set of high-value tests for this code. Provide:
1) Suggested test cases
2) Example test code
3) Notes on edge cases and mocks

{sel_note}Code:\n{content}"
            )
        }
        "docs" => {
            let sel_note = selection
                .map(|s| format!("Selection (document this region):\n{s}\n\n"))
                .unwrap_or_default();
            format!(
                "{path_line}Write concise documentation for this code: purpose, usage, and gotchas. Include examples if helpful.

{sel_note}Code:\n{content}"
            )
        }
        "commit" => {
            let sel_note = selection
                .map(|s| format!("Selection (summarize changes or intent for this region):\n{s}\n\n"))
                .unwrap_or_default();
            format!(
                "{path_line}Write a great git commit message for the changes implied by this code. Output:
1) A short imperative subject line
2) A detailed body (bullets)
3) Any breaking changes notes

{sel_note}Code:\n{content}"
            )
        }
        _ => return Err(anyhow!("unknown action: {action}")),
    };

    let user = ChatMessage {
        role: "user".to_string(),
        content: user_content,
    };

    let raw = request_chat_completion(provider, encryption_password, vec![sys, user], 0.2, None, thinking).await?;

    if action == "fix" || action == "refactor" {
        let direct = serde_json::from_str::<StructuredOut>(&raw).ok();
        let extracted = extract_first_json_object(&raw)
            .and_then(|j| serde_json::from_str::<StructuredOut>(&j).ok());
        if let Some(parsed) = direct.or(extracted) {
            let out_text = parsed.summary.unwrap_or_else(|| "".to_string());
            return Ok(AiRunResult {
                output: out_text,
                updated_content: parsed.updated_content,
            });
        }
    }

    Ok(AiRunResult {
        output: raw,
        updated_content: None,
    })
}
