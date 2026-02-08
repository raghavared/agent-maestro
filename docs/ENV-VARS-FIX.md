# Environment Variables Fix - Login Shell Issue

## Problem

When spawning Maestro sessions, environment variables (`MAESTRO_SESSION_ID`, `MAESTRO_MANIFEST_PATH`, `MAESTRO_SERVER_URL`) were not being seen by the `maestro worker init` command, even though they were being set correctly.

## Root Cause

The Tauri backend (Rust code) was spawning commands using the **login shell flag** (`-l`):

```rust
// Before (BROKEN):
vec!["-lc".to_string(), command.clone()]  // bash -lc "maestro worker init"
```

The `-l` flag makes bash/zsh a **login shell**, which sources profile files like:
- `~/.bash_profile`
- `~/.zprofile`
- `~/.profile`

These profile files often **reset the `PATH` and other environment variables**, overwriting the custom env vars we set!

## Evidence from Logs

The DevTools logs showed the env vars were passed correctly through all layers:

1. ✅ Server sends envVars via WebSocket
2. ✅ UI receives envVars in `session:created` event
3. ✅ `handleSpawnTerminalSession` receives envVars
4. ✅ Tauri `create_session` invoked with `env_vars`

But the Maestro CLI still couldn't see them because the login shell was resetting the environment.

## The Fix

Modified `maestro-ui/src-tauri/src/pty.rs` (lines 1268-1276) to use `-c` instead of `-lc` when environment variables are provided:

```rust
// After (FIXED):
} else {
    // Use -c instead of -lc when env_vars are provided to avoid profile files overwriting them
    let shell_flag = if env_vars.is_some() { "-c" } else { "-lc" };
    (
        shell.clone(),
        vec![shell_flag.to_string(), command.clone()],
        format!("{shell} {shell_flag} {command}"),
        false,
        shell.clone(),
    )
};
```

**What this does:**
- When `env_vars` are provided → use `-c` (non-login shell, preserves env vars)
- When no `env_vars` → use `-lc` (login shell, normal behavior for user sessions)

## Testing the Fix

1. **Rebuild the app**:
   ```bash
   cd maestro-ui
   npm run tauri dev
   ```

2. **Test by clicking play button** on any Maestro task

3. **Expected result**: Terminal spawns and shows:
   ```
   🔧 Initializing Maestro Worker Session
   📋 Reading manifest...
      Manifest: /Users/.../.maestro/sessions/sess_xxx/manifest.json
   ✅ Manifest loaded successfully
   ```

   Instead of the previous error:
   ```
   ❌ Failed to initialize worker session:
   MAESTRO_MANIFEST_PATH environment variable not set
   ```

## Why This Works

Using `-c` instead of `-lc`:
- ✅ Runs the command in a **non-login shell**
- ✅ **Skips sourcing** `~/.bash_profile` and `~/.zprofile`
- ✅ **Preserves environment variables** set by the parent process
- ✅ Still has access to shell builtins and PATH (inherited from parent)

## Files Modified

- `maestro-ui/src-tauri/src/pty.rs`: Lines 1268-1276

## Related Issues Fixed

This also fixes a previous fix we made in `maestro-ui/src/stores/initApp.ts`:
- Added WebSocket initialization (fixes sessions not spawning at all)
- Added WebSocket cleanup on teardown

Both fixes are needed for the full flow to work!

---

**Fixed:** 2026-02-05
