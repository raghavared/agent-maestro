# Maestro UI Frontend Architecture Review

Date: 2026-02-13
Scope: `maestro-ui` React + Zustand + Tauri frontend architecture

## Review Focus
- Component hierarchy and app shell composition
- State management architecture
- Tauri ↔ React integration and command boundaries
- Frontend ↔ backend communication patterns (REST + WebSocket)
- End-to-end application flow for task/session execution
- Strengths, risks, and prioritized improvements

## High-Level Architecture

```mermaid
flowchart LR
  UI[React UI Components]\n(App.tsx + panels/modals) --> ZS[Zustand Stores]\n(session/project/ui/maestro/...)
  ZS --> TAURI[Tauri invoke/listen]\n(Rust commands + events)
  ZS --> REST[MaestroClient REST]\n(/api)
  ZS --> WS[Global WebSocket]\n(useMaestroStore)

  TAURI --> PTY[PTY + FS + Secure Storage]\n(src-tauri)
  REST --> SERVER[maestro-server]
  WS --> SERVER

  SERVER -->|session:spawn| ZS
  ZS -->|handleSpawnTerminalSession| TAURI
```

## Component Hierarchy (Active Path)

Primary runtime composition is centered in `App.tsx`:
- `ProjectTabBar` (project switching + status)
- Left area in `App.tsx` (sessions + prompts inline)
- Main workspace: `AppWorkspace` (terminal + editor/file panels)
- Right area: `AppRightPanel` → `MaestroPanel` or `FileExplorerPanel`
- Global overlays: `AppModals`, `AppSlidePanel`, `CommandPalette`, startup + confirm dialogs

Key architectural observation:
- There are parallel/legacy component variants not used in active flow:
  - `src/components/app/Sidebar.tsx`
  - `src/components/app/Topbar.tsx`
  - `src/components/app/RightPanel.tsx`
- Active runtime uses `AppRightPanel.tsx` and inline sidebar rendering in `App.tsx`.

## State Management Architecture

Pattern: domain-sliced Zustand stores with cross-store coordination.

Core stores:
- `useSessionStore`: terminal/session lifecycle, spawn/close, prompt send, replay, Maestro session terminal spawn bridge
- `useProjectStore`: project CRUD/select/reopen/close and active-session mapping
- `useMaestroStore`: REST cache for tasks/sessions + singleton WebSocket event ingestion
- Supporting stores: `useUIStore`, `useWorkspaceStore`, `useSshStore`, `useSecureStorageStore`, etc.

Initialization pipeline:
- `App.tsx` bootstraps `initApp`, `initCentralPersistence`, `initWorkspaceViewPersistence`, `initActiveSessionSync`, `initTheme`, `initZoom`
- `initApp` is the runtime orchestrator: listener setup, persisted-state load, server sync, session restore, orphan reconciliation

Persistence model:
- Central debounced persistence in `stores/persistence.ts` writes to Tauri persisted state
- Workspace view persists separately to localStorage
- Session persistence includes mapping to backend PTY session IDs (`backendSessionId`)

## Tauri-React Integration Patterns

JS→Rust commands (invoke):
- PTY lifecycle: `create_session`, `write_to_session`, `close_session`, `resize_session`, etc.
- Filesystem/local+ssh operations
- secure storage (`prepare_secure_storage`, `reset_secure_storage`)
- tray/window integrations

Rust→JS events (listen):
- `pty-output`, `pty-exit`, `app-menu`, `tray-menu`

Boundary quality:
- Rust command surface is explicit and centralized in `src-tauri/src/main.rs` invoke handler
- File operations enforce root/path constraints (`files.rs`, `ssh_fs.rs`)
- Secure storage uses keychain-backed encryption primitives (`secure.rs`)

## Frontend ↔ Backend Communication

REST:
- `utils/MaestroClient.ts` wraps all `/api` endpoints for projects/tasks/sessions/templates/docs

WebSocket:
- Active channel is centralized in `useMaestroStore` (`WS_URL`)
- Handles `task:*`, `session:*`, `notify:*`, and `session:spawn`
- On `session:spawn`, store delegates to `useSessionStore.handleSpawnTerminalSession` to create local PTY terminal

Spawn flow (current implementation):
1. UI action (`MaestroPanel`) calls `createMaestroSession` (`services/maestroService.ts`)
2. POST `/sessions/spawn`
3. server emits `session:spawn`
4. `useMaestroStore` receives event
5. `useSessionStore.handleSpawnTerminalSession` creates Tauri terminal with command/env

## Application Flow (Startup)

`initApp` performs:
1. Start Maestro WebSocket
2. Register PTY/event listeners
3. Resolve home/startup flags
4. Initialize secure storage if needed
5. Load persisted state
6. Sync projects with server
7. Restore/reconnect terminal sessions
8. Reconcile orphan server sessions
9. Hydrate active session and set running state

This is robust and operationally pragmatic for desktop resilience.

## Architectural Decisions Observed

1. Zustand as primary state backbone
- Decision: state moved from React context/hooks to store-centric architecture
- Result: simpler cross-panel state sharing and deterministic startup orchestration

2. Dual transport model (REST + WebSocket)
- Decision: REST for commands/fetch, WS for live updates and spawn events
- Result: decoupled command/query model with real-time consistency

3. CLI-first worker execution
- Decision: UI spawns terminal workers; CLI handles worker/session internals
- Result: frontend remains orchestration/UI layer, not agent-runtime layer

4. Tauri command boundary for privileged operations
- Decision: file/pty/secure APIs through Rust commands
- Result: clear security and platform boundary

## Strengths

- Clear domain slices in state with practical ownership boundaries
- Strong startup/restore path, including PTY reconnection and orphan cleanup
- Well-defined Tauri boundary and command catalog
- Real-time update architecture integrated deeply into task/session UI
- Security-aware storage design (keychain + encrypted payloads)
- Server URL derivation reduces WS/API drift risk (`serverConfig.ts`)

## Areas for Improvement

1. Architecture drift and dead paths
- `MaestroContext` and `useMaestroWebSocket` appear legacy and unused by active app composition
- Unused alternate app shell components still exist (`Sidebar`, `Topbar`, `RightPanel`)
- Impact: higher cognitive load, onboarding friction, risk of regressions from editing wrong path

2. Excessive runtime logging in hot paths
- `useMaestroStore` and `useSessionStore.handleSpawnTerminalSession` log heavily with large payloads
- Impact: noisy dev diagnostics, performance overhead in high event throughput, harder signal/noise

3. Cross-store coupling via module-level refs/getState
- Several stores depend on runtime refs and direct `getState()` cross-calls
- Impact: works, but reduces testability and can hide action ordering assumptions

4. Persistent session feature mismatch
- UI still exposes persistent-terminal actions while Rust backend now returns unsupported behavior (`kill_persistent_session` errors)
- Impact: user-visible confusion and avoidable error paths

5. Type/system inconsistency in persistence mapping
- Explicit TS↔Rust shape workaround for project `name/title` in `persistence.ts`
- Impact: schema mismatch risk and weaker compile-time guarantees

## Prioritized Recommendations

1. Consolidate to one active architecture path
- Remove or quarantine unused `MaestroContext`, `useMaestroWebSocket`, and inactive app-shell components
- Add one short ARCHITECTURE.md that declares active runtime composition

2. Introduce structured logging levels
- Gate verbose logs behind `import.meta.env.DEV` and add lightweight logger utility
- Keep event payload logging opt-in only

3. Formalize spawn/session state machine
- Document and enforce states across REST + WS + local session creation (pending/spawning/attached/exited)
- Include duplicate-spawn guarantees and timeout behavior

4. Align UI capabilities with backend support
- Hide or disable persistent-session controls when backend support is off
- Surface explicit capability checks from backend at startup

5. Normalize persistence schema contracts
- Define a shared schema contract for persisted project/session payloads
- Remove `as any` mapping once aligned

## Suggested Next Refactors (Low-Risk Sequence)

1. Observability cleanup
- Add logger wrapper and replace direct `console.*` in stores

2. Dead-path cleanup
- Remove `MaestroContext` flow and unused app shell variants after confirming no imports

3. Capability-driven UI
- Add startup capability probe and conditionally render unsupported controls

4. Persistence contract hardening
- Introduce typed conversion layer for Rust persisted payloads

## File Anchors (Primary Evidence)

- `maestro-ui/src/App.tsx`
- `maestro-ui/src/stores/initApp.ts`
- `maestro-ui/src/stores/useSessionStore.ts`
- `maestro-ui/src/stores/useProjectStore.ts`
- `maestro-ui/src/stores/useMaestroStore.ts`
- `maestro-ui/src/stores/persistence.ts`
- `maestro-ui/src/services/maestroService.ts`
- `maestro-ui/src/utils/MaestroClient.ts`
- `maestro-ui/src-tauri/src/main.rs`
- `maestro-ui/src-tauri/src/pty.rs`
- `maestro-ui/src-tauri/src/files.rs`
- `maestro-ui/src-tauri/src/ssh_fs.rs`
- `maestro-ui/src-tauri/src/secure.rs`

