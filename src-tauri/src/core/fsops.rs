use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, PathBuf};
use std::collections::HashSet;
use walkdir::WalkDir;

use super::settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntryInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

fn workspace_root_path() -> Result<PathBuf> {
    let s = settings::load()?;
    let root = s
        .workspace_root
        .as_deref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow!("no workspace is open"))?;

    let pb = PathBuf::from(root);
    if !pb.exists() {
        return Err(anyhow!("workspace path does not exist"));
    }
    if !pb.is_dir() {
        return Err(anyhow!("workspace path is not a directory"));
    }
    Ok(pb)
}

fn validate_relative(path: &str, allow_empty: bool) -> Result<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        if allow_empty {
            return Ok(PathBuf::new());
        }
        return Err(anyhow!("path is required"));
    }

    let pb = PathBuf::from(trimmed);
    if pb.is_absolute() {
        return Err(anyhow!("absolute paths are not allowed"));
    }

    for c in pb.components() {
        match c {
            Component::CurDir => {}
            Component::Normal(_) => {}
            Component::ParentDir => return Err(anyhow!("parent directory segments are not allowed")),
            Component::Prefix(_) | Component::RootDir => {
                return Err(anyhow!("absolute paths are not allowed"))
            }
        }
    }

    Ok(pb)
}

fn abs_path(rel: &str, allow_empty: bool) -> Result<PathBuf> {
    let root = workspace_root_path()?;
    let rel = validate_relative(rel, allow_empty)?;
    Ok(root.join(rel))
}

pub fn workspace_list_dir(rel_dir: Option<&str>) -> Result<Vec<DirEntryInfo>> {
    let rel = rel_dir.unwrap_or("");
    let dir = abs_path(rel, true)?;

    let mut out = Vec::new();
    let mut seen = HashSet::<String>::new();
    for e in fs::read_dir(&dir).with_context(|| format!("list dir: {}", dir.display()))? {
        let e = e.with_context(|| format!("list dir entry: {}", dir.display()))?;
        let ft = e.file_type().with_context(|| "file_type")?;
        let name = e.file_name().to_string_lossy().to_string();

        let child_rel = if rel.is_empty() {
            name.clone()
        } else {
            let base = rel.trim_end_matches(|c| c == '/' || c == '\\');
            format!("{}/{}", base, name)
        };

        if seen.insert(child_rel.clone()) {
            out.push(DirEntryInfo {
                path: child_rel,
                name,
                is_dir: ft.is_dir(),
            });
        }
    }

    out.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(out)
}

pub fn workspace_list_files(max_files: usize) -> Result<Vec<String>> {
    let root = workspace_root_path()?;
    let mut out: Vec<String> = Vec::new();
    let mut seen = HashSet::<String>::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if out.len() >= max_files {
            break;
        }

        let ft = entry.file_type();
        if !ft.is_file() {
            continue;
        }

        let path = entry.path();

        if path.components().any(|c| {
            let s = c.as_os_str().to_string_lossy().to_lowercase();
            s == "node_modules" || s == ".git" || s == "dist" || s == "target"
        }) {
            continue;
        }

        let rel = path
            .strip_prefix(&root)
            .with_context(|| format!("strip prefix: {}", root.display()))?
            .to_string_lossy()
            .replace('\\', "/");
        if rel.trim().is_empty() {
            continue;
        }
        if seen.insert(rel.clone()) {
            out.push(rel);
        }
    }

    out.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(out)
}

pub fn workspace_read_file(rel_path: &str) -> Result<String> {
    let path = abs_path(rel_path, false)?;
    fs::read_to_string(&path).with_context(|| format!("read file: {}", path.display()))
}

pub fn workspace_write_file(rel_path: &str, contents: &str) -> Result<()> {
    let path = abs_path(rel_path, false)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create dir: {}", parent.display()))?;
    }
    fs::write(&path, contents).with_context(|| format!("write file: {}", path.display()))?;
    Ok(())
}

pub fn workspace_create_dir(rel_path: &str) -> Result<()> {
    let path = abs_path(rel_path, false)?;
    fs::create_dir_all(&path).with_context(|| format!("create dir: {}", path.display()))?;
    Ok(())
}

pub fn workspace_delete(rel_path: &str) -> Result<()> {
    let rel = validate_relative(rel_path, false)?;
    if rel.as_os_str().is_empty() {
        return Err(anyhow!("refusing to delete workspace root"));
    }

    let path = abs_path(rel_path, false)?;
    if path.is_dir() {
        fs::remove_dir_all(&path).with_context(|| format!("delete dir: {}", path.display()))?;
        return Ok(());
    }

    if path.exists() {
        fs::remove_file(&path).with_context(|| format!("delete file: {}", path.display()))?;
    }
    Ok(())
}

pub fn workspace_rename(from_rel: &str, to_rel: &str) -> Result<()> {
    let from = abs_path(from_rel, false)?;
    let to = abs_path(to_rel, false)?;
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create dir: {}", parent.display()))?;
    }
    fs::rename(&from, &to).with_context(|| format!("rename {} -> {}", from.display(), to.display()))?;
    Ok(())
}
