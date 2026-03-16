use anyhow::{anyhow, Context, Result};

use serde::{Deserialize, Serialize};

use std::fs;

use std::path::{Component, PathBuf};

use std::collections::HashSet;

use walkdir::WalkDir;



use super::settings;



const VROOT_PREFIX: &str = "__wsroot__/";



fn load_workspace_roots() -> Result<Vec<String>> {

    let s = settings::load()?;

    let mut roots = s.workspace_roots.clone();

    if roots.is_empty() {

        if let Some(r) = s.workspace_root.as_deref().map(|v| v.trim()).filter(|v| !v.is_empty()) {

            roots.push(r.to_string());

        }
    }

    Ok(roots)

}



fn parse_vroot(rel: &str) -> Option<(usize, String)> {

    let s = rel.trim().replace('\\', "/");

    if !s.starts_with(VROOT_PREFIX) {

        return None;

    }

    let rest = &s[VROOT_PREFIX.len()..];

    let (idx_raw, tail) = rest.split_once('/').unwrap_or((rest, ""));

    let idx: usize = idx_raw.parse().ok()?;

    Some((idx, tail.to_string()))

}



fn resolve_ws_path(rel: &str, allow_empty: bool) -> Result<(PathBuf, String)> {

    let roots = load_workspace_roots()?;

    if roots.is_empty() {

        return Err(anyhow!("no workspace is open"));

    }

    // If multiple roots exist, require vroot prefix for disambiguation except for empty root listing.

    let trimmed = rel.trim();

    if trimmed.is_empty() {

        if allow_empty {

            // For single-root workspaces, "" means the workspace root directory.
            // For multi-root workspaces, callers use "" to list the virtual roots.

            if roots.len() <= 1 {

                let root = roots[0].trim();

                let root_pb = PathBuf::from(root);

                if !root_pb.exists() {

                    return Err(anyhow!("workspace path does not exist"));

                }

                if !root_pb.is_dir() {

                    return Err(anyhow!("workspace path is not a directory"));

                }

                return Ok((root_pb, "".to_string()));

            }

            return Ok((PathBuf::new(), "".to_string()));

        }

        return Err(anyhow!("path is required"));

    }

    if let Some((idx, tail)) = parse_vroot(trimmed) {

        let root = roots.get(idx).ok_or_else(|| anyhow!("workspace root index out of bounds"))?;

        let root_pb = PathBuf::from(root);

        if !root_pb.exists() {

            return Err(anyhow!("workspace path does not exist"));

        }

        if !root_pb.is_dir() {

            return Err(anyhow!("workspace path is not a directory"));

        }

        let rel_pb = validate_relative(&tail, allow_empty)?;

        return Ok((root_pb.join(rel_pb), tail));

    }

    // No prefix: treat as relative to primary root (backward compatibility).

    let root = roots[0].trim();

    let root_pb = PathBuf::from(root);

    if !root_pb.exists() {

        return Err(anyhow!("workspace path does not exist"));

    }

    if !root_pb.is_dir() {

        return Err(anyhow!("workspace path is not a directory"));

    }

    let rel_pb = validate_relative(trimmed, allow_empty)?;

    Ok((root_pb.join(rel_pb), trimmed.replace('\\', "/")))

}



#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct DirEntryInfo {

    pub path: String,

    pub name: String,

    pub is_dir: bool,

}



#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct FileBase64 {

    pub mime: String,

    pub base64: String,

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

    let (pb, _) = resolve_ws_path(rel, allow_empty)?;

    Ok(pb)

}



pub fn workspace_list_dir(rel_dir: Option<&str>) -> Result<Vec<DirEntryInfo>> {

    let rel = rel_dir.unwrap_or("");

    let rel_norm = rel.trim().replace('\\', "/");

    // If requesting root listing and multiple roots exist, return them as virtual nodes.

    if rel_norm.is_empty() {

        let roots = load_workspace_roots()?;

        if roots.len() > 1 {

            let mut out = Vec::new();

            for (i, r) in roots.iter().enumerate() {

                let name = r

                    .replace('\\', "/")

                    .trim_end_matches('/')

                    .rsplit('/')

                    .next()

                    .unwrap_or(r)

                    .to_string();

                out.push(DirEntryInfo {

                    path: format!("{}{}", VROOT_PREFIX, i),

                    name,

                    is_dir: true,

                });

            }

            return Ok(out);

        }

    }

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

    let roots = load_workspace_roots()?;

    if roots.is_empty() {

        return Err(anyhow!("no workspace is open"));

    }

    let mut out: Vec<String> = Vec::new();

    let mut seen = HashSet::<String>::new();




    for (ri, root) in roots.iter().enumerate() {

        let root_pb = PathBuf::from(root);

        if !root_pb.exists() || !root_pb.is_dir() {

            continue;

        }

        for entry in WalkDir::new(&root_pb)

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
                .strip_prefix(&root_pb)
                .with_context(|| format!("strip prefix: {}", root_pb.display()))?
                .to_string_lossy()
                .replace('\\', "/");

            if rel.trim().is_empty() {
                continue;
            }

            let final_rel = if roots.len() > 1 {
                format!("{}{}{}{}", VROOT_PREFIX, ri, if rel.starts_with('/') { "" } else { "/" }, rel)
            } else {
                rel
            };

            if seen.insert(final_rel.clone()) {
                out.push(final_rel);
            }
        }
    }

    out.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(out)
}

// ... (rest of the code remains the same)


pub fn workspace_read_file(rel_path: &str) -> Result<String> {

    let path = abs_path(rel_path, false)?;

    fs::read_to_string(&path).with_context(|| format!("read file: {}", path.display()))

}



fn guess_mime_from_path(rel_path: &str) -> &'static str {

    let lower = rel_path.trim().replace('\\', "/").to_lowercase();

    let name = lower.rsplit('/').next().unwrap_or("");

    let ext = name.rsplit('.').next().unwrap_or("");



    match ext {

        "png" => "image/png",

        "jpg" | "jpeg" | "jfif" => "image/jpeg",

        "gif" => "image/gif",

        "webp" => "image/webp",

        "bmp" => "image/bmp",

        "ico" => "image/x-icon",

        "tif" | "tiff" => "image/tiff",

        "svg" => "image/svg+xml",

        "avif" => "image/avif",

        "heic" => "image/heic",

        "heif" => "image/heif",

        _ => "application/octet-stream",

    }

}



pub fn fs_read_file_abs(abs_path: &str) -> Result<String> {

    let p = PathBuf::from(abs_path.trim());

    if !p.is_absolute() {

        return Err(anyhow!("path must be absolute"));

    }

    if !p.exists() {

        return Err(anyhow!("file does not exist"));

    }

    if !p.is_file() {

        return Err(anyhow!("path is not a file"));

    }

    fs::read_to_string(&p).with_context(|| format!("read file: {}", p.display()))

}



pub fn fs_read_file_abs_base64(abs_path: &str) -> Result<FileBase64> {

    use base64::Engine as _;

    let p = PathBuf::from(abs_path.trim());

    if !p.is_absolute() {

        return Err(anyhow!("path must be absolute"));

    }

    if !p.exists() {

        return Err(anyhow!("file does not exist"));

    }

    if !p.is_file() {

        return Err(anyhow!("path is not a file"));

    }

    let bytes = fs::read(&p).with_context(|| format!("read file bytes: {}", p.display()))?;

    let mime = guess_mime_from_path(abs_path).to_string();

    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(FileBase64 { mime, base64 })

}



pub fn workspace_read_file_base64(rel_path: &str) -> Result<FileBase64> {

    use base64::Engine as _;



    let path = abs_path(rel_path, false)?;

    let bytes = fs::read(&path).with_context(|| format!("read file bytes: {}", path.display()))?;

    let mime = guess_mime_from_path(rel_path).to_string();

    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(FileBase64 { mime, base64 })

}



pub fn workspace_write_file(rel_path: &str, contents: &str) -> Result<()> {

    let path = abs_path(rel_path, false)?;

    if let Some(parent) = path.parent() {

        fs::create_dir_all(parent).with_context(|| format!("create dir: {}", parent.display()))?;

    }

    fs::write(&path, contents).with_context(|| format!("write file: {}", path.display()))?;

    Ok(())

}



pub fn workspace_write_file_base64(rel_path: &str, base64: &str) -> Result<()> {

    use base64::Engine as _;



    let path = abs_path(rel_path, false)?;

    if let Some(parent) = path.parent() {

        fs::create_dir_all(parent).with_context(|| format!("create dir: {}", parent.display()))?;

    }



    let trimmed = base64.trim();

    let payload = if let Some((_, after)) = trimmed.split_once("base64,") {

        after

    } else {

        trimmed

    };

    let bytes = base64::engine::general_purpose::STANDARD

        .decode(payload)

        .with_context(|| "decode base64")?;

    fs::write(&path, bytes).with_context(|| format!("write file bytes: {}", path.display()))?;

    Ok(())

}



pub fn workspace_create_dir(rel_path: &str) -> Result<()> {

    let path = abs_path(rel_path, false)?;

    fs::create_dir_all(&path).with_context(|| format!("create dir: {}", path.display()))?;

    Ok(())

}



pub fn workspace_delete(rel_path: &str) -> Result<()> {

    // If deleting a virtual root itself, reject.

    if let Some((_idx, tail)) = parse_vroot(rel_path) {

        if tail.trim().is_empty() {

            return Err(anyhow!("refusing to delete workspace root"));

        }

    }

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

    let (from, from_tail) = resolve_ws_path(from_rel, false)?;

    let (to, to_tail) = resolve_ws_path(to_rel, false)?;

    // If both are prefixed, they must refer to the same underlying root.

    let from_idx = parse_vroot(from_rel).map(|v| v.0);

    let to_idx = parse_vroot(to_rel).map(|v| v.0);

    if from_idx.is_some() && to_idx.is_some() && from_idx != to_idx {

        return Err(anyhow!("cross-root rename is not supported"));

    }

    // If only one side is prefixed, disallow to avoid surprising moves.

    if from_idx.is_some() ^ to_idx.is_some() {

        return Err(anyhow!("rename must stay within the same workspace root"));

    }

    let _ = (from_tail, to_tail);

    if let Some(parent) = to.parent() {

        fs::create_dir_all(parent).with_context(|| format!("create dir: {}", parent.display()))?;

    }

    fs::rename(&from, &to).with_context(|| format!("rename {} -> {}", from.display(), to.display()))?;

    Ok(())

}

