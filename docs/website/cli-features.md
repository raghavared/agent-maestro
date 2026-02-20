# CLI Features

## Problem
The UI is great for discovering work and monitoring sessions, but power users and automation need direct, scriptable control over tasks, sessions, teams, and project workflows.

## Solution
Use the Maestro CLI for precise operations, repeatable reporting, and lifecycle-aware automation.

### Core command groups
- `maestro task ...`: create, inspect, update, organize task trees, and manage task docs.
- `maestro session ...`: inspect active sessions, read logs/mail, send prompts/notifications, and coordinate workers.
- `maestro project ...`: manage project records and metadata.
- `maestro team ...` and `maestro team-member ...`: manage team structure, membership, identities, and memory.
- `maestro report ...`: quick progress/complete/blocked/error updates from active sessions.
- `maestro manifest generate`, `maestro worker init`, `maestro orchestrator init`: manifest-driven spawn and startup flow.

### Reporting flow (recommended)
1. Start work and send progress updates with `maestro task report progress` or `maestro session report progress`.
2. If blocked, send `blocked` status immediately with the dependency/reason.
3. On completion, send `complete` with a short summary.
4. Attach artifacts using `maestro task docs add` or `maestro session docs add`.

### Session and task lifecycle
- Session spawn is manifest-driven: generate context once, then initialize worker/orchestrator from that manifest.
- Workers use task/session reports to keep coordinator and UI state in sync.
- Mailbox and prompt/notify commands support cross-session coordination without leaving the terminal.

### Hooks and automation
- Lifecycle hooks can run at startup/shutdown boundaries (for setup, validation, cleanup, telemetry).
- CLI commands are stable building blocks for shell scripts, CI runners, and orchestrated multi-agent flows.

## Tech
- Built on Commander.js command modules (`task`, `session`, `project`, `team`, `team-member`, `report`, `manifest`, `worker`, `orchestrator`).
- Uses shared API client + storage patterns for consistent retries, error handling, and state updates.
- Manifest schema and prompt-builder services keep runtime context explicit, portable, and reproducible.

## When CLI is better than UI
Use CLI when you need:
- repeatable automation (scripts, CI/CD, scheduled jobs),
- high-speed power workflows over many sessions/tasks,
- precise operational reporting from agent terminals,
- integration with external tooling or custom orchestration.

Use UI when you need:
- visual discovery and navigation,
- interactive monitoring across teams,
- lightweight manual operations.
