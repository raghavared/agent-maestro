# Glossary

> Every Maestro-specific term defined in one sentence.

---

## A

### Acceptance criteria
Conditions that must be met for a task to be considered complete.

### Agent tool
The AI CLI tool that powers a session — `claude-code`, `codex`, or `gemini`.

## C

### Capabilities
A set of boolean flags on a team member that control what actions a session can perform (spawn sessions, edit tasks, report progress).

### Command permissions
Per-team-member overrides that restrict or allow specific CLI command groups and individual commands.

### Coordinated coordinator
A coordinator session that was spawned by another coordinator, forming a hierarchy of orchestrators.

### Coordinated worker
A worker session that was spawned and managed by a coordinator session.

### Coordinator
An agent mode where the session decomposes tasks, spawns worker sessions, monitors progress, and verifies results.

## D

### Directive
An initial instruction object (`subject` + `message`) delivered to a coordinated session at spawn time, providing its first assignment.

### Doc entry
A document (file path and optional inline content) attached to a session or task for reference.

## E

### Event
A timestamped record of something that happened in a session, stored in the session's `events` array.

## H

### Hook
A shell command configured to execute in response to specific tool calls or events during a session.

## M

### Manifest
A JSON file (`manifest.json`) generated at spawn time that contains the full configuration for a session — mode, tasks, skills, team member identity, and capabilities.

### Master session
A session spawned from a master project that has cross-project access to query tasks, sessions, and projects across the entire workspace.

### Member launch override
Per-team-member configuration overrides (agent tool, model, permission mode, skills) applied at launch time.

## N

### needsInput
A flag on a session indicating it is waiting for user input, with an optional message describing what it needs.

## O

### Ordering
A UI-only concept that stores the display order of entities (tasks, sessions, task lists) within a project.

## P

### Permission mode
Controls how an agent session handles tool approvals — `acceptEdits` (auto-approve edits), `interactive` (ask for each), `readOnly` (no writes), or `bypassPermissions` (approve everything).

### Project
A top-level container that groups related tasks and sessions under a single working directory.

### Priority
A task's urgency level — `low`, `medium`, or `high`.

## Q

### Queue mode
A task list execution mode where tasks are processed sequentially from an ordered queue.

## S

### Session
A running AI agent instance inside a PTY terminal, tied to one or more tasks within a project.

### Session status
The lifecycle state of a session — `spawning`, `idle`, `working`, `completed`, `failed`, or `stopped`.

### Simple mode
A worker strategy where the agent executes tasks directly without dependency ordering.

### Skill
A markdown instruction file that injects domain-specific knowledge and capabilities into a session's system prompt.

### Spawn source
Indicates who initiated a session spawn — `ui` (user via desktop app) or `session` (another agent session).

## T

### Task
A unit of work with a title, description, status, and priority, assigned to one or more sessions for execution.

### Task list
An ordered collection of task IDs within a project, used for sequencing and queue-based execution.

### Task session status
A per-session status on a task that tracks each session's progress independently — `working`, `blocked`, `completed`, `failed`, or `skipped`.

### Task status
The lifecycle state of a task — `todo`, `in_progress`, `in_review`, `completed`, `cancelled`, `blocked`, or `archived`.

### Team
A named group of team members with a designated leader, used to organize agents for coordinated work.

### Team member
A reusable agent profile that defines identity, role, avatar, model, agent tool, mode, and capabilities for sessions.

### Team session
A shared session ID (equal to the coordinator's session ID) that links a coordinator and all its spawned workers.

### Technical notes
Implementation guidance attached to a task that helps the agent understand how to approach the work.

### Timeline
A chronological log of significant events during a session (task started, progress updates, completions, errors).

## W

### Worker
An agent mode where the session directly executes assigned tasks without spawning other sessions.

### Workflow template
A built-in execution pattern (e.g., `execute-simple`, `coordinate-default`, `coordinate-dag`) that defines how an agent approaches its work.

---

> **See also:** [Status reference](./status-reference.md) for detailed status values and transitions.
