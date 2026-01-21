use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: Theme,
    pub offline_mode: bool,
    pub active_provider: Option<String>,
    #[serde(default)]
    pub pompora_thinking: Option<String>,
    #[serde(default)]
    pub workspace_root: Option<String>,
    #[serde(default)]
    pub recent_workspaces: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            offline_mode: false,
            active_provider: None,
            pompora_thinking: None,
            workspace_root: None,
            recent_workspaces: Vec::new(),
        }
    }
}

pub fn load() -> Result<AppSettings> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let s = fs::read_to_string(&path).with_context(|| format!("read settings: {}", path.display()))?;
    match serde_json::from_str(&s) {
        Ok(v) => Ok(v),
        Err(e) => {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);

            let mut backup = path.clone();
            for i in 0u32..100 {
                let name = if i == 0 {
                    format!("settings.json.corrupt-{ts}")
                } else {
                    format!("settings.json.corrupt-{ts}-{i}")
                };
                let mut candidate = path.clone();
                candidate.set_file_name(name);
                if !candidate.exists() {
                    backup = candidate;
                    break;
                }
            }

            if fs::rename(&path, &backup).is_err() {
                let _ = fs::remove_file(&path);
            }

            eprintln!(
                "parse settings failed ({}): {} (backed up to {})",
                path.display(),
                e,
                backup.display()
            );

            let def = AppSettings::default();
            let _ = store(&def);
            Ok(def)
        }
    }
}

pub fn store(next: &AppSettings) -> Result<()> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create settings dir: {}", parent.display()))?;
    }

    let tmp = path.with_extension("json.tmp");
    let s = serde_json::to_string_pretty(next).context("serialize settings")?;
    fs::write(&tmp, s.as_bytes()).with_context(|| format!("write settings tmp: {}", tmp.display()))?;

    // Best-effort durability: on some systems/filesystems, fsync can fail even though the
    // write succeeded. Settings should still be saved in that case.
    if let Ok(f) = OpenOptions::new().read(true).write(true).open(&tmp) {
        let _ = f.sync_all();
    }

    if let Err(e) = fs::rename(&tmp, &path) {
        // Fallback 1: remove existing and retry rename.
        let _ = fs::remove_file(&path);
        if let Err(e2) = fs::rename(&tmp, &path) {
            // Fallback 2: copy tmp to final.
            let copy_res = fs::copy(&tmp, &path)
                .with_context(|| format!("copy settings tmp to final after rename failure: {}", path.display()));
            if copy_res.is_err() {
                // Fallback 3: on Windows the destination can be locked, and copy won't overwrite.
                // As a last resort, try writing the final file directly.
                let _ = fs::remove_file(&path);
                fs::write(&path, s.as_bytes())
                    .with_context(|| format!("write settings final after rename+copy failure: {}", path.display()))?;
            }
            let _ = fs::remove_file(&tmp);
            // Preserve the original error chain for debugging.
            let _ = e;
            let _ = e2;
        }
    }

    // Best-effort durability for the final file.
    if let Ok(file) = fs::File::open(&path) {
        let _ = file.sync_all();
    }

    Ok(())
}

fn settings_path() -> Result<PathBuf> {
    let base = dirs::config_dir().or_else(|| dirs::home_dir().map(|h| h.join(".config"))).context("missing config dir")?;
    Ok(base.join("Pompora").join("settings.json"))
}
