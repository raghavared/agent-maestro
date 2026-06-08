# Maestro UI Redesign Brief — for Claude Design

> **Purpose of this document.** Hand this to a designer (or to Claude design) to redesign the entire Maestro desktop app in the "Claude" visual language. It documents the *complete* feature surface, the current layout structure, every screen and panel, all the interactions, and the current design tokens — so the redesign preserves all functionality while replacing the aesthetic.
>
> **Read this as:** "Here is everything the app does and shows today. Here is the current look. Here is the look we want. Redesign every surface accordingly."

---

## 0. What Maestro Is (context for the designer)

Maestro is a **multi-agent orchestration desktop app** for running and coordinating Claude (and Codex) coding agents. A user opens one or more **projects** (codebases), defines **team members** (agent personas), and launches **sessions** — each session is a live Claude agent running in a terminal, working on **tasks**. A **coordinator** agent can spawn and direct **worker** agents. The app is the cockpit: it shows what every agent is doing, the task board they're working from, the terminals they run in, and the artifacts (docs, timelines, recordings) they produce.

It is a **Tauri 2 desktop app** (macOS-first), React 18 + Zustand. Terminals are real (xterm.js). It is a power-user, information-dense tool — closer to an IDE or a mission-control console than a marketing site. **The redesign must keep that density and power while making it calm, legible, and beautiful.**

---

## 1. The Aesthetic Shift (the core of the brief)

### 1.1 Current aesthetic — "Terminal / Neon Hacker"

The default and signature theme is **Terminal**: matrix-green monospace, uppercase labels, glowing borders, near-black backgrounds. It reads as a hacker console.

The app actually ships **4 visual "styles"**, each with **6 color variants** (user-selectable):

| Style | Personality | Font | Radii | Shadows | Text |
|---|---|---|---|---|---|
| **Terminal** (default) | Neon hacker | JetBrains Mono (mono everywhere) | 4–10px | Colored glow (`0 0 8px rgba(primary)`) | UPPERCASE, +0.5px letter-spacing |
| **Material** | Clean Material Design | Inter UI / mono code | 8–20px | Soft drop shadows | Normal case |
| **Glass** | Frosted glassmorphism | Inter UI / mono code | 10–24px | Blur + saturate backdrop | Normal case |
| **Minimal** | Ultra-clean, focused | System sans / mono code | 4–10px | None | Normal case |

These styles are driven entirely by CSS custom properties (see §9 for the full token list). **The redesign should add (or replace the default with) a fifth style: "Claude".** Keep the theming architecture — it's a strength — but make Claude the default and the showcase.

### 1.2 Target aesthetic — "Claude Design"

Translate Maestro into Anthropic's Claude visual language:

- **Warm, editorial, calm.** Paper-like off-white surfaces in light mode; warm near-black (not pure black, not cold blue-black) in dark mode. Move away from the cold `#0a0e16` blue-black.
- **Signature accent: Claude coral/clay** (a warm terracotta orange, roughly `#D97757` / `#C15F3C`). Used sparingly for primary actions, active states, agent "working" pulses. This replaces neon green as the brand color.
- **Typography:** a humanist sans for UI (think Styrene-like / Inter as a stand-in), a refined serif for large display/empty-states/headings (Tiempos-like / a serif fallback) to give the editorial feel, and a comfortable monospace **reserved for terminals, code, logs, and IDs** (where mono is functionally correct — not for chrome labels).
- **Sentence case, not UPPERCASE.** Drop the uppercase + letter-spacing terminal styling for chrome. Labels read like prose.
- **Generous spacing, soft radii (8–14px), gentle shadows.** No neon glow. Depth comes from subtle elevation and warm tints, not luminous borders.
- **Quiet by default, expressive on action.** Color is used to mean something (status, agent activity), not for decoration. Lots of neutral surface, small bursts of coral.
- **Light mode as a first-class citizen** (the current app is dark-only). Provide both, with the same warmth in each.

**One-line direction:** *Take a mission-control console and make it feel like reading and writing in Claude — warm, literate, unhurried, but still dense and fast.*

### 1.3 What must NOT change

- Information density — power users rely on seeing many tasks/sessions/agents at once. Don't trade function for whitespace.
- The theming system (style + color-variant architecture). Add Claude; keep the engine.
- Every feature, control, and view documented below must survive. This is a reskin + UX polish, not a feature cut.
- Real terminal rendering (xterm) — terminals stay monospace and dark-ish for legibility; they're the "content," the chrome around them is what gets the Claude treatment.

---

## 2. Application Shell & Layout

The window is a single-window desktop layout. Top to bottom, left to right:

```
┌──────────────────────────────────────────────────────────────────────┐
│  PROJECT TAB BAR   [Proj A] [Proj B*] [+]              (per-proj badges)│  ← top strip
├──────────────────────────────────────────────────────────────────────┤
│  UPDATE BANNER (conditional)                                           │
├────┬───────────────────────┬───────────────────────────────┬──────────┤
│ I  │                       │                               │          │
│ C  │   MAESTRO PANEL       │      MAIN / TERMINAL AREA      │  SPACES  │
│ O  │   (Tasks/Team/Skills/ │   (active session terminal,   │  PANEL   │
│ N  │    Lists/Graphs OR    │    or whiteboard/doc space)   │ (session │
│    │    File Explorer)     │   + overlays: session-log,    │   list)  │
│ R  │                       │     spell btn, mode chip      │          │
│ A  │  ‹resize handle›      │   + TaskDetailOverlay         │‹resize›  │
│ I  │                       │   + Modals + SlidePanel       │          │
│ L  │                       │                               │          │
└────┴───────────────────────┴───────────────────────────────┴──────────┘
```

### 2.1 Project Tab Bar (top, full width)
- Horizontal tabs, one per open **project**. Active project highlighted.
- Each tab shows **per-project live badges**: session count, count of **working agents** (animated/pulsing when agents are active), and a **"needs input"** indicator (an agent is waiting on the human).
- `+` to create/open a project. Right-click / overflow: close project, delete project, reopen recently closed.
- Drag to reorder projects.
- Entry point to the **Multi-Project Board** (also `Cmd/Ctrl+Shift+B`).
- **Redesign note:** these badges are critical glanceable state. In Claude design, the "working" pulse should be a warm coral breathing animation; "needs input" should be an attention dot (amber/coral), not an alarm-red klaxon.

### 2.2 Icon Rail (far left, narrow vertical strip)
- Vertical icon buttons selecting what the left panel shows. Sections: **Tasks, Members, Teams, Skills, Lists, Graphs, Files**.
- Clicking a section opens the **Maestro Panel** (or **File Explorer** for Files) to that section; clicking the active one again collapses the panel (toggle).
- **Redesign note:** this is the primary navigation. Icons need clear, friendly line-icon treatment with a selected state that uses the coral accent + a soft pill background. Tooltips on hover.

### 2.3 Left Panel — Maestro Panel (resizable)
The workhorse. Contains a **primary tab bar** + **contextual sub-tab bar**, then the content. (Full detail in §3–§7.)
- Primary tabs: **Tasks · Team · Skills · Lists · Graphs** (each with a count badge; e.g., Team shows active member count).
- Sub-tabs depend on primary tab:
  - **Tasks** → Current · Pinned · Completed · Archived
  - **Team** → Members · Teams (+ "New", "Team Standup" actions)
  - **Skills** → Browse/Installed/Marketplace
- Resizable via a drag handle on its right edge (min/max width clamped). Double-clickable handle behaviors exist for auto-fit.
- Alternatively shows the **File Explorer** when the Files rail icon is active.

### 2.4 Main / Terminal Area (center, flexible)
The focus of the app. Shows the **active session's terminal**, or a **Space** (whiteboard / document / file editor) when one is active.

- **Empty state:** ASCII-art "MAESTRO" wordmark + a prompt like `ready for instructions_`. **Redesign note:** replace ASCII art with a warm, editorial empty state — a serif headline, a soft illustration or the Claude mark, and clear primary actions ("New session", "Open a task"). This is a big first-impression surface.
- **Active terminal:** full xterm terminal. Read-only styling when the session has exited/closing.
- **Overlays on top of the terminal:**
  - **Session Log Strip** — live telemetry of the running Claude agent (model, context tokens, cache-hit %, output tokens, API turns, tool calls, duration). Auto-scrolling, expandable. (See §5.4.)
  - **Spell Button** — small floating action to invoke a "spell" (a contextual prompt/skill) against the session. (See §6.1.)
  - **Mode Chip** — a small badge showing the session's role: **Coordinator** vs **Worker** (coordinator gets a distinct "glow"/emphasis today). (See §5.5.)
  - Drag-over affordance: dragging a **task card** onto the terminal sends it to the agent as work/prompt.
- **TaskDetailOverlay**, **AppModals**, and the **SlidePanel** (recordings/replay drawer) all mount here.

### 2.5 Right Panel — Spaces Panel (resizable)
- Primarily the **session list** for the active project ("Spaces rail" with a Sessions section). Each entry: session name, live status, team-member avatar, project color; click to focus, drag to reorder, close button.
- Hosts entry points: **New Session**, **Persistent Sessions**, **SSH Manager**, **Agent Shortcuts** (quick-launch presets), **Manage Terminals**.
- Resizable from its left edge.
- **Redesign note:** this is the "what agents do I have running" list — the live roster. Status dots and avatars carry meaning; make them legible and calm. Working = coral pulse; idle = neutral; needs-input = amber; done = green check; failed = red.

### 2.6 Global chrome & overlays
- **Command Palette** (`Cmd/Ctrl+K`) — fuzzy search across quick-start presets, saved prompts, recordings, sessions, and actions. (See §8.1.)
- **Multi-Project Board** (`Cmd/Ctrl+Shift+B`) — full-screen overlay; tabs Tasks / Sessions / Dashboard across all projects. (See §3.5.)
- **Team View** — full-screen overlay shown when a team (coordinator + workers) session is active; resizable split terminal panes. (See §5.6.)
- **Whiteboard Space** (`Cmd/Ctrl+Shift+X`) — Excalidraw canvas that replaces the terminal area.
- **Startup Settings Overlay** — first-run onboarding (storage setup, paths).
- **Update Banner** + **Update Modal** — app self-update.
- **Prompt Send Animation Layer** — a flourish when a prompt is dispatched to an agent. **Redesign note:** keep a tasteful version (a coral pulse traveling to the target) — it's a moment of delight worth preserving in a Claude-calm way.
- **Confirm-close-app** dialog listing running sessions grouped by project before quitting.

---

## 3. Tasks

Tasks are the unit of work. They're hierarchical (parent/children), have status + priority, can be assigned to team members, linked to sessions, and carry docs/timeline/images.

### 3.1 Task statuses & priorities (and their current glyphs)
Statuses (current monospace glyphs in parentheses — **replace glyphs with Claude-style status pills/dots in the redesign**):
- **Todo** (`○`) · **In Progress** (`◉`) · **In Review** (`◎`) · **Completed** (`✓`) · **Cancelled** (`⊘`) · **Blocked** (`✗`) · **Archived** (`▫`)

Priorities: **Low · Medium · High** (currently shown as `LOW/MED/HIGH` chips + a colored left stripe on cards).

**Redesign note:** Build a coherent status + priority visual system. Status as soft-tinted pills with a dot; priority as a subtle stripe or a small flag. Avoid the current uppercase mono labels. Keep them scannable in dense lists.

### 3.2 Task List (in Maestro Panel → Tasks)
A hierarchical, expandable list (`TaskListItem` rows). Each row:
- Status dot + **status dropdown** (cycle/choose status inline)
- Title (click → opens Task Detail Overlay)
- Expand/collapse caret for children
- **Pin** toggle (favorites → Pinned sub-tab)
- **Priority** badge + dropdown
- **Team-member avatar** + assignment dropdown
- **Launch-config** button (override model/args/permissions for that task's agent)
- Session-count indicator (if the task has live sessions)
- **Meta expander** → reveals inline: docs list, linked sessions (jump-to), and a timeline excerpt
- **Add Subtask** inline input under a parent

Above the list: **Task Filters** (search, status filter, priority filter, assignee filter, date range, sort) and an **Execution Bar** (see §3.4).

### 3.3 Task Detail Overlay (full-screen modal editor)
Tabs: **Details · Subtasks · Sessions · Timeline · Generated Docs · Reference Docs · Images.**
- **Details:** title, rich description, status, priority, due date, parent, assigned team member(s), launch-config panel (per-agent model/args), reference-task picker (link related tasks).
- **Subtasks:** nested list with inline add.
- **Sessions:** linked sessions with jump-to-terminal.
- **Timeline:** task-scoped event stream.
- **Generated Docs / Ref Docs:** doc lists → DocViewer.
- **Images:** screenshot/image gallery.
- Footer: Save / Cancel / Delete.

There is also a lighter **Create Task Modal** for quick creation (title, description, priority, status, due date, parent, assignee).

### 3.4 Execution Bar (batch agent launch)
A mode toggle above the task list. When ON:
- Checkboxes appear on tasks for multi-select.
- Controls appear: **team-member selector** (who executes), **launch-config dropdown** (model/args), **permission-mode dropdown**, **Execute** (run worker(s) on selected tasks), **Orchestrate** (run a coordinator over them), **Save as Team**, **Cancel**.
- **Redesign note:** this is a powerful, slightly hidden flow. Make the active execution mode visually distinct (a calm coral-tinted toolbar), and make Execute vs Orchestrate clearly different actions.

### 3.5 Kanban / Multi-Project Board (`Cmd/Ctrl+Shift+B`)
Full-screen overlay, three tabs: **Tasks · Sessions · Dashboard.**
- **Tasks tab:** Kanban. Columns = statuses (Todo, In Progress, In Review, Completed, Cancelled, Blocked, Archived); collapsible with counts. Cards are draggable between columns to change status.
  - **Layout toggle:** *Grouped* (one Kanban row per project — `ProjectKanbanRow`) vs *Unified* (all projects merged into shared columns).
  - **Project Selector Sidebar** (left, collapsible): checkboxes to include/exclude projects.
  - **Task Card** (`TaskCard`): title, priority stripe, project badge (multi-project), priority label, subtask progress (X/Y), due date (overdue highlight), last-updated relative time, session-count indicator, and a hover **"Work on"** action (launches an agent on the task).
- **Sessions tab** (`MultiProjectSessionsView`): all active sessions across selected projects, grouped or unified, each with status + timeline.
- **Dashboard tab** (`Dashboard`): analytics — KPI metric cards (total tasks, active sessions, capacity), charts (status bar chart, activity-over-time line, workload pie, activity calendar heatmap — recharts), time-range selector, breakdowns by status and by team member.

### 3.6 Task Graph (Maestro Panel → Graphs)
Canvas-based **task dependency graph**: task nodes (draggable, double-click to open), dependency edges, zoom/pan, context menu (create/link). **Redesign note:** style nodes as Claude-design cards with status color; edges as soft curved connectors.

### 3.7 Task Lists (Maestro Panel → Lists)
Named, ordered collections of tasks. Panel lists each TaskList with task count + open/edit/delete. Modals: **TaskListModal** (manage), **TaskListAddTasksModal** (add tasks to a list). Used for curated execution order.

---

## 4. Teams & Team Members (agent personas)

### 4.1 Team Members (Maestro Panel → Team → Members)
A team member is an **agent persona**: name, emoji **avatar**, **agent tool** (Claude / Codex), **model** (Opus / Sonnet / Haiku / etc.), an **identity/system prompt**, **command permissions**, scope (project vs **global**), and an optional **default** flag.
- **List** (`TeamMemberList`): collapsible rows — avatar, name, model badge, agent-tool badge, scope badge, default badge; actions: Edit, Archive/Unarchive, Delete, **Run**.
- **TeamMemberModal:** create/edit form — name, avatar emoji, agent-tool selector, model selector (with per-tool defaults), system-prompt editor, scope toggle, default toggle, permissions, skill selection.
- **Memory:** members carry persistent memory entries (appendable).
- **Redesign note:** personas are the "characters" of the app. Make member cards feel like contact/profile cards — avatar prominent, model/tool as quiet metadata chips. Avatars (emoji today) should sit in a soft circular surface.

### 4.2 Teams (Maestro Panel → Team → Teams)
A saved composition: a **coordinator** (leader) + **worker** members (supports team-of-teams via sub-teams).
- **List:** name, coordinator info, worker avatars/count, last-used; actions: Launch, Edit, Delete.
- **TeamModal:** name, coordinator selector, workers multi-select, per-member permissions + launch-config overrides.
- **TeamLaunchConfigModal:** advanced per-member model/args/permission overrides at launch time.
- **Team Standup** action: a coordinator-driven status round-up.

### 4.3 Agent selection & launch config (shared controls)
- **AgentSelector** — dropdown to pick a member (avatar + name + model), compact and full modes, searchable.
- **LaunchConfigDropdown** / **LaunchConfigPanel** — choose/override model + args + permission mode per agent; per-tool defaults; appears in task rows, execution bar, task detail, and team modals.
- **StrategyBadge** — shows Worker vs Orchestrator strategy; queue-item status badges (queued/processing/completed/failed/skipped).
- **Split Play Button / Launch Config Dropdown** — a primary "launch" button with an attached config chooser.

**Redesign note:** these selectors appear everywhere; design one consistent, compact "agent + config" control component and reuse it.

---

## 5. Sessions & Terminals (live agents)

### 5.1 Session = a running agent
A session is one Claude/Codex instance in a terminal, tied to a project, working on task(s), produced by a team member. Tracked: status, timeline, docs, the team-member snapshot, and live API telemetry.

Session statuses: **Spawning · Idle · Working · Done · Failed · Stopped.**

### 5.2 Terminal (`SessionTerminal`, xterm.js)
Real terminal emulation: copy/selection, resize (FitAddon), pending-data buffering, read-only mode for exited sessions. **Keep terminals monospace and high-contrast** — but the surrounding chrome (header, status, overlays) gets the Claude treatment. Provide a terminal theme that's warm-dark and matches the Claude palette rather than neon green-on-black.

### 5.3 Session list & lifecycle
- Lives in the right **Spaces Panel** (§2.5): name, status dot, member avatar, project color; focus/reorder/close.
- **NewSessionModal:** name, command, persistent toggle, cwd.
- **PersistentSessionsModal:** background sessions you can re-attach or kill.
- **ManageTerminalsModal:** list/kill active terminals with info (command, status, uptime).
- **Agent Shortcuts / Quick-launch:** saved presets to spin up an agent fast (also surfaced in the command palette).

### 5.4 Session Log Strip (live agent telemetry — a signature surface)
A live overlay on the terminal showing the running agent's metrics, parsed from Claude/Codex log files (polled ~2s): **model name, context tokens, cache-hit %, total output tokens, API turns, tool-call count, duration.** Auto-scrolls, expandable to detail; can switch Claude/Codex provider.
**Redesign note:** this is one of the most distinctive, valuable surfaces — it's the "agent vitals." Design it as an elegant, glanceable stat bar (small labeled metrics, a subtle activity sparkline, coral accent on the live/working metric). Make it feel like instrumentation, calmly.

### 5.5 Session detail & timelines
- **SessionDetailModal:** full session view — header (name, status, **StrategyBadge**), scrollable **SessionTimeline**, linked tasks (jump-to), docs list, metadata.
- **SessionTimeline:** event stream with filters (All / This Task / Milestones / Errors); event types include task_started, task_completed, tool_call, milestone, error; each event: timestamp, type icon, description, task link. Virtualized; compact mode for embedding. (`TimelineEvent` is the row.)
- **MaestroSessionContent:** the task tree a session is working on, with strategy badge + **QueueStatusDisplay** (for queued multi-task runs) + jump-to-task.
- **SessionInTaskView / SessionDetailsSection:** session cards embedded in the task detail view.
- **ModeChip:** Coordinator vs Worker badge over the terminal (coordinator currently gets a glow — see `styles-coordinator-glow.css`). **Redesign note:** distinguish coordinator vs worker with a tasteful treatment (e.g., coordinator gets a subtle coral ring/label), not a neon glow.

### 5.6 Team View (coordinator + workers, full-screen)
Shown when a team session is active: a full-screen split with the **coordinator terminal** and **worker terminals** in resizable panes (`TeamSessionGroup` groups them). Lets the human watch a coordinator delegate to workers live. **Redesign note:** this is the "orchestra" view — design a clear hierarchy (coordinator prominent, workers as a managed grid), with each pane labeled by its agent persona.

---

## 6. Spells, Skills & Docs

### 6.1 Spells
**Spells** are contextual prompts/skills invoked against an entity (a session, task, team-member, skill, etc.).
- **SpellButton:** floating action on the terminal for active Maestro sessions.
- **SpellPicker:** modal to search and execute available spells.
- **Redesign note:** "spell" is a playful name — lean into a tasteful magic metaphor (a subtle sparkle on invoke) without breaking the calm.

### 6.2 Skills (Maestro Panel → Skills)
Markdown-defined agent capabilities loaded from multiple scopes (global / project / task).
- **SkillsPanel:** search; Installed vs Marketplace; sections for project vs global skills; per-skill card (name, description, scope badges, version, source) with expandable detail (triggers, tags, docs) and install/uninstall.
- **ClaudeCodeSkillsSelector:** multi-select skill checklist used in task/team launch config (grouped by scope).

### 6.3 Docs
- **DocsList:** list of doc entries (title, icon, size, open).
- **DocViewer:** renders markdown with syntax-highlighted code; full-screen or inline (full-width in a document Space). Docs are produced by agents and attached to tasks/sessions.

---

## 7. Spaces (whiteboard / document / file)
"Spaces" can **replace the terminal area**:
- **Whiteboard** — Excalidraw canvas (`Cmd/Ctrl+Shift+X` to create/toggle), persisted.
- **Document** — markdown DocViewer in full-width inline mode.
- **File** — Monaco-based code editor for an opened file.
Managed via a spaces rail/panel; create/rename/delete. **Redesign note:** treat Spaces as "the canvas changes shape for the work" — same chrome, different center content.

---

## 8. Command Palette & Bars

### 8.1 Command Palette (`Cmd/Ctrl+K`)
Modal fuzzy-search over: quick-start presets (agent shortcuts), saved prompts, recordings, sessions (switch-to), and generic actions. Debounced input, grouped results, each with type icon + title + subtitle + actions; keyboard nav (↑/↓/Enter/Esc); pinned items on top. **Redesign note:** this is the speed layer — make it gorgeous and fast, Spotlight-grade, with the Claude type system.

### 8.2 Other bars
- **CommandBar / ExecutionBar** — task batch-execution controls (see §3.4).
- **QueueStatusDisplay** — progress of queued multi-task agent runs.
- **PanelIconBar** — the Maestro Panel's primary + sub-tab bar (§2.3).

---

## 9. Modals & Dialogs (full inventory)
Every one of these must be redesigned to the new modal language (warm surface, soft radius, gentle shadow/scrim, serif title optional, clear primary/secondary buttons):
- **ProjectModal** — create/edit project (name, base path, environment, assets, sound config)
- **ConfirmDeleteProjectModal** — confirm project deletion
- **NewSessionModal** — new terminal session
- **PersistentSessionsModal** — list/attach persistent sessions
- **ManageTerminalsModal** — kill/manage terminals
- **SshManagerModal** — SSH hosts, port forwards, auth
- **SecureStorageModal** — keychain/secure-storage setup & retry
- **StartRecordingModal / RecordingsListModal / ReplayModal / ConfirmDeleteRecordingModal** — session recording & replay (with playback controls)
- **ApplyAssetModal** — apply an asset bundle to a project
- **PathPickerModal** — file/dir picker
- **ConfirmActionModal** — generic confirm (supports danger styling, busy state)
- **AgentModalViewer** — view agent details/metadata
- **SoundSettingsModal / ProjectSoundSettings** — notification/sound instruments (agents can have audio cues)
- **UpdateModal** — app update install
- **CreateTaskModal / TaskListModal / TaskListAddTasksModal / TeamModal / TeamMemberModal / TeamLaunchConfigModal** — covered above

---

## 10. Cross-Cutting States & Patterns

- **Empty states:** No projects ("NO PROJECTS / create a project"), no tasks, no sessions, empty terminal. Redesign all into warm, helpful, editorial empty states with a clear primary action and (where apt) a serif headline.
- **Loading states:** spinners + "Loading tasks/team members…" — replace with calm skeletons/shimmer in warm neutrals.
- **Error states:** **ErrorBoundary** (retry), **PanelErrorState** (panel-level error + retry/close), topbar error/notice banners (dismissible), persistence-disabled warning with keychain retry.
- **Drag & drop:** tasks between Kanban columns; task → terminal (send as prompt); reorder sessions; reorder projects. (`DragGhostCard` is the drag preview.) Design a consistent drag affordance (lifted card + warm drop-zone highlight).
- **Status & activity color language (define once, use everywhere):** working = coral pulse, idle = neutral, needs-input = amber, done = green, failed = red, blocked = red-muted. Apply consistently across tabs/badges, session dots, task statuses, timeline events.
- **Animations:** prompt-send flourish, working pulses, coordinator emphasis. Keep them, retune them to "calm + warm."
- **Accessibility:** keep semantic landmarks (`aside/section/main/nav`), ARIA labels, `role="separator"` on resize handles, keyboard nav, focus rings. The redesign must hit WCAG AA contrast in **both** light and dark — verify the coral accent on warm neutrals especially.
- **Density / zoom:** the app has a global zoom scale (`--app-zoom-scale`) and resizable panels everywhere; the design must hold up across widths and zoom levels.

---

## 11. Current Design Tokens (the exact "before")

These are the live CSS variables. The redesign should produce an equivalent **Claude** token set (and ideally keep these other styles working).

**Base (root):**
```
--bg: #0a0e16;            /* cold blue-black — REPLACE with warm dark */
--panel: #10151e;  --panel-2: #111820;
--border: rgba(255,255,255,0.08);  --border-subtle: rgba(255,255,255,0.04);
--text: #f0f4f8;  --muted: rgba(240,244,248,0.7);
--accent: #6b8afd;  --accent-2: #22d3ee;  --accent-3: #818cf8;
--accent-persistent: #f472b6;
--radius-control: 6px;
```

**Terminal style (default — the look to move away from):**
```
font: 'JetBrains Mono' everywhere; radii 4–10px;
shadow-glow: 0 0 8px rgba(theme-primary,0.3);  (neon glow)
letter-spacing: 0.5px;  text-transform: UPPERCASE;
surfaces: #0a0e16 / #10151e / #111820;
default color = Matrix Green #00ff41.
```

**The 4 styles & their personalities** are summarized in §1.1. Color variants per style:
- Terminal: green `#00ff41`, blue `#00d9ff`, purple `#a855f7`, amber `#ffb000`, cyan `#22d3ee`, rose `#f472b6`
- Material: indigo, teal, deep-purple, rose, amber, emerald (e.g. indigo `#818cf8`)
- Glass: frost, lavender, mint, coral, gold, violet (translucent borders, `backdrop: blur(16px) saturate(180%)`)
- Minimal: slate, blue, violet, orange, emerald, rose (no shadows)

**Proposed Claude tokens (starting point for the designer — refine to brand):**
```
/* Light */
--bg: #FAF9F5;            /* warm paper */
--panel: #FFFFFF;  --panel-2: #F5F3EE;
--text: #2B2A27;   --muted: rgba(43,42,39,0.62);
--border: rgba(43,42,39,0.10);
--accent: #C15F3C;       /* Claude clay/coral */  --accent-hover: #D97757;
/* Dark */
--bg: #1F1E1B;           /* warm near-black, not blue */
--panel: #262522;  --panel-2: #2E2C28;
--text: #F2EFE9;   --muted: rgba(242,239,233,0.62);
--border: rgba(255,255,255,0.08);
--accent: #D97757;       --accent-hover: #E08A6E;
radii: sm 8 / md 10 / lg 14 / xl 20;
shadows: soft, low-spread, no glow;  letter-spacing: 0; text-transform: none;
font-ui: humanist sans (Styrene-like / Inter);  font-display: serif (Tiempos-like);  font-mono: terminals/code/IDs only.
```
*(Hex values above are directional, not exact brand specs — the designer should pin the precise Claude palette.)*

---

## 12. Redesign Deliverables (suggested ask to Claude design)

1. **Foundations:** the Claude token set (light + dark), type scale, spacing scale, radii, elevation, the status/activity color system, icon style.
2. **Core components:** buttons, inputs, dropdowns, chips/badges (status, priority, model, tool), avatars, tabs, the agent-selector + launch-config control, cards, list rows, modals, the resize handles.
3. **Key screens** (high-fidelity): app shell; Maestro Panel (Tasks list with hierarchy + execution bar); Task Detail Overlay; Multi-Project Kanban Board; Dashboard; Team Members & Teams; Session list + terminal with Session Log Strip + Mode Chip; Team View; Command Palette; the empty/onboarding state.
4. **States:** empty, loading (skeletons), error, drag-and-drop, agent-working animations.
5. **Terminal theme:** a warm-dark xterm palette consistent with Claude.

**Guardrails for the designer:** preserve every feature and control in this document; keep information density for power users; keep the theming architecture (add "Claude" as the default style alongside Terminal/Material/Glass/Minimal); support light + dark; hit WCAG AA. Calm and warm, but fast and dense.

---

*Generated from a full read of `maestro-ui/src` (137 components, 50+ stylesheets, theme system, and layout shell). This is the complete current feature surface as of the redesign request.*
