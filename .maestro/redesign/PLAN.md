# Maestro Redesign — Master Plan

Approved by user 2026-06-09.

## Goal

Re-skin the existing `maestro-ui/src/components/maestro/*` UI to match the design system in `panel-redesign/`. Workers modify existing components **in place**. Functionality is preserved verbatim — appearance only changes. Both light and dark themes ship.

## Locked decisions

| Decision | Value |
|---|---|
| Branch | `maestro-redesign` (already created, off `feature/session-stats-redesign`) |
| Canonical full layout | `panel-redesign/shell.jsx` |
| Left panel variant | **Ledger** |
| Right panel variant | **Roster** |
| Theme | Both light + dark, toggle on `<html data-theme="dark">` (per `shell.jsx`) |
| Token scope | Scoped under `<html data-redesign>` — non-redesigned UI untouched during rollout, full cutover later |
| Modals in scope | All modals (CreateTask, TeamMember, Team, Settings, ModelProfile, TaskList, SessionDetail, TeamLaunchConfig, etc.) |
| TopBar | Replace existing top chrome with `pn-top` (incl. Tauri title-bar work if needed) |
| Agent icons | Reuse existing `maestro-ui` assets; fall back to `AgentTile` initial-letter avatar |
| Verification rule | **Zero functionality changes** — preserve every prop, handler, store hook, ref, side effect. Appearance only. |

## Design system inputs (source of truth)

| File | Provides |
|---|---|
| `panel-redesign/theme.css` | Light-mode CSS variables, type scale, spacing |
| `panel-redesign/theme-dark.css` | Dark-mode overrides |
| `panel-redesign/kit.jsx` | `Icon`, `Mark`, `AgentTile`, dots, chips, kbd, buttons |
| `panel-redesign/shell.jsx` | Canonical full-app layout |
| `panel-redesign/left-panels.jsx` (Ledger section) | Maestro panel layout |
| `panel-redesign/right-panels.jsx` (Roster section) | Spaces panel layout |
| `panel-redesign/tiles.jsx`, `tiles-show.jsx` | Task tile + agent tile |
| `panel-redesign/modals.jsx`, `modals.css` | Modal designs |

**Strict rule:** copy values verbatim. No improvising spacing, colour, type. If unsure, escalate to me (coordinator).

## Sequencing

```
Phase 0 ── Foundation Engineer  (BLOCKING)
            └── tokens + kit primitives + theme toggle + FOUNDATION-DONE.md

Phase 1 ── 4 sub-coordinators in PARALLEL  (gated on Phase 0 commit)
            ├── Left Panel Coordinator       → 4 workers
            ├── Middle Panel Coordinator     → 2 workers
            ├── Right Panel Coordinator      → 3 workers
            └── Misc Coordinator             → 5 workers
```

Sub-coordinators may spawn in advance of foundation completion **only** to have their workers study old vs new and draft contracts. Implementation begins only after `FOUNDATION-DONE.md` is published.

## Team roster (19 members to recruit)

### Foundation (1)
- 🧱 Redesign Foundation Engineer — worker

### Left Panel branch (1 + 4)
- 🧭 Left Panel Coordinator — coordinator
- 🎚️ Icon Rail Worker — coordinated-worker
- 🗂️ Maestro Panel Shell Worker — coordinated-worker (header, subbar, search, filters, scroll, fade, footer)
- 🌲 Task List & Tree Worker — coordinated-worker (sectioned groups + recursive TaskNode)
- 🟦 Task Tile Worker — coordinated-worker (`pn-row`)

### Middle Panel branch (1 + 2)
- 🎛️ Middle Panel Coordinator — coordinator
- 💻 Terminal Theme Worker — coordinated-worker (re-skin `SessionTerminal.tsx` chrome via `pn-term-*`)
- 📊 Session Stats Theme Worker — coordinated-worker (re-skin `SessionStatsView.tsx` tokens only)

### Right Panel branch (1 + 3)
- 🧩 Right Panel Coordinator — coordinator
- 🪟 Spaces Layout Worker — coordinated-worker (`pn-sp` toolbar + quick-launch + scroll + `pn-srail`)
- 📜 Session List Worker — coordinated-worker (Running / Needs input / Idle groups + team grouping)
- 🎴 Session Tile Worker — coordinated-worker (`pn-sess` row)

### Miscellaneous branch (1 + 5)
- 🧰 Misc Coordinator — coordinator
- 🪧 Project Bar / TopBar Worker — coordinated-worker (`pn-top` full replacement)
- ➕ Task Create Modal Worker — coordinated-worker
- 👤 Team Member Modal Worker — coordinated-worker
- ⚙️ Settings Panel Worker — coordinated-worker
- 🧹 Modal Sweep Worker — coordinated-worker (Team, ModelProfile, TaskList, SessionDetail, TeamLaunchConfig, etc.)

## Task hierarchy

```
task_1780947602081_do1s54708 — Maestro Redesign (existing root)
└── NEW: Maestro Redesign Coordination (this session's task)
    ├── P0 — Foundation: design tokens, kit primitives, theme toggle
    ├── P1a — Left Panel redesign
    │       ├── Icon Rail
    │       ├── Maestro Panel Shell
    │       ├── Task List & Tree
    │       └── Task Tile
    ├── P1b — Middle Panel redesign
    │       ├── Terminal Theme
    │       └── Session Stats Theme
    ├── P1c — Right Panel redesign
    │       ├── Spaces Layout
    │       ├── Session List
    │       └── Session Tile
    └── P1d — Misc / Modals redesign
            ├── Project Bar / TopBar
            ├── Task Create Modal
            ├── Team Member Modal
            ├── Settings Panel
            └── Modal Sweep
```

## Worker protocol (MANDATORY for every panel worker)

Every worker MUST do this exact sequence — non-negotiable:

1. **READ the existing implementation** — open every file in scope under `maestro-ui/src/components/maestro/`. Catalogue every prop, store hook, event handler, ref, useEffect/useMemo, side effect, a11y attribute.
2. **READ the new design** — open `panel-redesign/shell.jsx` (canonical layout), `theme.css` + `theme-dark.css` (tokens), `kit.jsx` (primitives), and the specific variant file for your scope (`left-panels.jsx` Ledger / `right-panels.jsx` Roster / `tiles.jsx` / `modals.jsx`).
3. **Cross-reference (write contract)** — `<component>-CONTRACT.md` with a side-by-side map: (a) functional surface preserved verbatim, (b) visual surface replaced, (c) which exact foundation tokens + kit primitives map to each new visual element. The contract IS the consistency guarantee — nothing freehand.
4. **Adopt the new design in place** — modify the existing file. Pull every colour/spacing/font/radius/shadow from foundation tokens; pull every icon/dot/chip/avatar/button from kit primitives. Match panel-redesign exactly — same class semantics, same hierarchy, same spacing rhythm.
5. **Verify consistency** — visual diff vs `panel-redesign/` in light + dark. Contract check: every prop/hook/handler/ref preserved.
6. **Report complete** with screenshots + contract + `bun run build:ui` typecheck pass.

**Consistency rule:** if the design is silent on something (e.g. an edge state not shown in `panel-redesign/`), escalate to the panel coordinator — never invent. The panel coordinator escalates to me; I extend the foundation kit if needed.

## Communication & gates

- Foundation publishes `FOUNDATION-DONE.md` on its task with the catalog of every primitive and CSS class exported. This unblocks the 4 panel coordinators' workers.
- Each panel coordinator publishes `<panel>-CONTRACT.md` summarising what their workers need from the kit. If they need something missing, they escalate to me; I ping foundation to extend.
- Coordinator (me) monitors via `maestro session logs --my-workers` every cycle. Sync between branches if kit gaps emerge.

## What is NOT in scope

- Server, CLI, backend changes
- Refactoring component logic, splitting components, moving state
- Adding new features
- Deleting `panel-redesign/` reference folder
- Replacing the live mounts before all four panels are done (cutover is a separate approval gate per panel)
