//! Integration tests for tmux functionality
//!
//! These tests verify the tmux integration works correctly for:
//! - Session creation and persistence
//! - Multi-agent coordination (shared sessions)
//! - Pane splitting and targeting
//! - Command execution in panes
//! - Environment variable management

use std::process::Command;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;

/// Helper function to find the bundled tmux binary
fn find_tmux_binary() -> Option<PathBuf> {
    // Look for tmux in the project's bin directory (for CI/local dev)
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let bin_dir = PathBuf::from(manifest_dir).join("bin");

    #[cfg(target_os = "macos")]
    {
        let arch = if cfg!(target_arch = "aarch64") {
            "aarch64-apple-darwin"
        } else {
            "x86_64-apple-darwin"
        };

        let bundled = bin_dir.join(format!("tmux-{}", arch));
        if bundled.exists() {
            return Some(bundled);
        }
    }

    // Fallback to system tmux
    which::which("tmux").ok()
}

/// Helper function to get a unique test socket path
fn test_socket_path(test_name: &str) -> PathBuf {
    let temp_dir = std::env::temp_dir();
    temp_dir.join(format!("agents-ui-test-{}-{}.sock", test_name, std::process::id()))
}

/// Helper function to cleanup test socket
fn cleanup_socket(socket_path: &PathBuf) {
    let _ = std::fs::remove_file(socket_path);
}

/// Helper function to create a test tmux config
fn create_test_config() -> PathBuf {
    let temp_dir = std::env::temp_dir();
    let config_path = temp_dir.join(format!("tmux-test-{}.conf", std::process::id()));

    let config_content = r#"# Test tmux config
set -g mouse on
set -g status off
set -g default-terminal "screen-256color"
set -ga terminal-overrides ",xterm-256color:Tc"
set -sg escape-time 0
set -g history-limit 50000
set -g base-index 1
set -g pane-base-index 1
"#;

    std::fs::write(&config_path, config_content).unwrap();
    config_path
}

#[test]
fn test_tmux_binary_exists() {
    let tmux = find_tmux_binary();
    assert!(tmux.is_some(), "tmux binary not found");

    let tmux_path = tmux.unwrap();
    assert!(tmux_path.exists(), "tmux binary path does not exist: {:?}", tmux_path);
}

#[test]
fn test_tmux_version() {
    let tmux = find_tmux_binary().expect("tmux binary not found");

    let output = Command::new(&tmux)
        .arg("-V")
        .output()
        .expect("failed to execute tmux -V");

    assert!(output.status.success(), "tmux -V failed");

    let version_str = String::from_utf8_lossy(&output.stdout);
    assert!(version_str.contains("tmux"), "unexpected tmux version output: {}", version_str);
}

#[test]
fn test_create_tmux_session() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("create_session");
    let config = create_test_config();

    // Create a new session
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "test-session"])
        .output()
        .expect("failed to create tmux session");

    assert!(output.status.success(), "failed to create session: {}", String::from_utf8_lossy(&output.stderr));

    // Verify session exists
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["has-session", "-t", "test-session"])
        .output()
        .expect("failed to check session");

    assert!(output.status.success(), "session does not exist");

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "test-session"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_list_tmux_sessions() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("list_sessions");
    let config = create_test_config();

    // Create multiple sessions
    for i in 1..=3 {
        let session_name = format!("agents-ui-test-{}", i);
        let _ = Command::new(&tmux)
            .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
            .args(["new-session", "-d", "-s", &session_name])
            .output();
    }

    // List sessions
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["list-sessions", "-F", "#{session_name}"])
        .output()
        .expect("failed to list sessions");

    assert!(output.status.success(), "failed to list sessions");

    let sessions = String::from_utf8_lossy(&output.stdout);
    assert!(sessions.contains("agents-ui-test-1"), "session 1 not found");
    assert!(sessions.contains("agents-ui-test-2"), "session 2 not found");
    assert!(sessions.contains("agents-ui-test-3"), "session 3 not found");

    // Cleanup
    for i in 1..=3 {
        let session_name = format!("agents-ui-test-{}", i);
        let _ = Command::new(&tmux)
            .args(["-S", socket.to_str().unwrap()])
            .args(["kill-session", "-t", &session_name])
            .output();
    }

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_session_persistence() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("persistence");
    let config = create_test_config();

    // Create a session
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "persistent-session"])
        .output()
        .expect("failed to create session");

    assert!(output.status.success(), "failed to create session");

    // Verify it exists
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["has-session", "-t", "persistent-session"])
        .output()
        .expect("failed to check session");

    assert!(output.status.success(), "session does not exist");

    // Simulate app restart by just checking again (socket persists)
    thread::sleep(Duration::from_millis(100));

    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["has-session", "-t", "persistent-session"])
        .output()
        .expect("failed to check session after restart");

    assert!(output.status.success(), "session did not persist");

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "persistent-session"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_attach_to_existing_session() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("attach");
    let config = create_test_config();

    // Create a session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "attach-test"])
        .output();

    // Attach using new-session -A (attach or create)
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["new-session", "-A", "-s", "attach-test", "-d"])
        .output()
        .expect("failed to attach to session");

    assert!(output.status.success(), "failed to attach: {}", String::from_utf8_lossy(&output.stderr));

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "attach-test"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_split_pane() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("split_pane");
    let config = create_test_config();

    // Create a session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "split-test"])
        .output();

    // Split pane vertically
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["split-window", "-h", "-t", "split-test", "-P", "-F", "#{pane_id}"])
        .output()
        .expect("failed to split pane");

    assert!(output.status.success(), "failed to split pane: {}", String::from_utf8_lossy(&output.stderr));

    let new_pane_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    assert!(!new_pane_id.is_empty(), "no pane ID returned");

    // List panes to verify we have 2 panes
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["list-panes", "-t", "split-test", "-F", "#{pane_id}"])
        .output()
        .expect("failed to list panes");

    let panes = String::from_utf8_lossy(&output.stdout);
    let pane_count = panes.lines().count();
    assert_eq!(pane_count, 2, "expected 2 panes, got {}", pane_count);

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "split-test"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_send_keys_to_pane() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("send_keys");
    let config = create_test_config();

    // Create a session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "sendkeys-test"])
        .output();

    // Send a command to the pane
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["send-keys", "-t", "sendkeys-test:0", "echo 'test'", "Enter"])
        .output()
        .expect("failed to send keys");

    assert!(output.status.success(), "failed to send keys: {}", String::from_utf8_lossy(&output.stderr));

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "sendkeys-test"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_set_environment_variable() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("setenv");
    let config = create_test_config();

    // Create a session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "setenv-test"])
        .output();

    // Set an environment variable
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["setenv", "-t", "setenv-test", "TEST_VAR", "test_value"])
        .output()
        .expect("failed to set environment variable");

    assert!(output.status.success(), "failed to setenv: {}", String::from_utf8_lossy(&output.stderr));

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "setenv-test"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_get_pane_info() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("pane_info");
    let config = create_test_config();

    // Create a session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "paneinfo-test"])
        .output();

    // Get pane information
    let format = "pane_id=#{pane_id},pane_current_path=#{pane_current_path}";
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["display-message", "-t", "paneinfo-test:0", "-p", format])
        .output()
        .expect("failed to get pane info");

    assert!(output.status.success(), "failed to get pane info: {}", String::from_utf8_lossy(&output.stderr));

    let info = String::from_utf8_lossy(&output.stdout);
    assert!(info.contains("pane_id="), "pane info missing pane_id");
    assert!(info.contains("pane_current_path="), "pane info missing current path");

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "paneinfo-test"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_multi_agent_shared_session() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("multi_agent");
    let config = create_test_config();

    // Agent 1: Create a shared session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "agents-ui-shared"])
        .output();

    // Agent 2: Attach to the same session
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["has-session", "-t", "agents-ui-shared"])
        .output()
        .expect("agent 2 failed to check session");

    assert!(output.status.success(), "agent 2 cannot see shared session");

    // Agent 1: Split pane for agent 2
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["split-window", "-h", "-t", "agents-ui-shared", "-P", "-F", "#{pane_id}"])
        .output()
        .expect("failed to create pane for agent 2");

    assert!(output.status.success(), "failed to split pane");

    let agent2_pane = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Agent 2: Send command to its pane
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["send-keys", "-t", &format!("agents-ui-shared:{}", agent2_pane), "echo 'agent2'", "Enter"])
        .output()
        .expect("agent 2 failed to send command");

    assert!(output.status.success(), "agent 2 failed to send command to its pane");

    // Verify both panes exist
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["list-panes", "-t", "agents-ui-shared", "-F", "#{pane_id}"])
        .output()
        .expect("failed to list panes");

    let panes = String::from_utf8_lossy(&output.stdout);
    assert_eq!(panes.lines().count(), 2, "expected 2 panes for multi-agent coordination");

    // Cleanup
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "agents-ui-shared"])
        .output();

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_session_name_sanitization() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("sanitize");
    let config = create_test_config();

    // Tmux session names should only contain alphanumeric, dash, and underscore
    let test_cases = vec![
        ("agents-ui-test123", true),
        ("agents-ui-test_123", true),
        ("agents-ui-test-123", true),
    ];

    for (session_name, should_succeed) in test_cases {
        let output = Command::new(&tmux)
            .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
            .args(["new-session", "-d", "-s", session_name])
            .output()
            .expect("failed to create session");

        if should_succeed {
            assert!(output.status.success(), "session name '{}' should be valid", session_name);

            // Cleanup
            let _ = Command::new(&tmux)
                .args(["-S", socket.to_str().unwrap()])
                .args(["kill-session", "-t", session_name])
                .output();
        }
    }

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}

#[test]
fn test_kill_session() {
    let tmux = find_tmux_binary().expect("tmux binary not found");
    let socket = test_socket_path("kill");
    let config = create_test_config();

    // Create a session
    let _ = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap(), "-f", config.to_str().unwrap()])
        .args(["new-session", "-d", "-s", "kill-test"])
        .output();

    // Verify it exists
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["has-session", "-t", "kill-test"])
        .output()
        .expect("failed to check session");

    assert!(output.status.success(), "session should exist");

    // Kill the session
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["kill-session", "-t", "kill-test"])
        .output()
        .expect("failed to kill session");

    assert!(output.status.success(), "failed to kill session");

    // Verify it's gone
    let output = Command::new(&tmux)
        .args(["-S", socket.to_str().unwrap()])
        .args(["has-session", "-t", "kill-test"])
        .output()
        .expect("failed to check session");

    assert!(!output.status.success(), "session should not exist after kill");

    cleanup_socket(&socket);
    let _ = std::fs::remove_file(config);
}
