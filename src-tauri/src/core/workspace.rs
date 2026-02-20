use anyhow::{anyhow, Result};

use serde::{Deserialize, Serialize};

use std::path::PathBuf;



use super::settings;



#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct WorkspaceInfo {

    pub root: Option<String>,

    #[serde(default)]

    pub roots: Vec<String>,

    pub recent: Vec<String>,

}



pub fn workspace_get() -> Result<WorkspaceInfo> {

    let s = settings::load()?;

    let mut roots = s.workspace_roots.clone();

    if roots.is_empty() {

        if let Some(r) = s.workspace_root.as_deref().map(|v| v.trim()).filter(|v| !v.is_empty()) {

            roots.push(r.to_string());

        }

    }

    Ok(WorkspaceInfo {

        root: s.workspace_root.clone(),

        roots,

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

    s.workspace_roots = s

        .workspace_root

        .as_deref()

        .map(|v| vec![v.to_string()])

        .unwrap_or_default();

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



pub fn workspace_add_root(root: String) -> Result<WorkspaceInfo> {

    let mut s = settings::load()?;

    let p = root.trim().to_string();

    if p.is_empty() {

        return workspace_get();

    }

    let pb = PathBuf::from(&p);

    if !pb.exists() {

        return Err(anyhow!("workspace path does not exist"));

    }

    if !pb.is_dir() {

        return Err(anyhow!("workspace path is not a directory"));

    }

    // Migrate from single-root, if needed.

    if s.workspace_roots.is_empty() {

        if let Some(r) = s.workspace_root.as_deref().map(|v| v.trim()).filter(|v| !v.is_empty()) {

            s.workspace_roots.push(r.to_string());

        }

    }

    if !s.workspace_roots.iter().any(|x| x == &p) {

        s.workspace_roots.push(p.clone());

    }

    // Keep primary root for compatibility.

    s.workspace_root = s.workspace_roots.get(0).cloned();

    // Recent

    s.recent_workspaces.retain(|x| x != &p);

    s.recent_workspaces.insert(0, p);

    s.recent_workspaces.truncate(10);

    settings::store(&s)?;

    workspace_get()

}



pub fn workspace_remove_root(root: String) -> Result<WorkspaceInfo> {

    let mut s = settings::load()?;

    let p = root.trim().to_string();

    if p.is_empty() {

        return workspace_get();

    }

    if !s.workspace_roots.is_empty() {

        s.workspace_roots.retain(|x| x != &p);

        s.workspace_root = s.workspace_roots.get(0).cloned();

    } else if s.workspace_root.as_deref() == Some(p.as_str()) {

        s.workspace_root = None;

    }

    settings::store(&s)?;

    workspace_get()

}

