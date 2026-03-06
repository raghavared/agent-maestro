# Why Maestro?

## The Problem

You have four Claude sessions running on one project. Three more on another. All in separate terminals. None of them know what the others are doing.

You copy-paste context between them. You lose track of who's doing what. One session duplicates work another already finished. A third one is stuck, but you don't notice for twenty minutes.

You tab between seven terminal windows trying to remember which one is building the API and which one is writing tests. You type the wrong command into the wrong session. You waste time re-explaining context that should already be shared.

**This doesn't scale.**

---

## Before Maestro

```
Terminal 1: Claude — "building auth module"     (stuck, no one notices)
Terminal 2: Claude — "writing API routes"       (duplicating Terminal 4's work)
Terminal 3: Claude — "fixing CSS bugs"          (finished, sitting idle)
Terminal 4: Claude — "building API endpoints"   (doesn't know about Terminal 2)
Terminal 5: Claude — "running tests"            (testing outdated code)
Terminal 6: Claude — "writing docs"             (wrong context, wrong branch)
Terminal 7: Claude — "refactoring utils"        (blocked, can't tell anyone)
```

No visibility. No coordination. No structure. Just chaos.

---

## After Maestro

```
Maestro Dashboard
├── Project: my-app
│   ├── Task: Build Auth Module .............. IN PROGRESS
│   │   └── Session: auth-worker ............ working (2m ago)
│   ├── Task: API Endpoints ................. IN PROGRESS
│   │   └── Session: api-worker ............. working (30s ago)
│   ├── Task: Fix CSS Bugs .................. COMPLETED
│   │   └── Session: css-worker ............. completed
│   ├── Task: Write Tests ................... TODO (blocked by: Auth, API)
│   └── Task: Write Docs .................... TODO
└── All sessions visible. All tasks tracked. All progress live.
```

One place. Every session tracked. Every task visible. Dependencies enforced. Blockers surfaced instantly.

---

## What Changes

| Before | After |
|--------|-------|
| Scattered terminal windows | One dashboard for everything |
| Copy-pasting context | Shared project context, automatic |
| No idea who's doing what | Live status for every session |
| Duplicate work | Task assignments prevent overlap |
| Silent failures | Blockers reported instantly |
| Manual coordination | Coordinators orchestrate workers |
| Idle sessions go unnoticed | Real-time activity tracking |

---

## The Core Idea

Maestro treats AI sessions like a team. Teams need structure. They need task assignments, progress tracking, and communication channels.

Maestro gives your Claude sessions all of that.

> **Next:** [Feature Overview](./feature-overview.md) — Everything Maestro can do.
