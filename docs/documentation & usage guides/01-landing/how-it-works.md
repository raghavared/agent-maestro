# How It Works

The architecture in 30 seconds.

---

## Three Parts

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Desktop App   │     │      CLI        │     │                 │
│   (Tauri+React) │────▶│   (47+ cmds)    │────▶│     Server      │
│                 │     │                 │     │   (Express+WS)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │         HTTP + WebSocket                      │
         └───────────────────────┴───────────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   JSON Files    │
                                                │  (~/.maestro/)  │
                                                └─────────────────┘
```

---

## Each Part in One Sentence

**The server is the brain.** It stores all data, manages sessions, and pushes updates via WebSocket.

**The desktop app is the visual workspace.** Terminals, kanban boards, task trees, and live dashboards — all in one window.

**The CLI lets you do everything from the terminal.** Create projects, spawn sessions, manage tasks, and automate workflows with scripts.

---

## How Data Flows

1. You create a task. The CLI or desktop app sends a request to the server.
2. The server writes a JSON file to `~/.maestro/data/tasks/`.
3. The server broadcasts the change over WebSocket.
4. Every connected client updates instantly.

**Changes made anywhere show up everywhere.**

---

## How Sessions Work

1. You spawn a session. The server creates a session record.
2. The server generates a manifest — a JSON file with all the context the agent needs.
3. The desktop app opens a terminal and starts the agent with that manifest.
4. The agent reads its tasks, starts working, and reports progress back to the server.
5. You see it all in real time.

```
You ──▶ "spawn session" ──▶ Server creates manifest
                                    │
                              Desktop App opens terminal
                                    │
                              Agent starts with full context
                                    │
                              Agent works + reports progress
                                    │
                              You see updates live
```

---

## No Database

All data lives as JSON files on disk at `~/.maestro/data/`.

```
~/.maestro/
├── config                        # Server URL
├── bin/                          # CLI + server binaries
├── data/
│   ├── projects/<id>.json        # Your projects
│   ├── tasks/<id>.json           # Your tasks
│   ├── sessions/<id>.json        # Your sessions
│   ├── task-lists/<id>.json      # Your task lists
│   ├── team-members/<id>.json    # Your agent profiles
│   └── teams/<id>.json           # Your teams
└── sessions/<id>/manifest.json   # Session manifests
```

Simple. Portable. No setup. No migrations.

---

## The Key Insight

Maestro doesn't replace your AI tools. It coordinates them. Claude Code still does the coding. Maestro tells it what to work on, tracks what it's doing, and keeps everything in sync.

Think of it as a project manager for your AI agents.

> **Next:** [Installation Guide](../02-getting-started/installation.md) — Get Maestro running.
