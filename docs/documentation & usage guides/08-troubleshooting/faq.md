# Frequently Asked Questions

---

### Can I use Maestro with models other than Claude?

Yes. Maestro supports multiple agent tools via the `agentTool` field on team members:

- **`claude-code`** — Claude Code (default)
- **`codex`** — OpenAI Codex CLI
- **`gemini`** — Google Gemini CLI

Set it when creating a team member:
```bash
maestro team-member create "My Codex Worker" --agent-tool codex
```

---

### Does Maestro work on Linux?

The **server** and **CLI** work on Linux with no issues — they're Node.js applications.

The **desktop app** (Tauri) requires a Linux build. You'll need to build it from source:
```bash
# Install Tauri Linux prerequisites first
# See: https://tauri.app/start/prerequisites/
./install.sh
```

Alternatively, use the server + CLI without the desktop app (see below).

---

### Where is my data stored?

All data is stored as plain JSON files at:

```
~/.maestro/
├── config                    # Server URL, environment config
├── bin/                      # CLI + server binaries
├── data/
│   ├── projects/<id>.json    # Project definitions
│   ├── tasks/<id>.json       # Task records
│   ├── sessions/<id>.json    # Session records
│   ├── task-lists/<id>.json  # Task list ordering
│   ├── team-members/<projectId>.json
│   ├── teams/<projectId>.json
│   └── orderings/            # UI ordering data
└── sessions/<id>/
    └── manifest.json         # Session manifests
```

No database is required. You can back up everything by copying `~/.maestro/`.

---

### Can I run multiple projects at once?

Yes. Each project is independent. You can have multiple projects with their own tasks, sessions, and teams running simultaneously.

For cross-project management, use **master sessions**:
```bash
# Mark a project as a master project
maestro project set-master <project-id>

# From a master session, view all projects
maestro master projects
maestro master tasks
maestro master sessions
```

---

### Is Maestro free?

Yes. Maestro is open source under the **AGPL-3.0 license**. The software itself is completely free.

Note: You still need API access to the underlying AI models (Claude, Codex, Gemini) which have their own pricing. Maestro orchestrates these tools but doesn't include model access.

---

### Can multiple people use the same Maestro server?

Yes. The server is a standard HTTP/WebSocket server. Multiple users can connect to it simultaneously — from the desktop app, CLI, or custom integrations.

There's no built-in authentication, so anyone who can reach the server's port can use it. For shared environments, consider:
- Running behind a reverse proxy with auth
- Restricting access via firewall rules
- Binding to `127.0.0.1` instead of `0.0.0.0` for local-only access

---

### How do I reset everything?

```bash
# Back up first!
cp -r ~/.maestro/data ~/.maestro/data-backup

# Then delete all data
rm -rf ~/.maestro/data/

# Restart the server — it will recreate empty directories
maestro-server
```

This removes all projects, tasks, sessions, teams, and team members. The server binary, CLI, and config are preserved.

---

### Can I use Maestro without the desktop app?

Yes. The desktop app is optional. You can run Maestro with just:

1. **Server:** Start with `maestro-server` or `bun run dev:server`
2. **CLI:** Use `maestro` commands for all operations

Everything the UI can do, the CLI can do:
```bash
maestro project create "My Project"
maestro task create "Build feature X" --desc "..."
maestro session spawn --task <task-id> --mode worker
maestro session watch <session-id>
maestro session logs <session-id> --follow
```

---

### What's the difference between simple and queue execution mode?

**Simple mode** (`execute-simple`): All assigned tasks are given to the agent at once. The agent sees the full list and decides how to work through them. Best for small, related tasks where the agent benefits from seeing the big picture.

**Queue mode** (`execute-tree`): Tasks are processed in dependency order, one at a time. The agent completes a task, reports it done, and receives the next one. Best for large task trees where order matters and you want progress tracking per task.

For coordinators, there are also batching (`coordinate-batching`) and DAG (`coordinate-dag`) modes for parallel execution strategies.

---

### How many sessions can run at once?

There is no hard limit enforced by Maestro. The practical limit depends on your machine's resources:

- Each session runs a separate agent process (Claude Code, Codex, etc.)
- Each agent process consumes CPU, memory, and network bandwidth
- Claude Code sessions typically use 200-500MB RAM each

**Rules of thumb:**
- 8GB RAM machine → ~5-10 concurrent sessions comfortably
- 16GB RAM machine → ~10-20 concurrent sessions
- 32GB+ RAM → 20+ sessions

Monitor with:
```bash
# Check active sessions
maestro session list --status working

# Check system resources
top -l 1 | head -10
```

---

### How do I update Maestro?

```bash
# Pull latest code
cd /path/to/agent-maestro
git pull

# Rebuild and install
./install.sh
```

Your data in `~/.maestro/data/` is preserved across updates.

---

### Can agents access files outside the project directory?

Yes, depending on the agent tool's permission mode:

- **`bypassPermissions`** — full filesystem access, no prompts
- **`acceptEdits`** — auto-accepts file edits within the working directory
- **`readOnly`** — can read files but not modify them
- **`interactive`** — prompts for every action (requires human in the loop)

Set permission mode on the team member:
```bash
maestro team-member create "Safe Worker" --permission-mode acceptEdits
```

---

### How do I debug what prompt the agent receives?

Use the `debug-prompt` command:

```bash
# Full rendered prompt
maestro debug-prompt

# Just the system prompt
maestro debug-prompt --system-only

# Just the task XML
maestro debug-prompt --task-only

# Raw manifest JSON
maestro debug-prompt --manifest

# Full unprocessed output
maestro debug-prompt --raw
```

This is the most useful debugging tool in Maestro — use it whenever an agent isn't behaving as expected.

---

### What happens if the server crashes mid-session?

Active sessions will lose their WebSocket connection but the agent processes continue running independently. When you restart the server:

1. Session data on disk is preserved (JSON files)
2. Running agents continue working (they use the CLI, not WebSocket directly)
3. The UI will reconnect and show the last known state
4. Agents can still report via CLI commands which retry on connection failure (configurable via `MAESTRO_RETRIES`)

To check what was running:
```bash
maestro session list --status working
```
