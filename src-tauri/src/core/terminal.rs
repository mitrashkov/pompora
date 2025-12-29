use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct TerminalDataEvent {
    pub id: String,
    pub data: String,
}

struct TerminalSession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

type Sessions = Arc<Mutex<HashMap<String, TerminalSession>>>;

fn sessions() -> &'static Sessions {
    use once_cell::sync::OnceCell;
    static S: OnceCell<Sessions> = OnceCell::new();
    S.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn default_shell() -> (String, Vec<String>) {
    if cfg!(windows) {
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        if shell.to_lowercase().contains("powershell") {
            return (shell, vec!["-NoLogo".to_string()]);
        }
        (shell, vec![])
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let lower = shell.to_lowercase();
        // Most shells only show a prompt in interactive mode.
        if lower.ends_with("/bash") || lower == "bash" || lower.ends_with("/zsh") || lower == "zsh" || lower.ends_with("/fish") || lower == "fish" {
            return (shell, vec!["-i".to_string()]);
        }
        (shell, vec![])
    }
}

pub fn terminal_start(app: AppHandle, cols: u16, rows: u16, cwd: Option<String>) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let (shell, args) = default_shell();
    let mut cmd = CommandBuilder::new(shell);
    for a in args {
        cmd.arg(a);
    }

    if let Some(dir) = cwd {
        if !dir.trim().is_empty() {
            cmd.cwd(PathBuf::from(dir));
        }
    }

    // Improve prompt appearance on Unix shells.
    if !cfg!(windows) {
        cmd.env("TERM", "xterm-256color");
        cmd.env("PS1", "\\u@\\h:\\w\\$ ");
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = format!("term-{}", rand::random::<u64>());

    {
        let mut map = sessions().lock().map_err(|_| "terminal sessions lock poisoned".to_string())?;
        map.insert(
            id.clone(),
            TerminalSession {
                master: pair.master,
                writer,
                child,
            },
        );
    }

    let app2 = app.clone();
    let id2 = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let s = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app2.emit(
                        "terminal:data",
                        TerminalDataEvent {
                            id: id2.clone(),
                            data: s,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app2.emit(
            "terminal:exit",
            TerminalDataEvent {
                id: id2.clone(),
                data: "".to_string(),
            },
        );
    });

    Ok(id)
}

pub fn terminal_write(id: String, data: String) -> Result<(), String> {
    let mut map = sessions().lock().map_err(|_| "terminal sessions lock poisoned".to_string())?;
    let s = map.get_mut(&id).ok_or_else(|| "terminal session not found".to_string())?;
    s.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    s.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn terminal_resize(id: String, cols: u16, rows: u16) -> Result<(), String> {
    let mut map = sessions().lock().map_err(|_| "terminal sessions lock poisoned".to_string())?;
    let s = map.get_mut(&id).ok_or_else(|| "terminal session not found".to_string())?;
    s.master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn terminal_kill(id: String) -> Result<(), String> {
    let mut map = sessions().lock().map_err(|_| "terminal sessions lock poisoned".to_string())?;
    if let Some(mut s) = map.remove(&id) {
        let _ = s.child.kill();
    }
    Ok(())
}
