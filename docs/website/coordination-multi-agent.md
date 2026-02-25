# Coordination and Multi-Agent Workflows

Maestro includes a coordination layer so teams can run many agent sessions safely without losing context, ownership, or progress visibility.

## Why This Exists

- Keep one control plane for planning, execution, and tracking.
- Split large work into parallel worker sessions without manual copy/paste.
- Preserve traceability between tasks, sessions, docs, and final outcomes.

## Coordinator vs Worker Modes

- `coordinator`: Plans work, assigns tasks, watches execution, resolves blockers, and merges outcomes.
- `worker`: Executes assigned tasks directly (code, tests, docs), reports progress, and publishes artifacts.

This separation keeps planning centralized and execution parallel.

## Session Spawning and Worker Directives

Coordinators can spawn worker sessions with role-specific context:

- Assigned task IDs and project scope.
- Mode (`execute` / `plan`) and identity profile.
- Coordinator directives (what to build, constraints, acceptance criteria).

Workers start with a focused prompt so they can execute immediately.

## Monitoring and Control

Coordinators track worker state through task/session reporting:

- Progress updates during execution.
- `complete` reports with implementation summary.
- `blocked` reports when external input is required.
- Attached task docs for changed files and outputs.

This gives real-time visibility without interrupting workers.

## Mail and Prompt Communication

Maestro supports two communication paths:

- `session prompt`: Direct live instruction to a worker or peer.
- `session mail`: Persistent message queue for async coordination.

Use prompt for immediate direction; use mail for durable handoffs.

## Batching and DAG Workflows

For larger efforts, coordinators can run structured multi-task strategies:

- Batch parallelism: Independent tasks run at the same time.
- DAG orchestration: Downstream tasks start only after dependency completion.
- Stage-gated delivery: Plan → implement → verify → package artifacts.

This reduces bottlenecks and improves throughput on complex projects.

## Multi-Agent Tool Integration

Maestro can orchestrate multiple coding agents in one workflow, including:

- Codex
- Claude
- Gemini

The coordination layer standardizes task assignment, reporting, and artifact capture across tools, so teams can mix agents while keeping one operational model.

## User Value

- Faster delivery through safe parallel execution.
- Better reliability with explicit status and blocker reporting.
- Clear audit trail from assignment to final artifact.
- Flexible agent choice without workflow fragmentation.
