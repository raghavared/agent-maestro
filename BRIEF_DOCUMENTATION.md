# Maestro: Brief Documentation

## Overview

**Maestro** is a multi-agent task orchestration system designed to coordinate multiple Claude AI sessions across projects. It provides a unified interface to:

- Break work into organized tasks and subtasks
- Spawn and manage multiple Claude sessions concurrently
- Track progress in real-time as agents work
- Store all data as simple JSON files (no database required)

Think of Maestro as a **project manager for AI agents** — you define the work, and Maestro coordinates who does what.

---

## Architecture Overview

Maestro consists of three interconnected components:

```
┌─────────────┐         ┌──────────┐
│ Desktop App │         │   CLI    │
│ (maestro-ui)│         │ (maestro)│
└──────┬──────┘         └────┬─────┘
       │                      │
       └──────────┬───────────┘
                  │
           ┌──────▼──────┐
           │   Server    │
           │  (Express   │
           │  + WebSocket)
           └──────┬──────┘
                  │
          JSON files on disk
         (~/.maestro/data/)
```

### Component Structure

| Component | Purpose | Tech Stack |
|-----------|---------|-----------|
| **maestro-server** | Coordinates tasks, sessions, and projects. WebSocket/REST API. | Express.js, TypeScript, WebSocket |
| **maestro-ui** | Visual desktop application for workspaces. | Tauri, React, Monaco Editor, xterm.js |
| **maestro-cli** | Command-line tool for task management and reporting. | Node.js, TypeScript, Commander.js |
| **maestro-mcp** | MCP server integration for Claude integration. | TypeScript |
| **maestro-integration** | Test suite for integration testing. | TypeScript, Jest |

---

## Key Concepts

### Tasks
- Units of work that can be hierarchical (parent/child relationships)
- Have status (pending, in-progress, completed), priority, title, and description
- Support dependencies between tasks
- Stored as JSON files in `~/.maestro/data/tasks/`

### Sessions
- Represent Claude AI instances working on tasks
- Can be in **worker** or **orchestrator** role
- Support two strategies:
  - **Simple**: Claude sees all assigned tasks at once
  - **Queue**: Claude processes tasks one at a time from a queue
- Maintain timeline of progress reports
- Stored in `~/.maestro/data/sessions/`

### Projects
- Containers that group related tasks and sessions
- Allow isolation of different workspaces
- Stored in `~/.maestro/data/projects/`

### Roles & Strategies

**Roles:**
- **Worker**: Executes assigned tasks, reports progress
- **Orchestrator**: Plans work, creates subtasks, spawns worker sessions

**Strategies:**
- **Simple**: All tasks visible; Claude prioritizes autonomously
- **Queue**: Tasks processed sequentially from a queue

---

## Core Features

### 1. Task Management
```bash
maestro task create --title "Build feature X"
maestro task create --title "Unit tests" --parent <parent-id>
maestro task tree                    # View task hierarchy
maestro task list                    # List all tasks
```

### 2. Session Management
```bash
maestro session spawn --task <id>    # Spawn a Claude on a task
maestro session list                 # See all active sessions
maestro session info                 # Current session details
```

### 3. Progress Reporting
```bash
maestro report progress "Finished component"
maestro report blocked "Need database credentials"
maestro report complete "Feature fully implemented"
maestro report error "Build failed"
```

### 4. Queue Mode (Optional)
```bash
maestro queue start                  # Pick up next task
maestro queue complete               # Task done, get next one
maestro queue skip                   # Skip this task
```

### 5. Desktop Application
- **Terminals**: tmux-backed persistent terminal sessions
- **Task Board**: Visual task management interface
- **File Explorer**: Browse local and remote (SSH) files
- **Code Editor**: Monaco Editor with syntax highlighting
- **Session View**: Real-time view of what agents are doing
- **Command Palette**: Keyboard-accessible commands

---

## How It Works: Step by Step

1. **Define Work**: Create a task hierarchy in Maestro
   ```bash
   maestro task create --title "Build authentication system"
   maestro task create --title "JWT endpoint" --parent <id>
   maestro task create --title "Login form" --parent <id>
   ```

2. **Spawn Agents**: Start Claude sessions assigned to specific tasks
   ```bash
   maestro session spawn --task <task-id> --role worker
   ```

3. **Agents Report Progress**: Each Claude reports as it works
   ```bash
   maestro report progress "Finished JWT validation"
   maestro report complete "Auth system complete"
   ```

4. **Track Everything**: View status in the desktop app or CLI
   ```bash
   maestro status
   maestro session list
   ```

---

## Data Storage

Everything is stored as plain JSON files in your home directory:

```
~/.maestro/
├── data/
│   ├── projects/      # One JSON file per project
│   ├── tasks/         # Tasks organized by project
│   ├── sessions/      # Session history and state
│   ├── queues/        # Queue state for queue-mode sessions
│   └── templates/     # Session configuration templates
└── sessions/
    └── {session-id}/
        └── manifest.json  # Session config
```

**No database required.** You can open and edit these files directly in any text editor.

---

## Running Maestro

### Quick Start
```bash
npm install
npm run dev:all        # Start desktop app + server
```

### Development vs Production
- **Staging** (port 3002): Hot-reload development environment at `~/.maestro-staging/`
- **Prod** (port 3001): Stable production build at `~/.maestro/`

```bash
npm run staging         # Dev with hot-reload
npm run prod          # Production mode
```

### CLI Setup
```bash
cd maestro-cli
npm run build && npm link
maestro --help        # Now available globally
```

---

## Technology Stack

- **Frontend**: React 18, Tauri 2, Monaco Editor, xterm.js
- **Backend**: Express.js, WebSocket, TypeScript
- **Terminal**: tmux (persistent session management)
- **Build**: Vite, TypeScript, npm workspaces
- **Desktop**: Tauri (cross-platform: macOS, Linux, Windows)

---

## Common Workflows

### Workflow 1: Parallel Development
Assign frontend and backend work to separate Claude instances in queue mode:

```bash
maestro task create --title "Backend API"
maestro task create --title "Frontend UI"
maestro session spawn --task <backend-id> --strategy queue
maestro session spawn --task <frontend-id> --strategy queue
```

### Workflow 2: Planning + Execution
Use an orchestrator to plan, workers to execute:

```bash
# Orchestrator session (role: orchestrator)
maestro task create --title "Build chat app"
maestro task create --title "WebSocket server" --parent <id>
maestro task create --title "Message storage" --parent <id>

# Orchestrator spawns workers
maestro session spawn --task <websocket-id> --role worker
maestro session spawn --task <storage-id> --role worker
```

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MAESTRO_API_URL` | Server URL | `http://localhost:3000` |
| `MAESTRO_PROJECT_ID` | Default project | (none) |
| `MAESTRO_SESSION_ID` | Current session | (auto-assigned) |
| `MAESTRO_TASK_IDS` | Assigned tasks (comma-separated) | (none) |
| `MAESTRO_ROLE` | `worker` or `orchestrator` | `worker` |
| `MAESTRO_STRATEGY` | `simple` or `queue` | `simple` |
| `MAESTRO_MANIFEST_PATH` | Session config file path | (none) |

---

## Project Structure

```
agent-maestro/
├── maestro-ui/          # Desktop app (Tauri + React)
├── maestro-server/      # Express server with WebSocket
├── maestro-cli/         # Command-line interface
├── maestro-mcp/         # MCP server integration
├── maestro-integration/ # Integration tests
├── docs/                # Architecture and technical docs
├── scripts/             # Build and deployment scripts
└── package.json         # Monorepo configuration
```

---

## License

AGPL-3.0-only

---

## Summary

Maestro solves the **multi-agent coordination problem**. Instead of managing multiple Claude terminals manually, you define tasks once and let Maestro orchestrate them. Every agent reports back, every task is tracked, and everything is stored locally in simple JSON files.

**For developers:** Use the CLI for task management and progress reporting.
**For visual thinkers:** Use the desktop app to see everything at a glance.
**For automation:** Use the REST API or MCP integration to programmatically manage tasks.

Built by Anthropic for Claude, extensible for any AI workflow.
