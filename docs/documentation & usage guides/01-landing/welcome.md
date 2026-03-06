# Welcome to Maestro

**Run multiple Claudes across your projects. Coordinate all of them from one place.**

---

Maestro is the orchestration layer for AI-powered development. Instead of juggling scattered terminal sessions, you get one unified workspace where every agent is visible, trackable, and coordinated.

## What Maestro Does

- **Break work into tasks and subtasks.** Define what needs to happen. Set priorities, add dependencies, organize into task lists. Maestro keeps your work structured.

- **Spin up Claude sessions and assign them tasks.** Each session gets its own terminal, its own context, and a clear objective. Workers execute. Coordinators orchestrate. You stay in control.

- **See what every Claude is doing in real time.** Live progress updates, session timelines, and WebSocket-powered sync across every view. Nothing happens in the dark.

---

## Get Started

Install Maestro in one command:

```bash
# Full install (macOS — includes desktop app)
./install.sh

# Server + CLI only (no Rust required)
./install.sh --server-only

# Docker (cross-platform)
docker compose up
```

Then create your first project and start working:

```bash
maestro project create "my-project"
maestro task create "Build the login page"
maestro session spawn --task <task-id>
```

> **Next:** [Why Maestro?](./why-maestro.md) — The problem Maestro solves.
