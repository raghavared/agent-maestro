# Terminal Sessions

**Persistent terminals that survive app restarts, SSH into remote machines, and manage it all from the UI.**

---

## Terminal Basics

Every session in Maestro runs inside an xterm.js terminal emulator. The terminal supports:
- Full ANSI color and formatting
- Scrollback buffer (scroll up to see history)
- Copy/paste (`Cmd+C` / `Cmd+V` on macOS)
- Mouse support for compatible CLI apps
- Unicode and emoji rendering

[screenshot placeholder: Terminal session showing a Claude Code agent running with colored output]

---

## Regular Terminals

Click **+ New Session** in the sidebar's sessions section to open a new terminal. This starts a standard shell session in the current project's working directory.

Regular terminals are ephemeral — they're created when you open them and destroyed when you close them or quit the app.

---

## Persistent Terminals (tmux)

Maestro uses **tmux** for persistent terminal sessions. When a Maestro agent session is spawned, it runs inside a tmux session that survives app restarts.

### Why tmux?

- **Persistence** — If you close the app or it crashes, agent sessions keep running in the background
- **Reattach** — When you reopen the app, persistent sessions are automatically reconnected
- **Reliability** — Long-running agent tasks won't be interrupted by UI restarts

### Viewing Persistent Sessions

Click **Persistent Sessions** in the sidebar's session controls to open the persistent sessions modal.

[screenshot placeholder: Persistent Sessions modal showing a list of tmux-backed sessions with attach and kill buttons]

The modal shows:
- Session name and label
- Whether the session is currently open in the UI (shown as an "open" chip)
- **Attach** button — Reconnect to the session's terminal
- **Kill** button — Terminate the tmux session permanently

### tmux Keybindings

When inside a tmux-backed terminal, standard tmux prefix keys work:

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` then `D` | Detach from the session (it keeps running in background) |
| `Ctrl+B` then `[` | Enter scroll mode (use arrow keys to scroll, `q` to exit) |
| `Ctrl+B` then `c` | Create a new tmux window |
| `Ctrl+B` then `n` | Switch to next tmux window |
| `Ctrl+B` then `p` | Switch to previous tmux window |

> **Note:** These are tmux shortcuts, not Maestro shortcuts. They only apply inside persistent terminal sessions.

---

## SSH Support

Maestro can open terminal sessions on remote machines over SSH.

### Connecting

Click **SSH Manager** in the sidebar's session controls to open the SSH connection dialog.

[screenshot placeholder: SSH Manager modal showing host picker, port forwarding options, and connect button]

The SSH Manager provides:

| Feature | Description |
|---------|-------------|
| **Host picker** | Reads your `~/.ssh/config` and lists all configured hosts. Click to select, or type a custom host. |
| **Host details** | Shows resolved hostname, user, and port for the selected host |
| **Port forwarding** | Add local, remote, or dynamic (SOCKS) port forwards |
| **Forward-only mode** | Connect just for forwarding without opening a shell |
| **Exit on forward failure** | Automatically disconnect if a port forward fails |
| **Command preview** | Shows the exact `ssh` command that will be executed |
| **Copy command** | Copy the SSH command to your clipboard |

### After Connecting

Once connected, a new terminal session appears in the sidebar with an SSH indicator. The terminal is a live remote shell on the target machine.

When connected to an SSH host:
- The **File Explorer** switches to browsing the remote filesystem
- The **Code Editor** opens remote files
- New agent sessions spawned while connected can work on the remote machine

### Managing SSH Connections

Each SSH session appears as a regular session in the sidebar. Close it like any other session. If you configured port forwards, they're active as long as the session is open.

---

## Manage Terminals

Click **Manage Terminals** in the sidebar to open the terminal management modal.

[screenshot placeholder: Manage Terminals modal showing sessions with reorder arrows]

This lets you:
- View all terminals in the current project
- **Reorder** them using up/down arrow buttons
- See which terminals have exited or are being closed

Changes are saved automatically.

---

## Terminal Tips

- **Switch sessions quickly** — Use `Cmd+E` (next) and `Cmd+R` (previous) to cycle through sessions
- **Close active session** — `Cmd+W` closes the currently selected session
- **New session** — `Cmd+N` or `Cmd+D` opens a new terminal
- **Drag tasks into terminals** — Drag a task card from the Maestro panel onto a terminal to add it as context for the running agent

> **Next:** [File Explorer & Code Editor](./file-explorer-editor.md) — Browse files and edit code.
