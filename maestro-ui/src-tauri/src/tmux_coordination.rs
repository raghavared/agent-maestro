use std::process::Command;
use tauri::WebviewWindow;

/// Helper function to find the bundled tmux binary
fn find_bundled_tmux() -> Option<std::path::PathBuf> {
    crate::pty::find_bundled_tmux()
}

/// Helper function to get tmux paths
fn ensure_tmux_paths(window: &WebviewWindow) -> Result<crate::pty::TmuxPaths, String> {
    crate::pty::ensure_tmux_paths(window).ok_or("unable to determine tmux paths".to_string())
}

/// Attach to a shared tmux session for multi-agent coordination
///
/// # Arguments
/// * `session_name` - Name of the shared tmux session
/// * `socket_path` - Path to the tmux socket (optional, uses default if None)
///
/// # Returns
/// * `Ok(String)` - Session information if successful
/// * `Err(String)` - Error message if attachment fails
#[tauri::command]
pub fn tmux_attach_shared(
    window: WebviewWindow,
    session_name: String,
    socket_path: Option<String>,
) -> Result<String, String> {
    let tmux = find_bundled_tmux().ok_or("bundled tmux missing in this build".to_string())?;
    let tmux_paths = ensure_tmux_paths(&window)?;

    let socket = if let Some(path) = socket_path {
        path
    } else {
        tmux_paths.socket_dir.join("default").to_string_lossy().to_string()
    };

    // Check if session exists
    let out = Command::new(&tmux)
        .args(["-S", &socket, "has-session", "-t", &session_name])
        .output()
        .map_err(|e| format!("failed to check tmux session: {e}"))?;

    if !out.status.success() {
        return Err(format!("session '{}' does not exist", session_name));
    }

    Ok(format!("Successfully verified session '{}'", session_name))
}

/// Send a command to a specific tmux pane
///
/// # Arguments
/// * `session_name` - Name of the tmux session
/// * `pane_id` - Pane identifier (e.g., "0", "1", or "{pane-id}")
/// * `command` - Command to send to the pane
/// * `socket_path` - Path to the tmux socket (optional)
///
/// # Returns
/// * `Ok(())` - If command was sent successfully
/// * `Err(String)` - Error message if send fails
#[tauri::command]
pub fn tmux_send_to_pane(
    window: WebviewWindow,
    session_name: String,
    pane_id: String,
    command: String,
    socket_path: Option<String>,
) -> Result<(), String> {
    let tmux = find_bundled_tmux().ok_or("bundled tmux missing in this build".to_string())?;
    let tmux_paths = ensure_tmux_paths(&window)?;

    let socket = if let Some(path) = socket_path {
        path
    } else {
        tmux_paths.socket_dir.join("default").to_string_lossy().to_string()
    };

    let target = format!("{}:{}", session_name, pane_id);

    let out = Command::new(&tmux)
        .args(["-S", &socket, "send-keys", "-t", &target, &command, "Enter"])
        .output()
        .map_err(|e| format!("failed to send command to pane: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("failed to send command: {}", stderr));
    }

    Ok(())
}

/// Split a tmux pane for multi-agent coordination
///
/// # Arguments
/// * `session_name` - Name of the tmux session
/// * `pane_id` - Pane to split (optional, splits current pane if None)
/// * `vertical` - If true, split vertically; if false, split horizontally
/// * `socket_path` - Path to the tmux socket (optional)
///
/// # Returns
/// * `Ok(String)` - New pane ID if successful
/// * `Err(String)` - Error message if split fails
#[tauri::command]
pub fn tmux_split_pane(
    window: WebviewWindow,
    session_name: String,
    pane_id: Option<String>,
    vertical: bool,
    socket_path: Option<String>,
) -> Result<String, String> {
    let tmux = find_bundled_tmux().ok_or("bundled tmux missing in this build".to_string())?;
    let tmux_paths = ensure_tmux_paths(&window)?;

    let socket = if let Some(path) = socket_path {
        path
    } else {
        tmux_paths.socket_dir.join("default").to_string_lossy().to_string()
    };

    let target = if let Some(id) = pane_id {
        format!("{}:{}", session_name, id)
    } else {
        session_name.clone()
    };

    let split_flag = if vertical { "-h" } else { "-v" };

    let out = Command::new(&tmux)
        .args(["-S", &socket, "split-window", split_flag, "-t", &target, "-P", "-F", "#{pane_id}"])
        .output()
        .map_err(|e| format!("failed to split pane: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("failed to split pane: {}", stderr));
    }

    let new_pane_id = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Ok(new_pane_id)
}

/// Set an environment variable in a tmux session
///
/// # Arguments
/// * `session_name` - Name of the tmux session
/// * `key` - Environment variable name
/// * `value` - Environment variable value
/// * `socket_path` - Path to the tmux socket (optional)
///
/// # Returns
/// * `Ok(())` - If environment variable was set successfully
/// * `Err(String)` - Error message if setenv fails
#[tauri::command]
pub fn tmux_setenv(
    window: WebviewWindow,
    session_name: String,
    key: String,
    value: String,
    socket_path: Option<String>,
) -> Result<(), String> {
    let tmux = find_bundled_tmux().ok_or("bundled tmux missing in this build".to_string())?;
    let tmux_paths = ensure_tmux_paths(&window)?;

    let socket = if let Some(path) = socket_path {
        path
    } else {
        tmux_paths.socket_dir.join("default").to_string_lossy().to_string()
    };

    let out = Command::new(&tmux)
        .args(["-S", &socket, "setenv", "-t", &session_name, &key, &value])
        .output()
        .map_err(|e| format!("failed to set environment variable: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("failed to set environment variable: {}", stderr));
    }

    Ok(())
}

/// List all panes in a tmux session
///
/// # Arguments
/// * `session_name` - Name of the tmux session
/// * `socket_path` - Path to the tmux socket (optional)
///
/// # Returns
/// * `Ok(Vec<String>)` - List of pane IDs
/// * `Err(String)` - Error message if listing fails
#[tauri::command]
pub fn tmux_list_panes(
    window: WebviewWindow,
    session_name: String,
    socket_path: Option<String>,
) -> Result<Vec<String>, String> {
    let tmux = find_bundled_tmux().ok_or("bundled tmux missing in this build".to_string())?;
    let tmux_paths = ensure_tmux_paths(&window)?;

    let socket = if let Some(path) = socket_path {
        path
    } else {
        tmux_paths.socket_dir.join("default").to_string_lossy().to_string()
    };

    let out = Command::new(&tmux)
        .args(["-S", &socket, "list-panes", "-t", &session_name, "-F", "#{pane_id}"])
        .output()
        .map_err(|e| format!("failed to list panes: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("failed to list panes: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let panes: Vec<String> = stdout
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    Ok(panes)
}

/// Get information about a specific pane
///
/// # Arguments
/// * `session_name` - Name of the tmux session
/// * `pane_id` - Pane identifier
/// * `socket_path` - Path to the tmux socket (optional)
///
/// # Returns
/// * `Ok(String)` - Pane information (current directory, active command, etc.)
/// * `Err(String)` - Error message if query fails
#[tauri::command]
pub fn tmux_get_pane_info(
    window: WebviewWindow,
    session_name: String,
    pane_id: String,
    socket_path: Option<String>,
) -> Result<String, String> {
    let tmux = find_bundled_tmux().ok_or("bundled tmux missing in this build".to_string())?;
    let tmux_paths = ensure_tmux_paths(&window)?;

    let socket = if let Some(path) = socket_path {
        path
    } else {
        tmux_paths.socket_dir.join("default").to_string_lossy().to_string()
    };

    let target = format!("{}:{}", session_name, pane_id);
    let format = "pane_id=#{pane_id},pane_current_path=#{pane_current_path},pane_current_command=#{pane_current_command}";

    let out = Command::new(&tmux)
        .args(["-S", &socket, "display-message", "-t", &target, "-p", format])
        .output()
        .map_err(|e| format!("failed to get pane info: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("failed to get pane info: {}", stderr));
    }

    let info = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Ok(info)
}
