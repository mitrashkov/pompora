use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

fn history_path() -> Result<PathBuf> {
    let base = dirs::data_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .context("missing data dir")?;
    Ok(base.join("Pompora").join("history.json"))
}

pub fn load_raw() -> Result<Option<String>> {
    let path = history_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).with_context(|| format!("read history: {}", path.display()))?;
    if raw.trim().is_empty() {
        return Ok(None);
    }
    Ok(Some(raw))
}

pub fn store_raw(raw: &str) -> Result<()> {
    let path = history_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create history dir: {}", parent.display()))?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw.as_bytes()).with_context(|| format!("write history tmp: {}", tmp.display()))?;
    fs::rename(&tmp, &path).with_context(|| format!("replace history: {}", path.display()))?;
    Ok(())
}

pub fn clear() -> Result<()> {
    let path = history_path()?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    Ok(())
}
