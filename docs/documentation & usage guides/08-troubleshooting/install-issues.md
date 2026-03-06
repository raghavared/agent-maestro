# Common Install Issues

This page covers the most frequently encountered problems when installing Maestro and how to fix them.

---

## Rust Not Found

**Error:**
```
error: rustc not found
```

**Cause:** Rust is required to build the Tauri desktop app (`maestro-ui`). The install script does not auto-install Rust.

**Solution:**
```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Restart your shell or source the env
source "$HOME/.cargo/env"

# Verify
rustc --version
```

**Prevention:** If you don't need the desktop app, use `./install.sh --server-only` to skip the Tauri build entirely — no Rust required.

---

## Xcode Command Line Tools Missing

**Error:**
```
warn  Xcode Command Line Tools not found.
info  Triggering installation dialog — complete it, then re-run this script.
```

**Cause:** macOS requires Xcode Command Line Tools for compiling native dependencies. The install script checks for them and exits if missing.

**Solution:**
```bash
# Install Xcode CLI tools
xcode-select --install

# Wait for the dialog to complete, then re-run
./install.sh
```

**Prevention:** Install Xcode Command Line Tools before running the install script. They're a one-time setup on macOS.

---

## `bun` Not Found After Install

**Error:**
```
bun: command not found
```

**Cause:** The install script installs bun to `~/.bun/bin/`, but your shell session hasn't picked up the new PATH yet.

**Solution:**
```bash
# Option 1: Restart your terminal
# Option 2: Source your shell config
source ~/.zshrc   # or ~/.bashrc

# Option 3: Manually add bun to PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Verify
bun --version
```

**Prevention:** After a fresh bun install, always restart your terminal or source your shell config before running further commands.

---

## Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause:** Another process (possibly a previous Maestro server instance) is already listening on port 3000.

**Solution:**
```bash
# Find what's using the port
lsof -i :3000

# Kill the process (replace <PID> with actual PID)
kill <PID>

# Or force kill if needed
kill -9 <PID>

# Then restart the server
maestro-server
```

To use a different port:
```bash
PORT=3001 maestro-server
```

**Prevention:** Always stop the server cleanly before restarting. Use `Ctrl+C` or `kill` with a normal signal first.

---

## Tauri Build Fails

**Error:**
```
error: failed to run custom build command for `maestro-ui`
```
or
```
error[E0463]: can't find crate
```

**Cause:** Outdated Rust toolchain, missing Tauri prerequisites, or stale build cache.

**Solution:**
```bash
# Update Rust
rustup update

# Install Tauri CLI if missing
cargo install tauri-cli

# Clean and rebuild
cd maestro-ui
cargo clean
cd ..
./install.sh
```

If you see linker errors on macOS, ensure Xcode Command Line Tools are current:
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
# Or if you only have CLI tools:
sudo xcode-select --switch /Library/Developer/CommandLineTools
```

**Prevention:** Keep Rust updated with `rustup update` before building. Check [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

---

## `node_modules` Issues

**Error:**
```
Module not found: Can't resolve '...'
```
or
```
error: Could not resolve "..."
```

**Cause:** Stale or corrupted `node_modules` from a previous install, or a partial install that was interrupted.

**Solution:**
```bash
# From the repo root — clean and reinstall all packages
rm -rf node_modules
rm -rf maestro-server/node_modules
rm -rf maestro-cli/node_modules
rm -rf maestro-ui/node_modules

# Reinstall
bun install
```

If bun's lockfile is out of sync:
```bash
rm bun.lockb
bun install
```

**Prevention:** Always use `bun install` (not npm or yarn) to install dependencies. If you switch branches with different dependencies, run `bun install` again.

---

## Install Script Fails Silently

**Error:** The install script exits without a clear error message.

**Cause:** The script uses `set -euo pipefail`, so any failing command stops execution immediately.

**Solution:**
```bash
# Run with verbose output to see exactly where it fails
bash -x ./install.sh
```

Check the last few lines of output to identify which step failed, then refer to the relevant section above.

---

## Docker Compose Issues

**Error:**
```
ERROR: Service 'maestro' failed to build
```

**Cause:** Docker build context issues or missing Docker prerequisites.

**Solution:**
```bash
# Ensure Docker is running
docker info

# Clean build
docker compose down
docker compose build --no-cache
docker compose up
```

**Prevention:** Make sure Docker Desktop is running and has sufficient resources allocated (at least 4GB RAM recommended).
