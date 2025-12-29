use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use super::settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub root: Option<String>,
    pub recent: Vec<String>,
}

pub fn workspace_get() -> Result<WorkspaceInfo> {
    let s = settings::load()?;
    Ok(WorkspaceInfo {
        root: s.workspace_root.clone(),
        recent: s.recent_workspaces.clone(),
    })
}

pub fn workspace_set(root: Option<String>) -> Result<WorkspaceInfo> {
    let mut s = settings::load()?;

    let normalized = root
        .as_deref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .map(|v| v.to_string());

    if let Some(ref p) = normalized {
        let pb = PathBuf::from(p);
        if !pb.exists() {
            return Err(anyhow!("workspace path does not exist"));
        }
        if !pb.is_dir() {
            return Err(anyhow!("workspace path is not a directory"));
        }

        s.recent_workspaces.retain(|x| x != p);
        s.recent_workspaces.insert(0, p.clone());
        s.recent_workspaces.truncate(10);
    }

    s.workspace_root = normalized;
    settings::store(&s)?;
    workspace_get()
}

pub fn workspace_pick_folder() -> Result<Option<String>> {
    let picked = rfd::FileDialog::new()
        .set_title("Open Folder")
        .pick_folder();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

pub fn workspace_pick_file() -> Result<Option<String>> {
    let picked = rfd::FileDialog::new()
        .set_title("Open File")
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}
