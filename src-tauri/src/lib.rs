mod core;

use core::{ai, auth, fsops, search, secrets, settings, terminal, workspace};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn terminal_start(app: tauri::AppHandle, cols: u16, rows: u16, cwd: Option<String>) -> Result<String, String> {
    terminal::terminal_start(app, cols, rows, cwd)
}

#[tauri::command]
fn terminal_write(id: String, data: String) -> Result<(), String> {
    terminal::terminal_write(id, data)
}

#[tauri::command]
fn terminal_resize(id: String, cols: u16, rows: u16) -> Result<(), String> {
    terminal::terminal_resize(id, cols, rows)
}

#[tauri::command]
fn terminal_kill(id: String) -> Result<(), String> {
    terminal::terminal_kill(id)
}

#[tauri::command]
fn settings_get() -> Result<settings::AppSettings, String> {
    settings::load().map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_set(next: settings::AppSettings) -> Result<(), String> {
    settings::store(&next).map_err(|e| e.to_string())
}

#[tauri::command]
fn provider_key_status(provider: String) -> Result<secrets::KeyStatus, String> {
    secrets::provider_key_status(&provider)
}

#[tauri::command]
fn provider_key_set(provider: String, api_key: String, encryption_password: Option<String>) -> Result<(), String> {
    secrets::provider_key_set(&provider, &api_key, encryption_password.as_deref())
}

#[tauri::command]
fn provider_key_get(provider: String, encryption_password: Option<String>) -> Result<String, String> {
    secrets::provider_key_get(&provider, encryption_password.as_deref())
}

#[tauri::command]
fn provider_key_clear(provider: String) -> Result<(), String> {
    secrets::provider_key_clear(&provider)
}

#[tauri::command]
async fn auth_begin_login() -> Result<(String, String), String> {
    auth::begin_login().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn auth_wait_login(state: String) -> Result<auth::AuthProfile, String> {
    auth::wait_login(&state).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn auth_get_profile() -> Result<Option<auth::AuthProfile>, String> {
    auth::load_profile().map_err(|e| e.to_string())
}

#[tauri::command]
fn auth_logout() -> Result<(), String> {
    auth::logout().map_err(|e| e.to_string())
}

#[tauri::command]
async fn auth_get_credits() -> Result<auth::CreditsResponse, String> {
    auth::fetch_credits().await.map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_get() -> Result<workspace::WorkspaceInfo, String> {
    workspace::workspace_get().map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_search(query: String, max_results: Option<u32>) -> Result<Vec<search::SearchMatch>, String> {
    let max = max_results.unwrap_or(200).min(2000) as usize;
    search::workspace_search(&query, max).map_err(|e| e.to_string())
}

#[tauri::command]
async fn debug_gemini_end_to_end(api_key: String) -> Result<String, String> {
    let provider = "gemini";
    let api_key = api_key.trim();
    
    // 1) save key
    secrets::provider_key_set(provider, api_key, None)?;

    // 2) verify status + get
    let status = secrets::provider_key_status(provider)?;
    let stored = secrets::provider_key_get(provider, None)?;

    // 3) call gemini directly using our ai module
    let test_message = ai::ChatMessage {
        role: "user".to_string(),
        content: "Respond with exactly: OK".to_string(),
    };
    let resp = ai::ai_chat(vec![test_message], None, None)
        .await
        .map_err(|e| format!("ai_chat failed: {e}"))?;

    Ok(format!(
        "saved=true status.is_configured={} stored_len={} response={} ",
        status.is_configured,
        stored.len(),
        resp.output
    ))
}

#[tauri::command]
async fn test_gemini_api() -> Result<String, String> {
    use crate::core::ai::{ChatMessage, ai_chat};
    
    let test_message = ChatMessage {
        role: "user".to_string(),
        content: "Hello! Please respond with just 'API test successful'".to_string(),
    };
    
    match ai_chat(vec![test_message], None, None).await {
        Ok(result) => Ok(format!("Gemini API test successful. Response: {}", result.output)),
        Err(e) => Err(format!("Gemini API test failed: {}", e)),
    }
}

#[tauri::command]
async fn workspace_pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tokio::sync::oneshot;
    use std::time::Duration;

    println!("workspace_pick_folder: invoked");

    let (tx, rx) = oneshot::channel::<Option<String>>();
    app.dialog().file().pick_folder(move |file_path| {
        let out = file_path.map(|fp| match fp {
            tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
            tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
        });
        let _ = tx.send(out);
    });

    #[cfg(target_os = "linux")]
    {
        match tokio::time::timeout(Duration::from_secs(8), rx).await {
            Ok(Ok(out)) => {
                println!("workspace_pick_folder: result={:?}", out);
                Ok(out)
            }
            Ok(Err(e)) => Err(e.to_string()),
            Err(_) => {
                println!("workspace_pick_folder: timeout on linux; falling back to rfd");
                tokio::task::spawn_blocking(|| workspace::workspace_pick_folder())
                    .await
                    .map_err(|e| e.to_string())?
                    .map_err(|e| e.to_string())
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        let out = rx.await.map_err(|e| e.to_string())?;
        println!("workspace_pick_folder: result={:?}", out);
        Ok(out)
    }
}

#[tauri::command]
async fn workspace_pick_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tokio::sync::oneshot;
    use std::time::Duration;

    println!("workspace_pick_file: invoked");

    let (tx, rx) = oneshot::channel::<Option<String>>();
    app.dialog().file().pick_file(move |file_path| {
        let out = file_path.map(|fp| match fp {
            tauri_plugin_dialog::FilePath::Url(url) => url.to_string(),
            tauri_plugin_dialog::FilePath::Path(p) => p.to_string_lossy().to_string(),
        });
        let _ = tx.send(out);
    });

    #[cfg(target_os = "linux")]
    {
        match tokio::time::timeout(Duration::from_secs(8), rx).await {
            Ok(Ok(out)) => {
                println!("workspace_pick_file: result={:?}", out);
                Ok(out)
            }
            Ok(Err(e)) => Err(e.to_string()),
            Err(_) => {
                println!("workspace_pick_file: timeout on linux; falling back to rfd");
                tokio::task::spawn_blocking(|| workspace::workspace_pick_file())
                    .await
                    .map_err(|e| e.to_string())?
                    .map_err(|e| e.to_string())
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        let out = rx.await.map_err(|e| e.to_string())?;
        println!("workspace_pick_file: result={:?}", out);
        Ok(out)
    }
}

#[tauri::command]
fn workspace_list_dir(rel_dir: Option<String>) -> Result<Vec<fsops::DirEntryInfo>, String> {
    fsops::workspace_list_dir(rel_dir.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_list_files(max_files: Option<u32>) -> Result<Vec<String>, String> {
    let max = max_files.unwrap_or(20000).min(100000) as usize;
    fsops::workspace_list_files(max).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_read_file(rel_path: String) -> Result<String, String> {
    fsops::workspace_read_file(&rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_write_file(rel_path: String, contents: String) -> Result<(), String> {
    fsops::workspace_write_file(&rel_path, &contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_create_dir(rel_path: String) -> Result<(), String> {
    fsops::workspace_create_dir(&rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_delete(rel_path: String) -> Result<(), String> {
    fsops::workspace_delete(&rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_rename(from_rel: String, to_rel: String) -> Result<(), String> {
    fsops::workspace_rename(&from_rel, &to_rel).map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_set(root: Option<String>) -> Result<workspace::WorkspaceInfo, String> {
    workspace::workspace_set(root).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_chat(
    messages: Vec<ai::ChatMessage>,
    encryption_password: Option<String>,
    thinking: Option<String>,
) -> Result<ai::AiChatResult, String> {
    ai::ai_chat(messages, encryption_password.as_deref(), thinking.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_chat_with_model(
    messages: Vec<ai::ChatMessage>,
    encryption_password: Option<String>,
    model: Option<String>,
    thinking: Option<String>,
) -> Result<ai::AiChatResult, String> {
    ai::ai_chat_with_model(messages, encryption_password.as_deref(), model.as_deref(), thinking.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn openrouter_list_models() -> Result<Vec<ai::OpenRouterModelInfo>, String> {
    ai::openrouter_list_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_run_action(
    action: String,
    rel_path: Option<String>,
    content: String,
    selection: Option<String>,
    encryption_password: Option<String>,
    thinking: Option<String>,
) -> Result<ai::AiRunResult, String> {
    ai::ai_run_action(
        &action,
        rel_path.as_deref(),
        &content,
        selection.as_deref(),
        encryption_password.as_deref(),
        thinking.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings_get,
            settings_set,
            provider_key_status,
            provider_key_set,
            provider_key_get,
            provider_key_clear,
            auth_begin_login,
            auth_wait_login,
            auth_get_profile,
            auth_logout,
            auth_get_credits,
            test_gemini_api,
            debug_gemini_end_to_end,
            workspace_get,
            workspace_set,
            workspace_pick_folder,
            workspace_pick_file,
            workspace_list_dir,
            workspace_list_files,
            workspace_read_file,
            workspace_write_file,
            workspace_create_dir,
            workspace_delete,
            workspace_rename,
            workspace_search,
            ai_run_action,
            ai_chat,
            ai_chat_with_model,
            openrouter_list_models,
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
