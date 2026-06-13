use regex::Regex;
use serde::Serialize;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;

const MAX_LOG_FILE_BYTES: u64 = 10 * 1024 * 1024; // 10MB

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeLogFile {
    pub filename: String,
    pub modified_at: u64,
    pub size: u64,
    pub maestro_session_id: Option<String>,
}

const SESSION_ID_PREFIX_BYTES: usize = 8 * 1024; // 8KB

/// Read the first ~8KB of a JSONL file and look for a Maestro session ID tag.
fn extract_maestro_session_id(path: &PathBuf) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut buf = vec![0u8; SESSION_ID_PREFIX_BYTES];
    let n = file.read(&mut buf).ok()?;
    buf.truncate(n);
    let text = String::from_utf8_lossy(&buf);
    let re = Regex::new(r"<session_id>(sess_[^<]+)</session_id>").ok()?;
    re.captures(&text).map(|c| c[1].to_string())
}

/// Encode a cwd path to match Claude's project directory naming.
///
/// Claude Code names the project dir by replacing every non-alphanumeric
/// character in the absolute path with `-` (e.g. `/Users/jane.doe/my project`
/// -> `-Users-jane-doe-my-project`). Replacing only `/` would break any path
/// whose segments contain `.`, `_`, or spaces (such as a username like
/// `jane.doe`), because the encoded dir would never match the real one on disk.
/// A trailing slash is stripped first so it doesn't produce a trailing `-`.
fn encode_project_path(cwd: &str) -> String {
    cwd.trim_end_matches(['/', '\\'])
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

/// Get the Claude projects directory.
///
/// Honors `CLAUDE_CONFIG_DIR` (Claude Code relocates the whole `~/.claude` tree
/// there when set), falling back to `<home>/.claude`. On Windows the home dir
/// resolves to `%USERPROFILE%`, so the default is `%USERPROFILE%\.claude\projects`.
fn claude_projects_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        let dir = dir.trim();
        if !dir.is_empty() {
            return Ok(PathBuf::from(dir).join("projects"));
        }
    }
    let home = dirs::home_dir().ok_or_else(|| "cannot determine home directory".to_string())?;
    Ok(home.join(".claude").join("projects"))
}

#[tauri::command]
pub fn list_claude_session_logs(cwd: String) -> Result<Vec<ClaudeLogFile>, String> {
    let projects_dir = claude_projects_dir()?;
    let encoded = encode_project_path(cwd.trim());
    let project_dir = projects_dir.join(&encoded);

    if !project_dir.is_dir() {
        return Ok(Vec::new());
    }

    let read_dir = fs::read_dir(&project_dir).map_err(|e| format!("read dir failed: {e}"))?;
    let mut files: Vec<ClaudeLogFile> = Vec::new();

    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".jsonl") {
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

        // Extract maestro session ID from first ~8KB of the file
        let maestro_session_id = extract_maestro_session_id(&path);

        files.push(ClaudeLogFile {
            filename: name,
            modified_at,
            size: meta.len(),
            maestro_session_id,
        });
    }

    // Sort most recent first
    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(files)
}

#[tauri::command]
pub fn read_claude_session_log(cwd: String, filename: String) -> Result<String, String> {
    let filename = filename.trim();

    // Validate filename
    if !filename.ends_with(".jsonl") {
        return Err("filename must end with .jsonl".to_string());
    }
    if filename.contains('/') || filename.contains('\\') {
        return Err("filename must not contain path separators".to_string());
    }

    let projects_dir = claude_projects_dir()?;
    let encoded = encode_project_path(cwd.trim());
    let file_path = projects_dir.join(&encoded).join(filename);

    if !file_path.is_file() {
        return Err("log file not found".to_string());
    }

    let meta = fs::metadata(&file_path).map_err(|e| format!("metadata failed: {e}"))?;
    if meta.len() > MAX_LOG_FILE_BYTES {
        return Err(format!(
            "file too large ({} bytes, max {} bytes)",
            meta.len(),
            MAX_LOG_FILE_BYTES
        ));
    }

    fs::read_to_string(&file_path).map_err(|e| format!("read failed: {e}"))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogTailResult {
    pub content: String,
    pub new_offset: u64,
    pub file_size: u64,
}

/// Read new content from a JSONL log file starting at a byte offset.
/// Returns only the bytes added since the last read.
#[tauri::command]
pub fn tail_claude_session_log(
    cwd: String,
    filename: String,
    offset: u64,
) -> Result<LogTailResult, String> {
    let filename = filename.trim();

    if !filename.ends_with(".jsonl") {
        return Err("filename must end with .jsonl".to_string());
    }
    if filename.contains('/') || filename.contains('\\') {
        return Err("filename must not contain path separators".to_string());
    }

    let projects_dir = claude_projects_dir()?;
    let encoded = encode_project_path(cwd.trim());
    let file_path = projects_dir.join(&encoded).join(filename);

    if !file_path.is_file() {
        return Err("log file not found".to_string());
    }

    let meta = fs::metadata(&file_path).map_err(|e| format!("metadata failed: {e}"))?;
    let file_size = meta.len();

    // Nothing new
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

    let mut file = fs::File::open(&file_path).map_err(|e| format!("open failed: {e}"))?;
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

#[cfg(test)]
mod tests {
    use super::encode_project_path;

    #[test]
    fn encodes_plain_path() {
        assert_eq!(
            encode_project_path("/Users/subhang/Projects/agent-maestro"),
            "-Users-subhang-Projects-agent-maestro"
        );
    }

    #[test]
    fn encodes_dot_in_segment() {
        // A `.` in a path segment (e.g. the username) must become `-`,
        // matching Claude's project directory naming.
        assert_eq!(
            encode_project_path("/Users/jane.doe/Projects/agent-maestro"),
            "-Users-jane-doe-Projects-agent-maestro"
        );
    }

    #[test]
    fn encodes_underscores_and_spaces() {
        assert_eq!(
            encode_project_path("/Users/a_b/my project"),
            "-Users-a-b-my-project"
        );
    }

    #[test]
    fn strips_trailing_slash() {
        assert_eq!(
            encode_project_path("/Users/subhang/Projects/agent-maestro/"),
            "-Users-subhang-Projects-agent-maestro"
        );
    }
}
