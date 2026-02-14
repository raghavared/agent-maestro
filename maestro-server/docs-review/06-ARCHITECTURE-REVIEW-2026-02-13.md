# Maestro Server Architecture Review

Date: 2026-02-13
Scope: `maestro-server` API design, WebSocket communication, data flow, request/response handling, and system integration.

## Executive Summary

`maestro-server` has a clean layered architecture (API -> application services -> repositories) and uses domain events to decouple state changes from real-time delivery. The main risks are around trust boundaries and scale behavior: unauthenticated global WebSocket broadcast, permissive CORS, inconsistent event contract coverage, and filesystem repository concurrency limits.

## Current Architecture

- Entry point: `src/server.ts` wires Express routes, WebSocket server, and a DI container.
- Container: `src/container.ts` composes config, in-memory event bus, filesystem repositories, services, and skill loader.
- API layer: route modules per bounded area (`projects`, `tasks`, `sessions`, `queue`, `skills`, `templates`).
- Application layer: services enforce business rules and emit domain/notification events.
- Integration layer: `WebSocketBridge` subscribes to domain events and broadcasts to clients.
- Persistence: filesystem-backed repositories with in-memory maps and per-entity JSON files.

## Strengths

- Clear separation of concerns and dependency inversion via interfaces (`domain/*` contracts).
- Event-driven integration between services and WebSocket bridge keeps UI updates near real time.
- Session/task coordination logic is explicit and robust for many common lifecycle flows.
- Queue strategy is encapsulated cleanly (`QueueService` + queue-specific routes).
- Error model (`AppError` hierarchy) is applied across route handlers for structured responses.

## Findings (By Severity)

### High

1. Unauthenticated, unscoped WebSocket broadcast leaks cross-project/session data.
- Evidence:
  - WebSocket server accepts all connections with no auth/tenant check: `src/server.ts:164`.
  - Every subscribed event is broadcast to all connected clients: `src/infrastructure/websocket/WebSocketBridge.ts:113`.
- Impact:
  - Any connected client can receive all project/task/session updates and notification payloads.
  - This breaks data isolation and becomes a security/privacy risk in multi-user deployments.
- Recommendation:
  - Require auth at handshake (token/session cookie).
  - Introduce subscription scoping (project/session/task channels).
  - Broadcast only to authorized channel subscribers.

2. CORS policy currently allows any origin despite allowlist.
- Evidence:
  - Non-allowlisted origins still get `callback(null, true)`: `src/server.ts:51`.
  - Config supports `cors.origins` but server middleware hardcodes origins and does not use `config.cors`: `src/infrastructure/config/Config.ts:125`, `src/server.ts:34`.
- Impact:
  - Browser clients from arbitrary origins can access API endpoints if credentials policy permits.
- Recommendation:
  - Enforce deny-by-default for unknown origins.
  - Use `config.cors` centrally and keep env-driven per environment.

3. Event contract drift causes dropped notifications (`notify:task_in_review`).
- Evidence:
  - Event emitted by service: `src/application/services/TaskService.ts:161`.
  - `notify:task_in_review` missing from typed event map used by WebSocket bridge event list: `src/domain/events/DomainEvents.ts:166`.
  - Bridge subscribes only to enumerated `EventName[]`: `src/infrastructure/websocket/WebSocketBridge.ts:64`.
- Impact:
  - In-review notifications are emitted but never bridged to clients.
  - Creates silent UX inconsistency and debugging difficulty.
- Recommendation:
  - Add missing event to `TypedEventMap` and bridge subscription list.
  - Add event-contract tests to ensure emitted notification events are bridged.

### Medium

4. Validation layer exists but is not wired into route handlers.
- Evidence:
  - Zod schemas + middleware exist: `src/api/validation.ts:204`.
  - No route file applies `validateBody/validateParams/validateQuery` (codebase search).
- Impact:
  - Inconsistent request shape validation and weaker boundary protection.
  - Higher risk of malformed payloads propagating into service layer.
- Recommendation:
  - Attach validation middleware per route, beginning with high-risk endpoints (`/sessions/spawn`, task/session update routes, queue mutations).

5. `/sessions/spawn` parent session verification swallows all errors as 404.
- Evidence:
  - Broad `catch` converts any exception to `parent_session_not_found`: `src/api/sessionRoutes.ts:422`.
- Impact:
  - Operational/debug signals are lost (I/O or repository failures appear as "not found").
- Recommendation:
  - Only map `NotFoundError` to 404; propagate/log other exceptions as 500.

6. Filesystem repository model is single-process oriented and non-atomic under concurrency.
- Evidence:
  - Repository state stored in mutable in-memory maps and rewritten directly to JSON files (`writeFile`): `src/infrastructure/repositories/FileSystemSessionRepository.ts:88`, `src/infrastructure/repositories/FileSystemTaskRepository.ts:144`, `src/infrastructure/repositories/FileSystemTaskRepository.ts:191`.
- Impact:
  - Multi-process deployment can produce lost updates.
  - Crash during write can leave partial/corrupted file state.
- Recommendation:
  - Short term: atomic write pattern (`tmp + rename`) and per-entity write queue/lock.
  - Medium term: migrate to transactional DB adapter (Postgres) behind existing repository interfaces.

7. List endpoints return unbounded collections; no pagination/cursors.
- Evidence:
  - Direct full-list responses in routes/services: `src/api/taskRoutes.ts:42`, `src/api/projectRoutes.ts:26`, `src/api/sessionRoutes.ts:184`.
- Impact:
  - Throughput degradation and large payloads as data grows.
- Recommendation:
  - Add `limit/offset` or cursor pagination + default caps and indexes (for DB-backed future).

### Low

8. README WebSocket usage advertises subscribe channel semantics not implemented in bridge.
- Evidence:
  - README example sends `{ type: 'subscribe', channel: 'tasks' }`: `README.md`.
  - Bridge only handles `ping` and ignores subscription semantics: `src/infrastructure/websocket/WebSocketBridge.ts:48`.
- Impact:
  - Consumer confusion and integration mismatch.
- Recommendation:
  - Either implement subscription protocol or update README/docs to current behavior.

## Scalability and Maintainability Assessment

- Scalability (current): acceptable for single-node/small-team usage.
- Scalability (future): constrained by all-client WS fan-out, full in-memory list operations, and filesystem persistence model.
- Maintainability: generally good due to layering and service boundaries; weakened by duplicated route-level error handling and missing standardized request validation usage.

## Recommended Roadmap

1. Security hardening (immediate)
- Add WS authentication + scoped subscriptions.
- Enforce strict CORS from config.
- Wire input validation middleware on all mutation endpoints.

2. Reliability and consistency (near term)
- Fix missing `notify:task_in_review` event contract.
- Improve spawn error classification/logging.
- Add contract tests for event emission -> WebSocket delivery.

3. Scale readiness (mid term)
- Add pagination to list APIs.
- Introduce atomic file writes + write serialization.
- Implement Postgres repository adapter and runtime selection by `DATABASE_TYPE`.

## Architectural Decision Quality

- Good decisions:
  - Dependency inversion and repository abstraction make storage migration feasible.
  - Event-driven bridge reduces coupling between domain state and delivery mechanism.
- Decisions to revisit:
  - Global WS broadcast without subscription/auth.
  - Filesystem persistence as default for production scale profiles.
