# Backend Features (User-Facing)

This backend is designed to keep projects, tasks, sessions, and team members consistent across CLI, UI, and agent runtimes.

## API and Service Modules

### Purpose
Provide stable endpoints for project and execution workflows while centralizing business rules in services.

### What users get
- Predictable CRUD for projects, tasks, sessions, team members, ordering, and inter-session mail.
- Session spawn flow that builds a manifest and starts agent work with the right context.
- Consistent validations and error responses.

### Tech shape
- API routes in `maestro-server/src/api/*Routes.ts`.
- Business logic in `maestro-server/src/application/services/*Service.ts`.
- Contract-first domain interfaces in `maestro-server/src/domain`.

## Session Lifecycle Handling

### Purpose
Track work from spawn to completion with explicit status and timeline events.

### What users get
- Session starts in `spawning`, moves to `working`, and ends in `completed` or `failed`.
- Timeline captures progress, blockers, needs-input, and completion history.
- Task-session status sync so task progress reflects terminal session outcomes.

### Tech shape
- Spawn endpoint: `POST /api/sessions/spawn` in `maestro-server/src/api/sessionRoutes.ts`.
- Manifest pipeline via CLI command `maestro manifest generate`.
- Lifecycle updates and notifications managed in `maestro-server/src/application/services/SessionService.ts`.

## Event Bus and WebSocket Updates

### Purpose
Push real-time backend changes to connected clients with low coupling between modules.

### What users get
- Live UI updates for task/session changes without manual refresh.
- Notification events for progress, completion, failures, blocked states, and needs input.
- Session-filtered event delivery for focused views.

### Tech shape
- Event emission from services through `InMemoryEventBus`.
- WebSocket fan-out via `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`.
- REST + WS hybrid model: write via API, observe via event stream.

## Persistence Model

### Purpose
Keep data transparent, local, and easy to inspect/recover.

### What users get
- Durable JSON-backed state for projects, tasks, sessions, team members, mail, and ordering.
- Session manifests stored per session for reproducibility.
- Simple operational model without external DB requirements.

### Tech shape
- File-system repositories under `maestro-server/src/infrastructure/repositories`.
- Data location: `~/.maestro/data/*` and manifests in `~/.maestro/sessions/{sessionId}/manifest.json`.

## Reliability Patterns

### Purpose
Reduce user-facing failures during orchestration and command execution.

### What users get
- Retry behavior in CLI API client (3 attempts with exponential backoff).
- Validation gates on API inputs before mutations are applied.
- Best-effort propagation for secondary updates/events to avoid hard-failing core operations.

### Tech shape
- CLI transport reliability in `maestro-cli/src/api.ts`.
- Request schema checks in `maestro-server/src/api/validation.ts`.
- Status/notification safeguards in `maestro-server/src/application/services/SessionService.ts` and `TaskService.ts`.

## Practical Takeaway

For users, the backend behaves like a write-safe system of record with real-time mirrors to the UI: API calls commit state, services enforce workflow rules, events broadcast changes instantly, and local JSON persistence keeps execution history inspectable.
