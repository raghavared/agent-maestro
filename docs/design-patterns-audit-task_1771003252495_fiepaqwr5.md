# Design Patterns Audit: maestro-ui, maestro-server, maestro-cli

Date: 2026-02-13
Task: `task_1771003252495_fiepaqwr5`

## Scope
- `maestro-ui/src`
- `maestro-server/src`
- `maestro-cli/src`

## Executive Summary
The project demonstrates strong intentional architecture in `maestro-server` and good modular decomposition in `maestro-cli`. `maestro-ui` has robust state/event capabilities but shows architectural drift with duplicate realtime/state pipelines. The most significant risks are consistency and maintainability, not immediate correctness.

Overall assessment:
- Server design pattern maturity: High
- CLI design pattern maturity: Medium-High
- UI design pattern maturity: Medium
- Cross-project consistency: Medium

## Pattern Inventory

### 1) Layered / Clean Architecture (Strong in server)
Evidence:
- Clear domain/application/infrastructure boundaries in imports and wiring: `maestro-server/src/container.ts:1`, `maestro-server/src/container.ts:11`, `maestro-server/src/container.ts:74`
- API routes delegate to services, not repositories directly: `maestro-server/src/server.ts:85`, `maestro-server/src/server.ts:124`

Evaluation:
- Effective and consistently applied in server.
- Not mirrored in UI/CLI, which is acceptable, but cross-project docs should explicitly acknowledge architecture-by-component.

### 2) Dependency Injection / Composition Root (Server)
Evidence:
- Manual composition root creates and wires dependencies: `maestro-server/src/container.ts:64`
- Infrastructure behind interfaces: `maestro-server/src/container.ts:16`, `maestro-server/src/container.ts:40`

Evaluation:
- Good testability and swapability.
- Container is clean and easy to reason about.

### 3) Repository Pattern (Server)
Evidence:
- Repository interfaces in domain layer: `maestro-server/src/domain/repositories/ITaskRepository.ts:16`
- Filesystem implementations in infrastructure layer: `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts:13`

Evaluation:
- Strong abstraction boundaries.
- One leak exists: mutable entity references are returned from in-memory map.

### 4) Observer / Event-Driven Pattern (Server + UI)
Evidence:
- Typed event catalog: `maestro-server/src/domain/events/DomainEvents.ts:166`
- Event bus implementation with async fan-out: `maestro-server/src/infrastructure/events/InMemoryEventBus.ts:25`
- WebSocket bridge over event bus: `maestro-server/src/server.ts:163`
- UI event consumers: `maestro-ui/src/stores/useMaestroStore.ts:94`, `maestro-ui/src/hooks/useMaestroWebSocket.ts:152`

Evaluation:
- Good decoupling between command side and notification side.
- UI has duplicated observer stacks (store + hook/context), causing drift risk.

### 5) Factory Pattern (CLI)
Evidence:
- Agent tool selection factory: `maestro-cli/src/services/agent-spawner.ts:17`, `maestro-cli/src/services/agent-spawner.ts:35`

Evaluation:
- Clear and pragmatic.
- Easy to extend for new agent tools.

### 6) Strategy Pattern (CLI)
Evidence:
- Prompt generation by worker/orchestrator strategy: `maestro-cli/src/services/prompt-generator.ts:133`, `maestro-cli/src/services/prompt-generator.ts:232`, `maestro-cli/src/services/prompt-generator.ts:252`

Evaluation:
- Explicit strategy branching is understandable.
- Could evolve into pluggable strategy objects if branching grows.

### 7) Command Pattern (CLI command modules)
Evidence:
- Command registration by module: `maestro-cli/src/index.ts:144`
- Command permissions/guard service: `maestro-cli/src/services/command-permissions.ts:382`

Evaluation:
- Good separation of command concerns and policy concerns.

### 8) Singleton Usage (mixed quality)
Evidence:
- CLI default singleton spawner: `maestro-cli/src/services/agent-spawner.ts:98`
- UI API client singleton: `maestro-ui/src/utils/MaestroClient.ts:336`
- UI websocket singletons in two separate stacks:
  - `maestro-ui/src/stores/useMaestroStore.ts:16`
  - `maestro-ui/src/hooks/useMaestroWebSocket.ts:6`

Evaluation:
- Singleton itself is fine for shared resources.
- Duplicate singleton implementations for the same concern is high-maintenance.

## Architectural Patterns by Component

### maestro-server
- Predominant: layered clean architecture + DI + repository + observer.
- Strengths: strong separation, testability, explicit wiring.
- Weaknesses: entrypoint (`server.ts`) is becoming orchestration-heavy.

### maestro-cli
- Predominant: modular command architecture + factory + strategy.
- Strengths: extensible agent spawning, role/strategy policy control.
- Weaknesses: `index.ts` central file has grown and mixes bootstrap + command behavior.

### maestro-ui
- Predominant: centralized state store (Zustand) + event-driven websocket updates.
- Strengths: practical stateful UX model.
- Weaknesses: duplicated architecture path via legacy context provider and separate websocket stack.

## Anti-Patterns and Risks

### A1) Defined-but-unused validation layer (Server)
Evidence:
- Full Zod validation middleware and schemas defined: `maestro-server/src/api/validation.ts:62`, `maestro-server/src/api/validation.ts:204`
- Routes not applying middleware and relying on ad-hoc checks: `maestro-server/src/api/taskRoutes.ts:50`, `maestro-server/src/api/taskRoutes.ts:98`

Impact:
- Validation behavior differs per route.
- Inconsistent API contract enforcement and avoidable security risk.

Severity: High

### A2) Duplicate realtime/state architecture in UI
Evidence:
- Zustand store with websocket singleton and dispatch: `maestro-ui/src/stores/useMaestroStore.ts:16`, `maestro-ui/src/stores/useMaestroStore.ts:94`
- Separate websocket hook singleton and dispatcher: `maestro-ui/src/hooks/useMaestroWebSocket.ts:6`, `maestro-ui/src/hooks/useMaestroWebSocket.ts:112`
- Legacy context provider duplicates CRUD + websocket handling: `maestro-ui/src/contexts/MaestroContext.tsx:162`, `maestro-ui/src/contexts/MaestroContext.tsx:314`
- Context hook appears unused in app code: `maestro-ui/src/contexts/MaestroContext.tsx:522`

Impact:
- Architectural drift, higher cognitive load, inconsistent behavior possibility.

Severity: High

### A3) Leaky repository abstraction via mutable shared references
Evidence:
- Repository returns map entities directly: `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts:144`
- Service explicitly snapshots to work around mutation side effects: `maestro-server/src/application/services/TaskService.ts:102`, `maestro-server/src/application/services/TaskService.ts:171`

Impact:
- Hidden side effects and fragile invariants under future changes.

Severity: Medium

### A4) Security mismatch in CORS intent vs behavior
Evidence:
- Allowlist declared: `maestro-server/src/server.ts:37`
- Non-allowlisted origins still accepted: `maestro-server/src/server.ts:51`

Impact:
- Security posture is weaker than comments/config suggest.

Severity: Medium

### A5) God-file growth / mixed concerns
Evidence:
- Large mixed-concern files:
  - `maestro-ui/src/stores/useMaestroStore.ts` (453 LOC)
  - `maestro-ui/src/contexts/MaestroContext.tsx` (528 LOC)
  - `maestro-cli/src/index.ts` (245 LOC)
  - `maestro-server/src/server.ts` (217 LOC)

Impact:
- Slower onboarding and higher regression risk during edits.

Severity: Medium

## Consistency Review
- Pattern language consistency (naming/interfaces): Good in server and CLI.
- Error handling consistency: Mixed (good domain errors in server; ad-hoc checks in route layer).
- Event model consistency: Good at server level; duplicated consumers in UI reduce consistency.
- Boundary consistency (domain vs transport): Strong in server, weaker in UI (UI blends transport concerns, websocket transport, and app behaviors in same modules).

## Recommendations (Prioritized)

### Priority 1 (Immediate)
1. Enforce validation middleware in all server routes.
- Apply `validateBody/validateParams/validateQuery` from `maestro-server/src/api/validation.ts` across route modules.
- Remove duplicated manual validation branches once schemas cover them.

2. Consolidate UI websocket architecture to one path.
- Keep one source of truth (recommended: Zustand-based path in `useMaestroStore`).
- Deprecate/remove unused context-based path (`maestro-ui/src/contexts/MaestroContext.tsx`) or fully migrate to it, but not both.

### Priority 2 (Near-term)
3. Fix mutable repository boundary.
- Return cloned domain entities from repository getters, or enforce immutable domain models.
- Remove snapshot workaround from `TaskService` once repository semantics are safe.

4. Correct CORS behavior to match allowlist intent.
- Replace permissive fallback at `maestro-server/src/server.ts:51` with explicit rejection in non-dev environments.

### Priority 3 (Ongoing)
5. Split large files by concern.
- `useMaestroStore`: separate websocket transport, message reducers, and side effects (sound/notifications).
- `index.ts` (CLI): move top-level command handlers into modules.
- `server.ts`: split bootstrap/config/middleware/startup lifecycle.

6. Add architecture governance docs.
- Create an ADR documenting target architecture per component and explicit non-goals (e.g., UI uses store-centric architecture, not dual context/store).

## Suggested Follow-up Work Items
1. `server`: “Apply Zod middleware to all API routes and remove ad-hoc validation duplication.”
2. `ui`: “Decommission MaestroContext and unify websocket/event handling under one store architecture.”
3. `server`: “Repository immutability pass (clone-on-read) + regression tests around event transition logic.”
4. `server`: “Harden CORS policy by environment.”
5. `cross-project`: “Architecture consistency ADR and review checklist for future PRs.”

