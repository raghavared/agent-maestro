use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

const MAX_LOG_FILE_BYTES: u64 = 10 * 1024 * 1024; // 10MB
const SESSION_ID_PREFIX_BYTES: usize = 256 * 1024; // 256KB

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodexLogFile {
    pub filename: String,
    pub relative_path: String,
    pub modified_at: u64,
    pub size: u64,
    pub maestro_session_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogTailResult {
    pub content: String,
    pub new_offset: u64,
    pub file_size: u64,
}

fn codex_sessions_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "cannot determine home directory".to_string())?;
    Ok(home.join(".codex").join("sessions"))
}

fn read_prefix(path: &Path, bytes: usize) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut buf = vec![0u8; bytes];
    let n = file.read(&mut buf).ok()?;
    buf.truncate(n);
    Some(String::from_utf8_lossy(&buf).to_string())
}

fn extract_maestro_session_id(path: &Path) -> Option<String> {
    let text = read_prefix(path, SESSION_ID_PREFIX_BYTES)?;
    let re = Regex::new(r"<session_id>(sess_[^<]+)</session_id>").ok()?;
    re.captures(&text).map(|c| c[1].to_string())
}

fn list_jsonl_files_recursive(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let rd = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };

        for entry in rd.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                files.push(path);
            }
        }
    }

    files
}

fn file_matches_cwd(path: &Path, cwd: &str) -> bool {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line).is_err() || first_line.trim().is_empty() {
        return false;
    }

    let val: Value = match serde_json::from_str(first_line.trim()) {
        Ok(v) => v,
        Err(_) => return false,
    };

    if val.get("type").and_then(|v| v.as_str()) != Some("session_meta") {
        return false;
    }

    val.get("payload")
        .and_then(|p| p.get("cwd"))
        .and_then(|c| c.as_str())
        .map(|c| c == cwd)
        .unwrap_or(false)
}

fn resolve_codex_log_path(relative_path: &str) -> Result<PathBuf, String> {
    let rel = relative_path.trim();
    if !rel.ends_with(".jsonl") {
        return Err("filename must end with .jsonl".to_string());
    }

    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err("path must be relative".to_string());
    }
    if rel_path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("path must not contain '..'".to_string());
    }

    let base = codex_sessions_dir()?;
    let joined = base.join(rel_path);

    let canon_base = fs::canonicalize(&base).map_err(|e| format!("base path resolve failed: {e}"))?;
    let canon_joined = fs::canonicalize(&joined).map_err(|_| "log file not found".to_string())?;

    if !canon_joined.starts_with(&canon_base) {
        return Err("path escapes codex sessions directory".to_string());
    }

    Ok(canon_joined)
}

#[tauri::command]
pub fn list_codex_session_logs(cwd: String) -> Result<Vec<CodexLogFile>, String> {
    let sessions_dir = codex_sessions_dir()?;
    if !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }

    let cwd = cwd.trim();
    let all_files = list_jsonl_files_recursive(&sessions_dir);
    let mut files: Vec<CodexLogFile> = Vec::new();

    for path in all_files {
        if !file_matches_cwd(&path, cwd) {
            continue;
        }

        let meta = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let modified_at = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();

        let relative_path = path
            .strip_prefix(&sessions_dir)
            .ok()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|| filename.clone());

        let maestro_session_id = extract_maestro_session_id(&path);

        files.push(CodexLogFile {
            filename,
            relative_path,
            modified_at,
            size: meta.len(),
            maestro_session_id,
        });
    }

    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(files)
}

#[tauri::command]
pub fn read_codex_session_log(cwd: String, filename: String) -> Result<String, String> {
    let path = resolve_codex_log_path(&filename)?;

    if !file_matches_cwd(&path, cwd.trim()) {
        return Err("log file does not belong to the provided cwd".to_string());
    }

    let meta = fs::metadata(&path).map_err(|e| format!("metadata failed: {e}"))?;
    if meta.len() > MAX_LOG_FILE_BYTES {
        return Err(format!(
            "file too large ({} bytes, max {} bytes)",
            meta.len(),
            MAX_LOG_FILE_BYTES
        ));
    }

    fs::read_to_string(&path).map_err(|e| format!("read failed: {e}"))
}

#[tauri::command]
pub fn tail_codex_session_log(cwd: String, filename: String, offset: u64) -> Result<LogTailResult, String> {
    let path = resolve_codex_log_path(&filename)?;

    if !file_matches_cwd(&path, cwd.trim()) {
        return Err("log file does not belong to the provided cwd".to_string());
    }

    let meta = fs::metadata(&path).map_err(|e| format!("metadata failed: {e}"))?;
    let file_size = meta.len();

    if offset >= file_size {
        return Ok(LogTailResult {
            content: String::new(),
            new_offset: offset,
            file_size,
        });
    }

    let bytes_to_read = file_size - offset;
    if bytes_to_read > MAX_LOG_FILE_BYTES {
        return Err("too much new content to read".to_string());
    }

    let mut file = fs::File::open(&path).map_err(|e| format!("open failed: {e}"))?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| format!("seek failed: {e}"))?;

    let mut buf = vec![0u8; bytes_to_read as usize];
    file.read_exact(&mut buf)
        .map_err(|e| format!("read failed: {e}"))?;

    let content = String::from_utf8(buf).map_err(|_| "content is not valid UTF-8".to_string())?;

    Ok(LogTailResult {
        content,
        new_offset: file_size,
        file_size,
    })
}
