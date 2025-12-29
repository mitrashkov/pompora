use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

use super::settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: u32,
    pub text: String,
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

fn is_likely_text(bytes: &[u8]) -> bool {
    // reject if it contains NUL byte
    !bytes.iter().any(|b| *b == 0)
}

pub fn workspace_search(query: &str, max_results: usize) -> Result<Vec<SearchMatch>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    let root = workspace_root_path()?;
    let q_lower = q.to_lowercase();

    let mut out: Vec<SearchMatch> = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if out.len() >= max_results {
            break;
        }

        let ft = entry.file_type();
        if !ft.is_file() {
            continue;
        }

        let path = entry.path();

        // skip node_modules and git by default
        if path.components().any(|c| {
            let s = c.as_os_str().to_string_lossy().to_lowercase();
            s == "node_modules" || s == ".git" || s == "dist" || s == "target"
        }) {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        // 1 MiB limit
        if meta.len() > 1_048_576 {
            continue;
        }

        let bytes = match fs::read(path) {
            Ok(b) => b,
            Err(_) => continue,
        };

        if !is_likely_text(&bytes) {
            continue;
        }

        let s = match String::from_utf8(bytes) {
            Ok(v) => v,
            Err(_) => continue,
        };

        for (i, line) in s.lines().enumerate() {
            if out.len() >= max_results {
                break;
            }

            if line.to_lowercase().contains(&q_lower) {
                let rel = path
                    .strip_prefix(&root)
                    .with_context(|| format!("strip prefix: {}", root.display()))?
                    .to_string_lossy()
                    .replace('\\', "/");

                out.push(SearchMatch {
                    path: rel,
                    line: (i as u32) + 1,
                    text: line.trim_end().to_string(),
                });
            }
        }
    }

    Ok(out)
}
