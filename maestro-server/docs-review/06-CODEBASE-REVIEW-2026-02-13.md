# Maestro Server Codebase Review (2026-02-13)

## Scope
Reviewed `maestro-server` structure and implementation across:
- Express server bootstrap and middleware
- WebSocket bridge and domain event propagation
- API route handlers
- Application services
- File-system repositories and data model usage
- TypeScript setup and test baseline

## Architecture and Implementation Patterns
- Layering is clear and mostly consistent: `api -> application/services -> domain interfaces -> infrastructure implementations`.
- Dependency injection through `createContainer()` keeps construction centralized.
- Domain events are used pervasively for cross-cutting notifications and WebSocket propagation.
- Persistence uses in-memory maps backed by per-entity JSON files in repository classes.
- Error model is centralized (`AppError` hierarchy), but route-level handling duplicates behavior and bypasses global middleware.

## Findings

### High

1. CORS policy is effectively allow-all while `credentials: true` is enabled.
- Evidence: `maestro-server/src/server.ts:35` to `maestro-server/src/server.ts:52` always calls `callback(null, true)` even for untrusted origins.
- Evidence: `maestro-server/src/server.ts:54` enables `credentials: true`.
- Impact: Any website origin can make credentialed cross-origin requests to the API.
- Recommendation: Reject unknown origins (`callback(new Error(...), false)` or `callback(null, false)`) and drive allowlist from `Config.cors.origins`.

2. Input validation layer exists but is not applied to routes.
- Evidence: validation schemas/middleware exist in `maestro-server/src/api/validation.ts:204`.
- Evidence: no usages found for `validateBody/validateParams/validateQuery` in `src`.
- Impact: Most endpoints accept unsanitized/untyped payloads, increasing invalid state and security risk.
- Recommendation: Add schema middleware per endpoint, starting with mutating routes (`POST/PATCH/PUT`) and IDs/query filters.

3. Session spawn can leave orphaned `spawning` sessions on manifest-generation failure.
- Evidence: session created before manifest generation at `maestro-server/src/api/sessionRoutes.ts:487`.
- Evidence: on manifest failure, endpoint returns 500 at `maestro-server/src/api/sessionRoutes.ts:563` to `maestro-server/src/api/sessionRoutes.ts:569` without rollback.
- Impact: Stale sessions accumulate and UI/state can show sessions that never actually spawned.
- Recommendation: on failure, either delete the session or mark status `failed` with an error event/timeline entry.

4. Event contract drift causes missed real-time notifications.
- Evidence: `TaskService` emits `notify:task_in_review` at `maestro-server/src/application/services/TaskService.ts:161`.
- Evidence: `WebSocketBridge` subscriptions do not include `notify:task_in_review` in `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts:64` to `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts:89`.
- Evidence: `TypedEventMap` in `maestro-server/src/domain/events/DomainEvents.ts:166` to `maestro-server/src/domain/events/DomainEvents.ts:191` omits `notify:task_in_review`.
- Impact: clients miss expected notification events; type contracts and runtime behavior diverge.
- Recommendation: make event names a single source of truth and generate bridge subscriptions from that source.

5. Test suite is broken and still references removed modules.
- Evidence: `npm test` fails because tests import `../src/storage` and `../src/websocket` (missing).
- Impact: no automated regression safety net for API/service changes.
- Recommendation: either port tests to current architecture (`container + routes + services`) or remove obsolete suites and replace with current integration tests.

### Medium

1. Extensive `any` usage weakens TypeScript guarantees in critical boundaries.
- Evidence: pervasive `catch (err: any)` and `filter: any` in routes, e.g. `maestro-server/src/api/sessionRoutes.ts:135`, `maestro-server/src/api/sessionRoutes.ts:172`, `maestro-server/src/api/taskRoutes.ts:28`.
- Impact: type-safety is reduced exactly at API/deserialization boundaries where validation should be strongest.
- Recommendation: use `unknown` in catches, narrow with helpers, and strongly type request DTOs after schema validation.

2. Error handling is duplicated in each route file.
- Evidence: repeated `handleError` helper in all route modules (project/task/session/queue/template).
- Impact: inconsistent behavior risk and maintenance overhead.
- Recommendation: use an async route wrapper and central global error middleware.

3. Repository reads return mutable references from in-memory maps.
- Evidence: `findById` returns direct object refs, e.g. `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts:142`, `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts:141`.
- Impact: accidental mutation outside repository methods can bypass invariants and persistence semantics.
- Recommendation: return cloned objects or immutable views; enforce updates through repository methods only.

4. Logging mixes structured logger with many `console.log` debug statements.
- Evidence: large volume of direct console calls in `server.ts`, `sessionRoutes.ts`, `TaskService.ts`, `SessionService.ts`, and `WebSocketBridge.ts`.
- Impact: noisy logs, inconsistent formatting, and harder production observability.
- Recommendation: route all logs through `ILogger` with levels and redact sensitive payload fields.

## Code Organization Assessment
- Positive: folder organization is coherent and easy to navigate.
- Positive: service and repository interfaces are separated cleanly from implementations.
- Gap: routes currently contain substantial business/process logic (especially `sessionRoutes.ts` spawn flow), reducing cohesion.
- Recommendation: extract spawn orchestration into an application service to reduce route complexity and improve testability.

## Data Model and Storage Assessment
- Positive: JSON persistence format is simple and transparent for local/dev workflows.
- Risk: no file-locking or atomic-write strategy; concurrent writes may race and corrupt state in multi-process scenarios.
- Recommendation: add atomic temp-file write + rename, and define single-writer guarantees or migrate to database backend for concurrent deployments.

## Summary Verdict
- Overall quality: moderate, with clear architectural intent and good layering foundations.
- Production readiness risks are concentrated in boundary hardening: CORS, validation enforcement, event-contract consistency, and outdated tests.
