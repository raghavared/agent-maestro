# Maestro App Context

## Overview

Maestro is a task and session orchestration system for managing AI agents. It consists of three interconnected components that work together to provide both visual and command-line interfaces for task management, agent orchestration, and terminal session control.

## Components

### 1. Maestro Server (`/maestro-server/`)

**Purpose:** Backend server that manages task and session orchestration.

**Key Responsibilities:**
- Task and session CRUD operations via REST API
- Real-time event broadcasting via WebSocket
- Project and workspace management
- File-based storage in `~/.maestro/data`
- Manifest generation for agent sessions

**Technologies:** Express.js, WebSocket (ws), TypeScript

**API:**
- REST endpoints: `/api/tasks`, `/api/sessions`, `/api/projects`
- WebSocket: `ws://localhost:3000` for real-time updates
- Events: `task:created/updated`, `session:spawn`, `session:updated`, etc.

### 2. Maestro CLI (`/maestro-cli/`)

**Purpose:** Command-line interface for terminal-based task and session management.

**Key Responsibilities:**
- Task management: create, list, update, delete tasks
- Session control: create and manage agent sessions
- Agent orchestration: start workers and orchestrators
- Offline-first with local storage fallback
- Manifest generation for agent contexts

**Technologies:** Node.js, Commander.js, TypeScript

**Example Commands:**
```bash
maestro task list              # List all tasks
maestro task create "title"    # Create new task
maestro session create         # Create session
maestro manifest generate      # Generate session manifest
```

### 3. Maestro UI (`/maestro-ui/`)

**Purpose:** Native desktop application for visual task management and terminal sessions.

**Key Responsibilities:**
- Visual task management interface
- Embedded terminal sessions (xterm.js)
- Multi-project workspace organization
- SSH support with port forwarding
- File explorer with Monaco editor
- Session recording and replay
- Command palette and quick prompts

**Technologies:** Tauri 2, React 18, Zustand, xterm.js

**Store Architecture:**
- `useMaestroStore`: Task/session sync with server
- `useSessionStore`: Terminal session management
- `useProjectStore`: Project context
- `useUIStore`: Layout and UI state

## Architecture

```
┌─────────────────┐
│   Maestro UI    │  Desktop app
│  (Tauri+React)  │
└────────┬────────┘
         │
         ├─── REST API ──┐
         ├── WebSocket ──┤
         │               │
         v               v
┌──────────────────────────┐
│    Maestro Server        │
│  (Express + WebSocket)   │
└──────────┬───────────────┘
           │
           ├─── REST API ──┐
           │               │
┌──────────▼────────┐  ┌───────┐
│   Maestro CLI     │  │ Agents│
│   (Terminal)      │  │       │
└───────────────────┘  └───────┘
```

## Data Model

### Tasks
- Work units with hierarchical support (`parentId` for subtasks)
- Many-to-many with sessions (one task can have multiple sessions)
- Properties: title, description, status, priority, metadata

### Sessions
- Agent execution contexts
- Many-to-many with tasks (one session can handle multiple tasks)
- Tracks: status, environment variables, events, terminal output

### Projects
- Container for tasks and sessions
- Stored in `~/.maestro/data/projects/{projectId}/`

## Communication Flow

### Creating a Task
1. User creates task in UI or CLI
2. Component calls REST API: `POST /api/tasks`
3. Server stores task, emits `task:created` event
4. WebSocket broadcasts to all connected clients
5. All clients update their state

### Spawning a Session
1. User clicks "Spawn" in UI for a task
2. UI calls `POST /api/sessions` with taskIds
3. Server generates manifest via CLI
4. Server emits `session:spawn` event
5. UI receives spawn event, creates terminal window
6. Agent worker starts and connects to session

### Real-Time Updates
- All state changes emit WebSocket events
- UI and CLI subscribe to relevant events
- State synchronizes automatically across all clients

## Key Patterns

### Phase IV-A Architecture
- Many-to-many relationships between tasks and sessions
- Tasks store `sessionIds[]`, sessions store `taskIds[]`
- Hierarchical tasks via `parentId` field

### Event-Driven Architecture
- Server broadcasts all state changes
- Clients listen and update stores reactively
- Dedicated spawn event: `session:spawn`

### Type System
- Shared types between server and UI
- `SpawnSource`: `'ui' | 'session'`
- `AgentStatus`: `'working' | 'blocked' | 'needs_input' | 'completed' | 'failed'`
- `MaestroSessionStatus`: includes `'spawning' | 'stopped'`

### Offline Support (CLI)
- Local storage fallback when server unavailable
- Syncs with server when connection restored
- Graceful degradation with `safeNotify()` pattern

## Integration Points

1. **Shared Types:** Type definitions synchronized between server and UI
2. **WebSocket Events:** Real-time state propagation
3. **REST API:** Traditional CRUD operations
4. **File-based IPC:** CLI generates manifests, agents read them
5. **Manifest Generation:** Server delegates to CLI for session context

## Storage

- **Location:** `~/.maestro/data/`
- **Structure:** Project-organized JSON files
- **Entities:** Projects, tasks, sessions, skills
- **Format:** Human-readable JSON for easy debugging

## Use Cases

- **Task Management:** Create, organize, and track work items
- **Agent Orchestration:** Spawn and manage AI agent sessions
- **Terminal Sessions:** Run commands across multiple terminals
- **Remote Development:** SSH into servers with port forwarding
- **Session Recording:** Record and replay terminal sessions
- **Collaborative Work:** Share tasks and sessions across team
