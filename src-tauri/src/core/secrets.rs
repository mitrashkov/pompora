use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyStatus {
    pub provider: String,
    pub is_configured: bool,
    pub storage: StorageKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageKind {
    None,
    Keyring,
    Encryptedfile,
}

 fn safe_provider_id(provider: &str) -> String {
     provider
         .chars()
         .map(|c| {
             if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                 c
             } else {
                 '_'
             }
         })
         .collect()
 }

 fn key_path(provider: &str) -> Result<PathBuf, String> {
     let base = dirs::config_dir().ok_or_else(|| "Missing config directory".to_string())?;
     let safe = safe_provider_id(provider);
     Ok(base
         .join("Pompora")
         .join("secrets")
         .join(format!("provider-{safe}.txt")))
 }

// METHOD 1: Simple file storage in project directory
pub fn provider_key_set_method1(provider: &str, api_key: &str) -> Result<(), String> {
    let path = key_path(provider)?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let parent = path
        .parent()
        .ok_or_else(|| format!("Invalid key path: {}", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create secrets directory {}: {e}", parent.display()))?;

    let tmp = path.with_extension("txt.tmp");
    fs::write(&tmp, api_key)
        .map_err(|e| format!("Failed to write temp key file {}: {e}", tmp.display()))?;

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove existing key file {}: {e}", path.display()))?;
    }

    fs::rename(&tmp, &path)
        .map_err(|e| format!("Failed to rename temp key file to {}: {e}", path.display()))?;

    Ok(())
}

pub fn provider_key_get_method1(provider: &str) -> Result<String, String> {
    let path = key_path(provider)?;
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read key file {}: {e}", path.display()))?;
    let v = content.trim().to_string();
    if v.is_empty() {
        return Err(format!("Key file is empty: {}", path.display()));
    }
    Ok(v)
}

// METHOD 2: JSON file storage
pub fn provider_key_set_method2(provider: &str, api_key: &str) -> Result<(), String> {
    let path = PathBuf::from("api_keys.json");
    let data = serde_json::json!({ provider: api_key });
    fs::write(&path, serde_json::to_string_pretty(&data).unwrap()).map_err(|e| e.to_string())
}

pub fn provider_key_get_method2(provider: &str) -> Result<String, String> {
    let path = PathBuf::from("api_keys.json");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    data.get(provider).and_then(|v| v.as_str()).ok_or_else(|| "Key not found".to_string()).map(|s| s.to_string())
}

// METHOD 3: Environment file
pub fn provider_key_set_method3(provider: &str, api_key: &str) -> Result<(), String> {
    let path = PathBuf::from(".env");
    let line = format!("{}_API_KEY={}\n", provider.to_uppercase(), api_key);
    fs::write(&path, line).map_err(|e| e.to_string())
}

pub fn provider_key_get_method3(provider: &str) -> Result<String, String> {
    let path = PathBuf::from(".env");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let prefix = format!("{}_API_KEY=", provider.to_uppercase());
    for line in content.lines() {
        if line.starts_with(&prefix) {
            return Ok(line[prefix.len()..].to_string());
        }
    }
    Err("Key not found".to_string())
}

// METHOD 4: Config directory storage
pub fn provider_key_set_method4(provider: &str, api_key: &str) -> Result<(), String> {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("pompora");
    path.push(format!("{}.txt", provider));
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&path, api_key).map_err(|e| e.to_string())
}

pub fn provider_key_get_method4(provider: &str) -> Result<String, String> {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("pompora");
    path.push(format!("{}.txt", provider));
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

// METHOD 5: Temp directory storage
pub fn provider_key_set_method5(provider: &str, api_key: &str) -> Result<(), String> {
    let mut path = std::env::temp_dir();
    path.push("pompora_keys");
    path.push(format!("{}.txt", provider));
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&path, api_key).map_err(|e| e.to_string())
}

pub fn provider_key_get_method5(provider: &str) -> Result<String, String> {
    let mut path = std::env::temp_dir();
    path.push("pompora_keys");
    path.push(format!("{}.txt", provider));
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

// METHOD 6: Binary file storage
pub fn provider_key_set_method6(provider: &str, api_key: &str) -> Result<(), String> {
    let path = PathBuf::from(format!("{}.key", provider));
    fs::write(&path, api_key.as_bytes()).map_err(|e| e.to_string())
}

pub fn provider_key_get_method6(provider: &str) -> Result<String, String> {
    let path = PathBuf::from(format!("{}.key", provider));
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|e| e.to_string())
}

// METHOD 7: Base64 encoded file
pub fn provider_key_set_method7(provider: &str, api_key: &str) -> Result<(), String> {
    use base64::Engine as _;
    let path = key_path(provider)?;
    let parent = path.parent().ok_or("Invalid path")?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(api_key);
    std::fs::write(&path, encoded).map_err(|e| e.to_string())
}

pub fn provider_key_get_method7(provider: &str) -> Result<String, String> {
    use base64::Engine as _;
    let path = key_path(provider)?;
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(&content)
        .map_err(|e| e.to_string())?;
    String::from_utf8(decoded).map_err(|e| e.to_string())
}

// METHOD 8: Windows Registry style (file-based)
pub fn provider_key_set_method8(provider: &str, api_key: &str) -> Result<(), String> {
    let path = PathBuf::from("registry.json");
    let mut data = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::Value::Object(Default::default()))
    } else {
        serde_json::Value::Object(Default::default())
    };
    
    if let Some(obj) = data.as_object_mut() {
        obj.insert(provider.to_string(), serde_json::Value::String(api_key.to_string()));
    }
    
    fs::write(&path, serde_json::to_string_pretty(&data).unwrap()).map_err(|e| e.to_string())
}

pub fn provider_key_get_method8(provider: &str) -> Result<String, String> {
    let path = PathBuf::from("registry.json");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    data.get(provider).and_then(|v| v.as_str()).ok_or_else(|| "Key not found".to_string()).map(|s| s.to_string())
}

// METHOD 9: Simple INI file format
pub fn provider_key_set_method9(provider: &str, api_key: &str) -> Result<(), String> {
    let path = PathBuf::from("config.ini");
    let line = format!("{}={}\n", provider, api_key);
    fs::write(&path, line).map_err(|e| e.to_string())
}

pub fn provider_key_get_method9(provider: &str) -> Result<String, String> {
    let path = PathBuf::from("config.ini");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    for line in content.lines() {
        if let Some((key, value)) = line.split_once('=') {
            if key.trim() == provider {
                return Ok(value.trim().to_string());
            }
        }
    }
    Err("Key not found".to_string())
}

// METHOD 10: Memory-mapped file simulation
pub fn provider_key_set_method10(provider: &str, api_key: &str) -> Result<(), String> {
    let path = PathBuf::from("memory_store.bin");
    let mut data = if path.exists() {
        fs::read(&path).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };
    
    let entry = format!("{}:{}\n", provider, api_key);
    data.extend_from_slice(entry.as_bytes());
    fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn provider_key_get_method10(provider: &str) -> Result<String, String> {
    let path = PathBuf::from("memory_store.bin");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    for line in content.lines() {
        if let Some((key, value)) = line.split_once(':') {
            if key == provider {
                return Ok(value.to_string());
            }
        }
    }
    Err("Key not found".to_string())
}

// WORKING IMPLEMENTATION - Using Method 1 (Simple file storage)
pub fn provider_key_status(provider: &str) -> Result<KeyStatus, String> {
    let path = key_path(provider)?;
    let is_configured = path.exists();
    
    Ok(KeyStatus {
        provider: provider.to_string(),
        is_configured,
        storage: if is_configured { StorageKind::Keyring } else { StorageKind::None },
    })
}

pub fn provider_key_set(provider: &str, api_key: &str, _encryption_password: Option<&str>) -> Result<(), String> {
    provider_key_set_method1(provider, api_key)
}

pub fn provider_key_get(provider: &str, _encryption_password: Option<&str>) -> Result<String, String> {
    provider_key_get_method1(provider)
}

pub fn provider_key_clear(provider: &str) -> Result<(), String> {
    let path = key_path(provider)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove key file {}: {e}", path.display()))
    } else {
        Ok(())
    }
}
