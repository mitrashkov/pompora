use anyhow::{anyhow, Context, Result};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;

use super::secrets;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProfile {
    pub user_id: String,
    pub email: String,
    pub plan: String,
    #[serde(default)]
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditsResponse {
    pub plan: String,
    pub slow: CreditsBucket,
    pub fast: CreditsFast,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditsBucket {
    pub limit: i32,
    pub used: i32,
    pub remaining: i32,
    pub resets: Option<String>,
    pub period: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditsFast {
    pub limit_month: i32,
    pub used_month: i32,
    pub remaining_month: i32,
    pub daily_cap: i32,
    pub used_today: i32,
    pub remaining_today: i32,
    pub period_month: Option<String>,
    pub period_day: Option<String>,
}

struct PendingLogin {
    receiver: tokio::sync::oneshot::Receiver<AuthProfile>,
}

static PENDING: Lazy<Mutex<HashMap<String, PendingLogin>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn auth_path() -> Result<PathBuf> {
    let base = dirs::config_dir().context("missing config dir")?;
    Ok(base.join("Pompora").join("auth.json"))
}

fn store_profile(p: &AuthProfile) -> Result<()> {
    let path = auth_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create auth dir: {}", parent.display()))?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(p).context("serialize auth profile")?)
        .with_context(|| format!("write auth tmp: {}", tmp.display()))?;
    fs::rename(&tmp, &path).with_context(|| format!("replace auth: {}", path.display()))?;
    Ok(())
}

pub fn load_profile() -> Result<Option<AuthProfile>> {
    let path = auth_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).with_context(|| format!("read auth: {}", path.display()))?;
    let parsed = serde_json::from_str::<AuthProfile>(&raw).context("parse auth profile")?;
    Ok(Some(parsed))
}

pub fn clear_profile() -> Result<()> {
    let path = auth_path()?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    Ok(())
}

fn random_state() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>()
}

fn percent_decode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut bytes = input.as_bytes().iter().copied();
    while let Some(b) = bytes.next() {
        if b == b'%' {
            let h1 = bytes.next();
            let h2 = bytes.next();
            if let (Some(h1), Some(h2)) = (h1, h2) {
                let hex = [h1, h2];
                if let Ok(s) = std::str::from_utf8(&hex) {
                    if let Ok(v) = u8::from_str_radix(s, 16) {
                        out.push(v as char);
                        continue;
                    }
                }
            }
            out.push('%');
            continue;
        }
        if b == b'+' {
            out.push(' ');
            continue;
        }
        out.push(b as char);
    }
    out
}

fn parse_query(q: &str) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for part in q.split('&') {
        if part.trim().is_empty() {
            continue;
        }
        let (k, v) = part.split_once('=').unwrap_or((part, ""));
        out.insert(percent_decode(k), percent_decode(v));
    }
    out
}

fn read_http_request(stream: &mut TcpStream) -> Result<String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(15)))
        .ok();
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf).context("read request")?;
    Ok(String::from_utf8_lossy(&buf[..n]).to_string())
}

fn write_http_response(stream: &mut TcpStream, status: &str, body: &str) {
    let resp = format!(
        "HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
        body.as_bytes().len()
    );
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.flush();
}

fn handle_callback_request(state_expected: &str, req: &str) -> Result<AuthProfile> {
    let first_line = req.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let _method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("/");

    let path_and_query = target.split_once('?');
    let (path, q) = match path_and_query {
        Some((p, q)) => (p, q),
        None => (target, ""),
    };

    if path != "/callback" {
        return Err(anyhow!("unexpected path"));
    }

    let qp = parse_query(q);

    let state = qp.get("state").map(|s| s.as_str()).unwrap_or("");
    if state != state_expected {
        return Err(anyhow!("state mismatch"));
    }

    let api_key = qp.get("apiKey").map(|s| s.trim()).unwrap_or("");
    if api_key.is_empty() {
        return Err(anyhow!("missing apiKey"));
    }

    let plan = qp.get("plan").cloned().unwrap_or_else(|| "starter".to_string());
    let email = qp.get("email").cloned().unwrap_or_else(|| "".to_string());
    let user_id = qp.get("userId").cloned().unwrap_or_else(|| "".to_string());
    let avatar_url = qp.get("avatarUrl").cloned().unwrap_or_else(|| "".to_string());

    secrets::provider_key_set("pompora", api_key, None).map_err(|e| anyhow!(e))?;

    let profile = AuthProfile {
        user_id,
        email,
        plan,
        avatar_url,
    };

    store_profile(&profile)?;

    Ok(profile)
}

pub async fn begin_login() -> Result<(String, String)> {
    let state = random_state();

    let state_for_thread = state.clone();

    let listener = TcpListener::bind("127.0.0.1:0").context("bind callback server")?;
    let addr = listener.local_addr().context("callback server addr")?;
    let port = addr.port();

    let (tx, rx) = tokio::sync::oneshot::channel::<AuthProfile>();

    {
        let mut map = PENDING.lock().map_err(|_| anyhow!("auth lock poisoned"))?;
        map.insert(
            state.clone(),
            PendingLogin {
                receiver: rx,
            },
        );
    }

    std::thread::spawn(move || {
        let accept = listener.accept();
        match accept {
            Ok((mut stream, _)) => {
                let req = read_http_request(&mut stream);
                match req.and_then(|r| handle_callback_request(&state_for_thread, &r)) {
                    Ok(profile) => {
                        write_http_response(
                            &mut stream,
                            "200 OK",
                            "<html><body>Signed in. You can close this window.</body></html>",
                        );
                        let _ = tx.send(profile);
                    }
                    Err(_) => {
                        write_http_response(
                            &mut stream,
                            "400 Bad Request",
                            "<html><body>Login failed. You can close this window.</body></html>",
                        );
                    }
                }
            }
            Err(_) => {
            }
        }
    });

    let redirect = format!("http://127.0.0.1:{port}/callback");
    let url = format!(
        "https://pompora.dev/desktop/login?redirect={}&state={}",
        urlencoding::encode(&redirect),
        urlencoding::encode(&state)
    );

    Ok((url, state))
}

pub async fn wait_login(state: &str) -> Result<AuthProfile> {
    let pending = {
        let mut map = PENDING.lock().map_err(|_| anyhow!("auth lock poisoned"))?;
        map.remove(state)
    };

    let mut pending = pending.ok_or_else(|| anyhow!("login not started"))?;

    let profile = tokio::time::timeout(Duration::from_secs(180), pending.receiver)
        .await
        .map_err(|_| anyhow!("login timeout"))
        .context("wait login")
        .and_then(|r| r.map_err(|_| anyhow!("login canceled")))?;

    Ok(profile)
}

pub async fn fetch_credits() -> Result<CreditsResponse> {
    let api_key = secrets::provider_key_get("pompora", None).map_err(|e| anyhow!(e))?;

    let client = reqwest::Client::new();
    let res = client
        .get("https://pompora.dev/api/desktop/credits")
        .bearer_auth(api_key.trim())
        .send()
        .await
        .context("credits request")?;

    let status = res.status();
    let text = res.text().await.context("credits response text")?;

    if !status.is_success() {
        return Err(anyhow!("credits request failed (status {status}): {text}"));
    }

    let parsed = serde_json::from_str::<CreditsResponse>(&text)
        .with_context(|| format!("invalid credits json: {text}"))?;

    Ok(parsed)
}

pub fn logout() -> Result<()> {
    let _ = secrets::provider_key_clear("pompora");
    let _ = clear_profile();
    Ok(())
}
