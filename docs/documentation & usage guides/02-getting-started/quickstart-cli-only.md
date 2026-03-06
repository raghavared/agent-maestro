# Quickstart: CLI Only

> **Time:** 5 minutes | **No desktop app, no Rust, no Tauri** — just your terminal

This guide is for developers who live in the terminal. You'll install the server + CLI only, then create a project, task, and spawn Claude — all from the command line.

---

## Step 1: Install (Server + CLI Only)

No Rust toolchain needed. The `--server-only` flag skips the Tauri desktop app entirely:

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
./install.sh --server-only
```

```
info  Checking for bun...
done  bun found: 1.1.38
info  Checking for Node.js and npm...
done  Node.js found: v22.14.0

info  This will build Maestro from source and install:
info    CLI + Server  → ~/.maestro/bin

  Continue? [Y/n]

info  [1/4] Installing dependencies...
done  Dependencies installed

info  [2/4] Building server...
done  Server built

info  [3/4] Building CLI...
done  CLI built

info  [4/4] Installing CLI and server to ~/.maestro/bin...
done  Installed binaries to ~/.maestro/bin

Maestro has been built and installed!

  CLI         ~/.maestro/bin/maestro
  Server      ~/.maestro/bin/maestro-server
```

The installer adds `~/.maestro/bin` to your PATH. Reload your shell or run:

```bash
export PATH="$HOME/.maestro/bin:$PATH"
```

Verify:

```bash
maestro --version
```

---

## Step 2: Start the Server

In one terminal tab (or use a background process):

```bash
maestro-server
```

```
2026-03-05T10:00:01.123Z [INFO] Initializing container...
2026-03-05T10:00:01.190Z [INFO] Container initialized
```

> **Tip:** To run it in the background: `maestro-server &` or use a terminal multiplexer like tmux.

Quick health check:

```bash
curl -s http://localhost:2357/health | python3 -m json.tool
```

```json
{
    "status": "ok",
    "timestamp": 1709640001000,
    "uptime": 2.105
}
```

---

## Step 3: Create a Project

Navigate to your codebase and register it as a Maestro project:

```bash
cd ~/projects/my-api
maestro project create my-api -d .
```

```
done  Project created
ID     proj_1709640120000_a1b2c3d4
Name   my-api
Dir    /Users/you/projects/my-api
```

Set the project as your default so you don't need `--project` on every command:

```bash
export MAESTRO_PROJECT_ID=proj_1709640120000_a1b2c3d4
```

> **Tip:** Add this to your `.bashrc` / `.zshrc` for persistence.

List your projects anytime:

```bash
maestro project list
```

```
ID                              Name      Working Dir
proj_1709640120000_a1b2c3d4     my-api    /Users/you/projects/my-api
```

---

## Step 4: Create Tasks

Create a task for Claude to work on:

```bash
maestro task create "Implement JWT authentication" \
  --desc "Add POST /api/auth/login and /api/auth/register endpoints with JWT token generation, bcrypt password hashing, and middleware for protected routes" \
  --priority high
```

```
done  Task created
ID      task_1709640180000_e5f6g7h8
Title   Implement JWT authentication
```

Create subtasks if the work is large:

```bash
maestro task create "Write auth middleware" --parent task_1709640180000_e5f6g7h8
maestro task create "Add login endpoint" --parent task_1709640180000_e5f6g7h8
maestro task create "Add registration endpoint" --parent task_1709640180000_e5f6g7h8
```

View your task tree:

```bash
maestro task tree
```

```
Project Task Tree (proj_1709640120000_a1b2c3d4):

⏳ [task_1709640180000_e5f6g7h8] Implement JWT authentication (todo) HIGH
   ⏳ [task_1709640200000_m3n4o5p6] Write auth middleware (todo)
   ⏳ [task_1709640210000_q7r8s9t0] Add login endpoint (todo)
   ⏳ [task_1709640220000_u1v2w3x4] Add registration endpoint (todo)
```

---

## Step 5: Spawn a Claude Session

Assign Claude to your task:

```bash
maestro session spawn --task task_1709640180000_e5f6g7h8
```

```
Spawning maestro-worker session: Worker: Implement JWT authentication
   Task: Implement JWT authentication
   Priority: high
   Agent Tool: claude-code
   Model: sonnet
   Session ID: sess_1709640240000_i9j0k1l2

   Waiting for Agent Maestro to open terminal window...
```

**Without the desktop app**, you have two options to interact with the session:

### Option A: Watch the session output

```bash
maestro session watch sess_1709640240000_i9j0k1l2
```

This streams Claude's activity in real-time — files read, code written, tests run.

### Option B: Check session logs after the fact

```bash
maestro session logs sess_1709640240000_i9j0k1l2
```

---

## Step 6: Monitor Progress

Check what's happening across all sessions:

```bash
maestro session list
```

```
ID                              Status    Task
sess_1709640240000_i9j0k1l2     working   Implement JWT authentication
```

Get detailed session info:

```bash
maestro session info sess_1709640240000_i9j0k1l2
```

Check task status:

```bash
maestro task list
```

```
⏳ [task_1709640180000_e5f6g7h8] Implement JWT authentication (in_progress) HIGH
   ⏳ [task_1709640200000_m3n4o5p6] Write auth middleware (todo)
   ⏳ [task_1709640210000_q7r8s9t0] Add login endpoint (todo)
   ⏳ [task_1709640220000_u1v2w3x4] Add registration endpoint (todo)
```

---

## Step 7: Send Claude a Message Mid-Session

Need to redirect Claude or give additional context? Prompt the session directly:

```bash
maestro session prompt sess_1709640240000_i9j0k1l2 \
  --message "Use Prisma instead of raw SQL for the database layer"
```

Claude receives your message and adjusts its approach.

---

## Step 8: Check the Result

When Claude finishes, the task status updates automatically:

```bash
maestro task get task_1709640180000_e5f6g7h8
```

```
ID          task_1709640180000_e5f6g7h8
Title       Implement JWT authentication
Status      ✅ completed
Priority    high
Started     2026-03-05 10:04:00
Completed   2026-03-05 10:11:45
```

Review what Claude did:

```bash
git diff    # See code changes
git log     # See commits Claude made
```

---

## Everything You Can Do from the CLI

Here's a quick reference of the most useful commands:

| Command | What it does |
|---------|-------------|
| `maestro project create <name> -d <dir>` | Register a project |
| `maestro task create "<title>"` | Create a task |
| `maestro task tree` | View task hierarchy |
| `maestro session spawn --task <id>` | Start Claude on a task |
| `maestro session watch <id>` | Stream live output |
| `maestro session logs <id>` | View session logs |
| `maestro session prompt <id> --message "..."` | Send Claude a message |
| `maestro session list` | List all sessions |
| `maestro task list` | List all tasks with status |
| `maestro status` | Project overview |

All commands support `--json` for machine-readable output, making it easy to script:

```bash
# Get task ID programmatically
TASK_ID=$(maestro task create "Fix bug #123" --json | jq -r '.id')

# Spawn and capture session ID
SESSION_ID=$(maestro session spawn --task $TASK_ID --json | jq -r '.sessionId')

# Watch it work
maestro session watch $SESSION_ID
```

---

## Advanced: Use a Specific Model or Team Member

```bash
# Use Opus for complex tasks
maestro session spawn --task <id> --model opus

# Use a pre-configured team member
maestro team-member create "Alice" --role "Backend Engineer" --model opus --avatar "👩‍💻"
maestro session spawn --task <id> --team-member-id <member-id>
```

---

## What's Next?

- **[Install Guide](install-guide.md)** — Docker, manual install, and other methods
- **Team members** — Create persistent AI identities with roles, models, and memory
- **Coordinators** — Let Maestro decompose tasks and run parallel sessions
- **Skills** — Extend Claude with project-specific instructions
