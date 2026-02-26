# Maestro Server — Code Quality Report

**Date:** 2026-02-25
**Scope:** `maestro-server/` — ~11,000 lines TypeScript
**Reviewer:** Automated Senior Engineer Audit

---

## Executive Summary

| Dimension | Grade |
|-----------|-------|
| **Overall** | **C+** |
| API Architecture | B+ |
| TypeScript Quality | B- |
| Security | D |
| Database / Storage | B |
| Error Handling & Logging | B |
| Testing | D+ |
| Performance & Scalability | C+ |
| Docker & Deployment | C- |
| API Documentation | C |
| Open-Source Readiness | C- |

### Key Strengths
- Clean domain-driven architecture with proper separation (domain → application → infrastructure → api)
- Well-designed dependency injection container (`container.ts`) with interface-based wiring
- Comprehensive type-safe domain event system (`DomainEvents.ts`, `TypedEventMap`)
- Solid error hierarchy (`AppError` → `ValidationError`, `NotFoundError`, `BusinessRuleError`, etc.)
- Good WebSocket bridge with per-client subscription filtering

### Critical Issues
1. **Zod validation schemas exist but are never applied to any route** — all endpoints accept unvalidated input
2. **No authentication or authorization** on any API endpoint
3. **No rate limiting** — the server is fully open to abuse
4. **No `helmet`** or security headers
5. **Tests are broken** — they import a `Storage` class and old route modules (`../src/storage`, `../src/api/projects`) that no longer exist after the architecture refactor
6. **`zod` is imported in `validation.ts` but is not listed in `package.json` dependencies** — the module is a phantom dependency

---

## Detailed Findings

### 1. API Architecture

**Grade: B+**

| Finding | Severity | Details |
|---------|----------|---------|
| Clean layered architecture | Positive | Domain → Application → Infrastructure → API layers are well-separated |
| DI container pattern | Positive | `container.ts` wires all dependencies via interfaces — easy to swap implementations |
| Route factory pattern | Positive | `createProjectRoutes(service)` pattern enables testability |
| Duplicated error handlers | Medium | Every route file defines its own `handleError()` function with identical logic. Should be a shared middleware. |
| `/sessions/spawn` is 500+ lines | Medium | The spawn route handler (`sessionRoutes.ts:713-1208`) is a monolithic function mixing validation, business logic, manifest generation, CLI spawning, and event emission. Should be extracted into a `SpawnService`. |
| CORS bypass in production | High | `server.ts:49` — The CORS else-branch allows all origins: `callback(null, true); // For now, allow all origins`. This effectively disables CORS protection. |
| Route ordering risk | Low | `/sessions/spawn` (POST) must be registered before `/sessions/:id` to avoid route shadowing. Currently works but is fragile. |

### 2. TypeScript Quality

**Grade: B-**

| Finding | Severity | Details |
|---------|----------|---------|
| `strict: true` enabled | Positive | `tsconfig.json` has strict mode enabled |
| Proper interface contracts | Positive | `IProjectRepository`, `IEventBus`, `ILogger`, `IIdGenerator` — clean abstractions |
| 168 uses of `any` across 28 files | High | Excessive `any` usage, particularly in route handlers (`sessionRoutes.ts`: 37 occurrences), `LogDigestService` (24), and route error handlers (all typed `err: any`). |
| 16 uses of `as any` type assertions | Medium | In `container.ts:54`, `FileSystemTaskRepository.ts:75-79`, `sessionRoutes.ts:1052-1056` — bypassing type safety for mutations. |
| Filter objects typed as `any` | Medium | `taskRoutes.ts:28`: `const filter: any = {}` and `sessionRoutes.ts:280`: `const filter: any = {}` — should use `TaskFilter` / `SessionFilter` types. |
| `Record<string, any>` in domain types | Low | `types.ts:195` (`Team.metadata`), `SessionEvent.data` — some `any` is acceptable for extensible metadata, but should be `unknown` where possible. |

### 3. Security

**Grade: D**

| Finding | Severity | Details |
|---------|----------|---------|
| **No authentication** | Critical | Zero auth middleware. All endpoints are publicly accessible. No API key, JWT, or session-based auth. |
| **No authorization** | Critical | No RBAC, no scoping. Any client can delete any project/task/session. |
| **No rate limiting** | Critical | No `express-rate-limit` or equivalent. DoS trivial. |
| **No helmet** | High | No security headers (X-Frame-Options, CSP, etc.). |
| **CORS effectively disabled** | High | `server.ts:49` allows all origins regardless of the allowlist. |
| **Zod validation defined but unused** | Critical | `validation.ts` defines comprehensive schemas (`createTaskSchema`, `spawnSessionSchema`, etc.) but **no route imports or uses them**. All `req.body` is trusted raw. |
| Command injection surface | High | `sessionRoutes.ts:114` spawns a CLI process with arguments partially from user input (taskIds, skills, mode). While `safeId` regex exists in unused validation, the spawn endpoint does no input sanitization. |
| API keys passed through environment | Medium | `sessionRoutes.ts:1124-1137` copies `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. from server env to child processes. These could leak via `/sessions/:id` if env is included in response. |
| `json()` body parser has no size limit | Medium | `app.use(express.json())` — no `{ limit: '1mb' }` to prevent large payload attacks. |
| Team boundary check is good | Positive | `canCommunicateWithinTeamBoundary()` properly restricts inter-session messaging to parent/sibling scope. |

### 4. Database / Storage Access Patterns

**Grade: B**

| Finding | Severity | Details |
|---------|----------|---------|
| Repository pattern | Positive | Clean `IProjectRepository` / `ITaskRepository` / `ISessionRepository` interfaces |
| In-memory cache + file persistence | Positive | `Map<string, T>` for reads, JSON files for durability — good for single-instance use |
| Postgres config scaffolded | Positive | `Config.ts` supports `postgres` database type, though not yet implemented |
| Race conditions on concurrent writes | High | `FileSystemTaskRepository.update()` reads from Map, mutates in-place, writes to disk. Two concurrent updates to the same task will cause a lost-update. No locking or optimistic concurrency. |
| No write batching | Medium | Every mutation writes a full JSON file synchronously (per task/session). Under high load this will bottleneck on I/O. |
| `findAll()` returns mutable references | Medium | `FileSystemProjectRepository.findAll()` returns `Array.from(this.projects.values())` — consumers get direct references to cached objects. `SessionService.updateSession()` acknowledges this with snapshot comments but it's error-prone. |
| Migration pattern is inline | Low | `migrateTeamMemberTasks()` in `container.ts` is good practice but should be in a dedicated migrations module for extensibility. |

### 5. Error Handling & Logging

**Grade: B**

| Finding | Severity | Details |
|---------|----------|---------|
| Structured error hierarchy | Positive | `AppError` → `ValidationError` / `NotFoundError` / `BusinessRuleError` / `ConfigError` — excellent |
| Global error middleware | Positive | `server.ts:124-136` catches unhandled errors and formats them consistently |
| `toJSON()` on errors | Positive | Errors serialize cleanly for API responses |
| Structured logger interface | Positive | `ILogger` with levels, metadata, child loggers — well designed |
| Error handler duplication | Medium | Every route file re-implements `handleError()`. Should use global middleware or a shared helper. |
| Swallowed errors | Medium | Several `catch {}` blocks with no logging: `sessionRoutes.ts:973`, `sessionRoutes.ts:1047`, `container.ts:68`. Silent failures make debugging hard. |
| Error messages expose internals | Medium | `server.ts:133`: `message: err.message` in 500 responses leaks implementation details. Should use a generic message in production. |
| Graceful shutdown | Positive | `server.ts:155-187` handles SIGINT with timeout, WebSocket cleanup, and container shutdown. |

### 6. Testing

**Grade: D+**

| Finding | Severity | Details |
|---------|----------|---------|
| Test infrastructure exists | Positive | Jest configured with `ts-jest`, HTML reporter, coverage reporters |
| Test helpers are reusable | Positive | `TestDataDir`, `createTestProject()`, `createTestTask()` — good patterns |
| **Tests are broken/stale** | Critical | All test files import `Storage` from `../src/storage` and route modules from `../src/api/projects`, `../src/api/tasks`, `../src/api/sessions` — **these modules no longer exist**. The codebase was refactored to services/repositories but tests were never updated. |
| No unit tests for services | High | `ProjectService`, `TaskService`, `SessionService` have zero unit tests. |
| No unit tests for repositories | High | `FileSystemProjectRepository`, `FileSystemTaskRepository` have zero unit tests. |
| No WebSocket tests | Medium | `websocket.test.ts` exists as a `.d.ts` but the actual test file may be empty or stale. |
| No integration tests for the new architecture | High | No tests use `createContainer()` or the current route factories. |
| Test coverage unknown | Medium | With all tests broken, actual coverage is effectively 0%. |

### 7. Performance & Scalability

**Grade: C+**

| Finding | Severity | Details |
|---------|----------|---------|
| In-memory caching | Positive | All repositories maintain in-memory Maps — reads are O(1) by ID |
| Async/await throughout | Positive | Proper async patterns, no callback hell |
| Event-driven architecture | Positive | `InMemoryEventBus` with `Promise.all` for parallel handler execution |
| `findAll()` scans entire collection | Medium | `FileSystemTaskRepository.findAll()` iterates all tasks for filtering. At scale (10k+ tasks), needs indexing. |
| N+1 query pattern in spawn | Medium | `sessionRoutes.ts:859-870` loops `taskRepo.findById()` for each taskId; then loops again at line 1062. Should batch-fetch. |
| No connection pooling for future Postgres | Low | Postgres config exists but no pool implementation yet. |
| WebSocket broadcasts to all clients | Medium | `WebSocketBridge.broadcast()` iterates all clients per event. With many clients and high event frequency, this could bottleneck. |
| `EventEmitter` max listeners set to 100 | Low | `InMemoryEventBus` sets `setMaxListeners(100)` — adequate for current use but could be a limit with many subscriptions. |
| No response compression | Low | No `compression` middleware for API responses. |

### 8. Docker & Deployment Readiness

**Grade: C-**

| Finding | Severity | Details |
|---------|----------|---------|
| Dockerfile exists | Positive | Basic multi-step build with Node 18 Alpine |
| **No multi-stage build** | High | Dockerfile copies entire source + `node_modules` (including devDependencies) into the final image. Should use multi-stage: build in one stage, copy only `dist/` + production deps to final. |
| **`npm install` includes devDependencies** | High | `RUN npm install` should be `RUN npm ci --omit=dev` for production. |
| **No `.dockerignore`** | Medium | Missing `.dockerignore` — `node_modules`, `coverage`, `dist`, `.git` will be copied into build context. |
| **No health check in Dockerfile** | Medium | No `HEALTHCHECK` instruction, though `/health` endpoint exists. |
| No graceful shutdown for SIGTERM | Medium | Only `SIGINT` is handled in `server.ts`. Docker sends `SIGTERM` — the server won't shut down gracefully in containers. |
| Host binding `0.0.0.0` | Positive | `Config.ts` defaults to `0.0.0.0` — correct for containerized deployments. |
| No `.env.example` | Low | Environment variables are documented in Config but no `.env.example` file for developers. |
| Binary builds available | Positive | `build:binary` scripts for cross-platform PKG builds — good distribution story. |

### 9. API Documentation

**Grade: C**

| Finding | Severity | Details |
|---------|----------|---------|
| README covers basics | Positive | Quick start, endpoints list, configuration |
| **README is outdated** | High | Documents `PUT /api/tasks/:id` but actual route is `PATCH`. Lists a simplified project structure that doesn't match the current DDD layout. |
| No OpenAPI/Swagger | High | No machine-readable API specification. For an open-source project, this is expected. |
| No endpoint documentation for new features | Medium | Mail, teams, team members, ordering, workflow templates, spawn, modals — none documented in README. |
| Config options partially documented | Medium | README lists 3 env vars; `Config.ts` supports 15+. |
| JSDoc comments on interfaces | Positive | Domain interfaces (`IEventBus`, `ILogger`, `IIdGenerator`) have good JSDoc |
| Multiple spec/doc markdown files | Positive | `SPECIFICATION-COMPLETE.md`, `SPAWN-FLOWS-UPDATE.md`, `DOCUMENTATION-INDEX.md` exist |

### 10. Open-Source Readiness

**Grade: C-**

| Finding | Severity | Details |
|---------|----------|---------|
| MIT License declared | Positive | `package.json` says MIT (README says AGPL-3.0 — contradiction) |
| **License contradiction** | High | `package.json`: `"license": "MIT"` vs `README.md`: `"AGPL-3.0-only"`. Must be resolved. |
| **No CONTRIBUTING.md** | Medium | No contributor guide |
| **No CHANGELOG.md** | Medium | No changelog for tracking releases |
| **No LICENSE file** in server directory | Medium | Relies on root-level LICENSE |
| `"author": ""` in package.json | Low | No author attribution |
| No CI/CD configuration | Medium | No GitHub Actions, no lint/test/build pipeline |
| No linting configured | Medium | No ESLint/Prettier configuration for consistent code style |
| `zod` is a phantom dependency | High | Imported in `validation.ts` but not in `package.json` — will fail on clean install |
| Good code organization | Positive | Clean module boundaries, barrel exports, consistent file naming |

---

## Top 10 Actionable Recommendations

Prioritized by impact × effort ratio:

| # | Priority | Recommendation | Impact | Effort |
|---|----------|----------------|--------|--------|
| 1 | **Critical** | **Wire up Zod validation middleware** — Import and apply `validateBody()`, `validateParams()`, `validateQuery()` to all route handlers. Add `zod` to `package.json` dependencies. | Fixes input validation gap, prevents injection | Low |
| 2 | **Critical** | **Fix broken tests** — Update test files to use new service/repository architecture instead of the removed `Storage` class. Add unit tests for `ProjectService`, `TaskService`, `SessionService`. | Restores test safety net | Medium |
| 3 | **Critical** | **Add authentication middleware** — Implement API key or JWT-based auth. Even a simple shared secret (`X-API-Key` header) validated via middleware would be a massive improvement. | Prevents unauthorized access | Medium |
| 4 | **High** | **Add rate limiting** — `npm install express-rate-limit` and apply to all routes. Sensible defaults: 100 req/min for reads, 20 req/min for writes. | Prevents DoS | Low |
| 5 | **High** | **Add `helmet` middleware** — One line: `app.use(helmet())`. Instant security header improvements. | Security headers | Trivial |
| 6 | **High** | **Fix Dockerfile** — Multi-stage build, `npm ci --omit=dev`, add `.dockerignore`, add `HEALTHCHECK`, handle `SIGTERM`. | Production-ready containers | Low |
| 7 | **High** | **Fix CORS configuration** — Remove the `callback(null, true)` fallback. Actually reject unknown origins, or make it configurable via `Config.cors`. | Closes CORS bypass | Low |
| 8 | **Medium** | **Extract shared error middleware** — Replace per-route `handleError()` with a single Express error middleware. Ensure 500 responses don't leak `err.message` in production. | Code dedup, security | Low |
| 9 | **Medium** | **Reduce `any` usage** — Type route filters as `TaskFilter`/`SessionFilter`, type catch blocks as `catch (err: unknown)`, replace `Record<string, any>` with `Record<string, unknown>`. | Type safety | Medium |
| 10 | **Medium** | **Extract SpawnService** — Move the 500-line spawn handler from `sessionRoutes.ts` into `application/services/SpawnService.ts`. Separate concerns: validation, session creation, manifest generation, CLI execution, event emission. | Maintainability, testability | Medium |

---

## Positive Highlights

1. **Domain-Driven Design** — The codebase follows a clean DDD layered architecture. Domain interfaces are implementation-agnostic, making it straightforward to swap FileSystem repos for Postgres.

2. **Event-Driven Architecture** — The typed event bus (`DomainEvents.ts`) with a comprehensive `TypedEventMap` is well-designed. The WebSocket bridge automatically relays domain events to UI clients with per-session filtering.

3. **Dependency Injection** — `container.ts` centralizes all wiring. No service creates its own dependencies. This makes testing (once tests are fixed) straightforward via mocking.

4. **Error Hierarchy** — The `AppError` base class with semantic subclasses (`NotFoundError`, `ValidationError`, `BusinessRuleError`) maps cleanly to HTTP status codes and produces consistent API responses.

5. **Configuration Management** — `Config.ts` is well-structured with environment variable loading, validation, typed interfaces, and sensible defaults. The `fromObject()` factory enables test overrides.

6. **Graceful Shutdown** — The server handles `SIGINT` with a timeout, WebSocket cleanup, event bus teardown, and HTTP server close — good operational practice.

7. **Team Communication Boundaries** — `canCommunicateWithinTeamBoundary()` enforces that sessions can only message parent/sibling sessions, preventing cross-team information leakage.

8. **Session-Source Update Enforcement** — `TaskService.updateTask()` properly restricts what fields sessions can modify vs. what users can modify, preventing agents from escalating their own task priority/status.

---

*Report generated by automated code quality audit.*
