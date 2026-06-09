# PanelIconBar → pn-rail — Re-skin Contract

**Worker:** 🎚️ Icon Rail Worker (`tm_1780948938792_yyg2rl326`)
**File:** `maestro-ui/src/components/maestro/PanelIconBar.tsx` (296 lines)
**Design source:** `panel-redesign/shell.jsx` `IconRail()` (lines 90–115) + `panel-redesign/theme.css` `.pn-rail*` (lines 543–568)
**Kit:** `maestro-ui/src/components/maestro/redesign/kit.tsx` → `Icon`, `Mark` (confirmed staged; gate not yet open)
**Status:** CONTRACT REFINED per coordinator rulings (2026-06-09). Gate CLOSED — no source edits until coordinator sends go-ahead + `FOUNDATION-DONE.md` published.
**Rule:** Zero functionality changes. Every prop/handler/state-source/a11y attr preserved verbatim.

---

## ⚠️ STRUCTURAL FINDING + COORDINATOR RULINGS (RESOLVED)

The existing `PanelIconBar` is **not** a vertical rail. It renders **two stacked horizontal bars** inside a `maestroPanelTabSystem` container, mounted **inside** the Maestro panel (`MaestroPanel.tsx:615`):

1. **`maestroPanelPrimaryTabs`** — horizontal row of 6 primary tabs. Hidden when `hidePrimaryTabs`.
2. **`maestroPanelSubTabs`** — contextual second bar (New X actions, current/pinned/completed/archived icon sub-tabs, Standup, stats).

The design splits these into `pn-rail` (vertical primary nav, my scope) and `pn-subbar` (inside `pn-mp`, Shell Worker's scope).

### Rulings from Left Panel Coordinator (`sess_1780949253577_ei828bbjb`)

- **Q1/Q2 (subbar ownership + mount) — PROVISIONAL (escalated to top coordinator):** I own **only** the vertical `pn-rail` (primary nav). The **entire `maestroPanelSubTabs` block is removed** from `PanelIconBar` — it moves to the Shell Worker's `pn-subbar` inside `pn-mp`. The sub-tab state lives in `MaestroPanel.tsx:243-247` and is passed via props, so handlers are unaffected; `PanelIconBar` simply **stops rendering** `maestroPanelSubTabs` and keeps only the primary-nav buttons, restyled as `pn-rail-btn`. **Await coordinator confirm before editing** (Q1/Q2 still provisional).
- **Q3 — profiles icon:** `Icon name="bot"`.
- **Q4 — rail built ONLY from existing handlers.** Omit `files`, and the bottom `whiteboard`/`settings` buttons (no existing handlers; settings/whiteboard belong to TopBar/Misc branch). Adding non-functional buttons is forbidden (new functionality).
- **Q5 — naming:** keep `PrimaryTab` union value `"team"` and `onPrimaryTabChange("team")` verbatim. Only the visual label ("Members") + icon (`users`) change. Members vs Teams = two rail buttons selecting via `teamSubTab`.
- **Badges:** keep existing count sources as `pn-rail-badge`; render only when count > 0. Preserve every `onClick`, `type="button"`, and `title`.

### Final rail composition (7 buttons, all from existing handlers)

| Rail button | onClick(s) | Active when | Icon | Badge source (render if >0) |
|---|---|---|---|---|
| Tasks | `onPrimaryTabChange("tasks")` | `primaryTab==="tasks"` | `listChecks` | `activeCount` |
| Members | `onPrimaryTabChange("team")` + `onTeamSubTabChange("members")` | `primaryTab==="team" && teamSubTab==="members"` | `users` | `activeTeamCount` |
| Teams | `onPrimaryTabChange("team")` + `onTeamSubTabChange("teams")` | `primaryTab==="team" && teamSubTab==="teams"` | `team` | `teamCount` |
| Skills | `onPrimaryTabChange("skills")` | `primaryTab==="skills"` | `sparkles` | — (no count source) |
| Lists | `onPrimaryTabChange("lists")` | `primaryTab==="lists"` | `inbox` | `taskListCount` |
| Graphs | `onPrimaryTabChange("graphs")` | `primaryTab==="graphs"` | `graph` | `graphCount` |
| Profiles | `onPrimaryTabChange("profiles")` | `primaryTab==="profiles"` | `bot` | `modelProfileCount` |

Notes:
- Members/Teams both call `onPrimaryTabChange("team")`; the distinguishing call is `onTeamSubTabChange(...)`. Each button fires **both** handlers on click (order: set primary tab, then set teamSubTab) so functional parity with the old "team primary + sub-tab" flow is preserved.
- `title` per button = its label (matches design `title={label}`, shell.jsx:105): "Tasks", "Members", "Teams", "Skills", "Lists", "Graphs", "Profiles".

### `hidePrimaryTabs` / `forcedPrimaryTab` — RESOLVED (option a, coordinator-confirmed)

Verified `MaestroPanel.tsx:246-247` (`forcedPrimaryTab` fixes `primaryTab` + no-ops `setPrimaryTab`) and `:643` (`hidePrimaryTabs:true` only in forced mode). **Ruling:** gate the 7 rail nav buttons behind `!hidePrimaryTabs` **exactly** as the primary-tab block is gated today; **always render `pn-rail-mark` and `pn-rail-spacer`**. Forced mode = no interactive nav, just the mark. Behavior stays byte-for-byte.

Sections below: verbatim functional inventory (locked) + token/primitive mapping.

---

## A. Functional surface — PRESERVE VERBATIM

### A.1 Props (all 28 — none added, none removed, none renamed)
`primaryTab`, `onPrimaryTabChange`, `taskSubTab`, `onTaskSubTabChange`, `skillSubTab`, `onSkillSubTabChange`, `teamSubTab`, `onTeamSubTabChange`, `activeCount`, `pinnedCount`, `completedCount`, `archivedCount`, `teamMembers`, `loading`, `projectId`, `onNewTask`, `onNewTaskList`, `onNewTeamMember`, `onNewTeam?`, `onNewGraph?`, `onNewModelProfile?`, `onTeamStandup?`, `teamCount=0`, `taskListCount=0`, `graphCount=0`, `modelProfileCount=0`, `hidePrimaryTabs=false`.

Exported types preserved verbatim: `PrimaryTab = "tasks" | "lists" | "team" | "skills" | "graphs" | "profiles"`, `TaskSubTab = "current" | "pinned" | "completed" | "archived"`, `SkillSubTab = "browse" | "installed" | "marketplace"`, `TeamSubTab = "members" | "teams"`. (`AppLeftPanel.tsx:5` and `MaestroPanel.tsx:9` import these — do not change names.)

### A.2 Derived state
- `activeTeamCount = teamMembers.filter(t => t.status !== 'archived').length` (PanelIconBar.tsx:69) — preserve exact filter predicate.

### A.3 Event handlers / click bindings (every one preserved)
| Element | Handler | Notes |
|---|---|---|
| Tasks primary tab | `onPrimaryTabChange("tasks")` | active when `primaryTab==="tasks"` |
| Team primary tab | `onPrimaryTabChange("team")` | active when `primaryTab==="team"` |
| Skills primary tab | `onPrimaryTabChange("skills")` | active when `primaryTab==="skills"` |
| Lists primary tab | `onPrimaryTabChange("lists")` | active when `primaryTab==="lists"` |
| Graphs primary tab | `onPrimaryTabChange("graphs")` | active when `primaryTab==="graphs"` |
| Profiles primary tab | `onPrimaryTabChange("profiles")` | active when `primaryTab==="profiles"` |
| New Task (sub) | `onNewTask` | tasks context |
| Current/Pinned/Completed/Archived (sub) | `onTaskSubTabChange("current"\|"pinned"\|"completed"\|"archived")` | active = `taskSubTab===…` |
| New List (sub) | `onNewTaskList` | lists context |
| New Member (sub) | `onNewTeamMember` | team+members context |
| Standup (sub) | `onTeamStandup` | rendered only if `onTeamStandup` truthy |
| New Team (sub) | `onNewTeam` | team+teams context |
| New Profile (sub) | `onNewModelProfile` | profiles context |
| New Graph (sub) | `onNewGraph` | graphs context |

### A.4 Badge / count sources (preserve binding, restyle container only)
| Badge | Source prop |
|---|---|
| Tasks primary badge | `activeCount` |
| Team primary badge | `activeTeamCount` (derived) |
| Tasks sub: current count | `activeCount` |
| Tasks sub: pinned count | `pinnedCount` |
| Tasks sub: completed count | `completedCount` |
| Tasks sub: archived count | `archivedCount` |
| Lists stat | `taskListCount` |
| Members stat | `activeTeamCount` |
| Teams stat | `teamCount` |
| Profiles stat | `modelProfileCount` |
| Graphs stat | `graphCount` |

### A.5 Conditional render logic (preserve exactly)
- `!hidePrimaryTabs` gates the entire primary tab block.
- Sub-bar content switches on `primaryTab` (`tasks` / `lists` / `team`+`teamSubTab==="members"` / `team`+`teamSubTab==="teams"` / `profiles` / `graphs`); `skills` renders no sub-tabs (comment preserved as behavior).
- Standup button only renders when `onTeamStandup` is provided.

### A.6 Accessibility attributes (preserve)
- Every `<button type="button">` keeps `type="button"`.
- `title` attrs on sub-tab icon buttons (`"Current"`, `"Pinned"`, `"Completed"`, `"Archived"`) and Standup (`"Run a team standup to audit and optimize the roster"`).
- Decorative SVGs → replaced by `<Icon>` which emits `aria-hidden="true"` (kit.tsx:96) — equivalent/with parity.
- `rail` buttons in design carry `title={label}` (shell.jsx:105) — preserve label-as-title for each.
- `props.loading` and `props.projectId` are currently accepted but unused in render — keep in the prop list (consumed by type/contract; do not delete the props).

---

## B. Visual surface — REPLACE

| Old class | New class | Source |
|---|---|---|
| `maestroPanelTabSystem` | `pn-rail` (container) | theme.css:544 |
| (logo — none today) | `pn-rail-mark` > `<Mark size={24} />` | shell.jsx:103 |
| `maestroPanelPrimaryTab` | `pn-rail-btn` | theme.css:550 |
| `maestroPanelPrimaryTabActive` | `pn-rail-btn--active` | theme.css:556 |
| `maestroPanelTabIcon` (inline `<svg>`) | `<Icon name=… sw={1.55} />` | shell.jsx:106 |
| `maestroPanelTabBadge` | `pn-rail-badge` | theme.css:562 |
| text labels ("Tasks", …) | removed from rail; surfaced via `title` (icon-only rail) | shell.jsx:105 |
| (spacer — none today) | `pn-rail-spacer` | theme.css:567 |
| `maestroPanelSubTabs` + children | **REMOVED from this component** — moves to `pn-subbar` in `pn-mp` (Shell Worker). Handlers/state untouched (props passed from `MaestroPanel.tsx:243-247`). | shell.jsx:127 |

---

## C. Token + primitive mapping (rail elements that map cleanly)

### C.1 Container — `.pn-rail`
`width:56px; flex:0 0 auto; flex-direction:column; align-items:center; padding:12px 0 10px; gap:4px; background:var(--pn-paper); border-right:1px solid var(--pn-line);` — all from `redesign-tokens.css`. No hardcoded values.

### C.2 Mark — `.pn-rail-mark`
`<span className="pn-rail-mark"><Mark size={24} /></span>` — `color:var(--pn-brand); margin-bottom:10px;`. `Mark` from `redesign/kit.tsx`.

### C.3 Button — `.pn-rail-btn` / `.pn-rail-btn--active`
`40×40; border-radius:10px; display:grid; place-items:center; color:var(--pn-ink-3);` hover `background:var(--pn-hover); color:var(--pn-ink);` active `background:var(--pn-active)` + left accent bar `::before` `var(--pn-brand)`. Icon sized via `.pn-rail-btn svg {19×19}`; pass `<Icon name=… sw={1.55} />`.

### C.4 Icon name map (primary tab → `Icon name`)
| Tab | `Icon name` | Design ref |
|---|---|---|
| tasks | `listChecks` | RAIL[0] shell.jsx:92 |
| team → "Members" | `users` | RAIL[1] shell.jsx:93 |
| team → "Teams" | `team` | RAIL[2] shell.jsx:94 |
| skills | `sparkles` | RAIL[3] shell.jsx:95 |
| lists | `inbox` | RAIL[4] shell.jsx:96 |
| graphs | `graph` | RAIL[5] shell.jsx:97 |
| profiles | `bot` | coordinator ruling Q3 (no design RAIL entry; app-specific) |

### C.5 Badge — `.pn-rail-badge`
`position:absolute; top:3px; right:3px; min-width:15px; height:15px; background:var(--pn-ink); color:var(--pn-paper); font-family:var(--pn-mono); font-size:9px;`. Render only when count > 0 (design: `badge ? <span>… : null`, shell.jsx:107). Tasks→`activeCount`, Members→`activeTeamCount`, Lists→`taskListCount` (design shows a lists badge).

### C.6 Spacer — `.pn-rail-spacer`
Render `<span className="pn-rail-spacer" />` after the 7 nav buttons (pushes nothing below in our case). Design's bottom whiteboard (`pen`) + settings buttons are **OMITTED** (coordinator ruling Q4 — no existing handlers; they belong to TopBar/Misc branch). Adding them would be new functionality.

---

## D. Deliverables checklist (post-gate)
- [ ] Q1–Q5 answered by Left Panel Coordinator
- [ ] In-place re-skin of `PanelIconBar.tsx` per resolved structure
- [ ] All Section A functional surface verified preserved
- [ ] Light + dark screenshots diffed vs `panel-redesign` `IconRail`
- [ ] `bun run build:ui` typecheck pass
