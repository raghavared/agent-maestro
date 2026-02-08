# Maestro UI - Complete File Index

Comprehensive index of all source files in the Maestro UI codebase with descriptions.

---

## Root Files

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `tsconfig.node.json` | TypeScript config for Node.js files |
| `vite.config.ts` | Vite build configuration |
| `index.html` | HTML entry point |
| `MAESTRO-UI-SPEC.md` | Detailed UI specification (28KB) |
| `README.md` | Project documentation |
| `REFACTORING_GUIDE.md` | Refactoring guidelines |

---

## src/ - Main Source Directory

### Root Level Files

| File | LOC | Purpose |
|------|-----|---------|
| `main.tsx` | 10 | React entry point, renders App |
| `App.tsx` | 263 | Main application component, layout shell |
| `SessionTerminal.tsx` | 620 | Terminal component (xterm.js integration) |
| `CommandPalette.tsx` | 556 | Command palette (Cmd+K) |
| `SlidePanel.tsx` | 82 | Slide-out panel container |
| `pathDisplay.ts` | 60 | Path display utilities |
| `processEffects.ts` | 54 | Process detection for agents |
| `global.d.ts` | 10 | Global TypeScript declarations |
| `styles.css` | ~8000 | Main application styles |
| `styles-sessions.css` | 150 | Session-specific styles |
| `styles-mentions.css` | 29 | Mentions input styles |

---

## src/app/ - Core Application Types & Utilities

### src/app/types/ - Type Definitions

| File | LOC | Purpose |
|------|-----|---------|
| `maestro.ts` | 221 | **CANONICAL** Maestro domain types (tasks, sessions, projects) |
| `session.ts` | 44 | Terminal session types |
| `workspace.ts` | 18 | Workspace view types |
| `app.ts` | ~50 | App-level types |
| `app-state.ts` | ~40 | App state types |
| `storage.ts` | ~30 | Storage types |
| `recording.ts` | ~60 | Recording types |
| `index.ts` | 10 | Type exports |

### src/app/constants/ - Constants & Defaults

| File | LOC | Purpose |
|------|-----|---------|
| `defaults.ts` | ~100 | Default values for UI dimensions, settings |
| `storage.ts` | ~30 | localStorage key constants |
| `themes.ts` | ~50 | Theme color definitions |
| `index.ts` | 5 | Constant exports |

### src/app/utils/ - Utility Functions

| File | LOC | Purpose |
|------|-----|---------|
| `project.ts` | ~50 | Project utilities |
| `path.ts` | ~40 | Path manipulation utilities |
| `ssh.ts` | ~60 | SSH parsing and helpers |
| `string.ts` | ~30 | String utilities |
| `github.ts` | ~40 | GitHub integration utilities |
| `async.ts` | ~30 | Async utilities |
| `workspace.ts` | ~50 | Workspace utilities |
| `network.ts` | ~40 | Network utilities |
| `storage.ts` | ~50 | Storage utilities |
| `env.ts` | ~30 | Environment utilities |
| `id.ts` | ~20 | ID generation |
| `semver.ts` | ~40 | Version comparison |
| `index.ts` | 10 | Utility exports |

---

## src/components/ - React Components

### src/components/maestro/ - Maestro Task Management

| File | LOC | Purpose |
|------|-----|---------|
| `MaestroPanel.tsx` | 1047 | Main task management panel |
| `CreateTaskModal.tsx` | 631 | Task creation modal |
| `TaskListItem.tsx` | 961 | Task list item (recursive tree) |
| `TaskFilters.tsx` | 165 | Task filtering controls |
| `TaskStatusControl.tsx` | 166 | Task status dropdown |
| `TaskTimeline.tsx` | 111 | Task timeline display |
| `SessionDetailsSection.tsx` | 297 | Session details in task view |
| `SessionTimeline.tsx` | 269 | Session timeline display |
| `QueueSessionItem.tsx` | 265 | Queue session list item |
| `QueueStatusDisplay.tsx` | 197 | Queue status indicators |
| `SimpleSessionItem.tsx` | 299 | Simple session view |
| `TreeSessionItem.tsx` | 267 | Tree session view |
| `SessionInTaskView.tsx` | 229 | Session in task context |
| `MaestroSessionContent.tsx` | 390 | Session content viewer |
| `AgentSelector.tsx` | 122 | Agent selection dropdown |
| `StrategySelector.tsx` | 90 | Strategy selection dropdown |
| `StrategyBadge.tsx` | 95 | Strategy badge display |
| `TemplateEditor.tsx` | 271 | Template editor |
| `TemplateList.tsx` | 171 | Template list |
| `WorkOnModal.tsx` | 108 | Work on task modal |
| `AddSubtaskInput.tsx` | 95 | Add subtask input |
| `TimelineEvent.tsx` | 108 | Timeline event item |
| `ExecutionBar.tsx` | 72 | Execution progress bar |
| `SessionDetailModal.tsx` | ~300 | Session detail modal |

### src/components/app/ - App-Level Components

| File | LOC | Purpose |
|------|-----|---------|
| `AppWorkspace.tsx` | 236 | Main workspace container |
| `AppModals.tsx` | 914 | Modal manager (all modals) |
| `AppTopbar.tsx` | 366 | Top bar |
| `Sidebar.tsx` | 162 | Sidebar container |
| `RightPanel.tsx` | 74 | Right panel container |
| `Topbar.tsx` | 147 | Topbar component |
| `ResizeHandle.tsx` | 25 | Resize handle component |
| `index.ts` | 10 | Component exports |

### src/components/modals/ - Modal Components (15 files)

| File | LOC | Purpose |
|------|-----|---------|
| `ApplyAssetModal.tsx` | ~100 | Asset application dialog |
| `ConfirmActionModal.tsx` | ~80 | Generic confirmation dialog |
| `ConfirmDeleteProjectModal.tsx` | ~60 | Project delete confirmation |
| `ConfirmDeleteRecordingModal.tsx` | ~60 | Recording delete confirmation |
| `ManageTerminalsModal.tsx` | ~200 | Terminal management |
| `NewSessionModal.tsx` | ~300 | Create new terminal session |
| `PathPickerModal.tsx` | ~150 | File path selection |
| `PersistentSessionsModal.tsx` | ~200 | Persistent session list |
| `ProjectModal.tsx` | ~250 | Create/rename project |
| `RecordingsListModal.tsx` | ~200 | Recording list |
| `ReplayModal.tsx` | ~150 | Recording replay |
| `SecureStorageModal.tsx` | ~200 | Password/credential storage |
| `SshManagerModal.tsx` | ~300 | SSH connection manager |
| `StartRecordingModal.tsx` | ~100 | Start recording dialog |
| `UpdateModal.tsx` | ~150 | Version update notification |

### src/components/ - Other Components

| File | LOC | Purpose |
|------|-----|---------|
| `AgentShortcutsModal.tsx` | 160 | Agent shortcuts config |
| `AppRightPanel.tsx` | 232 | Right panel container |
| `AppSlidePanel.tsx` | 783 | Slide panel with tabs |
| `CodeEditorPanel.tsx` | 1166 | Monaco editor panel |
| `FileExplorerPanel.tsx` | 1391 | File explorer (commented out in workspace) |
| `InlineFolderBrowser.tsx` | ~200 | Folder picker component |
| `Icon.tsx` | 208 | Icon component |
| `ProjectTabBar.tsx` | 219 | Project tabs |
| `ProjectsSection.tsx` | 397 | Projects section |
| `QuickPromptsSection.tsx` | 53 | Quick prompts |
| `SessionsSection.tsx` | 583 | Sessions section |
| `ThemeSwitcher.tsx` | 37 | Theme switcher |
| `ZoomSetting.tsx` | 31 | Zoom control |

---

## src/contexts/ - React Contexts

| File | LOC | Purpose |
|------|-----|---------|
| `MaestroContext.tsx` | 528 | Maestro data context (tasks, sessions) |

---

## src/hooks/ - Custom React Hooks (42 hooks)

| File | LOC | Purpose |
|------|-----|---------|
| `useActive.ts` | 31 | Active state hook |
| `useActiveSession.ts` | 40 | Active session hook |
| `useAgentShortcuts.ts` | 48 | Agent shortcuts hook |
| `useAppInit.ts` | 782 | App initialization |
| `useAppLayout.ts` | 103 | App layout hook |
| `useAppLayoutResizing.ts` | 508 | Layout resizing |
| `useAppUpdate.ts` | 91 | App update checker |
| `useAssetManager.ts` | 262 | Asset management |
| `useEnvironmentManager.ts` | 138 | Environment management |
| `useKeyboardShortcuts.ts` | 537 | Keyboard shortcuts |
| `useMaestroSessions.ts` | 138 | Maestro sessions hook |
| `useMaestroWebSocket.ts` | 291 | Maestro WebSocket |
| `useNewSessionForm.ts` | 35 | New session form |
| `useNotifications.ts` | 83 | Notifications |
| `useOptimistic.ts` | 55 | Optimistic updates |
| `usePathPicker.ts` | 61 | Path picker |
| `usePersistentSessions.ts` | 182 | Persistent sessions |
| `useProjectManager.ts` | 458 | Project management |
| `usePromptManager.ts` | 124 | Prompt management |
| `usePromptSender.ts` | 124 | Prompt sending |
| `useQuickLaunch.ts` | 97 | Quick launch |
| `useRecentSessionManager.ts` | 88 | Recent sessions |
| `useRecordingManager.ts` | 338 | Recording management |
| `useReplayExecution.ts` | 137 | Replay execution |
| `useSecureStorageManager.ts` | 248 | Secure storage |
| `useSessionActions.ts` | 457 | Session actions |
| `useSessionLifecycle.ts` | 168 | Session lifecycle |
| `useSessionOrdering.ts` | 131 | Session ordering |
| `useSessionTasks.ts` | 53 | Session tasks |
| `useSshManager.ts` | 108 | SSH management |
| `useSshRootResolution.ts` | 102 | SSH root resolution |
| `useStatePersistence.ts` | 197 | State persistence |
| `useSubtaskProgress.ts` | 19 | Subtask progress |
| `useTaskBreadcrumb.ts` | 19 | Task breadcrumb |
| `useTaskSessionCount.ts` | 26 | Task session count |
| `useTaskSessions.ts` | 41 | Task sessions |
| `useTaskTree.ts` | 31 | Task tree |
| `useTasks.ts` | 40 | Tasks hook |
| `useTerminalSession.ts` | 94 | Terminal session |
| `useTrayManager.ts` | 181 | Tray management |
| `useWorkSpaceView.ts` | 228 | Workspace view |
| `useWorkspaceResizeEffect.ts` | 145 | Workspace resize |

---

## src/stores/ - Zustand State Stores (18 stores)

| File | LOC | Purpose |
|------|-----|---------|
| `initApp.ts` | 866 | **App initialization** - loads persisted state |
| `persistence.ts` | 210 | **Central persistence** - saves state to localStorage |
| `useSessionStore.ts` | 1393 | **Main store** - terminal session management |
| `useMaestroStore.ts` | 331 | **Maestro store** - tasks and sessions |
| `useProjectStore.ts` | 372 | Project management |
| `useWorkspaceStore.ts` | 287 | Workspace layouts |
| `useUIStore.ts` | 360 | UI state (sidebar, panels, modals) |
| `usePromptStore.ts` | 140 | Prompts |
| `useRecordingStore.ts` | 410 | Recordings |
| `useAssetStore.ts` | 292 | Assets |
| `useEnvironmentStore.ts` | 164 | Environments |
| `useAgentShortcutStore.ts` | 59 | Agent shortcuts |
| `useSshStore.ts` | 125 | SSH hosts |
| `usePersistentSessionStore.ts` | 107 | Persistent sessions |
| `useSecureStorageStore.ts` | 239 | Secure storage |
| `useThemeStore.ts` | 36 | Theme |
| `useZoomStore.ts` | 53 | Zoom level |
| `usePathPickerStore.ts` | 70 | Path picker |

---

## src/services/ - Service Layer

| File | LOC | Purpose |
|------|-----|---------|
| `maestroService.ts` | 80 | Maestro session operations |
| `sessionService.ts` | 74 | Terminal session operations via Tauri |
| `sshService.ts` | 0 | SSH operations (placeholder) |
| `terminalService.ts` | 77 | High-level terminal operations |

---

## src/utils/ - Utility Functions

| File | LOC | Purpose |
|------|-----|---------|
| `MaestroClient.ts` | 330 | **API client** - REST API for Maestro server |
| `claudeCliBuilder.ts` | ~100 | Claude CLI command builder |
| `domUtils.ts` | ~50 | DOM utilities |
| `maestroHelpers.ts` | ~100 | Maestro helpers |
| `workSpaceStorage.ts` | ~80 | Workspace storage |
| `formatters.ts` | ~60 | Formatters (date, time, etc.) |
| `serverConfig.ts` | 34 | Server URL configuration (API_BASE_URL, WS_URL, SERVER_URL) |
| `promptTemplate.ts` | ~70 | Prompt template utilities |

---

## src/assets/ - Static Assets

- Agent icons (Claude, Codex, Gemini)
- UI icons
- Images

---

## src/monaco/ - Monaco Editor Configuration

- Monaco editor setup and configuration

---

## src-tauri/ - Tauri Rust Backend

### src-tauri/src/

- PTY session management
- File system operations (local and SSH)
- System integration
- IPC command handlers

### src-tauri/bin/

- Bundled binaries (nu, zellij) for macOS

---

## spec/ - Documentation (This Directory)

| File | Purpose |
|------|---------|
| `TECHNICAL-SPECIFICATION.md` | Complete technical specification |
| `README.md` | Spec directory overview |
| `QUICK-REFERENCE.md` | Quick reference guide |
| `DATA-FLOW-DIAGRAMS.md` | Data flow diagrams |
| `FILE-INDEX.md` | This file |

---

## Summary Statistics

### By Category

| Category | Files | Approx LOC |
|----------|-------|------------|
| **Stores** | 18 | ~5,000 |
| **Components** | ~60 | ~12,000 |
| **Hooks** | 42 | ~6,000 |
| **Types** | 10 | ~1,000 |
| **Utils** | 20 | ~1,500 |
| **Services** | 4 | ~250 |
| **Styles** | 3 | ~8,200 |
| **Config** | 5 | ~100 |
| **Root** | 5 | ~500 |
| **Total** | ~170 | ~35,000 |

### Largest Files

| File | LOC | Category |
|------|-----|----------|
| `styles.css` | ~8,000 | Styles |
| `useSessionStore.ts` | 1,393 | Store |
| `FileExplorerPanel.tsx` | 1,391 | Component |
| `CodeEditorPanel.tsx` | 1,166 | Component |
| `MaestroPanel.tsx` | 1,047 | Component |
| `TaskListItem.tsx` | 961 | Component |
| `AppModals.tsx` | 914 | Component |
| `SessionDetailModal.tsx` | ~300 | Component |
| `initApp.ts` | 866 | Store |
| `AppSlidePanel.tsx` | 783 | Component |
| `useAppInit.ts` | 782 | Hook |
| `CreateTaskModal.tsx` | 631 | Component |
| `SessionTerminal.tsx` | 620 | Component |
| `SessionsSection.tsx` | 583 | Component |
| `CommandPalette.tsx` | 556 | Component |

### Key Metrics

- **Total Source Files**: ~170
- **Total Lines of Code**: ~35,000
- **TypeScript Files**: ~160
- **CSS Files**: 3
- **React Components**: ~60
- **Custom Hooks**: 42
- **Zustand Stores**: 18
- **Type Definition Files**: 10

---

## File Naming Conventions

### Components

- **PascalCase**: `MaestroPanel.tsx`, `TaskListItem.tsx`
- **Suffix**: `.tsx` for components with JSX

### Hooks

- **camelCase**: `useSessionStore.ts`, `useMaestroWebSocket.ts`
- **Prefix**: `use` for custom hooks
- **Suffix**: `.ts` for hooks without JSX

### Stores

- **camelCase**: `useSessionStore.ts`, `useMaestroStore.ts`
- **Prefix**: `use` for Zustand stores
- **Suffix**: `.ts`

### Types

- **camelCase**: `maestro.ts`, `session.ts`
- **Suffix**: `.ts` for type definitions

### Utils

- **camelCase**: `maestroHelpers.ts`, `claudeCliBuilder.ts`
- **Suffix**: `.ts`

### Styles

- **kebab-case**: `styles.css`, `styles-sessions.css`
- **Suffix**: `.css`

---

## Import Patterns

### Store Imports

```typescript
import { useSessionStore } from '../stores/useSessionStore';
import { useMaestroStore } from '../stores/useMaestroStore';
```

### Component Imports

```typescript
import { MaestroPanel } from './components/maestro/MaestroPanel';
import { TaskListItem } from './components/maestro/TaskListItem';
```

### Type Imports

```typescript
import type { MaestroTask, MaestroSession } from '../app/types/maestro';
import type { TerminalSession } from '../app/types/session';
```

### Utility Imports

```typescript
import { maestroClient } from '../utils/MaestroClient';
import { formatDate } from '../utils/formatters';
```

---

## Finding Files

### By Feature

**Task Management:**
- `src/components/maestro/MaestroPanel.tsx`
- `src/components/maestro/TaskListItem.tsx`
- `src/components/maestro/CreateTaskModal.tsx`
- `src/stores/useMaestroStore.ts`

**Terminal Sessions:**
- `src/SessionTerminal.tsx`
- `src/stores/useSessionStore.ts`
- `src/services/sessionService.ts`

**Projects:**
- `src/components/ProjectTabBar.tsx`
- `src/components/ProjectsSection.tsx`
- `src/stores/useProjectStore.ts`

**API Integration:**
- `src/utils/MaestroClient.ts`
- `src/services/maestroService.ts`
- `src/stores/useMaestroStore.ts` (WebSocket)

**Code Editor:**
- `src/components/CodeEditorPanel.tsx`
- `src/components/FileExplorerPanel.tsx`

**UI State:**
- `src/stores/useUIStore.ts`
- `src/stores/useWorkspaceStore.ts`

**Persistence:**
- `src/stores/persistence.ts`
- `src/stores/initApp.ts`

---

**Last Updated**: February 8, 2026
**Total Files Documented**: ~170
