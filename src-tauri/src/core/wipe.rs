use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

fn config_root() -> Result<PathBuf> {
    let base = dirs::config_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".config")))
        .context("missing config dir")?;
    Ok(base.join("Pompora"))
}

fn data_root() -> Result<PathBuf> {
    let base = dirs::data_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".local").join("share")))
        .context("missing data dir")?;
    Ok(base.join("Pompora"))
}

pub fn wipe_all() -> Result<()> {
    let cfg = config_root()?;
    let data = data_root()?;

    if cfg.exists() {
        let _ = fs::remove_dir_all(&cfg);
    }
    if data.exists() {
        let _ = fs::remove_dir_all(&data);
    }

    Ok(())
}
