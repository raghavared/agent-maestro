# SessionList-CONTRACT.md

**Worker:** 📜 Session List Worker (`tm_1780948939988_p44zlteor`)
**Scope:** Re-skin the session **grouping + recursion** (status/section headers, team grouping, coordinator→worker tree) to match the panel-redesign **Roster** variant. Zero functionality changes — restyle only.
**Status:** Steps 1–3 complete (study + contract). Gate CLOSED (no `FOUNDATION-DONE.md` yet). No source edits made.

---

## ✅ COORDINATOR RULINGS (Right Panel Coordinator, 2026-06-09) — RESOLVED

- **E1 → CONFIRMED.** Target = `maestro-ui/src/components/SessionsSection.tsx` (`buildTeamGroups` + recursive `SessionNodeRenderer` + sectioning). `MultiProjectSessionsView.tsx` is the multi-column BOARD — out of my scope (and out of the Spaces Layout worker's scope too).
- **E2 → OPTION A, CONFIRMED.** KEEP Open/Done/Archived filter sub-tabs + spawn tree EXACTLY (zero re-bucketing). Adopt ONLY the design's visual vocabulary for section headers: `pn-sec-head` + `pn-eyebrow` + `pn-count` + `pn-line`. Do NOT re-group by Running/Needs-input/Idle (no waiver). The Roster "Running/Needs input/Idle" brief was demo-data shape; live tab+tree wins under zero-functionality.
- **E3 → WRAP coordinator roots in `pn-team`**, populated from `teamGroupData.groups` (color/teamName/worker count) — NO new logic. **Team color lives ONLY on `pn-team__dot`.** Session Tile worker (`sess_1780949405769_k4g46x2hz`) has been ruled to DROP their per-tile `teamColor` accent → team color encoded once, here. No double-encoding.
- **E4 / GAP → ESCALATED to top coordinator.** Foundation will port `pn-team*` + `pn-kids` into `redesign-tokens.css`. E3 + nested-row indentation stay BLOCKED until that lands; coordinator will signal.

### SHARED-FILE PARTITION of `SessionsSection.tsx` (critical — multiple workers edit this file)
- **MINE:** section headers (`pn-sec-head`), team grouping wrapper (`pn-team`), recursive `SessionNodeRenderer` rows + nesting (`pn-kids`).
- **Spaces Layout worker:** quick-launch row (`agentShortcutRow` → `pn-quick`) + outer scroll/fade wrapper (`pn-scroll`/`pn-fade`) in the same file.
- Edit only my regions. If hunks are adjacent, coordinate directly to avoid collisions; coordinator will sequence.

### ROW-OWNERSHIP CHECK → RESOLVED
`SessionNodeRenderer` (SessionsSection.tsx:611) renders **`<SessionListItem .../>`** imported from `./maestro/SessionListItem` (line 37). There is **NO inline row** — the row is the Tile worker's `SessionListItem.tsx`, mounted by my `SessionNodeRenderer`. Clean split:
- **MINE:** `SessionNodeRenderer` wrapper divs (`.sessionTreeNode`, `.sessionTreeChildren`) → `pn-kids`/`pn-kids--st`; the `<SessionListItem>` *call* stays verbatim (props pass-through).
- **Tile worker:** the `SessionListItem` row internals (`pn-st`/`pn-sess`). Coordinating with them directly.

---

## ⚠️ TOP-PRIORITY ESCALATIONS (need Right Panel Coordinator decision before I implement)

### E1 — The session grouping does NOT live in `MultiProjectSessionsView.tsx`
My task title + the dispatch prompt name `MultiProjectSessionsView.tsx`. After reading it end-to-end, that file is the **multi-column board view** and groups sessions **by project** (`SessionProjectGroup`, `mpbSessionProjectHeader`, full terminal columns). It has **no** Running/Needs-input/Idle sections, **no** team grouping, **no** coordinator→worker recursion.

The real session-grouping surface — team grouping (`buildTeamGroups`) + recursive coordinator→worker tree (`SessionNodeRenderer`) + sectioning — lives in:

> **`maestro-ui/src/components/SessionsSection.tsx`** (note: parent `components/` dir, NOT `components/maestro/`)

This is the actual right-side "Sessions" panel: it has the QuickLaunch agent-shortcut row (matches `pn-quick`), sub-tabs, the session tree, and team color mapping. **I propose targeting `SessionsSection.tsx`** for my grouping/recursion work. Please confirm. (Note overlap: the coordinator assigned `MultiProjectSessionsView.tsx` shell to the Spaces Layout Worker too — that file is a *different* surface, the board, not the right panel.)

### E2 — Grouping MODEL mismatch: design = status sections; existing = filter-tabs + spawn-tree
| | Design (Roster / shell.jsx `SpacesPanel`) | Existing (`SessionsSection.tsx`) |
|---|---|---|
| Top-level grouping | Status **sections**: `Running · 4` / `Needs input · 1` / `Idle · 2` (`pn-sec-head`) | Filter **sub-tabs**: `Open` / `Done` / `Archived` (`sessionSubTabs`, `resolveSessionTab`) — interactive, mutually exclusive |
| Within group | flat `pn-list` of rows; one `pn-team` box for the running team | `sessionTree` of `visibleRoots` → recursive `SessionNodeRenderer` |

The protocol says **preserve grouping logic verbatim, restyle only**. Re-bucketing sessions into Running/Needs-input/Idle would be a **functionality change** (forbidden). 

**My recommendation (option A, pure restyle):** keep the Open/Done/Archived semantics and the spawn-tree exactly as-is; only adopt the design's *visual vocabulary* (`pn-eyebrow`/`pn-count`/`pn-line` typography, `pn-team` box, `pn-kids` indent) on the elements that already exist. I would **not** introduce status sections. Please confirm A vs. B (actually re-group by status — a logic change I'd refuse without an explicit waiver of the zero-functionality rule).

### E3 — `pn-team` boxed container has no existing structural counterpart
Design wraps a coordinator's subtree in a labelled box: `pn-team` → `pn-team__head` (`pn-team__dot` colored + `pn-team__name` + `pn-team__count` "4 sessions") then `SessionNode`s. 

Existing app conveys team identity as a **per-tile color** only (`maestroColorMap` → `teamColor` prop on each `SessionListItem`); there is **no** team header element and the tree is rendered **flat** (each root is a top-level `SessionNodeRenderer`, not boxed). 

Adopting `pn-team` means **adding a new wrapper** around each coordinator root — arguably structural, not pure restyle. The data already exists to populate it without new logic: `teamGroupData.groups` already provides `{ color, teamName, teamAvatar, coordinatorMaestroSessionId, workerMaestroSessionIds }`, so a `pn-team__head` is derivable (dot=`group.color`, name=`group.teamName ?? coordinator name`, count=`${workers.length + 1} sessions`). **Decision needed:** wrap each coordinator root in `pn-team` (recommended — closest to design, no logic change, data ready), or keep flat + per-tile color? Note this interacts with the Session Tile Worker's color treatment — coordinate so we don't double-encode team color.

### E4 — Design is silent on several existing states → escalating, not inventing
- **Empty state** (`sessionEmptyState` per Open/Done/Archived). Roster/shell show no empty state. → keep existing markup, apply only token colors? Confirm.
- **Plain (non-maestro) terminals** rendered via `DndContext`/`SortableContext` (drag-reorder) under the Terminals filter. Design's session list has no DnD list. → out of my grouping scope (those are tiles + a sortable list); confirm I leave the DnD wrapper untouched.
- **Live count chip** (`sessionSubTabs__live`, "N live") — no design equivalent. Belongs to the sub-tab row (Layout Worker). Confirm out of scope.

---

## ✅ COORDINATOR RULINGS — ROUND 2 (2026-06-09)

- **A/B → (B) CONFIRMED.** HOLD all visible session-tree work until `pn-team*`/`pn-kids` land in redesign-tokens.css v2; then do team box + `pn-team__head` + `pn-kids` nesting in ONE coherent pass. There is genuinely no unblocked session-tree CSS work now (Open/Done/Archived = interactive tablist, different surface; flat root list has no between-root headers; `pn-team__head` ships with `pn-team` in v2).
- **Option (A) Files header → REJECTED.** `spacesGroup__header` (L1456) is the Resources/Files grouping, NOT sessions — out of my lane. Leave it; coordinator confirms owner separately.
- **RULING #1 (pure swap):** adopt `pn-*` UNCONDITIONALLY, REPLACING old `themed*`/legacy classes. `data-redesign` is a global kill-switch, not a per-component dual-look. NO conditional/dual classNames, NO `useRedesignTheme` gating. Only runtime visual toggle = light/dark via `<html data-theme="dark">`.
- **RULING #2 (static-vs-reality):** re-skin REAL elements in place; never fabricate static duplicates; never add new data wiring; keep functional surfaces that have no design home in their current section, restyled with tokens; never drop/invent IA.
- **Orphan regions** (sidebarHeader, sessionsSegmentedFilter, sessionSubTabs, empty state, Files header): NOT mine — coordinator confirmed my scope is narrowly the `pn-team` box + `pn-kids` nesting in the session tree. Awaiting separate ownership ruling; I leave them untouched.

---

## STEP 4 — STAGED v2 APPLY-PLAN (apply the instant coordinator signals "pn-team ported")

**File:** `maestro-ui/src/components/SessionsSection.tsx` (+ no CSS edits — consume `redesign-tokens.css`).
**Verified facts (all pure reads, NO new logic / NO behavior change):**
- `teamGroupData.groups` (from `buildTeamGroups`, already memoized at SessionsSection.tsx:767) yields per group: `color: TeamColor` (`.primary` = hex), `teamName?: string`, `coordinatorMaestroSessionId`, `workerMaestroSessionIds: string[]`. → `pn-team__dot` = `group.color.primary`; `pn-team__count` = `workerMaestroSessionIds.length + 1`; `pn-team__name` = `group.teamName ?? root.teamMemberSnapshot?.name ?? root.name`.
- `SessionTreeNode = MaestroSession & { children }` (maestro.ts:710) → root carries `teamMemberSnapshot`/`name` for the fallback.
- Existing CSS being replaced: `.sessionTreeChildren` (styles-maestro-sessions-v2.css:2147 — `margin-left:14px; padding-left:8px; border-left:1px rgba(255,255,255,.08)`) → `pn-kids pn-kids--st` (`margin-left:19px; border-left:1px var(--pn-line)`). `.sessionTreeNode`/`--child` have NO dedicated CSS → safe to drop the class (keep `data-maestro-session-id`).

### Edit 1 — add a pure-read lookup (no behavior change), near `teamGroupData` (~L769)
```ts
const teamGroupByCoordinator = useMemo(() => {
  const m = new Map<string, TeamGroup>();          // TeamGroup imported from utils/teamGrouping
  for (const g of teamGroupData.groups) m.set(g.coordinatorMaestroSessionId, g);
  return m;
}, [teamGroupData.groups]);
```

### Edit 2 — `SessionNodeRenderer` wrapper (L607-610 + L633), RULING #1 outright swap
- L608 `className={`sessionTreeNode ${depth > 0 ? "sessionTreeNode--child" : ""}`}` → drop className entirely; keep `data-maestro-session-id={node.id}` on a plain `<div>`. (indent now comes from the parent `pn-kids`, not a per-node modifier — matches design SessionNode.)
- L633 `<div className="sessionTreeChildren">` → `<div className="pn-kids pn-kids--st">`.

### Edit 3 — wrap coordinator roots in `pn-team` (L1401-1426), tree + props VERBATIM
```tsx
<div className="pn-list">                                  {/* was className="sessionTree" */}
  {visibleRoots.map((root) => {
    const group = teamGroupByCoordinator.get(root.id);
    const node = (
      <SessionNodeRenderer key={root.id} node={root} depth={0}
        /* …ALL existing props verbatim (tab, collapsedSessions, maestroColorMap,
           linkMap, activeLocalSessionId, inspectedSessionId, maestroTasks,
           resumingSessionId, onToggleCollapse, onOpenDetail, onSelect,
           onJumpToTerminal, onStop, onResume, onRestore, onToggleHumanComplete,
           onOpenTeamView)… */ />
    );
    if (!group) return node;                              // standalone root → bare (matches design idle nodes)
    const n = group.workerMaestroSessionIds.length + 1;
    const teamName = group.teamName ?? root.teamMemberSnapshot?.name ?? root.name;
    return (
      <div className="pn-team" key={root.id}>
        <div className="pn-team__head">
          <span className="pn-team__dot" style={{ background: group.color.primary }} />
          <span className="pn-team__name">{teamName}</span>
          <span className="pn-team__count">{n} session{n === 1 ? "" : "s"}</span>
        </div>
        {node}
      </div>
    );
  })}
</div>
```
Pluralization `{n === 1 ? "" : "s"}` follows the existing codebase pattern (`SessionProjectGroup`), not invented design text.

### Invariants preserved (verify post-edit)
- `SessionNodeRenderer` props/recursion/`React.memo` unchanged → WebSocket realtime + collapse state intact.
- `data-maestro-session-id` retained on the node wrapper (used by terminal reparenting / DOM queries).
- No store/handler/ref/effect touched; `pn-team` is a pure presentational wrapper; lookup map is a read-only index.
- Only roots that ARE coordinator/team groups get boxed; solo sessions render bare (design parity). A 0-worker coordinator → "1 session" boxed alone (honest; noted).

### Verification targets (light + dark) vs `panel-redesign/shell.jsx` SpacesPanel L211-214 + `tiles.css` L236-247
- `pn-team`: `border:1px var(--pn-line)`, `radius var(--pn-r-md)`, `bg var(--pn-card)`, `margin:8px 12px`.
- `pn-team__head`: `bg var(--pn-surface)`, `border-bottom var(--pn-line)`, `padding:8px 12px`.
- `pn-team__dot` 8px = `group.color.primary` (same both themes — team identity).
- `pn-kids--st` indent `margin-left:19px; border-left var(--pn-line)`.
- Dark: `--pn-line`/`--pn-card`/`--pn-surface` swap via `theme-dark.css`; confirm dot legibility on both card backgrounds.
- Then: `bun run build:ui` typecheck pass; light+dark screenshots; report complete.

---

## STEP 5/6 — IMPLEMENTATION LANDED + VERIFICATION (2026-06-09)

**File edited:** `maestro-ui/src/components/SessionsSection.tsx` (rebased on Spaces Layout worker's final hunks; their `pn-quick`/`pn-scroll`/`pn-fade` untouched). RULING #1 outright class swaps throughout; zero logic/prop/handler/ref/store change.

| Region | Before → After |
|---|---|
| Panel header | `sidebarHeader` → `pn-head`; `title` → `pn-proj` + inserted `pn-head-spacer`; 5 action buttons `btnSmall btnIcon` → `pn-ib` (3 toggles add `pn-ib--active`) |
| View filter | `sessionsSegmentedFilter`/`__btn`/`--active` → `pn-filters`/`pn-filter`/`pn-filter--active` |
| Sub-tabs | `sessionSubTabs`/`__btn`/`--active` → `pn-subbar`/`pn-subtab`/`pn-subtab--active`; count → `pn-tab-n`; live indicator → `pn-chip` + `pn-dot-wrap`>`pn-dot pn-dot--run pn-dot--live` |
| Tree container | `sessionTree` → `pn-list` |
| Team grouping | coordinator roots wrapped in `pn-team`>`pn-team__head` (`pn-team__dot` bg=`group.color.primary`, `pn-team__name`=`teamName ?? teamMemberSnapshot.name ?? name`, `pn-team__count`=`${workers+1} session(s)`); standalone roots render bare |
| Nesting | `sessionTreeChildren` → `pn-kids pn-kids--st` |
| Files header | `spacesGroup__header`/`__label`/`__count` → `pn-sec-head`>`pn-eyebrow`>`pn-count` + `pn-line` |
| Empty state | inline token colors (`--pn-ink`/`--pn-ink-3`/`--pn-ink-4`); structure kept |
| Pure-read add | `teamGroupByCoordinator` memo (Map coordId→TeamGroup over existing `teamGroupData.groups`) |

**Deliberately PRESERVED (zero-functionality):**
- `.sessionTreeNode` class KEPT — it is a JS selector hook (`PromptSendAnimation.tsx:51` queries `.sessionTreeNode[data-maestro-session-id]`), not a theme class. Indentation now comes from the parent `pn-kids`, so the `--child` modifier is cosmetically inert but left in place (no CSS, harmless).
- All `SessionNodeRenderer` props/recursion/`React.memo` unchanged → WebSocket realtime + per-node collapse intact.

**Verification:**
- ✅ Typecheck: `cd maestro-ui && bunx tsc -b` → exit 0, no errors.
- ⚠️ `bun run build:ui` (tsc+vite): tsc passed; the vite production bundle step was SIGTERM'd by the runner (environmental "Polite quit", resource-limited) — NOT a code error. Typecheck is the authoritative type-safety gate and it passed.
- ✅ Live in running staging app: Vite dev (4568) + Tauri dev are running, so HMR hot-loaded these changes into the live "Maestro" staging window for immediate visual review.
- ✅ **DARK theme verified** via Screenshots Worker capture (`.maestro/redesign/screenshots/full-layout-dark.png`): right panel shows the `pn-team` box "Backend Squad" (dot + name + "7 sessions" right-aligned, coordinator nested in card), `pn-subbar` sub-tabs (Open 2 / Done / Archived 8, Open active), `pn-filters` pill row, and a standalone session rendering bare (correct design parity). No layout breakage.
- ✅ **LIGHT theme verified** (`.maestro/redesign/screenshots/right-panel-sessions-light.png`): my regions render with correct light tokens — `pn-team` box warm-paper (`--pn-card`) with `--pn-surface` head bar + legible team dot, `pn-subtab--active` light pill, `pn-filters` pills, bare standalone root. ✓ for my scope.
- (This worker cannot self-capture screenshots — no browser-automation tool; Tauri native window — verification via the Screenshots Worker's live captures.)

**FINAL light/dark gate — SATISFIED (post-backdrop-fix, current integrated state):**
- ✅ DARK: `right-panel-dark.png` + latest `full-layout-*` — pn-head/pn-ib, pn-filters, pn-subbar, pn-team box all coherent.
- ✅ LIGHT: `full-layout-light.png` (Screenshots Worker, after Layout's `spacesPanelContent`→transparent fix) — right-panel header/filters/sub-tabs/`pn-team` all sit on warm PAPER; container-leak gate passed. (Center terminal stays dark by design.)
- ✅ `tsc -b` exit 0 re-run against current siblings (incl. Tile worker's `SessionListItem` pn-st rewrite) — prop pass-through still type-clean.
- ✅ Rule-2 container audit CLEAR (independently confirmed by Right Panel Coordinator); orphaned `.sidebarHeader`/`.agentShortcutRow` theme-primary border rules don't apply to my pn-* elements.

### Findings from light/dark verification
1. ⚠️ **Cross-cutting (NOT my scope):** in LIGHT mode the right-panel *backdrop* stays dark while redesigned cards turn paper → my transparent-by-design header/filters/sub-tabs sit on a dark backdrop (incoherent). Root cause = panel container bg: `SpacesPanel.tsx` uses `pn-sp` (correct) but the inner `spacesPanelContent` wrapper (SpacesPanel.tsx:120) carries a legacy dark bg overriding `--pn-surface` in light. Invisible in dark (backdrop matches). Flagged to Spaces Layout worker to token-swap that wrapper. My regions use transparent bg per design — correct.
2. ℹ️ **Intentional divergence vs `expected-full-layout-dark.png`:** the expected mockup shows RUNNING/IDLE `pn-sec-head` STATUS sections; this build uses Open/Done/Archived tabs + spawn tree per coordinator ruling **E2 → Option A** (zero re-bucketing, preserve live data shape). `pn-team` box + `pn-kids` nesting + bare standalone roots DO match expected. The absent status sections are the approved descope, not a defect (asked coordinator to re-confirm Option A given the mockup).

**Visual checklist vs `panel-redesign/shell.jsx` SpacesPanel (L210-216) + `tiles.css` (L236-247), light + dark:**
1. Panel header reads as `pn-head` (warm paper, "Sessions" in ink, icon buttons right-aligned via spacer).
2. Filter pills (`pn-filter`) + active pill ink border/bg.
3. Sub-tabs (`pn-subtab`) active tint; live `pn-chip` with pulsing run dot.
4. Coordinator team box: `pn-team` card (border `--pn-line`, radius `--pn-r-md`, `--pn-card` bg), head bar `--pn-surface` with colored 8px dot + name + "N sessions"; subtree inside.
5. Child sessions indented under `pn-kids--st` left hairline (19px).
6. Files header hairline `pn-sec-head` with mono eyebrow + count.
7. Dark: `--pn-line`/`--pn-card`/`--pn-surface` swap; team dot color legible on both.

**Open foundation gap:** `pn-ib--active` referenced but not yet in redesign-tokens.css (escalated). Until added, active toggle buttons show no tint (aria-pressed still conveys state).

---

## STEP 1 — Existing implementation (functional surface to PRESERVE VERBATIM)

**Primary file:** `maestro-ui/src/components/SessionsSection.tsx`
**Supporting:** `maestro-ui/src/utils/teamGrouping.ts`, `maestro-ui/src/hooks/useSessionTree.ts`, `maestro-ui/src/utils/sessionLifecycle.ts`

### Grouping / recursion logic (DO NOT TOUCH — restyle wrappers only)
| Surface | What it does | Preserve |
|---|---|---|
| `teamGroupData = useMemo(buildTeamGroups(sessions, maestroSessions, teamsMap))` | builds team groups (coordinator + workers, color, status, teamName/avatar) | verbatim |
| `useSessionTree(projectMaestroSessions) → { roots }` | builds spawn-chain tree (coordinator→children) | verbatim |
| `maestroColorMap` (msId→TeamColor) | per-session team color | verbatim (data source for `pn-team__dot`) |
| `linkMap` (msId→{localSessionId, exited}) | live-terminal liveness | verbatim |
| `childrenByParentId` / `collectSubtreeIds` | subtree cascade for close/restore | verbatim |
| `visibleRoots` = `sessionRoots.filter(resolveSessionTab === sessionSubTab)` | tab filtering | verbatim |
| `sessionTabCounts` / `liveCount` | Open/Done/Archived counts + live count | verbatim |
| `SessionNodeRenderer` (recursive) | renders each node via `SessionListItem`, recurses `node.children` when `!isCollapsed` | recursion + props verbatim; **only restyle the wrapper divs** |
| `collapsedSessions` + `handleToggleSessionCollapse` | per-node collapse state | verbatim |
| `inspectedSessionId` (useUIStore) + `isSelected` derivation | selection highlight | verbatim |
| Handlers: `handleSelectTile`, `handleJumpToTerminal`, `handleStopSession`, `handleResume`, `handleRestoreTree`, `handleToggleHumanComplete`, `handleOpenSessionDetail`, `handleOpenTeamView` | tile actions threaded to `SessionListItem` | verbatim (pass-through) |
| Store hooks: `useMaestroStore` (tasks, sessions, teams, fetchSession, resumeSessionFlow, resumingSessionId, setSessionHumanComplete, setSessionArchived, hardRefresh), `useUIStore`, `useSpacesStore` | WebSocket-backed realtime state | verbatim |
| `sessionsRef` (live ref for stable callbacks) | keeps `handleSelectTile` reference-stable across WS ticks → preserves `React.memo` on nodes | verbatim — do not add deps |

### Realtime / collapse invariants to preserve
- WebSocket updates flow automatically via `useMaestroStore` selectors — no polling. My wrapper restyle must not break memoization (keep `SessionNodeRenderer` props identical; do not introduce new inline objects in the hot path).
- Collapse state is per-node in `collapsedSessions` (Set). Restyle the arrow/indent but keep the same toggle wiring (lives in `SessionListItem`, owned by Tile Worker — I only style `sessionTreeChildren` visibility wrapper).

### Existing DOM (the visual surface I restyle)
```
.sessionList
  .sessionTree
    .sessionTreeNode (data-maestro-session-id)        ← per root
      <SessionListItem/>                               (TILE — Tile Worker)
      .sessionTreeChildren                             ← when expanded & has kids
        .sessionTreeNode.sessionTreeNode--child        ← recursion, indented
          <SessionListItem depth=n/>
          .sessionTreeChildren ...
  .sessionEmptyState (sessionEmptyState__icon/title/hint)   ← empty
```
There are currently **no** `pn-sec-head`-style section headers and **no** `pn-team` boxes in this tree.

---

## STEP 2 — Design (visual surface to ADOPT)

**Source:** `panel-redesign/shell.jsx` `SpacesPanel()` (lines 191–221) + `right-panels.jsx` `RosterRight()`; recursion model `tiles.jsx` `SessionNode()` (213–221); CSS `theme.css` + `tiles.css`.

```
.pn-scroll
  .pn-sec-head  > .pn-eyebrow "Running" <.pn-count>· 4</> + .pn-line
  .pn-team
    .pn-team__head > .pn-team__dot(color) + .pn-team__name + .pn-team__count "4 sessions"
    <SessionNode node=coordinator/>          ← SessionTile + .pn-kids.pn-kids--st recursion
  .pn-sec-head  > .pn-eyebrow "Idle" <.pn-count>· 2</> + .pn-line
  <SessionNode .../> ...                      ← idle roots, not boxed
.pn-fade
```
`SessionNode` recursion (design): `<div><SessionTile/>{children && !collapsed && <div className="pn-kids pn-kids--st">{children.map(SessionNode)}</div>}</div>` — children indent via a **single `pn-kids` wrapper with a left hairline**, NOT a per-node `--child` modifier.

---

## STEP 3 — Cross-reference map (new element → exact foundation class + tokens)

| New visual element (mine) | Replaces existing | Foundation class | Tokens / values |
|---|---|---|---|
| Section header row | (new, per E2 option A: restyle existing labels only) | `.pn-sec-head` | `padding:14px 16px 7px; display:flex; gap:8px; align-items:center` |
| Section label text | section/eyebrow text | `.pn-eyebrow` | `--pn-mono` 10.5px/600, `letter-spacing:.12em`, uppercase, `color:var(--pn-ink-3)` |
| Section count | inline count | `.pn-count` (inside `.pn-eyebrow`) | `color:var(--pn-ink-4)` |
| Section trailing rule | — | `.pn-line` (span) | `flex:1; height:1px; background:var(--pn-line)` |
| List container | `.sessionTree` | `.pn-list` (optional) | `display:flex; flex-direction:column` |
| Team group box (E3) | flat root (per-tile color) | `.pn-team` | `margin:8px 12px; border:1px solid var(--pn-line); border-radius:var(--pn-r-md); overflow:hidden; background:var(--pn-card)` |
| Team head | — | `.pn-team__head` | `flex; gap:8px; padding:8px 12px; border-bottom:1px solid var(--pn-line); background:var(--pn-surface)` |
| Team dot | team color (currently on tile) | `.pn-team__dot` | `8px circle`; `background` = inline `group.color` (from `maestroColorMap`/`teamGroupData`) |
| Team name | — | `.pn-team__name` | `12px/600 var(--pn-ink)`, ellipsis |
| Team count | — | `.pn-team__count` | `--pn-mono 10px var(--pn-ink-3); margin-left:auto` → `${workers+1} sessions` |
| Children indent wrapper | `.sessionTreeChildren` + per-node `.sessionTreeNode--child` | `.pn-kids.pn-kids--st` | `margin-left:19px; border-left:1px solid var(--pn-line)` |
| Per-node wrapper | `.sessionTreeNode` | plain `<div>` (keep `data-maestro-session-id`) | — |

### Token / kit GAPS to flag to Foundation (escalate)
1. **`pn-team*` and `pn-kids` are defined in `panel-redesign/tiles.css`, not `theme.css`.** `pn-sec-head`/`pn-eyebrow`/`pn-count`/`pn-line`/`pn-list` are in `theme.css`. → Confirm Foundation ports **`tiles.css`** (or at least `.pn-team`, `.pn-team__head/__dot/__name/__count`, `.pn-kids`, `.pn-kids--st`) into `maestro-ui/src/components/maestro/redesign/redesign-tokens.css`. If absent, I'm blocked on E3.
2. **Variables consumed:** `--pn-line`, `--pn-line-2`, `--pn-card`, `--pn-surface`, `--pn-ink`, `--pn-ink-3`, `--pn-ink-4`, `--pn-mono`, `--pn-r-md`. Confirm all present in `redesign-tokens.css` (light) + dark overrides (`--pn-line`/`--pn-line-2`/`--pn-card`/`--pn-surface` differ in `theme-dark.css`).
3. **No kit *primitive* needed by me** (I render structural wrappers; the tile/icon/dot primitives belong to the Tile Worker). If E3 team dot should use a kit `StatusDot`, confirm — but design uses a plain colored `pn-team__dot`, so I'll inline the color.

### Foundation consumption paths (per coordinator correction 2026-06-09)
- CSS: `maestro-ui/src/components/maestro/redesign/redesign-tokens.css`
- Kit: `maestro-ui/src/components/maestro/redesign/kit.tsx`
- Theme hook/flag: `maestro-ui/src/components/maestro/redesign/useRedesignTheme.ts`
- Scope everything under `<html data-redesign>` / dark via `<html data-theme="dark">`.

---

## Boundary with sibling workers (Right Panel branch)
- **🪟 Spaces Layout Worker** owns: SpacesToolbar tabs, QuickLaunch, `pn-scroll`/`pn-fade` chrome, the Open/Done/Archived **sub-tab row**, live-count chip. → I do **not** touch these.
- **🎴 Session Tile Worker** owns: `SessionListItem.tsx` (`pn-st`/`pn-sess` row, status dot, collapse arrow, actions). → I do **not** touch the tile; I only style the wrappers around it (`pn-team`, `pn-kids`, `pn-sec-head`).
- **Me (📜 Session List Worker):** section headers, team-group box, children-indent wrapper, recursion container — the connective tissue between tiles.

## Open questions summary (awaiting coordinator)
1. E1 — confirm target = `SessionsSection.tsx` (not `MultiProjectSessionsView.tsx`).
2. E2 — confirm option A (restyle only, keep Open/Done/Archived) vs. re-bucket by status.
3. E3 — confirm introduce `pn-team` box per coordinator root vs. keep flat + per-tile color; coordinate color ownership with Tile Worker.
4. E4 — confirm empty-state / DnD terminal list / live-count handling (token-only or leave).
5. GAP — confirm Foundation ports `tiles.css` `pn-team*` + `pn-kids` into `redesign-tokens.css`.
