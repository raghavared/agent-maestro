# Maestro CLI Low-Level Design Review

## Scope
This review covers `maestro-cli` implementation internals for:
- command implementation and argument parsing
- API interaction patterns
- state/session/task management behavior
- configuration loading and precedence
- data flow through init/report/docs/queue flows

Codebase analyzed: `maestro-cli/src/**` (TypeScript, Commander-based CLI).

## Technology and Runtime Architecture
- Runtime: Node.js ESM CLI (`"type": "module"`) with executable shim `maestro-cli/bin/maestro.js` -> `dist/index.js`.
  - Evidence: `maestro-cli/package.json`, `maestro-cli/bin/maestro.js`
- Command framework: `commander` with centralized registration in root entrypoint.
  - Evidence: `maestro-cli/src/index.ts`
- I/O and UX: `ora` spinners, `chalk`, `cli-table3`, JSON output wrappers.
  - Evidence: `maestro-cli/src/utils/formatter.ts`, command modules
- Validation: AJV schema for manifest contract.
  - Evidence: `maestro-cli/src/schemas/manifest-schema.ts`
- Server interaction: HTTP via `node-fetch`, wrapped by `APIClient`.
  - Evidence: `maestro-cli/src/api.ts`

## Command Registration and Argument Parsing
### Entrypoint pattern
- Root program defines global flags: `--json`, `--server`, `--project`.
- `preAction` hook applies `--server` by mutating shared API client base URL.
- Subcommand groups are registered from separate modules:
  - `project`, `task`, `session`, `worker`, `orchestrator`, `skill`, `manifest`, `queue`, `report`.
- Evidence: `maestro-cli/src/index.ts`

### Parsing behavior and conventions
- Parsing model is Commander positional + options.
- Most actions follow this pattern:
  1. `await guardCommand('<command-key>')`
  2. merge global opts (`program.opts()`) with env config
  3. optional spinner when not JSON
  4. API call(s)
  5. formatter output or `handleError`
- Evidence: `maestro-cli/src/commands/task.ts`, `maestro-cli/src/commands/session.ts`, `maestro-cli/src/commands/project.ts`, `maestro-cli/src/commands/queue.ts`, `maestro-cli/src/commands/report.ts`

### Notable command families
- `report <progress|complete|blocked|error>` maps to timeline event types and has special behavior for `complete` (also patches session status to `completed`).
  - Evidence: `maestro-cli/src/commands/report.ts`
- `task report <...>` updates per-session task status (`sessionStatus`) and separately posts timeline event.
  - Evidence: `maestro-cli/src/commands/task.ts`
- `session spawn` builds task context, decides role from skill, and posts `/api/sessions/spawn` with `spawnSource: 'session'`.
  - Evidence: `maestro-cli/src/commands/session.ts`
- Queue strategy commands (`queue:*`) are session-bound and poll-based for `queue start`.
  - Evidence: `maestro-cli/src/commands/queue.ts`

## Command Permission Model
- Central registry maps logical command keys (`task:create`, `queue:start`) to metadata and role/strategy constraints.
- Permission sources:
  1. defaults by role
  2. strategy extension (queue commands)
  3. optional manifest explicit `session.allowedCommands` override (+ force-included core commands)
- `guardCommand` blocks disallowed commands only when a manifest is loaded (`loadedFromManifest === true`); if not loaded, all commands are permitted.
- Evidence: `maestro-cli/src/services/command-permissions.ts`

Design implication:
- This is permissive in non-manifest contexts (useful for local CLI/manual operation) and restrictive for spawned agent sessions.

## Configuration Handling
### Config load order and precedence
- Loads env from:
  1. local cwd `.env`
  2. staging home config (`~/.maestro-staging/config`) if staging heuristics match
  3. prod home config (`~/.maestro/config`)
- `apiUrl` precedence:
  1. `MAESTRO_SERVER_URL`
  2. `MAESTRO_API_URL`
  3. discovered `DATA_DIR/server-url`
  4. fallback `http://localhost:3000`
- Runtime override: `--server` supersedes by calling `api.setBaseUrl(...)`.
- Evidence: `maestro-cli/src/config.ts`, `maestro-cli/src/index.ts`

### Context state sources
- Session/project/task context is read from env (`MAESTRO_SESSION_ID`, `MAESTRO_PROJECT_ID`, `MAESTRO_TASK_IDS`, strategy vars).
- Parent session and role context are propagated into spawned sessions.
- Evidence: `maestro-cli/src/config.ts`, `maestro-cli/src/services/*-spawner.ts`, `maestro-cli/src/commands/session.ts`

## API Interaction Pattern
### API client semantics
- `APIClient` normalizes URL joining and JSON headers.
- Retries use exponential backoff (`retryDelay * 2^attempt`) for:
  - network errors (no response / DNS / timeout / connection refused)
  - HTTP 5xx
- No retries for HTTP 4xx.
- `204` responses mapped to empty object.
- Evidence: `maestro-cli/src/api.ts`

### Error normalization
- Errors mapped to CLI error model with exit code taxonomy:
  - 1 general/validation
  - 2 resource not found
  - 3 network
  - 4 permission
  - 5 spawn failed
- Printed either as structured JSON or human-readable output.
- Evidence: `maestro-cli/src/utils/errors.ts`

## State Management and Lifecycle Behavior
### Session lifecycle
- `session register`:
  - checks if session exists
  - patches existing session to `working` or creates session
- `session complete` patches status to `completed`
- `session needs-input` / `resume-working` patch `needsInput` and session status
- `report complete` also patches session status to `completed`
- Evidence: `maestro-cli/src/commands/session.ts`, `maestro-cli/src/commands/report.ts`

### Task lifecycle
- Orchestrator task status mutation: `task update`, `task complete`, `task block`.
- Worker/task-session reporting uses per-session state path (`sessionStatus`, `updateSource: 'session'`, `sessionId`) instead of global task status changes.
- Timeline audit events posted separately for status/report updates.
- Evidence: `maestro-cli/src/commands/task.ts`

### Worker/orchestrator init
- `worker init` and `orchestrator init`:
  - read+validate manifest from env path
  - role-check manifest
  - auto-patch task/session statuses
  - spawn selected agent tool through `AgentSpawner`
- Worker init additionally caches permissions derived from manifest.
- Evidence: `maestro-cli/src/commands/worker-init.ts`, `maestro-cli/src/commands/orchestrator-init.ts`, `maestro-cli/src/services/agent-spawner.ts`

## Manifest, Prompt, and Agent Spawn Flow
### Manifest contract
- Typed contract supports multi-task sessions, role/strategy fields, agent tool selection, optional reference tasks.
- AJV schema enforces strict object shapes and enums.
- Evidence: `maestro-cli/src/types/manifest.ts`, `maestro-cli/src/schemas/manifest-schema.ts`

### Prompt generation
- Prompt template selection by role + strategy (`worker-simple`, `worker-queue`, `orchestrator-default`, etc.).
- Async path tries server templates first (`/api/templates/...`) with bundled fallback.
- `WhoamiRenderer` composes final session prompt-style context including command brief and optional reference task docs.
- Evidence: `maestro-cli/src/services/prompt-generator.ts`, `maestro-cli/src/services/whoami-renderer.ts`

### Agent spawning
- Factory selects tool-specific spawner (`claude-code`, `codex`, `gemini`).
- Environment injection carries full Maestro context across child process boundary.
- Tool-specific model/approval mappings implemented in each spawner.
- Evidence: `maestro-cli/src/services/agent-spawner.ts`, `maestro-cli/src/services/claude-spawner.ts`, `maestro-cli/src/services/codex-spawner.ts`, `maestro-cli/src/services/gemini-spawner.ts`

## End-to-End Data Flows
### Flow A: `maestro task report progress <taskId> <msg>`
1. Parse args/options (Commander)
2. Permission gate (`task:report:progress`)
3. Resolve session context from env
4. PATCH `/api/tasks/:taskId` with `sessionStatus=working`
5. POST `/api/sessions/:sessionId/timeline` with `type=progress`
6. Render output (JSON/text)
- Evidence: `maestro-cli/src/commands/task.ts`

### Flow B: `maestro report complete "summary"`
1. Permission gate (`report:complete`)
2. POST timeline event `task_completed`
3. PATCH session status `completed`
4. Output success
- Evidence: `maestro-cli/src/commands/report.ts`

### Flow C: `maestro session spawn --task <id> ...`
1. Permission gate (`session:spawn`)
2. Load task from server
3. Build derived context (related tasks + workflow instructions)
4. Build spawn payload (`spawnSource`, role from skill, optional orchestrator strategy)
5. POST `/api/sessions/spawn`
6. Return session id
- Evidence: `maestro-cli/src/commands/session.ts`

### Flow D: `maestro queue start`
1. Permission gate (`queue:start`)
2. POST start endpoint once
3. If empty, poll `queue/top` with interval/timeout and signal cancellation
4. On new task, POST start again to claim
- Evidence: `maestro-cli/src/commands/queue.ts`

## Observed Design Decisions
- Server-first command execution for mutable operations; local storage used only for manifest generation.
  - Evidence: API usage across command modules; local storage in `maestro-cli/src/commands/manifest-generator.ts`
- Backward-compatible context fallback for `whoami` when manifest is absent.
  - Evidence: `maestro-cli/src/index.ts`
- Non-blocking telemetry/audit updates (timeline post failures often swallowed to keep primary command successful).
  - Evidence: `maestro-cli/src/commands/task.ts`
- Strategy-aware command surface and prompt instructions.
  - Evidence: `maestro-cli/src/services/command-permissions.ts`, `maestro-cli/src/services/prompt-generator.ts`

## Risks and Gaps Identified
- `manifest generate` depends on local file cache (`~/.maestro/data`) while most CLI uses server API; potential consistency gap in distributed usage.
  - Evidence: `maestro-cli/src/commands/manifest-generator.ts`, `maestro-cli/src/storage.ts`
- `queue start` parses numeric options with `parseInt` without strict validation (NaN/negative values can degrade behavior).
  - Evidence: `maestro-cli/src/commands/queue.ts`
- Some tests appear out of sync with current manifest shape (`task` vs `tasks[]`), reducing regression confidence.
  - Evidence: `maestro-cli/tests/services/manifest-reader.test.ts`, `maestro-cli/src/types/manifest.ts`
- Default permission behavior allows all commands when no manifest exists; appropriate for local CLI but weaker guardrails in ad-hoc runs.
  - Evidence: `maestro-cli/src/services/command-permissions.ts`

## Inferred Acceptance Criteria (Given/When/Then)
1. Given a manifest-scoped session, when a disallowed command is invoked, then CLI rejects execution with an explicit permission error.
2. Given network/server transient failures, when API requests fail with retryable errors, then CLI retries with exponential backoff before surfacing failure.
3. Given a worker session context, when reporting task progress/completion/blockers/errors, then CLI updates per-session task status and session timeline consistently.
4. Given `--json` mode, when any command succeeds, then output is wrapped in `{ success: true, data: ... }` consistently.

## Uncertainties
- Whether server-side endpoints enforce the same permission model or rely primarily on CLI-side gating.
- Whether local-storage manifest generation is intended long-term or transitional.
- Whether lifecycle hooks (`needs-input`, `resume-working`) are fully wired for all agent tool integrations.
