# Maestro - Multi-Agent Coordination Platform for Claude

## What is Maestro?

Maestro is an intelligent orchestration platform that lets you run and coordinate multiple Claude AI agents working together on your projects. If you've ever had multiple Claude sessions running across different terminals with no way to track what each one is doing, Maestro solves that problem.

Think of Maestro as a **project manager for your Claude agents**—you define the work, and Maestro coordinates who does what, tracks progress in real-time, and keeps everything organized.

## The Problem Maestro Solves

Working on complex software projects often requires:
- Multiple parallel tasks happening simultaneously
- Breaking large features into smaller, manageable pieces
- Coordinating work across different parts of a codebase
- Tracking what's been done and what's still pending
- Managing specialized workflows (testing, code review, debugging, etc.)

Doing this with separate, isolated Claude sessions quickly becomes chaotic. You lose track of which Claude is working on what, what's been completed, and how everything fits together.

## How Maestro Works

Maestro provides three integrated components that work together:

### 1. **Desktop Application** (Maestro UI)
A complete workspace built with Tauri, featuring:
- **Persistent Terminals** - Real terminal sessions powered by tmux that keep running even when you close the app
- **File Explorer** - Browse local and remote (SSH) files
- **Code Editor** - Monaco-based editor with syntax highlighting
- **Task Management Panel** - Visual task tracking with filtering and status updates
- **Session Recording** - Record and replay Claude sessions
- **Command Palette** - Keyboard-driven access to all features
- **Agent Detection** - Automatically recognizes when Claude is running in a terminal

### 2. **Command-Line Interface** (Maestro CLI)
Full terminal control for everything:
- Create and manage tasks
- Spawn and monitor Claude sessions
- Report progress, blockers, and completion
- Queue management
- Project organization
- Session templates and manifests

### 3. **Server** (Maestro Server)
The coordination brain:
- Stores all tasks, sessions, and projects as plain JSON files (no database setup needed)
- WebSocket support for real-time updates
- REST API for all operations
- Multi-client synchronization

All three components stay synchronized—changes made in the desktop app appear instantly in the CLI and vice versa.

## Core Concepts

### Tasks and Hierarchies
Tasks are units of work organized in a tree structure:
- **Root tasks** represent main objectives (e.g., "Implement Authentication")
- **Subtasks** break down work into manageable pieces
- Tasks have status (pending, in-progress, completed, blocked), priority, and dependencies
- Full hierarchy visualization with `maestro task tree`

### Two-Tier Agent Orchestration

#### Orchestrators (Planners)
- Analyze high-level requirements
- Break down complex requests into structured execution plans
- Create dependency graphs of subtasks
- Spawn and coordinate worker sessions

#### Workers (Executors)
- Execute specific tasks or groups of related subtasks
- Write code, run tests, fix bugs
- Report progress back to the system
- Can work in parallel without interference

### Work Strategies

**Simple Mode:**
- Claude sees all assigned tasks at once
- Works through them with full context
- Best for related tasks that need holistic understanding

**Queue Mode:**
- Tasks lined up one at a time
- Claude picks up next task with `maestro queue start`
- Focused, serial execution
- Great for independent tasks or avoiding context overload

### Skilled Agents
Maestro supports specialized agent configurations for different workflows:
- **Bug Hunter** - Finds root causes of errors using logs and tests
- **Code Reviewer** - Reviews changes against best practices
- **QA Engineer** - Writes comprehensive tests
- **Frontend Expert** - Specialized for UI/UX work
- **Database Architect** - Schema design and migrations
- And more...

Skills are markdown files that inject specific prompts, tools, and context for different types of work.

## Key Features

### Persistent Terminals with tmux
- Terminal sessions survive app restarts
- Detach and reattach to running sessions
- Each agent gets an isolated tmux session
- Parallel work without interference
- Automatic reconnection and status tracking

### Session Management
- Spawn Claude sessions from UI or CLI
- Environment variables inject context (task IDs, session IDs, role)
- Session templates and manifests for reproducible setups
- Timeline tracking of all actions
- Session recording and playback

### Real-Time Progress Tracking
Agents report status as they work:
```bash
maestro report progress "Finished login route, starting tests"
maestro report blocked "Need database credentials"
maestro report complete "Auth system is done"
```

All updates appear instantly across all clients.

### Multiple Projects
Organize work across different codebases:
- Separate task lists per project
- Isolated session contexts
- Project-specific configurations

### Dual Environment Support
Run production and staging simultaneously:
- **Production** - Stable build on port 3001, installed app
- **Staging** - Development with hot-reload on port 3002
- Separate data directories (`~/.maestro` vs `~/.maestro-staging`)
- No conflicts, no crosstalk

### Simple Data Storage
Everything stored as human-readable JSON:
```
~/.maestro/
├── data/
│   ├── projects/     # One JSON file per project
│   ├── tasks/        # Organized by project
│   ├── sessions/     # Session metadata
│   └── queues/       # Queue state
```
No database to configure. Just files you can read and edit.

## Use Cases

### 1. Complex Feature Development
Break a large feature into phases:
1. Orchestrator analyzes requirements and creates execution plan
2. Worker sessions spawned for each phase (backend, frontend, tests, docs)
3. All work happens in parallel
4. Progress tracked in real-time
5. Results aggregated when complete

### 2. Multi-Agent Workflows
Create software development pipelines:
1. **Feature Implementer** writes the code
2. **QA Engineer** writes comprehensive tests
3. **Code Reviewer** checks for issues
4. **Documentation Writer** updates docs

Each agent is specialized and focused on its domain.

### 3. Long-Running Operations
- Start Claude working on a task
- Close the desktop app or disconnect
- Terminal keeps running via tmux
- Reattach later to check progress
- Perfect for tasks that take hours (migrations, large refactors, etc.)

### 4. Distributed Work Across Projects
- Multiple projects, each with its own task tree
- Spawn sessions per project
- Context switching without losing track
- See what every Claude is doing across all projects

### 5. Specialized Debugging
- Spawn a "Bug Hunter" skilled agent
- Automatically loads debugging tools and prompts
- Focuses on reproduction, log analysis, and root cause identification
- Reports findings back to main task

## Getting Started

### Prerequisites
- Node.js v18 or newer
- Rust (for desktop app)
- Tauri prerequisites (for desktop app)

### Quick Start
```bash
# Install dependencies
npm install

# Start everything
npm run dev:all

# Set up CLI
cd maestro-cli
npm run build && npm link
maestro --help
```

### Create Your First Task
```bash
# Create a project
maestro project create "My App"

# Create a task
maestro task create --title "Build authentication"

# Spawn a Claude session to work on it
maestro session spawn --task <task-id>
```

### Use the Desktop App
Launch the app and you'll see:
- Terminals where Claude sessions run
- Task panel for visual task management
- File explorer and code editor
- Real-time progress updates

## Why Choose Maestro?

### For Individual Developers
- **Stay organized** - Never lose track of what multiple Claudes are doing
- **Break down complexity** - Turn overwhelming projects into manageable tasks
- **Leverage specialization** - Use skilled agents for different types of work
- **Boost productivity** - Parallel work instead of serial

### For Teams
- **Visibility** - See what agents are working on in real-time
- **Reproducibility** - Session manifests and templates ensure consistent setups
- **Coordination** - Task dependencies prevent conflicting work
- **Knowledge capture** - Session recordings preserve decision-making process

### For Complex Projects
- **Hierarchical planning** - Tree structure naturally models complex work
- **Parallel execution** - Multiple agents working simultaneously
- **Context management** - Each agent has exactly what it needs, no more
- **Failure recovery** - Blocked tasks don't block everything else

## Technical Details

### Architecture
- **Desktop App**: Tauri (Rust + React + TypeScript)
- **Server**: Express + WebSocket (TypeScript)
- **CLI**: Node.js (TypeScript)
- **Terminal**: xterm.js + tmux
- **Editor**: Monaco Editor
- **Data**: Plain JSON files

### Data Flow
```
Desktop App ──┐
              ├──► Maestro Server ──► JSON Files on Disk
CLI ──────────┘
```

Both UI and CLI connect to the server. Server persists everything as JSON. Real-time updates via WebSocket.

### Extensibility
- **Skills** - Markdown files in `.skills/` directory
- **Hooks** - Webhooks for session events
- **Manifests** - JSON configs for reproducible session setups
- **Templates** - Reusable session configurations

## License

Maestro is open source under AGPL-3.0-only. See [LICENSE](./LICENSE) for details.

## Links

- **Repository**: [GitHub](https://github.com/subhangR/agent-maestro)
- **Documentation**: See [docs/](./docs/) directory
- **Quick Start**: [docs/QUICK-START.md](./docs/QUICK-START.md)
- **Testing Guide**: [docs/testing/TESTING-GUIDE.md](./docs/testing/TESTING-GUIDE.md)

## Acknowledgments

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [xterm.js](https://xtermjs.org/), [Monaco Editor](https://microsoft.github.io/monaco-editor/), and [tmux](https://github.com/tmux/tmux).

Designed for [Claude](https://anthropic.com/) users who want to unlock the full potential of multi-agent coordination.

---

**Ready to coordinate your Claude agents?** Start with `npm install && npm run dev:all` and see the power of organized, multi-agent development.
