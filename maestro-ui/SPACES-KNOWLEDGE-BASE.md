# Spaces Knowledge Base — Maestro UI

> Created by the Spaces Engineer recruitment task (task_1771833864413_fm8x92r3r)
> Branch: `ui-v2`

---

## 1. What Is a Space?

A **space** is any content displayed in the **center area** of the app. The design plan (`UI-V2-DESIGN-PLAN.md`) defines four current/planned space types:

| Type | Description | How Created |
|------|-------------|-------------|
| **Session** | A Maestro agent session (terminal + agent metadata + task logs). The primary space type today. | Running a task, quick-start (Claude/Codex), or implicitly via Maestro spawning |
| **Terminal** | A raw shell terminal with no Maestro session overhead | Clicking "Terminal" in the + menu |
| **Whiteboard** | An Excalidraw drawing board. Currently a full-screen overlay; planned to become inline | Cmd/Ctrl+Shift+X, or whiteboard icon in left rail/spaces rail |
| **Doc** | A document viewer/editor (Phase 2 — not yet built) | Clicking a doc from a task, or "Doc" in the + menu |

> Note: `Board` (multi-project task board) is also available as an overlay (Cmd/Ctrl+Shift+B) but is not yet a first-class space type.

---

## 2. App Layout (ui-v2 branch)

The layout follows a **three-column structure**:

```
┌──────────────────────────────────────────────────────────────────┐
│  Project Tab Bar (top)                                            │
├──┬──────────────┬─────────────────────────────┬──────────────────┤
│  │              │                             │  Spaces Panel    │
│I │  Maestro     │     Active Space            │  (right, 48px    │
│C │  Sidebar     │     Content                 │   collapsed or   │
│O │  (expanded   │                             │   expandable)    │
│N │   or hidden) │     Terminal /              │                  │
│R │              │     Whiteboard /            │  [session list]  │
│A │              │     Board                   │                  │
│I │              │                             │                  │
│L │              │                             │                  │
└──┴──────────────┴─────────────────────────────┴──────────────────┘
```

- **Left**: `AppLeftPanel` = `IconRail` (48px, always visible) + optional `MaestroPanel` or `FileExplorerPanel`
- **Center**: `main > terminalArea` = `AppWorkspace` (terminals) + `TaskDetailOverlay` + `AppSlidePanel`
- **Right**: `SpacesPanel` = collapsed rail (48px) or expanded sessions list (variable width)

---

## 3. The Spaces Panel (Right Side)

### 3.1 Two Modes

**Collapsed (Rail mode)** — `spacesRailActiveSection === null`
- Component: `SpacesRail` inside `SpacesPanel`
- Width: `SPACES_RAIL_WIDTH = 48px` (constant in `defaults.ts`)
- Shows: small icon buttons for each open session + toggle button + "new session" button + whiteboard button
- Session icons show: agent icon image, OR a letter avatar (for Maestro sessions), OR a terminal icon
- Visual states per icon: `--working` (pulse ring), `--needsInput` (dot), `--completed` (checkmark), `--active` (right-side indicator bar)

**Expanded (Spaces panel mode)** — `spacesRailActiveSection === 'sessions'`
- Component: `SpacesPanelContent` wrapping `SessionsSection`
- Width: `rightPanelWidth` (default 320px, min 280px, max 1000px, persisted in localStorage)
- Shows: full session list with all session metadata

### 3.2 State Management

The toggle state lives in `useUIStore`:
```ts
spacesRailActiveSection: 'sessions' | null  // null = collapsed, 'sessions' = expanded
toggleSpacesPanel()                          // flips between the two
setSpacesRailActiveSection(section)
```

Persisted widths are in `localStorage`:
- Key: `agents-ui-right-panel-width-v1`
- Key: `agents-ui-session-order-by-project-v1` (drag-and-drop ordering)

---

## 4. Session (Space) Data Model

### 4.1 `TerminalSession` (UI runtime model — `src/app/types/session.ts`)

```ts
type TerminalSession = {
  id: string;             // Unique runtime ID (from Tauri backend)
  name: string;           // Display name
  command: string;        // The running command string
  cwd: string | null;     // Current working directory
  projectId: string;      // Parent project
  persistId: string;      // Stable ID for persistent sessions (survives restarts)
  persistent: boolean;    // True = tmux-style persistent terminal
  createdAt: number;      // Timestamp (ms)
  launchCommand: string | null;    // Command run at session start
  restoreCommand?: string | null;  // Command used to reconnect persistent sessions
  sshTarget: string | null;        // SSH host if this is an SSH session
  sshRootDir: string | null;       // Remote root dir for SSH workspace
  effectId?: string | null;        // Process effect ID (e.g. 'claude', 'codex')
  agentWorking?: boolean;          // True = agent is currently producing output
  processTag?: string | null;      // Short label for non-effect commands
  exited?: boolean;                // True = process has exited
  closing?: boolean;               // True = close in progress
  exitCode?: number | null;
  lastRecordingId?: string | null;
  recordingActive?: boolean;
  maestroSessionId?: string | null; // Links to a MaestroSession on the server
};
```

### 4.2 `PersistedTerminalSession` (localStorage/disk persistence model)

Same shape but without runtime fields; used to restore sessions across app restarts.

### 4.3 `MaestroSession` (server-side session, linked via `maestroSessionId`)

Stored in `useMaestroStore.sessions: Map<string, MaestroSession>`.
Key fields relevant to the spaces UI:
- `status`: `'spawning' | 'working' | 'idle' | 'completed' | 'failed' | 'stopped'`
- `mode`: `'worker' | 'coordinator' | 'coordinated-coordinator'`
- `taskIds`: list of task IDs assigned to this session
- `needsInput.active`: whether the session is waiting for user input
- `teamSessionId`: groups coordinator + workers into a team
- `spawnedBy`: parent coordinator session ID (fallback grouping)
- `teamMemberId`: the TeamMember profile this session uses
- `teamMemberSnapshot` / `teamMemberSnapshots`: avatar + name + agentTool for display
- `strategy` / `orchestratorStrategy`: the run strategy (e.g., `'simple'`, `'team'`)
- `metadata.agentTool`: `'claude-code' | 'codex' | 'gemini'`

---

## 5. Session State & Lifecycle

### 5.1 Store: `useSessionStore`

Located at `src/stores/useSessionStore.ts`.

```
State:
  sessions: TerminalSession[]         — All loaded sessions
  activeId: string | null             — Currently focused session
  hydrated: boolean                   — Has been loaded from persistence
  newOpen: boolean                    — "New session" form open
  sessionOrderByProject: Record<string, string[]>   — Drag-drop order per project
  recentSessionKeys: RecentSessionKey[]             — Recently used sessions

Key derived selectors (pure, call getState()):
  getActive()               — Active TerminalSession or null
  getActiveIsSsh()          — Is active session an SSH session?
  getProjectSessions(projectId)   — Sessions for a project
  getSortedSessions(projectId)    — Sorted by drag-drop order (or createdAt)
```

### 5.2 How Sessions Are Created

1. **User creates**: `onNewSubmit()` → `createSession()` → Tauri `create_session` invoke → adds to `sessions[]`
2. **Quick-start**: `quickStart(preset)` → same path, pre-fills command
3. **SSH connect**: `onSshConnect()` → `createSession()` with `launchCommand = ssh ...`
4. **Maestro spawns**: `handleSpawnTerminalSession(sessionInfo)` → direct Tauri `create_session` invoke, sets `maestroSessionId`
5. **Persistent attach**: `attachPersistentSession(persistId)` → `createSession()` with `persistent: true`
6. **Open terminal at path**: `handleOpenTerminalAtPath(path, provider, sshTarget)`

### 5.3 How Sessions Are Closed

`onClose(id)` → marks `closing: true` → `closeSession(id)` (Tauri) → if persistent, `kill_persistent_session` → removes from `sessions[]`

### 5.4 Agent Working Detection

`markAgentWorkingFromOutput(id, data)` — called on terminal output. Sets `agentWorking = true` if:
- Session has an `effectId` (recognized agent process)
- Output is "meaningful" (not just resize noise)
- Session isn't exited/closing

Then schedules an idle timer (from the effect's `idleAfterMs`) to reset `agentWorking = false`.

---

## 6. Session Ordering (Per-Project)

Sessions are ordered per project via drag-and-drop using `@dnd-kit/core`.

- State: `sessionOrderByProject: Record<projectId, persistId[]>` in `useSessionStore`
- Persisted: `localStorage` key `agents-ui-session-order-by-project-v1`
- Reorder action: `reorderSessions(draggedPersistId, targetPersistId)`
- Display order: `getSortedSessions(projectId)` sorts by order array, then by `createdAt` for unknown sessions

---

## 7. Team Grouping in the Spaces Rail/Panel

When Maestro runs a team (coordinator + workers), sessions are visually grouped together in the Spaces Rail and Spaces Panel.

Logic in `src/utils/teamGrouping.ts` (`buildTeamGroups` + `getGroupedSessionOrder`):

1. **Strategy 1** (explicit): Group by `MaestroSession.teamSessionId` — all sessions sharing the same `teamSessionId` form a group.
2. **Strategy 2** (fallback): Find sessions with `mode === 'coordinator'`, then match workers by `spawnedBy === coordinatorId`.

Each group gets a **color** from `TEAM_COLORS` (cycling). The coordinator appears first, workers below.

The `SpacesRail` wraps grouped sessions in `<div className="spacesRailTeamGroup">` with the group's border/background colors.

---

## 8. The Workspace Store (Per-Space Workspace State)

`useWorkspaceStore` (`src/stores/useWorkspaceStore.ts`) tracks **file explorer + code editor state per workspace**.

The key concept is the **workspace key**:
```ts
getActiveWorkspaceKey():
  - For local sessions: returns activeProjectId
  - For SSH sessions:  returns `ssh:${projectId}:${sshTarget}`
  - Fallback:          returns activeProjectId
```

Each workspace key maps to a `WorkspaceView`:
```ts
type WorkspaceView = {
  projectId: string;
  fileExplorerOpen: boolean;
  fileExplorerRootDir: string | null;
  fileExplorerPersistedState: FileExplorerPersistedState | null;
  codeEditorOpen: boolean;
  codeEditorRootDir: string | null;
  openFileRequest: CodeEditorOpenFileRequest | null;
  codeEditorActiveFilePath: string | null;
  codeEditorPersistedState: CodeEditorPersistedState | null;
  codeEditorFsEvent: CodeEditorFsEvent | null;
  editorWidth: number;
  treeWidth: number;
};
```

Persisted in localStorage via `src/stores/persistence.ts` (`initWorkspaceViewPersistence`).

---

## 9. The Whiteboard Space

Component: `ExcalidrawBoard` (`src/components/ExcalidrawBoard.tsx`)

Current behavior:
- Full-screen **overlay** rendered via `createPortal` into `document.body`
- Opened/closed via `showExcalidrawBoard` state in `App.tsx`
- Toggle shortcut: `Cmd/Ctrl+Shift+X`
- State persistence: `localStorage` key `maestro-excalidraw-scene-v1`
- Saves on changes with 300ms debounce
- Only one whiteboard exists (global, project-agnostic)

Planned (Phase 2, not yet built):
- Multiple whiteboard spaces, each inline in the center area
- Each whiteboard is a separate "space" with its own ID and persistence key
- Removing the overlay behavior

---

## 10. The Board Space

Component: `Board` (multi-project board, `src/components/maestro/MultiProjectBoard.tsx`)

Current behavior:
- Full-screen **overlay**, opened via `showMultiProjectBoard` state
- Toggle shortcut: `Cmd/Ctrl+Shift+B`
- Also accessible from `ProjectTabBar` > button
- Allows viewing tasks across all projects, changing task status, and starting Maestro sessions

---

## 11. How the Current Space Is Determined

The **active space** is determined by `useSessionStore.activeId`:

- `null`: No session — center shows empty state or nothing
- A session ID: That `TerminalSession` is the active space
  - `AppWorkspace` renders the terminal for that session
  - `SpacesRail` / `SessionsSection` highlights that session

Changing the active space: `setActiveId(id)` in `useSessionStore`.

Project-level "current space" tracking:
```
useProjectStore.activeProjectId — the active project
  + useSessionStore.activeId    — the active session within that project
```

The UI automatically shows only the sessions for the `activeProjectId` in the Spaces Panel (filtered in `App.tsx`):
```ts
const projectSessions = sessions.filter(s => s.projectId === activeProjectId);
```

---

## 12. Left Panel: Icon Rail + Maestro Sidebar

The left panel is managed by `AppLeftPanel` + `IconRail` + `useUIStore`.

### Icon Rail Sections

```ts
type IconRailSection = 'tasks' | 'members' | 'teams' | 'skills' | 'lists' | 'files' | null;
```

- Stored in: `useUIStore.iconRailActiveSection`
- Persisted: `localStorage` key `agents-ui-icon-rail-section-v1`
- Width: `ICON_RAIL_WIDTH = 48px` (always visible)
- Expanded sidebar width: `maestroSidebarWidth` (default 280px, min 200px, max 600px)
- Toggle: `toggleIconRailSection(section)` — clicking same section collapses, different section switches

The expanded sidebar shows either:
- `MaestroPanel` (for tasks/members/teams/skills/lists sections)
- `FileExplorerPanel` (for the 'files' section)

---

## 13. UI Store: Space-Related State (`useUIStore`)

```ts
// Spaces panel (right)
spacesRailActiveSection: 'sessions' | null
setSpacesRailActiveSection(section)
toggleSpacesPanel()

// Icon rail + left sidebar
iconRailActiveSection: IconRailSection
maestroSidebarWidth: number
setIconRailActiveSection(section)
toggleIconRailSection(section)
setMaestroSidebarWidth(width)
persistMaestroSidebarWidth(value)

// Task detail overlay (covers workspace center)
taskDetailOverlay: { taskId: string; projectId: string } | null
setTaskDetailOverlay(overlay)

// Layout sizing
rightPanelWidth: number          // Spaces panel expanded width
sidebarWidth: number             // Legacy (not currently primary)
```

---

## 14. Server / Backend Details

Sessions are backed by a **Tauri Rust backend**. The UI communicates via `invoke()` calls:

| Tauri Command | Purpose |
|---------------|---------|
| `create_session` | Create a new terminal session |
| `close_session` | Kill and clean up a session |
| `detach_session` | Detach from a session (persistent terminals) |
| `kill_persistent_session` | Kill a persistent (tmux-like) session |
| `write_to_session` | Write data (commands/input) to session stdin |
| `validate_directory` | Validate a path is an existing directory |
| `stop_session_recording` | Stop screen recording |
| `get_app_info` | Get app version/info |
| `allow_window_close` | Signal that the window can be closed |

The **Maestro server** is a separate HTTP/WebSocket server:
- HTTP: via `maestroClient` (REST API for tasks, sessions, teams, members, lists)
- WebSocket: `WS_URL` in `src/utils/serverConfig.ts` — real-time updates for task/session changes, sound events, input-needed notifications, agent modals

---

## 15. CSS Classes for Spaces

Key CSS classes (in `styles.css`):

**Spaces Panel container:**
- `.spacesPanel` — the aside element, right side
- `.spacesPanel--expanded` — when expanded to show session list
- `.spacesPanelContent` — inner container when expanded
- `.spacesPanelTitle` — "Spaces" heading text

**Spaces Rail (collapsed mode):**
- `.spacesRail` — the narrow 48px rail
- `.spacesRailSessions` — scrollable session icon list
- `.spacesRailTeamGroup` — colored border box grouping team sessions
- `.spacesRailSession` — individual session icon button
- `.spacesRailSession--active` — currently selected session
- `.spacesRailSession--working` — agent is working
- `.spacesRailSession--needsInput` — waiting for user input
- `.spacesRailSession--exited` — session has exited
- `.spacesRailSession--completed` — Maestro session completed
- `.spacesRailSessionPulse` — animated working pulse ring
- `.spacesRailSessionNeedsInput` — needs-input dot indicator
- `.spacesRailSessionCompleted` — completed checkmark indicator
- `.spacesRailSessionInitial` — letter avatar for maestro sessions
- `.spacesRailSessionInitial--maestro` — maestro-specific avatar style
- `.spacesRailSessionIcon` — agent icon image

**Session items (expanded panel):**
- `.sessionItem` — a single session in the list
- `.sessionItemActive` / `.sessionItemExited` / `.sessionItemClosing`
- `.sessionItemPersistent` / `.sessionItemSsh` / `.sessionItemDefault`
- `.sessionItemNeedsInput` — yellow highlight when needs input
- `.sessionItemRow` — flex row with icon + meta + actions
- `.sessionAgentIcon` — agent icon wrapper
- `.sessionAgentIcon__wrapper--live` — live (working) state
- `.sessionAgentIcon__liveDot` — green pulsing dot
- `.sessionMeta` — name + status container
- `.sessionName` — session name + chip + recording dot
- `.sessionItemActions` — close/log buttons area
- `.sessionItemStatusRow` — maestro status badges row
- `.sessionStatusBadge` — badge showing session status
- `.sessionItemTaskChips` — row of task progress chips
- `.sessionTaskChip` — individual task mini-badge

**Icon Rail (left):**
- `.iconRail` — the 48px left rail
- `.iconRailButton` — each icon button
- `.iconRailButton--active` — active/selected state
- `.iconRailActiveIndicator` — blue bar on active icon
- `.iconRailBadge` — count badge
- `.iconRailSpacer` — flex spacer to push bottom icons down

---

## 16. Phase Status (ui-v2 branch)

**Phase 1 — COMPLETE:**
- ✅ `IconRail` component created
- ✅ `AppLeftPanel` wrapper created
- ✅ `SpacesPanel` + `SpacesRail` created
- ✅ `App.tsx` restructured (left panel + center + right spaces panel)
- ✅ `SessionsSection` reused inside expanded SpacesPanel
- ✅ Resize handles for both left sidebar and right spaces panel
- ✅ All session functionality preserved (drag-drop, team grouping, maestro integration)

**Phase 2 — NOT STARTED:**
- ❌ Whiteboard as inline space (currently still an overlay)
- ❌ Doc space type
- ❌ `useSpacesStore` for non-session spaces
- ❌ New space toolbar with type buttons
- ❌ Multiple whiteboards
- ❌ Space switching transitions/animations

---

## 17. Key Files Quick Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main layout shell, wires all stores and components |
| `src/components/SpacesPanel.tsx` | Right panel outer shell (collapsed vs expanded) |
| `src/components/SpacesRail.tsx` | Collapsed 48px session icon list |
| `src/components/SessionsSection.tsx` | Expanded session list with full session items |
| `src/components/AppLeftPanel.tsx` | Left panel (icon rail + maestro/file sidebar) |
| `src/components/IconRail.tsx` | Vertical icon navigation (left) |
| `src/components/ExcalidrawBoard.tsx` | Whiteboard overlay (current) |
| `src/stores/useSessionStore.ts` | All session state + lifecycle actions |
| `src/stores/useUIStore.ts` | Layout state (panel visibility, widths, overlays) |
| `src/stores/useWorkspaceStore.ts` | Per-workspace file explorer + code editor state |
| `src/stores/useMaestroStore.ts` | Server-side tasks, sessions, teams, WebSocket |
| `src/services/sessionService.ts` | `createSession` / `closeSession` Tauri bridge |
| `src/utils/teamGrouping.ts` | Group sessions by coordinator/worker teams |
| `src/app/types/session.ts` | `TerminalSession` and `PersistedTerminalSession` types |
| `src/app/types/workspace.ts` | `WorkspaceView` type |
| `src/app/constants/defaults.ts` | All dimension constants + localStorage keys |
| `maestro-ui/UI-V2-DESIGN-PLAN.md` | Full design plan for the spaces restructure |
