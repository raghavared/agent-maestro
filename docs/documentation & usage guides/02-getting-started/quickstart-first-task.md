# Quickstart: Your First Task

> **Time:** 5 minutes | **Goal:** Go from zero to watching Claude work on your code

This is the golden path. By step 6, Claude will be writing code in your project.

---

## Prerequisites

- macOS (Apple Silicon or Intel)
- Node.js 18+ installed
- An Anthropic API key (set as `ANTHROPIC_API_KEY` in your environment)

---

## Step 1: Install Maestro

Clone the repo and run the installer:

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
./install.sh
```

You'll see each build step complete:

```
info  Checking for bun...
done  bun found: 1.1.38
info  Checking for Node.js and npm...
done  Node.js found: v22.14.0

info  This will build Maestro from source and install:
info    CLI + Server  → ~/.maestro/bin
info    Desktop app   → /Applications/Maestro.app

  Continue? [Y/n]

info  [1/6] Installing dependencies...
done  Dependencies installed

info  [2/6] Building server...
done  Server built

info  [3/6] Building CLI...
done  CLI built

info  [4/6] Building UI and desktop app (Tauri)...
done  Desktop app built

info  [5/6] Installing CLI and server to ~/.maestro/bin...
done  Installed binaries to ~/.maestro/bin

info  [6/6] Installing desktop app to /Applications...
done  Installed Maestro.app to /Applications

Maestro has been built and installed!

  CLI         ~/.maestro/bin/maestro
  Server      ~/.maestro/bin/maestro-server
  Desktop     /Applications/Maestro.app
```

> **Don't need the desktop app?** Use `./install.sh --server-only` instead — skips Tauri/Rust entirely. See the [Install Guide](install-guide.md) for all methods.

Verify the CLI is available:

```bash
maestro --help
```

---

## Step 2: Start the Server

```bash
maestro-server
```

The server starts on port 2357:

```
2026-03-05T10:00:01.123Z [INFO] Initializing container...
2026-03-05T10:00:01.180Z [INFO] Running team member task migration...
2026-03-05T10:00:01.185Z [INFO] Migration complete: no old team member tasks found
2026-03-05T10:00:01.190Z [INFO] Container initialized
```

Confirm it's running:

```bash
curl http://localhost:2357/health
```

```json
{
  "status": "ok",
  "timestamp": 1709640001000,
  "uptime": 3.241
}
```

> **Tip:** Keep this terminal open. The server must be running for all Maestro operations.

---

## Step 3: Open the Desktop App

Launch Maestro from your Applications folder or Spotlight:

```
/Applications/Maestro.app
```

The desktop app connects to the server automatically. You'll see the Maestro dashboard — empty for now.

> **Prefer the terminal?** Skip to the [CLI-only Quickstart](quickstart-cli-only.md). Everything you can do in the UI, you can do from the CLI.

---

## Step 4: Create a Project

A project links Maestro to a directory on your machine. Open a new terminal in your project folder:

```bash
cd ~/projects/my-app
maestro project create my-app -d .
```

```
done  Project created
ID     proj_1709640120000_a1b2c3d4
Name   my-app
Dir    /Users/you/projects/my-app
```

Save that project ID — you'll need it for the next steps. Set it as a default so you don't have to pass `--project` every time:

```bash
export MAESTRO_PROJECT_ID=proj_1709640120000_a1b2c3d4
```

---

## Step 5: Create a Task

Tasks describe what you want Claude to build. Create one:

```bash
maestro task create "Add a login page with email and password"
```

```
done  Task created
ID      task_1709640180000_e5f6g7h8
Title   Add a login page with email and password
```

You can add more detail with `--desc`:

```bash
maestro task create "Add a login page" --desc "Create a React login form with email/password fields, form validation, and a submit button that calls POST /api/auth/login" --priority high
```

---

## Step 6: Spawn a Claude Session

This is where the magic happens. Tell Maestro to assign Claude to your task:

```bash
maestro session spawn --task task_1709640180000_e5f6g7h8
```

```
Spawning maestro-worker session: Worker: Add a login page with email and p...
   Task: Add a login page with email and password
   Priority: medium
   Agent Tool: claude-code
   Model: sonnet
   Session ID: sess_1709640240000_i9j0k1l2

   Waiting for Agent Maestro to open terminal window...
```

A new terminal window opens in the desktop app. Claude is now working on your task. You'll see the Maestro init banner followed by Claude Code starting up:

```
╭────────────────────────────────────────────────────────────────╮
│   ⚡ MAESTRO  —  Worker Session                                 │
├────────────────────────────────────────────────────────────────┤
│   Session  sess_1709640240000_i9j0k1l2                          │
│   Model claude-sonnet-4-5  │  Perms accept-edits  │  Tool Claude Code │
╰────────────────────────────────────────────────────────────────╯

╭────────────────────────────────────────────────────────────────╮
│   📋 Task                                                       │
├────────────────────────────────────────────────────────────────┤
│     PRI        ST  Title                                        │
│   ─────────────────────────────────────────────────────────    │
│    MEDIUM     ○  Add a login page with email and password       │
╰────────────────────────────────────────────────────────────────╯

  ▶  Spawning Claude Code…
```

Claude reads your codebase, plans the implementation, and starts writing code.

---

## Step 7: Watch Claude Work

From another terminal, you can watch the session in real-time:

```bash
maestro session watch sess_1709640240000_i9j0k1l2
```

This streams Claude's progress — files it's reading, code it's writing, and commands it's running. You'll see output like:

```
[sess_1709640240000_i9j0k1l2] Reading src/App.tsx...
[sess_1709640240000_i9j0k1l2] Creating src/components/LoginPage.tsx...
[sess_1709640240000_i9j0k1l2] Updating src/App.tsx with login route...
[sess_1709640240000_i9j0k1l2] Running npm test...
```

You can also check session status:

```bash
maestro session info sess_1709640240000_i9j0k1l2
```

---

## Step 8: See the Result

When Claude finishes, the task is marked complete:

```bash
maestro task get task_1709640180000_e5f6g7h8
```

```
ID          task_1709640180000_e5f6g7h8
Title       Add a login page with email and password
Status      ✅ completed
Priority    medium
Started     2026-03-05 10:04:00
Completed   2026-03-05 10:07:23
```

Check your project — Claude has created the files, and you can see exactly what changed:

```bash
git diff
```

In the desktop app, the task timeline shows every action Claude took: files read, files written, commands executed, and the final completion report.

---

## What's Next?

- **[Quickstart: CLI Only](quickstart-cli-only.md)** — Do everything from the terminal, no desktop app needed
- **[Quickstart: Desktop App](quickstart-desktop-app.md)** — Visual walkthrough with screenshots
- **Create a team member** — Give Claude a persistent identity with skills and memory:
  ```bash
  maestro team-member create "Alice" --role "Senior Developer" --avatar "👩‍💻" --model opus
  maestro session spawn --task <task-id> --team-member-id <member-id>
  ```
- **Use a coordinator** — Let Maestro decompose large tasks and run multiple Claude sessions in parallel
- **Install skills** — Extend Claude's capabilities with project-specific instructions
