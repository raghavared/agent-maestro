# Tmux Migration Guide

Maestro has migrated from zellij to tmux for persistent terminal sessions. This guide covers what changed, how to migrate existing sessions, and the new capabilities available.

---

## What Changed

### Core Terminal Backend

- **Before**: Maestro used a bundled zellij binary for persistent terminal sessions
- **After**: Maestro now uses tmux (bundled on macOS, system tmux on other platforms)

### Why the Change?

1. **Better stability**: tmux is more mature and battle-tested than zellij
2. **Wider compatibility**: tmux works reliably across all Unix-like systems
3. **Native mouse support**: tmux handles mouse mode natively, simplifying the codebase
4. **Industry standard**: tmux is the de facto standard for terminal multiplexing
5. **Better multi-agent coordination**: tmux's session/window model aligns better with Maestro's multi-agent architecture

### Technical Changes

#### Backend (Rust)

- `maestro-ui/src-tauri/src/pty.rs`: Replaced zellij-specific PTY spawning with tmux
  - `spawn_zellij()` → `spawn_tmux()`
  - Sessions now use `tmux new-session` and `tmux attach-session`
  - Mouse mode enabled by default with `set-option -g mouse on`

#### Frontend (TypeScript/React)

- `maestro-ui/src/SessionTerminal.tsx`: Removed zellij-specific keybindings
  - Removed Ctrl+S scroll mode handling
  - Removed Shift+Enter special handling
  - Removed custom wheel event handlers (tmux handles scrolling natively)
  - Simplified key event handlers to only handle copy operations

- UI text updates across modals:
  - "Persistent terminal (zellij)" → "Persistent terminal (tmux)"
  - "Running bundled zellij sessions" → "Running tmux sessions"

#### CLI

- `maestro-cli/src/commands/session/spawn.ts`: Updated session spawning to use tmux
  - Changed from zellij-specific socket paths to tmux socket paths

---

## Migration Guide

### For Existing Sessions

**Important**: Existing zellij sessions are not automatically migrated. You'll need to recreate them.

#### Step 1: List Your Existing Sessions

In the desktop app:
1. Go to Settings → Manage persistent terminals
2. Note down any important session names and their working directories

#### Step 2: Close Existing Zellij Sessions

```bash
# Kill all zellij sessions managed by Maestro
maestro session list
maestro session close <session-id>
```

Or from the desktop app:
1. Click the settings icon in the Sessions panel
2. Select "Manage persistent terminals"
3. Click "Kill" on each session

#### Step 3: Create New Tmux Sessions

Use the same process as before to create persistent terminals. They'll now use tmux automatically:

**From the desktop app:**
1. Click the "+" button in the Sessions panel
2. Check "Persistent terminal (tmux)"
3. Configure your session and click "Create"

**From the CLI:**
```bash
maestro session spawn --persistent --cwd /path/to/project
```

### For SSH Connections

SSH connections also use tmux for persistence. The migration is seamless:

1. Use the SSH connection dialog (same as before)
2. Check "Persistent terminal (tmux)"
3. Connect as usual

---

## Tmux Keybindings

Maestro's tmux integration uses a simplified keybinding setup optimized for single-session usage. The default tmux prefix key is **Ctrl+B**.

### Essential Keybindings

| Keybinding | Action |
|------------|--------|
| **Ctrl+B** then **D** | Detach from session (session keeps running) |
| **Ctrl+B** then **[** | Enter copy/scroll mode (use arrow keys or Page Up/Down) |
| **q** (in scroll mode) | Exit copy/scroll mode |
| **Mouse wheel** | Scroll up/down (mouse mode enabled by default) |

### Copy Mode (Scrollback)

When in copy mode (Ctrl+B then [):
- **Arrow keys**: Navigate character by character
- **Page Up/Down**: Navigate page by page
- **g**: Go to top of history
- **G**: Go to bottom of history
- **/** or **?**: Search forward/backward
- **Space**: Start selection
- **Enter**: Copy selection (in vi mode)
- **q**: Exit copy mode

### Window Management (Advanced)

If you need multiple windows within a tmux session:

| Keybinding | Action |
|------------|--------|
| **Ctrl+B** then **c** | Create new window |
| **Ctrl+B** then **n** | Next window |
| **Ctrl+B** then **p** | Previous window |
| **Ctrl+B** then **&** | Kill window |
| **Ctrl+B** then **,** | Rename window |

**Note**: Maestro typically manages sessions at the application level, so you rarely need tmux's window management features.

---

## Multi-Agent Coordination Features

The tmux migration enables better coordination between multiple Claude agents working in parallel.

### Session Isolation

Each Claude agent gets its own tmux session, providing:
- **Independent environments**: Agents can't accidentally interfere with each other's terminals
- **Separate scrollback buffers**: Each agent's output is isolated
- **Individual persistence**: Agents can detach and reattach independently

### Improved Status Tracking

Tmux sessions integrate better with Maestro's session management:
- Real-time session status (attached/detached)
- Automatic reconnection on app restart
- Better handling of agent crashes or disconnections

### Parallel Execution

Multiple agents can work simultaneously without conflicts:
```bash
# Spawn multiple worker agents
maestro session spawn --task task-1 --role worker
maestro session spawn --task task-2 --role worker
maestro session spawn --task task-3 --role worker
```

Each gets its own isolated tmux session.

---

## Troubleshooting

### Session Not Persisting

**Problem**: Terminal session closes when you close the app.

**Solution**: Make sure you checked "Persistent terminal (tmux)" when creating the session.

### Can't Scroll in Terminal

**Problem**: Mouse wheel doesn't scroll.

**Solution**: Tmux mouse mode is enabled by default. If scrolling doesn't work:
1. Enter copy mode: **Ctrl+B** then **[**
2. Use Page Up/Down or arrow keys to scroll
3. Press **q** to exit copy mode

### Session Already Exists Error

**Problem**: `tmux: sessions should be nested with care` or similar error.

**Solution**: You're trying to create a tmux session inside another tmux session. Exit the outer session first.

### Tmux Not Found

**Problem**: `tmux: command not found`

**Solution**:
- On macOS: Maestro bundles tmux, so this shouldn't happen. If it does, reinstall Maestro.
- On Linux: Install tmux via your package manager:
  ```bash
  # Ubuntu/Debian
  sudo apt install tmux

  # Fedora
  sudo dnf install tmux

  # Arch
  sudo pacman -S tmux
  ```

### Old Zellij Sessions Still Running

**Problem**: Old zellij sessions consuming resources.

**Solution**: Kill them manually:
```bash
# Find zellij processes
ps aux | grep zellij

# Kill them
pkill -9 zellij
```

---

## Configuration

### Custom Tmux Config

If you want to customize tmux behavior, create or edit `~/.tmux.conf`:

```bash
# Example customizations

# Change prefix from Ctrl+B to Ctrl+A
unbind C-b
set-option -g prefix C-a
bind-key C-a send-prefix

# Increase scrollback buffer
set-option -g history-limit 10000

# Use vi keybindings in copy mode
setw -g mode-keys vi

# Customize status bar
set -g status-bg black
set -g status-fg white
```

**Note**: Maestro sets some options automatically (like mouse mode). Your custom config will override these, so test carefully.

### Disabling Mouse Mode

If you prefer keyboard-only navigation:

```bash
# In ~/.tmux.conf
set-option -g mouse off
```

Then restart any persistent sessions.

---

## Advanced: Multi-Session Workflows

### Orchestrator + Workers Pattern

A common pattern is one orchestrator agent spawning multiple worker agents:

```bash
# Terminal 1: Start orchestrator
maestro session spawn --role orchestrator --task planning-task --persistent

# The orchestrator will spawn workers as needed
# Each worker gets its own tmux session automatically
```

### Viewing All Sessions

**From the CLI:**
```bash
maestro session list --json | jq '.sessions[] | select(.persistent == true)'
```

**From tmux:**
```bash
tmux list-sessions
```

### Attaching to a Specific Session

```bash
# List sessions
maestro session list

# Attach to a specific session by ID
maestro session attach <session-id>
```

---

## Differences from Zellij

| Feature | Zellij | Tmux |
|---------|--------|------|
| Scroll mode activation | Ctrl+S | Ctrl+B then [ |
| Scroll mode exit | Esc | q |
| Mouse support | Required scroll mode | Always active |
| Built-in layouts | Yes | Yes (but Maestro doesn't use them) |
| Plugin system | Yes | Yes (but Maestro doesn't use it) |
| Default keybindings | Modern, intuitive | Traditional Unix |
| Shift+Enter handling | Special handling | Standard terminal input |

---

## Known Limitations

1. **No automatic session recovery**: If tmux crashes, sessions may be lost. This is rare but possible.
2. **No cross-platform session sharing**: Tmux sessions are local to the machine.
3. **Limited nested session support**: Running tmux inside tmux is discouraged.

---

## Getting Help

- **Tmux documentation**: `man tmux` or visit [https://github.com/tmux/tmux/wiki](https://github.com/tmux/tmux/wiki)
- **Maestro issues**: [https://github.com/anthropics/agent-maestro/issues](https://github.com/anthropics/agent-maestro/issues)
- **Quick help**: Run `maestro --help` or use the command palette in the desktop app (Cmd+K)

---

## Migration Checklist

- [ ] Note down existing zellij session names and directories
- [ ] Close all existing persistent sessions
- [ ] Kill any leftover zellij processes (`pkill zellij`)
- [ ] Update Maestro to the latest version
- [ ] Recreate persistent sessions with the new tmux backend
- [ ] Test SSH connections with persistence
- [ ] Verify multi-agent workflows work as expected
- [ ] (Optional) Customize tmux config if needed

---

**Last updated**: 2026-02-09
