mod core;



use core::{ai, auth, fsops, history, search, secrets, settings, terminal, workspace};

use tauri::Manager;

use tauri_plugin_clipboard_manager::ClipboardExt;

use tauri_plugin_dialog::DialogExt;



#[cfg(windows)]

use std::time::Duration;



#[cfg(windows)]

use raw_window_handle::{HasWindowHandle, RawWindowHandle};



#[cfg(windows)]

use windows::{

    Win32::{

        Foundation::HWND,

        Graphics::Dwm::{

            DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_VISIBLE_FRAME_BORDER_THICKNESS,

        },

        UI::WindowsAndMessaging::{

            GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,

            SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_CLIENTEDGE,

            WS_EX_DLGMODALFRAME, WS_EX_STATICEDGE, WS_EX_WINDOWEDGE,

        },

    },

};



#[cfg(windows)]

fn apply_windows_border_fix<R: tauri::Runtime>(window: &tauri::webview::WebviewWindow<R>) {

    let handle = match window.window_handle() {

        Ok(h) => h,

        Err(_) => return,

    };



    let raw = handle.as_raw();

    let hwnd = match raw {

        RawWindowHandle::Win32(h) => HWND(h.hwnd.get() as *mut std::ffi::c_void),

        _ => return,

    };



    unsafe {

        let color_none: u32 = 0xFFFFFFFE;

        let _ = DwmSetWindowAttribute(

            hwnd,

            DWMWA_BORDER_COLOR,

            (&color_none as *const u32) as *const std::ffi::c_void,

            std::mem::size_of::<u32>() as u32,

        );



        let thickness: u32 = 0;

        let _ = DwmSetWindowAttribute(

            hwnd,

            DWMWA_VISIBLE_FRAME_BORDER_THICKNESS,

            (&thickness as *const u32) as *const std::ffi::c_void,

            std::mem::size_of::<u32>() as u32,

        );



        // Clear edge extended styles that often render the visible 1px frame on borderless

        // Windows while keeping the window resizable.

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;

        let stripped = ex_style

            & !(WS_EX_WINDOWEDGE.0 | WS_EX_CLIENTEDGE.0 | WS_EX_STATICEDGE.0 | WS_EX_DLGMODALFRAME.0);

        if stripped != ex_style {

            let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, stripped as isize);

            let _ = SetWindowPos(

                hwnd,

                None,

                0,

                0,

                0,

                0,

                SWP_NOMOVE

                    | SWP_NOSIZE

                    | SWP_NOZORDER

                    | SWP_NOACTIVATE
                    | SWP_FRAMECHANGED,
            );
        }
    }
}


#[cfg(debug_assertions)]

fn debug_log(msg: &str) {

    println!("{msg}");

}



#[cfg(not(debug_assertions))]

fn debug_log(_msg: &str) {}



// WSL clipboard commands using Windows clipboard via powershell.exe

#[cfg(target_os = "linux")]

#[tauri::command]

fn wsl_clipboard_write_text(text: String) -> Result<(), String> {

    use std::io::Write;
    use std::process::{Command, Stdio};

    // Use PowerShell Set-Clipboard and pipe text via stdin. This avoids fragile quoting.
    // We try powershell.exe from PATH first, then absolute Windows path from WSL.

    let candidates = [
        "powershell.exe",
        "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
    ];

    let mut last_err: Option<String> = None;

    for ps in candidates {
        let mut child = match Command::new(ps)
            .arg("-NoProfile")
            .arg("-Command")
            .arg("Set-Clipboard -Value ([Console]::In.ReadToEnd())")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                last_err = Some(format!("{}: {}", ps, e));
                continue;
            }
        };

        if let Some(stdin) = child.stdin.as_mut() {
            if let Err(e) = stdin.write_all(text.as_bytes()) {
                last_err = Some(format!("{} stdin: {}", ps, e));
                let _ = child.kill();
                continue;
            }
        }

        match child.wait_with_output() {
            Ok(out) if out.status.success() => return Ok(()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                last_err = Some(format!("{} exit {:?}: {}", ps, out.status.code(), stderr));
            }
            Err(e) => {
                last_err = Some(format!("{} wait: {}", ps, e));
            }
        }
    }

    Err(format!(
        "Failed to write to clipboard{}",
        last_err
            .as_deref()
            .map(|e| format!(": {e}"))
            .unwrap_or_default()
    ))

}



#[cfg(target_os = "linux")]

#[tauri::command]

fn wsl_clipboard_read_text() -> Result<String, String> {

    use std::process::{Command, Stdio};

    // Use PowerShell Get-Clipboard -Raw. Try PATH then absolute Windows path.

    let candidates = [
        "powershell.exe",
        "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
    ];

    let mut last_err: Option<String> = None;

    for ps in candidates {
        let out = match Command::new(ps)
            .arg("-NoProfile")
            .arg("-Command")
            .arg("Get-Clipboard -Raw")
            .stdin(Stdio::null())
            .output()
        {
            Ok(out) => out,
            Err(e) => {
                last_err = Some(format!("{}: {}", ps, e));
                continue;
            }
        };

        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout).into_owned();
            return Ok(text.trim_end_matches('\r').trim_end_matches('\n').to_string());
        }

        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        last_err = Some(format!("{} exit {:?}: {}", ps, out.status.code(), stderr));
    }

    Err(format!(
        "Failed to read from clipboard{}",
        last_err
            .as_deref()
            .map(|e| format!(": {e}"))
            .unwrap_or_default()
    ))

}



// Non-Linux stubs (not used but needed for compilation)

#[cfg(not(target_os = "linux"))]

#[tauri::command]

fn wsl_clipboard_write_text(_text: String) -> Result<(), String> {

    Err("Not supported on this platform".to_string())

}



#[cfg(not(target_os = "linux"))]

#[tauri::command]

fn wsl_clipboard_read_text() -> Result<String, String> {

    Err("Not supported on this platform".to_string())

}



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

fn clipboard_write_text(app: tauri::AppHandle, text: String) -> Result<(), String> {

    app.clipboard().write_text(text).map_err(|e| e.to_string())

}



#[tauri::command]

fn clipboard_read_text(app: tauri::AppHandle) -> Result<String, String> {

    app.clipboard().read_text().map_err(|e| e.to_string())

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

fn history_get_raw() -> Result<Option<String>, String> {

    history::load_raw().map_err(|e| e.to_string())

}



#[tauri::command]

fn history_set_raw(raw: String) -> Result<(), String> {

    history::store_raw(&raw).map_err(|e| e.to_string())

}



#[tauri::command]

fn history_clear() -> Result<(), String> {

    history::clear().map_err(|e| e.to_string())

}



#[tauri::command]

fn history_path() -> Result<String, String> {

    history::history_path_string().map_err(|e| e.to_string())

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

fn auth_clear() -> Result<(), String> {

    auth::clear_profile().map_err(|e| e.to_string())

}



#[tauri::command]

fn settings_clear() -> Result<(), String> {

    settings::clear().map_err(|e| e.to_string())

}



#[tauri::command]

fn provider_keys_clear_all() -> Result<(), String> {

    secrets::clear_all_provider_keys().map_err(|e| e.to_string())

}



#[tauri::command]

fn app_wipe_all() -> Result<(), String> {

    core::wipe_all().map_err(|e| e.to_string())

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



    debug_log("workspace_pick_folder: invoked");



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

                debug_log(&format!("workspace_pick_folder: result={out:?}"));

                Ok(out)

            }

            Ok(Err(e)) => Err(e.to_string()),

            Err(_) => {

                debug_log("workspace_pick_folder: timeout on linux; falling back to rfd");

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

        debug_log(&format!("workspace_pick_folder: result={out:?}"));

        Ok(out)

    }

}



#[tauri::command]

async fn workspace_pick_file(app: tauri::AppHandle) -> Result<Option<String>, String> {

    use tokio::sync::oneshot;

    use std::time::Duration;



    debug_log("workspace_pick_file: invoked");



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

                debug_log(&format!("workspace_pick_file: result={out:?}"));

                Ok(out)

            }

            Ok(Err(e)) => Err(e.to_string()),

            Err(_) => {

                debug_log("workspace_pick_file: timeout on linux; falling back to rfd");

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

        debug_log(&format!("workspace_pick_file: result={out:?}"));

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

fn workspace_read_file_base64(rel_path: String) -> Result<fsops::FileBase64, String> {

    fsops::workspace_read_file_base64(&rel_path).map_err(|e| e.to_string())

}



#[tauri::command]

fn workspace_write_file(rel_path: String, contents: String) -> Result<(), String> {

    fsops::workspace_write_file(&rel_path, &contents).map_err(|e| e.to_string())

}



#[tauri::command]

fn workspace_write_file_base64(rel_path: String, base64: String) -> Result<(), String> {

    fsops::workspace_write_file_base64(&rel_path, &base64).map_err(|e| e.to_string())

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

fn workspace_add_root(root: String) -> Result<workspace::WorkspaceInfo, String> {

    workspace::workspace_add_root(root).map_err(|e| e.to_string())

}



#[tauri::command]

fn workspace_remove_root(root: String) -> Result<workspace::WorkspaceInfo, String> {

    workspace::workspace_remove_root(root).map_err(|e| e.to_string())

}



#[tauri::command]

fn fs_read_file_abs(abs_path: String) -> Result<String, String> {

    fsops::fs_read_file_abs(&abs_path).map_err(|e| e.to_string())

}



#[tauri::command]

fn fs_read_file_abs_base64(abs_path: String) -> Result<fsops::FileBase64, String> {

    fsops::fs_read_file_abs_base64(&abs_path).map_err(|e| e.to_string())

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

async fn provider_list_models(provider: String, encryption_password: Option<String>) -> Result<Vec<ai::ProviderModelInfo>, String> {

    ai::provider_list_models(&provider, encryption_password.as_deref()).await.map_err(|e| e.to_string())

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

        .setup(|app| {

            #[cfg(windows)]

            {

                if let Some(w) = app.get_webview_window("main") {

                    apply_windows_border_fix(&w);



                    let app_handle = app.handle().clone();

                    tauri::async_runtime::spawn(async move {

                        tokio::time::sleep(Duration::from_millis(250)).await;

                        if let Some(w) = app_handle.get_webview_window("main") {

                            apply_windows_border_fix(&w);

                        }

                    });

                }

            }

            Ok(())

        })

        .on_window_event(|window, event| {

            #[cfg(windows)]

            {

                match event {

                    tauri::WindowEvent::Resized(_)

                    | tauri::WindowEvent::ScaleFactorChanged { .. }

                    | tauri::WindowEvent::Focused(true) => {

                        if let Some(w) = window.app_handle().get_webview_window(window.label()) {

                            apply_windows_border_fix(&w);

                        }

                    }

                    _ => {}

                }

            }

        })

        .plugin(tauri_plugin_opener::init())

        .plugin(tauri_plugin_dialog::init())

        .plugin(tauri_plugin_clipboard_manager::init())

        .invoke_handler(tauri::generate_handler![

            settings_get,

            settings_set,

            history_get_raw,

            history_set_raw,

            history_clear,

            history_path,

            provider_key_status,

            provider_key_set,

            provider_key_get,

            provider_key_clear,

            provider_keys_clear_all,

            settings_clear,

            auth_clear,

            app_wipe_all,

            auth_begin_login,

            auth_wait_login,

            auth_get_profile,

            auth_logout,

            auth_get_credits,

            test_gemini_api,

            debug_gemini_end_to_end,

            workspace_get,

            workspace_set,

            workspace_add_root,

            workspace_remove_root,

            workspace_pick_folder,

            workspace_pick_file,

            workspace_list_dir,

            workspace_list_files,

            workspace_read_file,

            workspace_read_file_base64,

            fs_read_file_abs,

            fs_read_file_abs_base64,

            clipboard_write_text,

            clipboard_read_text,

            wsl_clipboard_write_text,

            wsl_clipboard_read_text,

            workspace_write_file,

            workspace_write_file_base64,

            workspace_create_dir,

            workspace_delete,

            workspace_rename,

            workspace_search,

            ai_run_action,

            ai_chat,

            ai_chat_with_model,

            openrouter_list_models,

            provider_list_models,

            terminal_start,

            terminal_write,

            terminal_resize,

            terminal_kill

        ])

        .run(tauri::generate_context!())

        .expect("error while running tauri application");

}

