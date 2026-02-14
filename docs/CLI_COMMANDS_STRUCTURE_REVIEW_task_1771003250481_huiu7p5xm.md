# CLI Commands Structure Review

Date: 2026-02-13
Task: `task_1771003250481_huiu7p5xm`
Scope: Maestro CLI command hierarchy, options/arguments, naming conventions, help text, error UX, consistency, completeness

## Executive Summary

The CLI has a strong functional surface area and a clean top-level grouping model (`project`, `task`, `session`, `queue`, `report`, `worker`, `orchestrator`, etc.).

Primary gaps are UX consistency and discoverability under role-based permissions:
- Hidden/forbidden commands are still displayed in `--help`, creating false affordances for workers.
- Permission-denied paths can throw uncaught errors with Node stack traces.
- JSON output contracts are inconsistent across commands and error paths.
- Documentation/spec examples are partially out of sync with implemented options.

## Command Hierarchy (Current)

Observed root commands from `maestro --help`:
- `whoami`
- `commands`
- `project`
- `task`
- `session`
- `worker`
- `orchestrator`
- `skill`
- `manifest`
- `queue`
- `report`
- `status`
- `track-file`

Subcommand structure:
- `project`: `list`, `create <name>`, `get <id>`, `delete <id>`
- `task`: `list [taskId]`, `create [title]`, `get [id]`, `update <id>`, `complete <id>`, `block <id>`, `children <taskId>`, `report (progress|complete|blocked|error)`, `docs (add|list)`, `tree`
- `session`: `list`, `info`, `docs (add|list)`, `spawn`, `register`, `complete`, `needs-input`, `resume-working`
- `queue`: `top`, `start`, `complete`, `fail`, `skip`, `list`, `push <taskId>`, `status`
- `report`: `progress <message>`, `complete <summary>`, `blocked <reason>`, `error <description>`
- `worker`: `init`
- `orchestrator`: `init`
- `skill`: `list`, `info <name>`, `validate`
- `manifest`: `generate`

Role-gated worker-visible set (from `maestro commands --json`, strategy `simple`):
- Allowed: 24 command IDs (core, reporting, task read/create/docs/report, session info/register/complete/docs, worker init)
- Hidden: 19 command IDs (task mutation, project management, session spawn/list, queue commands, orchestrator init)

## Findings

### 1) Permission errors leak stack traces (high severity UX)

Observed behavior:
- `maestro task update test123 --status todo` (worker/simple) prints raw Node stack trace and exits 1.

Expected behavior:
- Friendly permission-denied message or structured JSON error with no stack trace.

Likely cause:
- `guardCommand(...)` throws; many handlers do not wrap this call in local try/catch.
- Source: `maestro-cli/src/services/command-permissions.ts` (`guardCommand`) and command handlers in `maestro-cli/src/commands/*.ts`.

Impact:
- Poor user experience, noisy logs, brittle automation parsing.

### 2) Help output shows commands users cannot execute (high severity discoverability)

Observed behavior:
- `maestro task --help` shows `update`, `complete`, `block`, `tree` even for worker role where they are denied.
- Similar pattern for `session --help` (`list`, `spawn`).

Expected behavior:
- Either role-aware help, or explicit "restricted command" labeling in help.

Impact:
- Users discover invalid paths first, then hit errors.

### 3) JSON output contract inconsistency (medium)

Observed behavior:
- Many success responses use wrapper: `{ "success": true, "data": ... }` via `outputJSON`.
- Some error paths emit this shape; others emit plain `{success:false,...}` via direct `console.log`.
- Uncaught errors (permission path) emit non-JSON stack traces even with `--json`.

Impact:
- Hard to build reliable wrappers/scripts around CLI.

### 4) Naming & command model inconsistency (medium)

Examples:
- Two reporting surfaces: `report ...` (session-level) and `task report ...` (task-session-level), both with overlapping verbs.
- `task complete` (orchestrator task status mutation) vs `task report complete` (session status update only) is semantically subtle.
- `session complete` and `report complete` both affect session completion in different contexts.

Impact:
- Higher cognitive load; easier to misuse commands.

### 5) Validation/utilities are not consistently applied (medium)

Observed in source:
- Validation helpers exist in `maestro-cli/src/utils/validation.ts` but are only partially used.
- Several commands accept free-form `--status` / `--priority` and rely on backend rejection.

Impact:
- Preventable round-trips and less actionable local feedback.

### 6) Documentation drift in CLI reference (medium)

Observed mismatch:
- `maestro-cli/docs/spec/07-CLI-COMMANDS-REFERENCE.md` lists global `--debug`, but CLI currently defines `--json`, `--server`, `--project`.
- Task creation options in doc include fields not present in current CLI command implementation.

Impact:
- Users following docs may use unsupported options.

### 7) Output formatting and TTY behavior (low-medium)

Observed in source:
- `queue list` manually injects ANSI sequences and Unicode symbols regardless of terminal capabilities.
- No explicit no-color behavior checks in those branches.

Impact:
- Inconsistent output in non-TTY contexts and log files.

### 8) Hidden internal-hook commands exposed to users (low)

Observed:
- `track-file`, `session register`, `session complete`, `session needs-input`, `session resume-working` are primarily hook/internal automation commands but visible in generic help.

Impact:
- Clutters user-facing command space and increases confusion.

## Completeness Assessment

Strengths:
- Comprehensive lifecycle support (projects, tasks, sessions, queue workflow, docs attachment, role-aware permissions model).
- Good basic affordances (`--json`, grouped subcommands, command listing, API-backed operations).

Gaps:
- No shell completion export command.
- No explicit machine-readable schema/version command.
- No consistent dry-run/validate mode for mutation commands.
- Limited explicit examples in runtime help.

## Prioritized Improvements

1. Normalize command guard failures
- Wrap `guardCommand(...)` failures through `handleError(...)` in every command path.
- For `--json`, always emit structured error JSON; never print stack traces.

2. Make help role-aware (or role-annotated)
- Option A: dynamically hide unavailable subcommands at runtime using loaded permissions.
- Option B: keep commands visible but annotate as restricted and show allowed roles/strategies.

3. Unify JSON response envelope
- Define a strict output contract for all commands:
  - success: `{ success: true, data: ... }`
  - error: `{ success: false, error, message, details?, suggestion? }`
- Eliminate direct ad-hoc `console.log(JSON.stringify(...))` branches.

4. Clarify reporting model
- Rename or alias to reduce ambiguity:
  - session-level: `session report ...`
  - task-level: `task report ...`
- Or keep names but expand help text with explicit side-effects matrix.

5. Enforce local argument validation consistently
- Apply `validateStatus`, `validatePriority`, and related helpers in all relevant commands before network calls.

6. Separate internal commands from user commands
- Hide internal hook commands from default `--help` (show only in `--help --all-internal` or docs for hooks).

7. Refresh docs/spec reference
- Update `maestro-cli/docs/spec/07-CLI-COMMANDS-REFERENCE.md` to current options and behaviors.
- Add auto-generated command reference from code metadata to prevent drift.

## Suggested Future Command Information Architecture

- User-facing primary groups:
  - `project`, `task`, `session`, `queue`, `report`, `status`, `whoami`, `commands`
- Advanced/ops group:
  - `manifest`, `skill`
- Internal-only group (hidden by default):
  - `track-file`, `session register`, `session complete`, `session needs-input`, `session resume-working`

## Notes on Method

This review combines:
- Runtime command/help observation (`maestro --help`, subcommand `--help`, `maestro commands --json`)
- Error-path spot checks (permission denied, missing args, missing session context)
- Source-level inspection of command definitions and support utilities in:
  - `maestro-cli/src/index.ts`
  - `maestro-cli/src/commands/*.ts`
  - `maestro-cli/src/services/command-permissions.ts`
  - `maestro-cli/src/utils/errors.ts`
  - `maestro-cli/src/utils/validation.ts`
  - `maestro-cli/docs/spec/07-CLI-COMMANDS-REFERENCE.md`
