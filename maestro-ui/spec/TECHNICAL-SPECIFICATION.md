# Maestro UI - Technical Specification

**Version:** 0.3.0
**Last Updated:** February 7, 2026
**Status:** Living Document

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Directory Structure](#directory-structure)
5. [Data Models & Type System](#data-models--type-system)
6. [State Management](#state-management)
7. [Component Architecture](#component-architecture)
8. [Services & API Integration](#services--api-integration)
9. [Real-time Communication](#real-time-communication)
10. [Terminal Integration](#terminal-integration)
11. [File System & Code Editor](#file-system--code-editor)
12. [Maestro Integration](#maestro-integration)
13. [Build & Development](#build--development)
14. [Key Features](#key-features)
15. [Data Flow Patterns](#data-flow-patterns)
16. [Performance Considerations](#performance-considerations)

---

## Executive Summary

**Maestro UI** is a native desktop application built with Tauri v2 that provides a sophisticated workspace for managing AI coding agents, terminal sessions, and project workflows. It serves as the frontend interface for the Maestro task orchestration system, enabling users to create, manage, and monitor AI agent sessions working on software development tasks.

### Core Purpose

- **Task Management**: Create, organize, and track development tasks with hierarchical structure
- **Session Orchestration**: Spawn and manage AI agent sessions (Claude, Codex, Gemini) for task execution
- **Real-time Monitoring**: Live WebSocket updates for task progress and session status
- **Terminal Integration**: Embedded PTY terminals with xterm.js for direct interaction
- **Project Organization**: Multi-project workspace with environment management
- **Code Editing**: Integrated Monaco editor for file viewing and editing

### Key Characteristics

- **Native Desktop Application**: Built with Tauri (Rust + Web Technologies)
- **React 18**: Modern React with hooks and functional components
- **Type-Safe**: Comprehensive TypeScript coverage
- **Real-time**: WebSocket-based live updates
- **Persistent State**: Zustand stores with localStorage persistence
- **Terminal-First**: PTY-backed terminals as first-class citizens

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri Window (macOS)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React Application                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Zustand    │  │ React Context│  │   Hooks      │   │  │
│  │  │   Stores     │  │ (Maestro)    │  │   Layer      │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │         │                  │                  │           │  │
│  │  ┌──────▼──────────────────▼──────────────────▼───────┐  │  │
│  │  │              Component Tree                         │  │  │
│  │  │  ┌─────────┐  ┌─────────┐  ┌──────────────────┐   │  │  │
│  │  │  │Sidebar  │  │Workspace│  │  Maestro Panel   │   │  │  │
│  │  │  │Sessions │  │Terminals│  │  (Task Manager)  │   │  │  │
│  │  │  └─────────┘  └─────────┘  └──────────────────┘   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │      Maestro Server (Node.js)       │
        │  ┌───────────┐    ┌──────────────┐ │
        │  │ REST API  │    │  WebSocket   │ │
        │  └───────────┘    └──────────────┘ │
        │  ┌───────────────────────────────┐ │
        │  │   SQLite Database             │ │
        │  │   (Tasks, Sessions, Projects) │ │
        │  └───────────────────────────────┘ │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     Maestro CLI (TypeScript)        │
        │  ┌──────────────────────────────┐  │
        │  │  Worker Initialization       │  │
        │  │  Manifest Generation         │  │
        │  │  Skill Loading               │  │
        │  │  Agent Spawning (Claude)     │  │
        │  └──────────────────────────────┘  │
        └─────────────────────────────────────┘
```

### Architectural Principles

1. **Separation of Concerns**: UI handles presentation, Maestro Server handles orchestration, CLI handles execution
2. **CLI-First Architecture**: The UI spawns terminals with environment variables; CLI handles all agent configuration
3. **Real-time Sync**: WebSocket ensures UI stays in sync with server state
4. **Immutable State**: Zustand stores use immutable updates for predictability
5. **Component Composition**: Small, focused components with clear responsibilities
6. **Type Safety**: Strict TypeScript with shared type definitions

---

## Technology Stack

### Frontend Core

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.6.2 | Type safety |
| **Vite** | 5.4.8 | Build tool & dev server |
| **Zustand** | 5.0.11 | State management |

### Native Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tauri** | 2.9.6 | Native app framework |
| **@tauri-apps/api** | 2.x | Tauri JavaScript APIs |

### UI Components

| Technology | Version | Purpose |
|------------|---------|---------|
| **Monaco Editor** | 0.55.1 | Code editor |
| **@monaco-editor/react** | 4.7.0 | React wrapper for Monaco |
| **xterm.js** | 5.0.0 | Terminal emulator |
| **xterm-addon-fit** | 0.8.0 | Terminal auto-sizing |
| **react-mentions** | 4.4.10 | @-mention inputs |

### Build Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **@vitejs/plugin-react** | 4.3.1 | Vite React plugin |
| **concurrently** | 9.2.1 | Run multiple commands |

### Backend Integration

- **REST API**: HTTP client via fetch API
- **WebSocket**: Native WebSocket for real-time updates
- **Server URL**: `http://localhost:3000` (REST), `ws://localhost:3000` (WebSocket)

---

## Directory Structure

```
maestro-ui/
├── src/
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # React entry point
│   ├── SessionTerminal.tsx        # Terminal component (xterm.js)
│   ├── CommandPalette.tsx         # Command palette (Cmd+K)
│   ├── SlidePanel.tsx             # Slide-out panel component
│   │
│   ├── app/                       # Core application types & utilities
│   │   ├── types/
│   │   │   ├── maestro.ts         # Maestro domain types (canonical)
│   │   │   ├── session.ts         # Terminal session types
│   │   │   ├── workspace.ts       # Workspace view types
│   │   │   ├── app.ts             # App-level types
│   │   │   ├── storage.ts         # Storage types
│   │   │   ├── recording.ts       # Recording types
│   │   │   └── index.ts
│   │   ├── constants/
│   │   │   ├── defaults.ts        # Default values
│   │   │   ├── storage.ts         # Storage keys
│   │   │   ├── themes.ts          # Theme definitions
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── project.ts         # Project utilities
│   │       ├── path.ts            # Path utilities
│   │       ├── ssh.ts             # SSH helpers
│   │       ├── string.ts          # String utilities
│   │       ├── github.ts          # GitHub integration
│   │       ├── workspace.ts       # Workspace utilities
│   │       ├── storage.ts         # Storage utilities
│   │       ├── env.ts             # Environment utilities
│   │       └── semver.ts          # Version comparison
│   │
│   ├── components/                # React components
│   │   ├── maestro/               # Maestro-specific components
│   │   │   ├── MaestroPanel.tsx            # Main Maestro panel
│   │   │   ├── CreateTaskModal.tsx         # Task creation modal
│   │   │   ├── TaskListItem.tsx            # Task list item
│   │   │   ├── TaskDetailModal.tsx         # Task detail view
│   │   │   ├── TaskFilters.tsx             # Task filtering
│   │   │   ├── TaskStatusControl.tsx       # Task status UI
│   │   │   ├── TaskTimeline.tsx            # Task timeline
│   │   │   ├── SessionDetailsSection.tsx   # Session details
│   │   │   ├── SessionTimeline.tsx         # Session timeline
│   │   │   ├── QueueSessionItem.tsx        # Queue session item
│   │   │   ├── QueueStatusDisplay.tsx      # Queue status
│   │   │   ├── SimpleSessionItem.tsx       # Simple session view
│   │   │   ├── TreeSessionItem.tsx         # Tree session view
│   │   │   ├── SessionInTaskView.tsx       # Session in task context
│   │   │   ├── AgentSelector.tsx           # Agent selection
│   │   │   ├── StrategySelector.tsx        # Strategy selection
│   │   │   ├── StrategyBadge.tsx           # Strategy badge
│   │   │   ├── TemplateEditor.tsx          # Template editor
│   │   │   ├── TemplateList.tsx            # Template list
│   │   │   ├── WorkOnModal.tsx             # Work on task modal
│   │   │   ├── AddSubtaskInput.tsx         # Add subtask input
│   │   │   ├── TimelineEvent.tsx           # Timeline event
│   │   │   ├── MaestroSessionContent.tsx   # Session content
│   │   │   └── ExecutionBar.tsx            # Execution bar
│   │   │
│   │   ├── app/                   # App-level components
│   │   │   ├── AppWorkspace.tsx            # Main workspace
│   │   │   ├── AppModals.tsx               # Modal manager
│   │   │   ├── AppTopbar.tsx               # Top bar
│   │   │   ├── Sidebar.tsx                 # Sidebar
│   │   │   ├── RightPanel.tsx              # Right panel
│   │   │   ├── ResizeHandle.tsx            # Resize handle
│   │   │   └── Topbar.tsx                  # Topbar component
│   │   │
│   │   ├── modals/                # Modal components
│   │   │   └── (17 modal components)
│   │   │
│   │   ├── AgentShortcutsModal.tsx        # Agent shortcuts config
│   │   ├── AppRightPanel.tsx              # Right panel container
│   │   ├── AppSlidePanel.tsx              # Slide panel container
│   │   ├── CodeEditorPanel.tsx            # Monaco editor panel
│   │   ├── FileExplorerPanel.tsx          # File explorer
│   │   ├── Icon.tsx                       # Icon component
│   │   ├── ProjectTabBar.tsx              # Project tabs
│   │   ├── ProjectsSection.tsx            # Projects section
│   │   ├── QuickPromptsSection.tsx        # Quick prompts
│   │   ├── SessionsSection.tsx            # Sessions section
│   │   ├── ThemeSwitcher.tsx              # Theme switcher
│   │   └── ZoomSetting.tsx                # Zoom setting
│   │
│   ├── contexts/                  # React contexts
│   │   └── MaestroContext.tsx              # Maestro data context
│   │
│   ├── hooks/                     # Custom React hooks (42 hooks)
│   │   ├── useActive.ts
│   │   ├── useActiveSession.ts
│   │   ├── useAgentShortcuts.ts
│   │   ├── useAppInit.ts
│   │   ├── useAppLayout.ts
│   │   ├── useAppLayoutResizing.ts
│   │   ├── useAppUpdate.ts
│   │   ├── useAssetManager.ts
│   │   ├── useEnvironmentManager.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useMaestroSessions.ts
│   │   ├── useMaestroWebSocket.ts
│   │   ├── useNewSessionForm.ts
│   │   ├── useNotifications.ts
│   │   ├── useOptimistic.ts
│   │   ├── usePathPicker.ts
│   │   ├── usePersistentSessions.ts
│   │   ├── useProjectManager.ts
│   │   ├── usePromptManager.ts
│   │   ├── usePromptSender.ts
│   │   ├── useQuickLaunch.ts
│   │   ├── useRecentSessionManager.ts
│   │   ├── useRecordingManager.ts
│   │   ├── useReplayExecution.ts
│   │   ├── useSecureStorageManager.ts
│   │   ├── useSessionActions.ts
│   │   ├── useSessionLifecycle.ts
│   │   ├── useSessionOrdering.ts
│   │   ├── useSessionTasks.ts
│   │   ├── useSshManager.ts
│   │   ├── useSshRootResolution.ts
│   │   ├── useStatePersistence.ts
│   │   ├── useSubtaskProgress.ts
│   │   ├── useTaskBreadcrumb.ts
│   │   ├── useTaskSessionCount.ts
│   │   ├── useTaskSessions.ts
│   │   ├── useTaskTree.ts
│   │   ├── useTasks.ts
│   │   ├── useTerminalSession.ts
│   │   ├── useTrayManager.ts
│   │   ├── useWorkSpaceView.ts
│   │   └── useWorkspaceResizeEffect.ts
│   │
│   ├── stores/                    # Zustand state stores
│   │   ├── initApp.ts                     # App initialization
│   │   ├── persistence.ts                 # Persistence logic
│   │   ├── useAgentShortcutStore.ts      # Agent shortcuts
│   │   ├── useAssetStore.ts              # Assets
│   │   ├── useEnvironmentStore.ts        # Environments
│   │   ├── useMaestroStore.ts            # Maestro state
│   │   ├── usePathPickerStore.ts         # Path picker
│   │   ├── usePersistentSessionStore.ts  # Persistent sessions
│   │   ├── useProjectStore.ts            # Projects
│   │   ├── usePromptStore.ts             # Prompts
│   │   ├── useRecordingStore.ts          # Recordings
│   │   ├── useSecureStorageStore.ts      # Secure storage
│   │   ├── useSessionStore.ts            # Sessions (main store)
│   │   ├── useSshStore.ts                # SSH
│   │   ├── useThemeStore.ts              # Theme
│   │   ├── useUIStore.ts                 # UI state
│   │   ├── useWorkspaceStore.ts          # Workspace
│   │   └── useZoomStore.ts               # Zoom level
│   │
│   ├── services/                  # Service layer
│   │   ├── maestroService.ts             # Maestro operations
│   │   ├── sessionService.ts             # Session operations
│   │   ├── sshService.ts                 # SSH operations
│   │   └── terminalService.ts            # Terminal operations
│   │
│   ├── utils/                     # Utility functions
│   │   ├── MaestroClient.ts              # API client
│   │   ├── claudeCliBuilder.ts           # Claude CLI builder
│   │   ├── domUtils.ts                   # DOM utilities
│   │   ├── maestroHelpers.ts             # Maestro helpers
│   │   ├── workSpaceStorage.ts           # Workspace storage
│   │   ├── formatters.ts                 # Formatters
│   │   └── promptTemplate.ts             # Prompt templates
│   │
│   ├── assets/                    # Static assets
│   ├── monaco/                    # Monaco configuration
│   ├── styles.css                 # Main styles (269KB)
│   ├── styles-sessions.css        # Session styles
│   ├── styles-mentions.css        # Mentions styles
│   ├── pathDisplay.ts             # Path display utilities
│   ├── processEffects.ts          # Process effects (agent detection)
│   └── global.d.ts                # Global type declarations
│
├── src-tauri/                     # Tauri Rust backend
│   ├── src/                       # Rust source
│   └── bin/                       # Bundled binaries (nu, zellij)
│
├── public/                        # Public assets
├── dist/                          # Build output
│
├── package.json                   # NPM dependencies
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite config
├── index.html                     # HTML entry
│
├── MAESTRO-UI-SPEC.md            # UI specification (large)
├── README.md                      # Documentation
└── REFACTORING_GUIDE.md          # Refactoring guide
```

---

## Data Models & Type System

### Core Domain Types

Located in `src/app/types/maestro.ts` - these are canonical types matching the server.

#### Task Types

```typescript
// Task lifecycle status
type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

// Task priority
type TaskPriority = 'low' | 'medium' | 'high';

// Task session status (agent-specific)
type TaskSessionStatus =
  | 'queued'      // Waiting in queue
  | 'working'     // Agent actively working
  | 'needs_input' // Waiting for user input
  | 'blocked'     // Blocked by dependency
  | 'completed'   // Successfully finished
  | 'failed'      // Failed with error
  | 'skipped';    // Skipped by agent

// Main Task entity
interface MaestroTask {
  // Core Identity
  id: string;
  projectId: string;
  parentId: string | null;

  // Content
  title: string;
  description: string;
  initialPrompt: string;

  // Status & Priority
  status: TaskStatus;
  priority: TaskPriority;
  sessionStatus?: TaskSessionStatus;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;

  // Relationships
  sessionIds: string[];        // Sessions working on this task
  skillIds: string[];          // Skills applied to task
  agentIds: string[];          // Agents assigned
  dependencies: string[];      // Task dependencies

  // Model configuration
  model?: ModelType;           // 'sonnet' | 'opus' | 'haiku'

  // UI/Populated Fields (Optional)
  subtasks?: MaestroTask[];    // Child tasks
  sessionCount?: number;       // Computed: number of sessions
  lastUpdate?: string | null;  // Computed: last update time
}
```

#### Session Types

```typescript
// Session lifecycle status
type MaestroSessionStatus =
  | 'spawning'    // Being created
  | 'idle'        // Ready but not working
  | 'working'     // Actively processing
  | 'completed'   // Finished successfully
  | 'failed'      // Failed with error
  | 'stopped';    // Manually stopped

// Worker strategy
type WorkerStrategy = 'simple' | 'queue';

// Spawn source (where session was created)
type SpawnSource = 'ui' | 'session';

// Session entity
interface MaestroSession {
  id: string;
  projectId: string;
  taskIds: string[];           // Tasks this session is working on
  name: string;
  agentId?: string;            // Agent identifier (e.g., 'claude')
  env: Record<string, string>; // Environment variables
  strategy?: WorkerStrategy;   // Worker strategy
  status: MaestroSessionStatus;
  startedAt: number;
  lastActivity: number;
  completedAt: number | null;
  hostname: string;
  platform: string;
  events: MaestroSessionEvent[];
  timeline: SessionTimelineEvent[];  // Activity timeline
  role?: 'orchestrator' | 'worker';
  spawnSource?: SpawnSource;
  spawnedBy?: string;          // Parent session ID
  manifestPath?: string;       // Path to session manifest
  model?: ModelType;
}
```

#### Timeline Events

```typescript
type SessionTimelineEventType =
  | 'session_started'    // Session spawned
  | 'session_stopped'    // Session stopped
  | 'task_started'       // Started working on a task
  | 'task_completed'     // Finished a task
  | 'task_failed'        // Failed a task
  | 'task_skipped'       // Skipped a task
  | 'task_blocked'       // Blocked on a task
  | 'needs_input'        // Waiting for user input
  | 'progress'           // General progress update
  | 'error'              // Error occurred
  | 'milestone';         // Milestone reached

interface SessionTimelineEvent {
  id: string;
  type: SessionTimelineEventType;
  timestamp: number;
  message?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}
```

#### Project Types

```typescript
interface MaestroProject {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  basePath?: string | null;
  environmentId: string | null;
  assetsEnabled?: boolean;
}
```

### Terminal Session Types

Located in `src/app/types/session.ts` - UI-specific terminal types.

```typescript
// Terminal session (UI representation)
type TerminalSession = {
  // Core identity
  id: string;                   // Terminal ID
  name: string;
  projectId: string;
  persistId: string;            // Persistence ID
  persistent: boolean;          // Should survive restarts

  // Command & execution
  command: string;              // Running command
  launchCommand: string | null; // Original launch command
  restoreCommand?: string | null;
  cwd: string | null;           // Current working directory

  // Timestamps
  createdAt: number;

  // SSH (if remote)
  sshTarget: string | null;     // SSH host
  sshRootDir: string | null;    // Remote root directory

  // Recording
  lastRecordingId?: string | null;
  recordingActive?: boolean;

  // Process detection
  effectId?: string | null;     // Detected process effect
  processTag?: string | null;   // Process tag
  agentWorking?: boolean;       // Is agent actively working

  // Exit state
  exited?: boolean;
  closing?: boolean;
  exitCode?: number | null;

  // Maestro integration
  maestroSessionId?: string | null;  // Linked Maestro session
};
```

### Workspace Types

Located in `src/app/types/workspace.ts`.

```typescript
type WorkspaceView = {
  projectId: string;

  // File explorer state
  fileExplorerOpen: boolean;
  fileExplorerRootDir: string | null;
  fileExplorerPersistedState: FileExplorerPersistedState | null;

  // Code editor state
  codeEditorOpen: boolean;
  codeEditorRootDir: string | null;
  openFileRequest: CodeEditorOpenFileRequest | null;
  codeEditorActiveFilePath: string | null;
  codeEditorPersistedState: CodeEditorPersistedState | null;
  codeEditorFsEvent: CodeEditorFsEvent | null;

  // Dimensions
  editorWidth: number;
  treeWidth: number;
};
```

### API Payload Types

```typescript
// Task creation
interface CreateTaskPayload {
  projectId: string;
  parentId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  initialPrompt?: string;
  skillIds?: string[];
  model?: ModelType;
}

// Task update
interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  sessionStatus?: TaskSessionStatus;
  priority?: TaskPriority;
  initialPrompt?: string;
  sessionIds?: string[];
  skillIds?: string[];
  agentIds?: string[];
  model?: ModelType;
  completedAt?: number | null;
}

// Session spawning
interface SpawnSessionPayload {
  projectId: string;
  taskIds: string[];
  role?: 'worker' | 'orchestrator';
  strategy?: WorkerStrategy;
  spawnSource?: SpawnSource;
  sessionId?: string;           // Parent session ID if spawned from session
  sessionName?: string;
  skills?: string[];
  spawnedBy?: string;           // Deprecated
  context?: Record<string, any>;
  model?: ModelType;
}

interface SpawnSessionResponse {
  success: boolean;
  sessionId: string;
  manifestPath: string;
  session: MaestroSession;
}
```

---

## State Management

The application uses **Zustand** for state management with multiple specialized stores. Each store handles a specific domain with clear responsibilities.

### Store Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application State                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │
│  │  Session   │  │  Maestro   │  │   Project      │    │
│  │  Store     │  │  Store     │  │   Store        │    │
│  └─────┬──────┘  └─────┬──────┘  └────────┬───────┘    │
│        │                │                   │            │
│  ┌─────▼────────────────▼───────────────────▼────────┐  │
│  │           localStorage Persistence                 │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Core Stores

#### 1. **useSessionStore** (Main Store)

Location: `src/stores/useSessionStore.ts` (44KB, ~1400 lines)

**Purpose**: Manages all terminal sessions, their lifecycle, and interactions.

**State:**
```typescript
interface SessionStore {
  // Session data
  sessions: TerminalSession[];
  activeId: string | null;

  // UI state
  newOpen: boolean;
  newName: string;
  newCommand: string;
  newCwd: string | null;
  newPersistent: boolean;

  // Actions
  setActiveId(id: string): void;
  createSession(params: CreateSessionParams): Promise<void>;
  onClose(id: string): Promise<void>;
  quickStart(params: QuickStartParams): Promise<void>;
  sendPromptToActive(prompt: string, mode: 'send' | 'paste'): Promise<void>;
  onCwdChange(id: string, cwd: string): void;
  onCommandChange(id: string, command: string): void;
  reorderSessions(newOrder: string[]): void;
  handleSpawnTerminalSession(config: SpawnConfig): Promise<void>;
  // ... many more actions
}
```

**Key Responsibilities:**
- Terminal session lifecycle (create, close, restore)
- PTY management via Tauri backend
- Session persistence
- Command execution and prompt sending
- Process detection (agent activity)
- Session recording
- Working directory tracking

#### 2. **useMaestroStore**

Location: `src/stores/useMaestroStore.ts`

**Purpose**: Manages Maestro tasks and sessions with WebSocket synchronization.

**State:**
```typescript
interface MaestroState {
  // Data caches
  tasks: Map<string, MaestroTask>;
  sessions: Map<string, MaestroSession>;

  // Loading & error state
  loading: Set<string>;
  errors: Map<string, string>;

  // WebSocket state
  wsConnected: boolean;
  activeProjectIdRef: string | null;

  // Fetch methods
  fetchTasks(projectId: string): Promise<void>;
  fetchTask(taskId: string): Promise<void>;
  fetchSessions(taskId?: string): Promise<void>;
  fetchSession(sessionId: string): Promise<void>;

  // Mutation methods
  createTask(data: CreateTaskPayload): Promise<MaestroTask>;
  updateTask(taskId: string, updates: UpdateTaskPayload): Promise<MaestroTask>;
  deleteTask(taskId: string): Promise<void>;
  createMaestroSession(data: CreateSessionPayload): Promise<MaestroSession>;
  updateMaestroSession(sessionId: string, updates: UpdateSessionPayload): Promise<MaestroSession>;
  deleteMaestroSession(sessionId: string): Promise<void>;
  addTaskToSession(sessionId: string, taskId: string): Promise<void>;
  removeTaskFromSession(sessionId: string, taskId: string): Promise<void>;

  // Cache management
  clearCache(): void;
  hardRefresh(projectId: string): Promise<void>;

  // WebSocket lifecycle
  initWebSocket(): void;
  destroyWebSocket(): void;
}
```

**Key Features:**
- Global WebSocket singleton with automatic reconnection
- Exponential backoff for reconnection (up to 30s)
- Optimistic updates via WebSocket events
- Normalized data storage (Maps for O(1) lookups)
- Loading and error tracking per resource

#### 3. **useProjectStore**

Location: `src/stores/useProjectStore.ts`

**Purpose**: Manages projects and project selection.

**State:**
```typescript
interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  projectOpen: boolean;
  projectName: string;
  projectBasePath: string;
  projectEnvironmentId: string | null;
  projectAssetsEnabled: boolean;

  selectProject(id: string): void;
  openNewProject(): void;
  createProject(): Promise<void>;
  updateProject(id: string, updates: ProjectUpdates): Promise<void>;
  deleteActiveProject(): Promise<void>;
  setProjectOpen(open: boolean): void;
  // ... more actions
}
```

#### 4. **useWorkspaceStore**

Location: `src/stores/useWorkspaceStore.ts`

**Purpose**: Manages workspace layouts per project/session.

**State:**
```typescript
interface WorkspaceStore {
  workspaceViews: Record<string, WorkspaceView>;
  workspaceResizeMode: 'tree' | 'editor' | null;

  updateWorkspaceViewForKey(
    key: string,
    projectId: string,
    updater: (prev: WorkspaceView) => WorkspaceView
  ): void;

  closeCodeEditor(): void;
  toggleFileExplorer(): void;
  handleSelectWorkspaceFile(path: string): void;
  handleRenameWorkspacePath(oldPath: string, newPath: string): void;
  handleDeleteWorkspacePath(path: string): void;
  beginWorkspaceResize(mode: 'tree' | 'editor'): (e: MouseEvent) => void;
}
```

**Key Workspace Keys:**
- Format: `{projectId}:{sessionId}` or `{projectId}:default`
- Allows different layouts per project and session
- Persists editor tabs, file explorer state, and dimensions

#### 5. **useUIStore**

Location: `src/stores/useUIStore.ts`

**Purpose**: Global UI state (sidebar, panels, modals).

**State:**
```typescript
interface UIStore {
  // Layout dimensions
  sidebarWidth: number;
  rightPanelWidth: number;

  // Panel visibility
  slidePanelOpen: boolean;
  slidePanelTab: 'prompts' | 'recordings' | 'assets' | 'environments';

  // Modal state
  activeModal: string | null;
  modalData: any;

  // Methods
  setSidebarWidth(width: number): void;
  setRightPanelWidth(width: number): void;
  setSlidePanelOpen(open: boolean): void;
  setSlidePanelTab(tab: string): void;
  openModal(modal: string, data?: any): void;
  closeModal(): void;
}
```

#### 6. **usePromptStore**

Location: `src/stores/usePromptStore.ts`

**Purpose**: Manages saved prompts and quick prompts.

**State:**
```typescript
interface PromptStore {
  prompts: Prompt[];
  pinnedPromptIds: string[];

  addPrompt(prompt: Prompt): void;
  updatePrompt(id: string, updates: PromptUpdates): void;
  deletePrompt(id: string): void;
  pinPrompt(id: string): void;
  unpinPrompt(id: string): void;
  openPromptEditor(id?: string): void;
}
```

### Additional Stores

- **useRecordingStore**: Session recording management
- **useAssetStore**: Project asset templates
- **useEnvironmentStore**: Environment variable sets
- **useAgentShortcutStore**: Agent quick-launch configuration
- **useSshStore**: SSH host management
- **usePersistentSessionStore**: Persistent session configuration
- **useSecureStorageStore**: Encrypted storage (macOS Keychain)
- **useThemeStore**: Theme management
- **useZoomStore**: Zoom level management
- **usePathPickerStore**: Path picker UI state

### Persistence Strategy

**Central Persistence** (`src/stores/persistence.ts`):

```typescript
// Watches stores and saves to localStorage
initCentralPersistence(): CleanupFunction {
  // Subscribe to stores
  const unsubSession = useSessionStore.subscribe(state => {
    localStorage.setItem('sessions', JSON.stringify(state.sessions));
  });

  const unsubProject = useProjectStore.subscribe(state => {
    localStorage.setItem('projects', JSON.stringify(state.projects));
  });

  // ... more subscriptions

  return () => {
    unsubSession();
    unsubProject();
    // ... cleanup all
  };
}
```

**Initialization** (`src/stores/initApp.ts`):

```typescript
// Loads state from localStorage on app start
export function initApp(
  registry: TerminalRegistry,
  pendingData: PendingDataBuffer
): CleanupFunction {
  // Load persisted sessions
  const savedSessions = localStorage.getItem('sessions');
  if (savedSessions) {
    useSessionStore.setState({ sessions: JSON.parse(savedSessions) });
  }

  // Load persisted projects
  const savedProjects = localStorage.getItem('projects');
  if (savedProjects) {
    useProjectStore.setState({ projects: JSON.parse(savedProjects) });
  }

  // Initialize WebSocket
  useMaestroStore.getState().initWebSocket();

  // ... more initialization

  return () => {
    // Cleanup on app unmount
    useMaestroStore.getState().destroyWebSocket();
  };
}
```

---

## Component Architecture

### Component Hierarchy

```
App
├── ProjectTabBar
│   └── [Project tabs with session counts]
│
├── AppContent
│   ├── Sidebar
│   │   ├── QuickPromptsSection
│   │   │   └── [Quick prompt buttons (Cmd+1-5)]
│   │   └── SessionsSection
│   │       ├── [Agent quick-start buttons]
│   │       ├── [Session list with drag-and-drop]
│   │       └── [New session button]
│   │
│   ├── Main
│   │   ├── AppWorkspace
│   │   │   ├── TerminalPane
│   │   │   │   └── SessionTerminal (xterm.js)
│   │   │   ├── CodeEditorPanel (Monaco)
│   │   │   └── FileExplorerPanel (commented out)
│   │   │
│   │   ├── AppModals
│   │   │   ├── NewSessionModal
│   │   │   ├── ProjectConfigModal
│   │   │   ├── SshManagerModal
│   │   │   └── [15+ other modals]
│   │   │
│   │   └── AppSlidePanel
│   │       ├── PromptsTab
│   │       ├── RecordingsTab
│   │       ├── AssetsTab
│   │       └── EnvironmentsTab
│   │
│   └── AppRightPanel
│       └── MaestroPanel
│           ├── CreateTaskModal
│           ├── TaskListItem
│           │   ├── TaskStatusControl
│           │   ├── TaskFilters
│           │   └── TaskTimeline
│           ├── TaskDetailModal
│           │   ├── SessionDetailsSection
│           │   ├── SessionTimeline
│           │   └── AddSubtaskInput
│           ├── TemplateEditor
│           └── TemplateList
│
└── CommandPalette (overlay)
    ├── [Search input]
    ├── [Prompt results]
    ├── [Recording results]
    └── [Session results]
```

### Key Components

#### **SessionTerminal** (20KB)

Location: `src/SessionTerminal.tsx`

**Purpose**: Embeds xterm.js terminal with PTY backend.

**Features:**
- PTY session management via Tauri
- Terminal theming (dark mode)
- Working directory change detection
- Process command tracking
- Recording integration
- Fit addon for auto-sizing
- Buffer management for data before terminal ready

**Implementation:**
```typescript
interface SessionTerminalProps {
  id: string;
  active: boolean;
  readOnly: boolean;
  persistent: boolean;
  onCwdChange: (id: string, cwd: string) => void;
  onCommandChange: (id: string, command: string) => void;
  onResize: (id: string, cols: number, rows: number) => void;
  registry: MutableRefObject<TerminalRegistry>;
  pendingData: MutableRefObject<PendingDataBuffer>;
}
```

**Terminal Registry:**
```typescript
type TerminalRegistry = Map<string, Terminal>;  // sessionId -> xterm.js Terminal
type PendingDataBuffer = Map<string, string>;   // sessionId -> buffered data
```

#### **MaestroPanel** (33KB)

Location: `src/components/maestro/MaestroPanel.tsx`

**Purpose**: Main task management interface.

**Features:**
- Task tree view with expand/collapse
- Task creation and editing
- Task status management (todo/in_progress/completed)
- Task filtering (status, priority, search)
- Session spawning for tasks
- Timeline view for task history
- Subtask management
- Template editor

**State Management:**
```typescript
// Uses MaestroContext + local UI state
const { state, fetchTasks, createTask, updateTask } = useMaestroContext();
const [filters, setFilters] = useState<TaskFilters>({
  status: 'all',
  priority: 'all',
  search: '',
});
const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
```

#### **TaskListItem** (30KB)

Location: `src/components/maestro/TaskListItem.tsx`

**Purpose**: Renders individual task with interactive controls.

**Features:**
- Collapsible subtask tree
- Inline status updates
- Session indicators
- Timeline events
- Context menu actions
- Drag handle for reordering
- Priority badges

**Rendering Logic:**
```typescript
// Recursive rendering for task tree
function TaskListItem({ task, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="taskItem" style={{ paddingLeft: depth * 20 }}>
      <TaskHeader task={task} onToggle={() => setExpanded(!expanded)} />
      <TaskStatusControl task={task} onUpdate={handleUpdate} />
      <TaskTimeline events={task.timeline} />

      {expanded && task.subtasks?.map(subtask => (
        <TaskListItem key={subtask.id} task={subtask} depth={depth + 1} />
      ))}
    </div>
  );
}
```

#### **CommandPalette** (17KB)

Location: `src/CommandPalette.tsx`

**Purpose**: Quick access to prompts, recordings, and sessions.

**Features:**
- Fuzzy search
- Keyboard navigation (arrow keys, enter)
- Multiple result categories
- Quick actions (Cmd+1-5 for prompts)
- Global shortcut (Cmd+K)

**Search Implementation:**
```typescript
const [query, setQuery] = useState('');
const results = useMemo(() => {
  const q = query.toLowerCase();
  return {
    prompts: prompts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q)
    ),
    recordings: recordings.filter(r =>
      r.name.toLowerCase().includes(q)
    ),
    sessions: sessions.filter(s =>
      s.name.toLowerCase().includes(q)
    ),
  };
}, [query, prompts, recordings, sessions]);
```

#### **AppWorkspace**

Location: `src/components/app/AppWorkspace.tsx`

**Purpose**: Main workspace container with resizable panels.

**Features:**
- Terminal pane (always visible)
- Code editor panel (lazy-loaded)
- File explorer panel (commented out)
- Resize handles between panels
- SSH detection and integration
- Workspace view persistence per project/session

**Layout Logic:**
```typescript
// CSS variables for panel widths
style={{
  '--workspaceEditorWidthPx': `${activeWorkspaceView.editorWidth}px`,
  '--workspaceFileTreeWidthPx': `${activeWorkspaceView.treeWidth}px`,
} as React.CSSProperties}
```

#### **CodeEditorPanel** (37KB)

Location: `src/components/CodeEditorPanel.tsx`

**Purpose**: Monaco-based code editor with multi-tab support.

**Features:**
- Monaco editor integration
- Syntax highlighting
- Multi-tab interface
- Local and SSH file support
- Auto-save (Cmd+S)
- Tab close (Cmd+W)
- File watching for external changes

**Editor Configuration:**
```typescript
<MonacoEditor
  height="100%"
  language={detectLanguage(filePath)}
  theme="vs-dark"
  value={fileContent}
  onChange={handleChange}
  options={{
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }}
/>
```

---

## Services & API Integration

### MaestroClient

Location: `src/utils/MaestroClient.ts`

**Purpose**: Type-safe REST API client for Maestro server.

**Architecture:**

```typescript
class MaestroClient {
  private baseUrl = 'http://localhost:3000/api';

  // Generic fetch with error handling
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }
}

// Singleton export
export const maestroClient = new MaestroClient();
```

**API Methods:**

| Category | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| **Projects** | `getProjects()` | `GET /api/projects` | List all projects |
| | `getProject(id)` | `GET /api/projects/:id` | Get single project |
| | `createProject(data)` | `POST /api/projects` | Create project |
| | `updateProject(id, data)` | `PUT /api/projects/:id` | Update project |
| | `deleteProject(id)` | `DELETE /api/projects/:id` | Delete project |
| **Tasks** | `getTasks(projectId?)` | `GET /api/tasks?projectId=...` | List tasks |
| | `getTask(id)` | `GET /api/tasks/:id` | Get single task |
| | `createTask(data)` | `POST /api/tasks` | Create task |
| | `updateTask(id, updates)` | `PATCH /api/tasks/:id` | Update task |
| | `deleteTask(id)` | `DELETE /api/tasks/:id` | Delete task |
| | `getTaskChildren(taskId)` | `GET /api/tasks/:id/children` | Get subtasks |
| **Sessions** | `getSessions(taskId?)` | `GET /api/sessions?taskId=...` | List sessions |
| | `getSession(id)` | `GET /api/sessions/:id` | Get single session |
| | `createSession(data)` | `POST /api/sessions` | Create session |
| | `updateSession(id, updates)` | `PATCH /api/sessions/:id` | Update session |
| | `deleteSession(id)` | `DELETE /api/sessions/:id` | Delete session |
| | `spawnSession(data)` | `POST /api/sessions/spawn` | Spawn session |
| | `addTaskToSession(sessionId, taskId)` | `POST /api/sessions/:id/tasks/:taskId` | Link task |
| | `removeTaskFromSession(sessionId, taskId)` | `DELETE /api/sessions/:id/tasks/:taskId` | Unlink task |
| | `addSessionTimelineEvent(sessionId, event)` | `POST /api/sessions/:id/timeline` | Add event |
| **Skills** | `getSkills()` | `GET /api/skills` | List available skills |
| **Templates** | `getTemplates()` | `GET /api/templates` | List templates |
| | `getTemplate(id)` | `GET /api/templates/:id` | Get template |
| | `getTemplateByRole(role)` | `GET /api/templates/role/:role` | Get by role |
| | `createTemplate(data)` | `POST /api/templates` | Create template |
| | `updateTemplate(id, updates)` | `PUT /api/templates/:id` | Update template |
| | `resetTemplate(id)` | `POST /api/templates/:id/reset` | Reset to default |
| | `deleteTemplate(id)` | `DELETE /api/templates/:id` | Delete template |
| | `getDefaultTemplateContent(role)` | `GET /api/templates/default/:role` | Get default |

### Service Layer

#### **maestroService.ts**

Location: `src/services/maestroService.ts`

**Purpose**: High-level Maestro operations.

```typescript
// Creates a Maestro session and spawns terminal
export async function createMaestroSession(input: {
  task?: MaestroTask;
  tasks?: MaestroTask[];
  project: MaestroProject;
  skillIds?: string[];
  strategy?: WorkerStrategy;
}): Promise<TerminalSession> {
  const { task, tasks, skillIds, project, strategy } = input;

  // Normalize to array
  const taskList = tasks || (task ? [task] : []);
  if (taskList.length === 0) {
    throw new Error('At least one task is required');
  }

  // Spawn via server
  const response = await maestroClient.spawnSession({
    projectId: project.id,
    taskIds: taskList.map(t => t.id),
    role: 'worker',
    strategy: strategy || 'simple',
    spawnSource: 'ui',
    sessionName: taskList.length > 1
      ? `Multi-Task: ${taskList[0].title}`
      : taskList[0].title,
    skills: skillIds || ['maestro-worker'],
    model: taskList[0].model || 'sonnet',
  });

  // Return placeholder - actual session spawned via WebSocket
  return {
    id: 'pending',
    maestroSessionId: response.sessionId,
    projectId: project.id,
  } as TerminalSession;
}
```

**Key Insight**: The UI doesn't directly spawn terminals for Maestro sessions. It calls the server spawn endpoint, which generates a manifest via the Maestro CLI and emits a `session:spawn` event. The UI's WebSocket handler receives this event and spawns the terminal with the correct environment variables.

#### **sessionService.ts**

Location: `src/services/sessionService.ts`

**Purpose**: Terminal session operations via Tauri.

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Create PTY session
export async function createPtySession(params: {
  name: string;
  command: string | null;
  args: string[];
  cwd: string;
  envVars: Record<string, string>;
}): Promise<string> {
  return invoke('create_pty_session', params);
}

// Send data to PTY
export async function sendDataToPty(sessionId: string, data: string): Promise<void> {
  return invoke('send_data_to_pty', { sessionId, data });
}

// Resize PTY
export async function resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke('resize_pty', { sessionId, cols, rows });
}

// Close PTY session
export async function closePtySession(sessionId: string): Promise<void> {
  return invoke('close_pty_session', { sessionId });
}
```

#### **terminalService.ts**

Location: `src/services/terminalService.ts`

**Purpose**: High-level terminal operations.

```typescript
export async function createTerminalSession(params: {
  name: string;
  command: string | null;
  cwd: string;
  envVars?: Record<string, string>;
}): Promise<TerminalSession> {
  const { name, command, cwd, envVars = {} } = params;

  // Generate session ID
  const id = generateId();

  // Create PTY backend
  const ptyId = await createPtySession({
    name,
    command: command || 'bash',
    args: [],
    cwd,
    envVars,
  });

  // Create UI session object
  const session: TerminalSession = {
    id,
    name,
    command: command || 'bash',
    cwd,
    projectId: useProjectStore.getState().activeProjectId,
    persistent: false,
    createdAt: Date.now(),
    // ...
  };

  return session;
}
```

---

## Real-time Communication

### WebSocket Architecture

**Connection**: Single global WebSocket connection managed by `useMaestroStore`.

**URL**: `ws://localhost:3000`

**Lifecycle:**
1. Connection established on app initialization
2. Automatic reconnection with exponential backoff
3. Maximum backoff: 30 seconds
4. Connection survives across project switches

### Event Types

**Server → Client Events:**

```typescript
// Task events
'task:created'   → { ...task }
'task:updated'   → { ...task }
'task:deleted'   → { id: string }

// Session events
'session:created' → { session: {...}, ...metadata }
'session:updated' → { ...session }
'session:deleted' → { id: string }
'session:spawn'   → {
  session: {...},
  command: string,
  cwd: string,
  envVars: Record<string, string>,
  projectId: string,
  spawnSource: 'ui' | 'session',
  parentSessionId?: string
}

// Relationship events
'task:session_added'   → { taskId: string, sessionId: string }
'task:session_removed' → { taskId: string, sessionId: string }
'session:task_added'   → { sessionId: string, taskId: string }
'session:task_removed' → { sessionId: string, taskId: string }
```

### Event Handling

Location: `src/stores/useMaestroStore.ts`

```typescript
const handleMessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data);

  // Logging (with high-frequency event filtering)
  const shouldLogDetails = !HIGH_FREQUENCY_EVENTS.has(message.event);
  if (shouldLogDetails) {
    console.log('\n' + '━'.repeat(80));
    console.log(`📥 CLIENT EVENT RECEIVED`);
    console.log(`📡 Event Type: ${message.event}`);
    console.log('\n📦 Event Payload:');
    console.log(JSON.stringify(message.data, null, 2));
    console.log('━'.repeat(80) + '\n');
  }

  // Handle events
  switch (message.event) {
    case 'task:created':
    case 'task:updated':
      set(prev => ({
        tasks: new Map(prev.tasks).set(message.data.id, message.data)
      }));
      break;

    case 'task:deleted':
      set(prev => {
        const tasks = new Map(prev.tasks);
        tasks.delete(message.data.id);
        return { tasks };
      });
      break;

    case 'session:spawn':
      // Special handling for session spawning
      const session = message.data.session || message.data;
      set(prev => ({
        sessions: new Map(prev.sessions).set(session.id, session)
      }));

      // Spawn terminal via session store
      void useSessionStore.getState().handleSpawnTerminalSession({
        maestroSessionId: session.id,
        name: session.name,
        command: message.data.command,
        args: [],
        cwd: message.data.cwd,
        envVars: message.data.envVars,
        projectId: message.data.projectId,
      });
      break;

    // ... more cases
  }
};
```

### Reconnection Logic

```typescript
const connectGlobal = () => {
  if (globalConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) {
    return; // Already connected or connecting
  }

  globalConnecting = true;
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    set({ wsConnected: true });
    globalConnecting = false;
    globalReconnectAttempts = 0;

    // Refetch data on reconnect
    const { activeProjectIdRef } = get();
    if (activeProjectIdRef) {
      get().fetchTasks(activeProjectIdRef);
      get().fetchSessions();
    }
  };

  ws.onclose = () => {
    set({ wsConnected: false });
    globalConnecting = false;
    globalWs = null;

    // Exponential backoff reconnection
    const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);
    globalReconnectTimeout = window.setTimeout(() => {
      globalReconnectAttempts++;
      connectGlobal();
    }, delay);
  };

  ws.onmessage = handleMessage;
  ws.onerror = (err) => console.error('WebSocket error:', err);

  globalWs = ws;
};
```

### Optimistic Updates

The UI performs **optimistic updates** for mutations:

1. User action triggers API call
2. API call returns success
3. WebSocket event confirms update
4. UI state updated via WebSocket handler

**Example:**
```typescript
// User clicks "Complete" on task
await maestroClient.updateTask(taskId, { status: 'completed' });
// ↓
// Server processes update
// ↓
// Server emits 'task:updated' event
// ↓
// WebSocket handler updates store
set(prev => ({ tasks: new Map(prev.tasks).set(taskId, updatedTask) }));
```

This ensures:
- Single source of truth (server)
- No stale data
- Automatic multi-client sync

---

## Terminal Integration

### PTY Backend (Tauri)

The application uses **Pseudo-Terminal (PTY)** sessions provided by the Tauri Rust backend.

**Rust Commands** (invoked from TypeScript):

```rust
// src-tauri/src/main.rs (pseudocode)

#[tauri::command]
fn create_pty_session(
  name: String,
  command: Option<String>,
  args: Vec<String>,
  cwd: String,
  env_vars: HashMap<String, String>,
) -> Result<String, String> {
  // Create PTY with portable_pty crate
  let pty = PtySystem::native()
    .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })?;

  // Spawn process
  let cmd = CommandBuilder::new(command.unwrap_or("bash".to_string()));
  cmd.args(args);
  cmd.cwd(cwd);
  cmd.env_extend(env_vars);

  let child = pty.slave.spawn_command(cmd)?;

  // Store PTY in global map
  let session_id = Uuid::new_v4().to_string();
  PTY_SESSIONS.lock().unwrap().insert(session_id.clone(), pty);

  // Start background thread to read PTY output and emit to frontend
  spawn_pty_reader(session_id.clone(), pty.master);

  Ok(session_id)
}

#[tauri::command]
fn send_data_to_pty(session_id: String, data: String) -> Result<(), String> {
  let sessions = PTY_SESSIONS.lock().unwrap();
  let pty = sessions.get(&session_id).ok_or("Session not found")?;
  pty.master.write_all(data.as_bytes())?;
  Ok(())
}

#[tauri::command]
fn resize_pty(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
  let sessions = PTY_SESSIONS.lock().unwrap();
  let pty = sessions.get(&session_id).ok_or("Session not found")?;
  pty.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })?;
  Ok(())
}

#[tauri::command]
fn close_pty_session(session_id: String) -> Result<(), String> {
  let mut sessions = PTY_SESSIONS.lock().unwrap();
  sessions.remove(&session_id);
  Ok(())
}
```

### Frontend Terminal (xterm.js)

**Terminal Creation:**

```typescript
// In SessionTerminal.tsx
useEffect(() => {
  if (!active) return;

  // Create xterm.js terminal
  const term = new Terminal({
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      // ... more colors
    },
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    cursorBlink: true,
    scrollback: 10000,
  });

  // Attach to DOM
  term.open(terminalRef.current);

  // Attach fit addon
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  fitAddon.fit();

  // Store in registry
  registry.current.set(id, term);

  // Setup event listeners
  term.onData(data => {
    // Send input to PTY
    invoke('send_data_to_pty', { sessionId: id, data });
  });

  term.onResize(({ cols, rows }) => {
    // Resize PTY
    invoke('resize_pty', { sessionId: id, cols, rows });
    onResize(id, cols, rows);
  });

  // Cleanup
  return () => {
    term.dispose();
    registry.current.delete(id);
  };
}, [active, id]);
```

**Receiving PTY Output:**

```typescript
// Listen for PTY output events from Tauri
useEffect(() => {
  const unlisten = listen<{ sessionId: string; data: string }>('pty-output', (event) => {
    const { sessionId, data } = event.payload;
    const term = registry.current.get(sessionId);

    if (term) {
      // Write to terminal
      term.write(data);
    } else {
      // Buffer if terminal not ready
      const existing = pendingData.current.get(sessionId) || '';
      pendingData.current.set(sessionId, existing + data);
    }
  });

  return () => {
    unlisten();
  };
}, [registry, pendingData]);
```

**Working Directory Detection:**

```typescript
// Parse PTY output for working directory changes
term.onData(data => {
  // Look for OSC 7 escape sequence (working directory)
  // Format: \x1b]7;file://hostname/path\x1b\\
  const osc7Match = data.match(/\x1b\]7;file:\/\/[^\/]*(.+?)\x1b\\/);
  if (osc7Match) {
    const newCwd = decodeURIComponent(osc7Match[1]);
    onCwdChange(id, newCwd);
  }

  // Also parse shell prompts for CWD
  // ... more detection logic
});
```

### Process Detection

Location: `src/processEffects.ts`

**Purpose**: Detect running processes (agents) and show activity indicators.

```typescript
export interface ProcessEffect {
  id: string;
  label: string;
  matchCommands: string[];  // Commands that trigger this effect
  idleAfterMs: number;       // Time before marking idle
  iconSrc: string;           // Icon to display
}

export const PROCESS_EFFECTS: ProcessEffect[] = [
  {
    id: 'claude',
    label: 'Claude',
    matchCommands: ['claude', 'claude-code'],
    idleAfterMs: 2000,
    iconSrc: claudeIcon,
  },
  {
    id: 'codex',
    label: 'Codex',
    matchCommands: ['codex'],
    idleAfterMs: 2000,
    iconSrc: codexIcon,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    matchCommands: ['gemini'],
    idleAfterMs: 2000,
    iconSrc: geminiIcon,
  },
  // ... more agents
];
```

**Detection Logic:**

```typescript
// In useSessionStore
onCommandChange(id: string, command: string): void {
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  // Detect process effect
  const effect = PROCESS_EFFECTS.find(e =>
    e.matchCommands.some(cmd => command.toLowerCase().includes(cmd))
  );

  if (effect) {
    // Mark session with effect
    const updated = {
      ...session,
      effectId: effect.id,
      processTag: effect.label,
      agentWorking: true,
    };

    // Start idle timer
    clearTimeout(idleTimers.get(id));
    const timer = setTimeout(() => {
      // Mark idle after timeout
      updateSession(id, { agentWorking: false });
    }, effect.idleAfterMs);

    idleTimers.set(id, timer);
    updateSession(id, updated);
  }
}
```

**Visual Indicators:**

```css
/* Active agent indicator */
.sessionItem.agentWorking {
  border-left: 3px solid var(--color-accent);
}

.sessionItem.agentWorking::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## File System & Code Editor

### Monaco Editor Integration

**Lazy Loading:**

```typescript
// In AppWorkspace.tsx
const LazyCodeEditorPanel = React.lazy(() => import('../CodeEditorPanel'));

// Rendered with Suspense
<React.Suspense fallback={<div>Loading editor…</div>}>
  <LazyCodeEditorPanel
    provider="local"  // or "ssh"
    rootDir="/path/to/project"
    openFileRequest={request}
    persistedState={editorState}
    onPersistState={handlePersist}
  />
</React.Suspense>
```

**Multi-Tab Editor:**

```typescript
interface CodeEditorPersistedState {
  openTabs: Array<{
    path: string;
    content: string;
    modified: boolean;
  }>;
  activeTabIndex: number;
}

function CodeEditorPanel({ rootDir, persistedState }: Props) {
  const [tabs, setTabs] = useState(persistedState?.openTabs || []);
  const [activeIndex, setActiveIndex] = useState(persistedState?.activeTabIndex || 0);

  const activeTab = tabs[activeIndex];

  return (
    <div className="codeEditorPanel">
      <div className="editorTabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.path}
            className={`editorTab ${i === activeIndex ? 'active' : ''}`}
            onClick={() => setActiveIndex(i)}
          >
            {basename(tab.path)}
            {tab.modified && ' •'}
            <button onClick={() => closeTab(i)}>×</button>
          </button>
        ))}
      </div>

      <MonacoEditor
        path={activeTab.path}
        value={activeTab.content}
        language={detectLanguage(activeTab.path)}
        onChange={content => updateTab(activeIndex, { content, modified: true })}
        onSave={() => saveFile(activeTab)}
      />
    </div>
  );
}
```

**File Operations:**

```typescript
// Local files
async function readLocalFile(path: string): Promise<string> {
  return invoke('read_file', { path });
}

async function writeLocalFile(path: string, content: string): Promise<void> {
  return invoke('write_file', { path, content });
}

// SSH files
async function readSshFile(sshTarget: string, path: string): Promise<string> {
  return invoke('read_ssh_file', { sshTarget, path });
}

async function writeSshFile(sshTarget: string, path: string, content: string): Promise<void> {
  return invoke('write_ssh_file', { sshTarget, path, content });
}
```

**Language Detection:**

```typescript
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'rb': 'ruby',
    'md': 'markdown',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'css': 'css',
    'scss': 'scss',
    'html': 'html',
    // ... more mappings
  };

  return langMap[ext || ''] || 'plaintext';
}
```

### File Explorer

**Currently commented out in `AppWorkspace.tsx`**, but the implementation exists in `FileExplorerPanel.tsx` (44KB).

**Features (when enabled):**
- Tree view of directories
- Local and SSH file browsing
- File operations (rename, delete, create)
- Drag-and-drop file upload (Finder → Explorer)
- Drag-and-drop file download (Explorer → Finder)
- Context menu actions
- Open in external editor (VS Code)

---

## Maestro Integration

### CLI-First Architecture

**Core Principle**: The UI's only job is to spawn terminals with environment variables. The Maestro CLI handles everything else.

**UI Responsibilities:**
1. Create task in server (via API)
2. Call `/api/sessions/spawn` endpoint
3. Receive `session:spawn` WebSocket event
4. Spawn terminal with provided environment variables

**CLI Responsibilities:**
1. Read environment variables
2. Fetch session metadata from server
3. Load skills and prompts
4. Generate session manifest
5. Execute hooks and scripts
6. Spawn Claude with proper configuration
7. Report status to server

### Session Spawning Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks "Work On Task" in UI                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. UI calls maestroClient.spawnSession()                        │
│    POST /api/sessions/spawn                                     │
│    {                                                             │
│      projectId, taskIds, role: 'worker',                        │
│      strategy: 'simple', spawnSource: 'ui',                     │
│      skills: ['maestro-worker'], model: 'sonnet'                │
│    }                                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Server (maestro-server) receives spawn request               │
│    - Creates session record in database                         │
│    - Calls `maestro worker init` CLI command                    │
│    - CLI generates session manifest                             │
│    - Server emits 'session:spawn' WebSocket event with:         │
│      {                                                           │
│        session: { id, name, status, ... },                      │
│        command: 'maestro',                                       │
│        args: ['worker', 'init'],                                │
│        cwd: '/project/working/dir',                             │
│        envVars: {                                                │
│          MAESTRO_SESSION_ID: 'ses_123',                         │
│          MAESTRO_PROJECT_ID: 'proj_456',                        │
│          MAESTRO_TASK_DATA: '{"id":"...","title":"..."}',       │
│          MAESTRO_TASK_IDS: 'task1,task2',                       │
│          MAESTRO_SKILLS: 'maestro-worker',                      │
│          MAESTRO_API_URL: 'http://localhost:3000',              │
│          MAESTRO_AGENT_ID: 'claude',                            │
│          MAESTRO_AGENT_MODEL: 'sonnet'                          │
│        }                                                         │
│      }                                                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. UI WebSocket handler receives 'session:spawn' event          │
│    - Stores session in useMaestroStore                          │
│    - Calls useSessionStore.handleSpawnTerminalSession()         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. UI spawns terminal session                                   │
│    - Creates PTY via Tauri backend                              │
│    - Passes command: 'maestro'                                  │
│    - Passes args: ['worker', 'init']                            │
│    - Passes environment variables                               │
│    - Creates xterm.js terminal                                  │
│    - Links UI session to Maestro session                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Terminal runs: maestro worker init                           │
│    - CLI reads MAESTRO_* environment variables                  │
│    - Fetches full session data from server                      │
│    - Loads skills from MAESTRO_SKILLS                           │
│    - Executes pre-spawn hooks                                   │
│    - Spawns Claude with:                                        │
│      - Session context                                          │
│      - Task data                                                │
│      - Loaded skills                                            │
│      - Custom prompts                                           │
│    - Reports status updates to server                           │
│    - Server emits WebSocket events (task_started, progress...)  │
└─────────────────────────────────────────────────────────────────┘
```

### Environment Variables

**Set by UI (via spawn event):**

```bash
# Session identification
MAESTRO_SESSION_ID=ses_abc123
MAESTRO_PROJECT_ID=proj_xyz789

# Task data (primary task as JSON)
MAESTRO_TASK_DATA='{"id":"task_1","title":"Fix bug","description":"...","initialPrompt":"Fix the login bug",...}'

# All task IDs (for multi-task sessions)
MAESTRO_TASK_IDS=task_1,task_2,task_3

# Skills to load (comma-separated)
MAESTRO_SKILLS=maestro-worker,debugging,testing

# Server connection
MAESTRO_API_URL=http://localhost:3000

# Agent configuration
MAESTRO_AGENT_ID=claude
MAESTRO_AGENT_MODEL=sonnet  # or opus, haiku
```

**Read by CLI:**

```typescript
// In maestro-cli/src/commands/worker.ts
export async function workerInit() {
  // Read from environment
  const sessionId = process.env.MAESTRO_SESSION_ID;
  const projectId = process.env.MAESTRO_PROJECT_ID;
  const taskData = JSON.parse(process.env.MAESTRO_TASK_DATA || '{}');
  const taskIds = (process.env.MAESTRO_TASK_IDS || '').split(',');
  const skills = (process.env.MAESTRO_SKILLS || '').split(',');
  const apiUrl = process.env.MAESTRO_API_URL;
  const agentId = process.env.MAESTRO_AGENT_ID || 'claude';
  const model = process.env.MAESTRO_AGENT_MODEL || 'sonnet';

  // Fetch full session from server
  const session = await fetch(`${apiUrl}/api/sessions/${sessionId}`).then(r => r.json());

  // Load skills
  for (const skillId of skills) {
    await loadSkill(skillId);
  }

  // Generate manifest
  const manifestPath = await generateManifest(session, taskData);

  // Spawn Claude
  await spawnClaude({
    model,
    prompt: taskData.initialPrompt,
    skills,
    context: { session, task: taskData, manifest: manifestPath },
  });

  // Report completion
  await updateSessionStatus(sessionId, 'completed');
}
```

### Worker Strategies

**Simple Strategy** (default):
- One session per task
- Sequential execution
- Direct task assignment

**Queue Strategy**:
- Worker polls server for tasks
- Can handle multiple tasks in sequence
- Supports task dependencies
- Enables distributed work

**Implementation:**

```typescript
// In CreateTaskModal
const [strategy, setStrategy] = useState<WorkerStrategy>('simple');

// Passed to spawn
await maestroClient.spawnSession({
  // ...
  strategy: strategy,  // 'simple' or 'queue'
});
```

**CLI Behavior:**

```typescript
// Simple strategy
if (strategy === 'simple') {
  // Execute assigned tasks directly
  for (const taskId of taskIds) {
    await executeTask(taskId);
  }
}

// Queue strategy
if (strategy === 'queue') {
  // Poll server for tasks
  while (true) {
    const task = await pollNextTask(sessionId);
    if (!task) break;
    await executeTask(task.id);
  }
}
```

---

## Build & Development

### Development Setup

**Prerequisites:**
- Node.js 18+
- Rust toolchain
- Tauri prerequisites for macOS

**Installation:**

```bash
# Install dependencies
cd maestro-ui
npm install

# Run in development mode
npm run tauri dev

# Or with clear data
npm run tauri:dev:clear
```

**Development Servers:**

| Service | Port | Purpose |
|---------|------|---------|
| Vite Dev Server | 1420 | React app with HMR |
| Maestro Server | 3000 | REST API + WebSocket |
| Tauri Window | - | Native app window |

### Build Process

**Development Build:**

```bash
npm run dev           # Vite only (for web testing)
npm run tauri dev     # Full Tauri app
```

**Production Build:**

```bash
npm run build         # TypeScript + Vite build
npm run tauri build   # Full app bundle
```

**Output:**

```
src-tauri/target/release/bundle/
├── macos/
│   └── Maestro UI.app
├── dmg/
│   └── Maestro UI_0.3.0_aarch64.dmg
└── deb/ (if on Linux)
```

### Vite Configuration

Location: `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  clearScreen: false,  // Don't clear terminal
  server: {
    port: 1420,
    strictPort: true,  // Fail if port unavailable
  },
  envPrefix: ['VITE_', 'TAURI_'],  // Expose env vars
  build: {
    target: 'es2021',
    sourcemap: Boolean(process.env.TAURI_DEBUG),
    minify: process.env.TAURI_DEBUG ? false : 'esbuild',
  },
});
```

### TypeScript Configuration

Location: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Scripts

```json
{
  "scripts": {
    "dev": "vite --port 1420 --strictPort",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 1420 --strictPort",
    "tauri": "tauri",
    "tauri:dev:clear": "tauri dev -- -- --clear-data",
    "dev:all": "concurrently \"npm run tauri dev\" \"npm run dev --prefix ../maestro-server\""
  }
}
```

---

## Key Features

### 1. Multi-Project Workspace

- **Project Tabs**: Top bar shows all projects with session counts
- **Per-Project Sessions**: Each project has isolated terminal sessions
- **Per-Project Configuration**: Base path, environment, assets
- **Quick Switch**: Click tab to switch projects instantly

### 2. Terminal Sessions

- **Real PTY**: True terminal emulation with job control
- **Persistent Sessions**: Sessions survive app restarts (optional)
- **Working Directory Tracking**: Detects CWD changes via OSC 7
- **Process Detection**: Shows icons for running agents
- **Activity Indicators**: Pulsing dot when agent is working
- **Session Recording**: Record and replay terminal sessions

### 3. Task Management

- **Hierarchical Tasks**: Parent tasks with unlimited subtasks
- **Task Status**: todo, in_progress, completed, cancelled, blocked
- **Task Priority**: low, medium, high
- **Task Dependencies**: Block tasks until dependencies complete
- **Task Timeline**: See history of task events
- **Session Association**: Link tasks to sessions

### 4. Session Orchestration

- **Spawn Sessions**: Start AI agents to work on tasks
- **Worker Strategies**: Simple (direct) or Queue (polling)
- **Multi-Task Sessions**: Assign multiple tasks to one session
- **Session Timeline**: Track session activity over time
- **Session Status**: spawning, idle, working, completed, failed
- **Model Selection**: Choose Claude model (sonnet, opus, haiku)

### 5. Real-time Synchronization

- **WebSocket Updates**: Instant updates across all clients
- **Automatic Reconnection**: Recovers from network issues
- **Optimistic UI**: Immediate feedback with server confirmation
- **Event Logging**: Detailed logs for debugging

### 6. Code Editing

- **Monaco Editor**: VS Code-quality editor
- **Multi-Tab**: Multiple files open simultaneously
- **Syntax Highlighting**: 40+ languages
- **Auto-Save**: Cmd+S to save
- **Local & SSH**: Edit files locally or remotely
- **File Watching**: Detects external changes

### 7. Quick Access

- **Command Palette** (Cmd+K): Search prompts, recordings, sessions
- **Quick Prompts** (Cmd+1-5): Send pinned prompts instantly
- **Agent Shortcuts**: One-click agent launching
- **Keyboard Shortcuts**: Extensive keyboard navigation

### 8. Prompts & Templates

- **Saved Prompts**: Reusable prompt library
- **Pin Prompts**: Quick access to favorites
- **Prompt Templates**: Variables and placeholders
- **Worker Templates**: Customize agent system prompts
- **Asset Templates**: Project-specific file templates

---

## Data Flow Patterns

### 1. Task Creation Flow

```
User clicks "Create Task"
  → Opens CreateTaskModal
  → User fills form (title, description, prompt, priority)
  → User clicks "Create"
  → maestroClient.createTask(payload)
  → POST /api/tasks
  → Server creates task in database
  → Server emits 'task:created' WebSocket event
  → useMaestroStore receives event
  → Updates tasks Map
  → UI re-renders with new task
```

### 2. Session Spawning Flow

```
User clicks "Work On Task"
  → Opens WorkOnModal
  → User selects strategy, model, skills
  → User clicks "Start"
  → maestroClient.spawnSession(payload)
  → POST /api/sessions/spawn
  → Server creates session record
  → Server calls `maestro worker init` CLI
  → CLI generates manifest
  → Server emits 'session:spawn' WebSocket event with:
    - session object
    - command: 'maestro'
    - args: ['worker', 'init']
    - cwd, envVars
  → useMaestroStore receives event
  → Calls useSessionStore.handleSpawnTerminalSession()
  → Creates PTY via Tauri
  → Creates xterm.js terminal
  → Terminal runs: maestro worker init
  → CLI spawns Claude
  → Agent starts working
```

### 3. Real-time Update Flow

```
Agent updates task status on CLI
  → CLI calls PATCH /api/tasks/:id
  → Server updates database
  → Server emits 'task:updated' WebSocket event
  → useMaestroStore receives event
  → Updates tasks Map
  → UI re-renders with updated status
  → MaestroPanel shows new status
  → TaskListItem updates visual indicator
```

### 4. Terminal Output Flow

```
PTY process writes to stdout
  → Tauri PTY reader thread receives data
  → Emits 'pty-output' event to frontend
  → SessionTerminal component receives event
  → Looks up xterm.js Terminal in registry
  → Calls terminal.write(data)
  → Terminal displays output
  → Parses output for CWD changes
  → Updates session.cwd in store
```

---

## Performance Considerations

### Optimizations

1. **Lazy Loading**:
   - Monaco editor lazy-loaded with `React.lazy()`
   - File explorer commented out (not needed currently)

2. **Memoization**:
   - `useMemo` for computed values (session counts, project sessions)
   - `useCallback` for stable callbacks
   - `React.memo` for component memoization (AppWorkspace)

3. **Normalized State**:
   - Maps for O(1) task/session lookups
   - Sets for loading/error tracking

4. **Virtual Scrolling**:
   - Task list uses virtualization for large lists (not implemented yet, but needed)

5. **WebSocket Event Filtering**:
   - High-frequency events excluded from verbose logging
   - Reduces console noise

6. **Terminal Buffering**:
   - Pending data buffer for PTY output before terminal ready
   - Prevents lost data

### Potential Bottlenecks

1. **Large Task Lists**:
   - No virtualization yet
   - Could slow down with 1000+ tasks
   - **Solution**: Implement react-window or react-virtualized

2. **WebSocket Message Volume**:
   - Many rapid updates could overwhelm UI
   - **Solution**: Throttle/debounce state updates

3. **Terminal Memory**:
   - xterm.js scrollback buffer (10,000 lines)
   - Multiple sessions could use significant memory
   - **Solution**: Reduce scrollback or implement paging

4. **File Editor**:
   - Monaco editor is heavy (~5MB)
   - Multiple editor instances could be costly
   - **Solution**: Single editor instance with tab switching

---

## Appendices

### A. Key File Sizes

| File | Size | LOC | Purpose |
|------|------|-----|---------|
| `styles.css` | 269KB | ~8000 | Main stylesheet |
| `useSessionStore.ts` | 44KB | ~1400 | Session management |
| `FileExplorerPanel.tsx` | 44KB | ~1400 | File explorer |
| `CodeEditorPanel.tsx` | 37KB | ~1200 | Code editor |
| `MaestroPanel.tsx` | 33KB | ~1000 | Task manager |
| `TaskListItem.tsx` | 30KB | ~1000 | Task item |
| `MAESTRO-UI-SPEC.md` | 28KB | ~900 | UI specification |
| `initApp.ts` | 27KB | ~800 | App initialization |
| `AppSlidePanel.tsx` | 25KB | ~800 | Slide panel |

### B. State Persistence Keys

| Key | Store | Data Type |
|-----|-------|-----------|
| `sessions` | useSessionStore | `TerminalSession[]` |
| `activeSessionId` | useSessionStore | `string \| null` |
| `projects` | useProjectStore | `Project[]` |
| `activeProjectId` | useProjectStore | `string \| null` |
| `prompts` | usePromptStore | `Prompt[]` |
| `pinnedPromptIds` | usePromptStore | `string[]` |
| `recordings` | useRecordingStore | `Recording[]` |
| `workspaceViews` | useWorkspaceStore | `Record<string, WorkspaceView>` |
| `sidebarWidth` | useUIStore | `number` |
| `rightPanelWidth` | useUIStore | `number` |
| `theme` | useThemeStore | `'dark' \| 'light'` |
| `zoom` | useZoomStore | `number` |

### C. API Endpoints Summary

**Base URL**: `http://localhost:3000/api`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/projects` | List projects |
| GET | `/projects/:id` | Get project |
| POST | `/projects` | Create project |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |
| GET | `/tasks?projectId=...` | List tasks |
| GET | `/tasks/:id` | Get task |
| POST | `/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| GET | `/tasks/:id/children` | Get subtasks |
| GET | `/sessions?taskId=...` | List sessions |
| GET | `/sessions/:id` | Get session |
| POST | `/sessions` | Create session |
| PATCH | `/sessions/:id` | Update session |
| DELETE | `/sessions/:id` | Delete session |
| POST | `/sessions/spawn` | Spawn session |
| POST | `/sessions/:id/tasks/:taskId` | Add task to session |
| DELETE | `/sessions/:id/tasks/:taskId` | Remove task from session |
| POST | `/sessions/:id/timeline` | Add timeline event |
| GET | `/skills` | List skills |
| GET | `/templates` | List templates |
| GET | `/templates/:id` | Get template |
| GET | `/templates/role/:role` | Get template by role |
| POST | `/templates` | Create template |
| PUT | `/templates/:id` | Update template |
| POST | `/templates/:id/reset` | Reset template |
| DELETE | `/templates/:id` | Delete template |
| GET | `/templates/default/:role` | Get default content |

### D. WebSocket Events

**Client → Server**: None (read-only client)

**Server → Client**:

| Event | Payload | Purpose |
|-------|---------|---------|
| `task:created` | `MaestroTask` | New task created |
| `task:updated` | `MaestroTask` | Task updated |
| `task:deleted` | `{ id: string }` | Task deleted |
| `session:created` | `{ session: MaestroSession, ... }` | New session created |
| `session:updated` | `MaestroSession` | Session updated |
| `session:deleted` | `{ id: string }` | Session deleted |
| `session:spawn` | `{ session, command, cwd, envVars, ... }` | Spawn request |
| `task:session_added` | `{ taskId, sessionId }` | Task linked to session |
| `task:session_removed` | `{ taskId, sessionId }` | Task unlinked from session |
| `session:task_added` | `{ sessionId, taskId }` | Session linked to task |
| `session:task_removed` | `{ sessionId, taskId }` | Session unlinked from task |

---

## Conclusion

Maestro UI is a sophisticated desktop application that bridges the gap between task management and AI agent execution. Its architecture is built on clear separation of concerns:

- **UI Layer**: React + Zustand for state management
- **Native Layer**: Tauri + Rust for system integration
- **Server Layer**: Maestro Server for orchestration
- **CLI Layer**: Maestro CLI for agent execution

The application's strength lies in its **CLI-First Architecture**, where the UI is primarily responsible for spawning terminals with the right environment variables, and the CLI handles all the complexity of agent configuration and execution.

This design makes the system:
- **Portable**: CLI can run standalone or via UI
- **Testable**: Each layer can be tested independently
- **Extensible**: New features can be added at any layer
- **Maintainable**: Clear boundaries between concerns

**Key Technologies:**
- Tauri for native capabilities
- React 18 for UI
- Zustand for state management
- xterm.js for terminals
- Monaco for code editing
- WebSocket for real-time updates

**Architecture Highlights:**
- Single global WebSocket connection
- Normalized state with Maps
- CLI-First execution model
- Real-time synchronization
- Persistent sessions
- Multi-project workspaces

This specification serves as the **source of truth** for the Maestro UI codebase, documenting its architecture, data models, component hierarchy, and integration patterns.

---

**Document Version:** 1.0.0
**Generated:** February 7, 2026
**Author:** Maestro Development Team
**Repository:** https://github.com/FusionbaseHQ/agents-ui
