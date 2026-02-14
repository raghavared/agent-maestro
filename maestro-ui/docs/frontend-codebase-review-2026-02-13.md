# Maestro UI Frontend Codebase Review

Date: 2026-02-13  
Scope: `maestro-ui` React + Tauri frontend, Zustand state layer, project structure

## Findings (Prioritized)

### 1) High: Critical modules are overly large and multi-responsibility
Large files combine UI rendering, orchestration logic, side effects, and integration concerns, increasing change risk and review cost.

Evidence:
- `maestro-ui/src/stores/useSessionStore.ts` (1268 lines)
- `maestro-ui/src/components/maestro/MaestroPanel.tsx` (917 lines)
- `maestro-ui/src/App.tsx` (547 lines)
- `maestro-ui/src/stores/initApp.ts` (777 lines)
- `maestro-ui/src/components/FileExplorerPanel.tsx` (1303 lines)

Code references:
- `maestro-ui/src/stores/useSessionStore.ts:70`
- `maestro-ui/src/App.tsx:46`
- `maestro-ui/src/components/maestro/MaestroPanel.tsx:225`

Impact:
- Harder debugging and regression isolation
- Higher onboarding cost
- Lower testability due to broad coupling

Recommendation:
- Split by domain action slices (session lifecycle, prompt dispatch, maestro session bridging, ordering)
- Extract pure helpers out of stores/components
- Keep React components mostly declarative and delegate mutations to typed action hooks

---

### 2) High: Partial migration leaves duplicate architecture paths
Codebase has both old and new initialization/state pathways, increasing drift and ambiguity.

Evidence:
- New initializer used in app: `maestro-ui/src/App.tsx:77` -> `initApp(...)`
- Old hook still present: `maestro-ui/src/hooks/useAppInit.ts:85`
- Legacy context provider still present but appears unused:
  - `maestro-ui/src/contexts/MaestroContext.tsx:162`
  - no usage found for `MaestroProvider` in `src`

Impact:
- Parallel implementations may diverge in behavior
- Dead code risk, maintenance overhead

Recommendation:
- Remove or archive legacy path (`useAppInit`, `MaestroContext`) after validating parity
- Add ADR note describing current canonical runtime path

---

### 3) Medium-High: Excessive production logging includes payload dumps
WebSocket handlers log full event payloads and verbose connection traces; session spawn flow logs env var metadata.

Evidence:
- Full payload logging: `maestro-ui/src/stores/useMaestroStore.ts:102`
- Additional verbose websocket logs: `maestro-ui/src/stores/useMaestroStore.ts:228`
- Env var logging: `maestro-ui/src/hooks/useMaestroSessions.ts:62`
- Spawn/session logs: `maestro-ui/src/services/maestroService.ts:24`

Impact:
- Potential sensitive metadata exposure in app logs
- Performance/noise impact in high-event workloads

Recommendation:
- Gate logs behind debug flag (`import.meta.env.DEV` or dedicated logger level)
- Redact payload fields (paths, env values, token-like strings)

---

### 4) Medium: Type safety is weakened in critical Maestro flows
Despite `strict: true`, key interaction paths still rely on `any`.

Evidence:
- `maestro-ui/src/components/maestro/MaestroPanel.tsx:225` (`taskData: any`)
- repeated `catch (err: any)` blocks in same file
- `maestro-ui/src/stores/useMaestroStore.ts:59` (`normalizeSession(session: any): any`)

Impact:
- Runtime shape errors possible on websocket/API schema changes
- Weak autocomplete and refactor safety

Recommendation:
- Introduce narrow DTO/guard layer for websocket events
- Replace `any` with discriminated union event types and typed error helpers

---

### 5) Medium: User-facing feature gap still uses blocking `alert(...)`
“Add task to existing session” remains stubbed with TODO + browser alert.

Evidence:
- `maestro-ui/src/hooks/useMaestroSessions.ts:34`
- `maestro-ui/src/hooks/useMaestroSessions.ts:36`

Impact:
- Incomplete UX for a core workflow
- Blocks automation and polished desktop behavior

Recommendation:
- Implement modal-based session picker integrated with existing terminal/session stores

---

### 6) Medium: Large commented-out feature blocks indicate unresolved UI direction
A significant file explorer branch is commented out in production code.

Evidence:
- `maestro-ui/src/components/app/AppWorkspace.tsx:177`

Impact:
- Reduces readability and maintainability
- Creates uncertainty about intended behavior

Recommendation:
- Remove commented block and track via issue/feature flag branch

---

### 7) Medium-Low: Heavy cross-store `getState()` usage increases hidden coupling
Stores frequently read from each other directly via module imports, creating implicit dependencies.

Evidence:
- Many cross-store accesses in `maestro-ui/src/stores/useProjectStore.ts`
- persistence fan-in in `maestro-ui/src/stores/persistence.ts:32`

Impact:
- Harder deterministic tests
- Higher risk of initialization order mistakes

Recommendation:
- Introduce explicit service layer for orchestration boundaries
- Keep stores domain-local; use composition hooks for cross-domain flows

---

### 8) Medium: Testing surface appears absent
No frontend test files detected and no `test` script in package scripts.

Evidence:
- `maestro-ui/package.json` scripts: no `test`
- Search did not find test/spec files under `maestro-ui/src`

Impact:
- High regression risk in refactors and event/state heavy logic

Recommendation:
- Add baseline unit tests for store actions and selectors
- Add integration tests for session spawn/update and persistence restore paths

## Strengths Observed

- Strong foundational typing mode enabled (`strict: true`) in `maestro-ui/tsconfig.json`
- Clear top-level separation by concern (`components/`, `stores/`, `hooks/`, `services/`, `app/types`)
- Tauri event integration and lifecycle cleanup are thoughtfully handled in initializer flow
- Persistence architecture is centralized and debounced (`maestro-ui/src/stores/persistence.ts`)

## Suggested Refactor Sequence

1. Establish canonical architecture and remove dead paths (`useAppInit`, unused context layer).  
2. Introduce logger abstraction + redaction and disable verbose logs in production.  
3. Slice `useSessionStore` and `MaestroPanel` into focused modules with typed action APIs.  
4. Replace `any` in websocket/task handling with validated DTOs.  
5. Add focused tests around store transitions and websocket event handling.

## Residual Risk

Because automated tests are not currently present, any broad refactor in session/maestro orchestration carries elevated regression risk unless test coverage is added first.
