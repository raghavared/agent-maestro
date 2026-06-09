# SessionTile Re-skin Contract

**Worker:** Session Tile Worker (🎴)
**Scope:** Re-skin `maestro-ui/src/components/maestro/SessionListItem.tsx` IN PLACE to the
panel-redesign `pn-sess` row (Roster variant) — appearance only, **zero functionality changes**.
**Gate:** Steps 1-3 only (study + contract). NO source edits until `FOUNDATION-DONE.md` is broadcast.

## Source-of-truth references

| What | Path |
|---|---|
| Component to re-skin | `maestro-ui/src/components/maestro/SessionListItem.tsx` (606 lines) |
| Design row (canonical) | `panel-redesign/shell.jsx` → `SRow` (L27-45) |
| Design row (in context) | `panel-redesign/right-panels.jsx` → `SessRow` + `RosterRight` (L30-78) |
| Light tokens | `panel-redesign/theme.css` (`:root`, `.pn-sess*`, `.pn-agent`, `.pn-chip`, `.pn-ib`, `.pn-dot`) |
| Dark tokens | `panel-redesign/theme-dark.css` (`html[data-theme="dark"]`) |
| Kit primitives (JSX src) | `panel-redesign/kit.jsx` (Icon, Mark, AgentTile) |
| **Foundation kit (TS, consume this)** | `maestro-ui/src/components/maestro/redesign/kit.tsx` |
| **Foundation tokens (consume this)** | `maestro-ui/src/components/maestro/redesign/redesign-tokens.css` |
| **Theme hook** | `maestro-ui/src/components/maestro/redesign/useRedesignTheme.ts` |

> Foundation CSS is scoped under `html[data-redesign]` (light) and
> `html[data-redesign][data-theme="dark"]` (dark). Classes/tokens are identical to
> panel-redesign — no global `:root` mutation. `AgentTile` in `kit.tsx` adds a
> `pn-agent--init` initial-letter fallback for non-claude/codex/gemini/terminal kinds.

---

## A. Functional surface — PRESERVE VERBATIM (no behavior may change)

### Props (all 20 — signature unchanged)
`session, depth, teamColor, childCount, isCollapsed, onToggleCollapse, link, isSelected,
maestroTasks, tab, onOpenDetail, onSelect, onJumpToTerminal, onStop, onResume, onRestore,
onToggleHumanComplete, onOpenTeamView, isResuming`

### Store hooks (keep, same selectors)
- `useMaestroStore((s) => s.updateSessionMode)` → `updateSessionMode`
- `useUIStore((s) => s.setDocOverlay)` → `setDocOverlay`
- `useUIStore((s) => s.sessionShowTaskDetails)` → `showTaskDetails`

### Local state (keep)
`isMetaExpanded`, `copiedRef`, `showModeDropdown`, `modeDropdownPos`

### Refs (keep)
`modeBtnRef` (HTMLButtonElement)

### Effects / memos (keep verbatim)
- `useEffect([showModeDropdown])` — positions mode dropdown from `modeBtnRef.getBoundingClientRect()`
- `useMemo` `linkedTasks` (deps `session.taskIds, maestroTasks`)
- `useMemo` `detailsTooltip` (deps `title, status, session.needsInput?.active, session.model, mode, linkedTasks`)

### Handlers / callbacks (keep verbatim, including `e.stopPropagation()` calls)
- `handleModeChange` (useCallback)
- `handleCopyReference` (useCallback — clipboard + 1200ms copied flag)
- Root `onClick={() => onSelect(session, link)}`
- arrow `onClick` → `onToggleCollapse()` (guarded by `hasChildren`)
- radio `onClick` → `onToggleHumanComplete(session)`
- docBadge `onClick` → `setIsMetaExpanded(true)`
- teamView `onClick` → `onOpenTeamView(session)`
- resume `onClick` → `onResume(session.id)` (guarded by `canResume`)
- stop `onClick` → `onStop(session, link)`
- restore `onClick` → `onRestore(session)`
- copyRef `onClick` → `handleCopyReference()`
- caret `onClick` → `setIsMetaExpanded(v => !v)`
- mode picker button + portal dropdown options + overlay close
- docItem `onClick` → `setDocOverlay(doc)`
- details `onClick` → `onOpenDetail(session.id)`

### Derived logic (keep verbatim — these are the load-bearing predicates)
- `status`, `needsInput`, `isLinkedLive = Boolean(link && !link.exited)`
- `hasChildren = childCount > 0`, `isHumanCompleted`, `isArchived`
- `isOutOfTab = depth > 0 && isArchived && tab !== 'archived'`
- `snapshots` / `avatars` / `memberNames` / `title` derivation
- `canResume = (session.metadata?.agentTool || "claude-code") === "claude-code"`
- `willOpenStats = willOpenStatsOnClick(session, link)`; `isShowingTerminalOnClick = !willOpenStats`
- Constant maps: `SESSION_STATUS_LABELS/SYMBOLS`, `MODE_LABELS/OPTIONS`, `TASK_STATUS_SYMBOLS`,
  `TASK_LINE_COLORS`; helpers `formatTimeAgo`, `formatDuration`
- `createPortal(... document.body)` for mode dropdown
- `React.memo` wrapper + exported interfaces `SessionTileLinkInfo`, `SessionListItemProps`

### A11y / attributes (keep verbatim)
- `aria-hidden` on accent span, archived glyph, resume icon
- `aria-pressed={isHumanCompleted}` on radio
- `aria-label="Copy session reference"` on copyRef
- `data-status-anchor` on status span
- `title=` tooltips on every interactive element (all preserved)
- `style={{ "--session-team-color" }}` CSSProperties on root; `--task-accent` on task lines

---

## B. Visual surface — REPLACE (class + token + kit-primitive mapping)

The design `pn-sess` row = **3 flex columns**: `AgentTile lg` · `pn-sess__body` (name + status) · `pn-sess__trail` (chip + icon-button). Map the existing visual elements onto that skeleton:

| Existing element | New visual treatment | Class(es) | Token(s) | Kit primitive |
|---|---|---|---|---|
| Root `.sessionTile` + status/state modifier classes | `pn-sess` row; `--active` when `isSelected`; `--wait` when `needsInput` | `pn-sess`, `pn-sess--active`, `pn-sess--wait` | `--pn-line` (border-bottom), `--pn-hover`, `--pn-active`, `--pn-wait-soft` | — |
| `.sessionTile__avatar` (emoji) + title text | Leading `AgentTile lg` (agent logo) + `pn-sess__name` | `pn-sess__name` | `--pn-ink`, font 13.5px/600 | `<AgentTile kind={…} lg />` |
| `.sessionTile__status` symbol + `.sessionTile__linkedDot` / `__stoppedDot` | Status row: `pn-dot` (+`--live`) + status text | `pn-sess__status`, `pn-dot-wrap`, `pn-dot`, `pn-dot--{run\|wait\|idle\|block}`, `pn-dot--live`, `pn-sess__statustext`, `pn-sess__statustext--wait/--run` | `--pn-run/--pn-wait/--pn-idle/--pn-block` | `pn-dot` |
| `.sessionTile__time` (formatTimeAgo/Duration) | Trailing `pn-meta` `· {elapsed}` inside status row | `pn-meta` | `--pn-mono`, `--pn-ink-3` | — |
| `.sessionTile__docBadge` / task count | `pn-chip` count chip in trail | `pn-chip` | `--pn-active`, `--pn-ink-3`, `--pn-r-pill` | — |
| Action buttons (`__btn`, `__resumeBtn`, caret) | `pn-ib` icon buttons (24×24 inline-size per SRow `more`) | `pn-ib` | `--pn-ink-3`, `--pn-hover` | `<Icon name="…" />` |
| `.sessionTile__tag--archived/--done` | small `pn-tag` text tags | `pn-tag`, `pn-tag--*` | `--pn-line-2`, status colors | — |
| WorktreeBadge | keep existing component; OR `pn-tag` w/ `gitBranch` icon | (TBD — see GAP) | — | `<Icon name="gitBranch" />` |
| Expanded meta (`.sessionTile__meta` …) | re-skin badges→`pn-chip`/`pn-tag`, mode dropdown, docs list, time | `pn-chip`, `pn-tag`, `pn-ib`, `pn-meta` | status + line tokens | `Icon` |

### Icon mapping (existing glyph → kit `Icon name`)
| Existing | Icon name |
|---|---|
| `↻` resume | `refresh` |
| `✕` close/stop | `x` |
| `↩` restore | `arrowRight` (flip) — **GAP, see below** |
| `⧉` copy ref | `copy` |
| `▾`/`▴` caret | `chevronD` / (rotate) |
| `⊞` team view | `teamview` |
| `▸`/`▾` collapse arrow | `chevronR` / `chevronD` |
| `ⓘ` details | `info` |
| `M↓` / `{ }` doc | `doc` |
| `!` needs-input / status symbols `◐○◉✓✗■` | replaced by `pn-dot` color + statustext words |

### Status → dot/statustext class derivation (NEW — design uses semantic buckets)
The design `pn-dot--{run,wait,idle,block}` + `statustext--{run,wait}` does **not** 1:1 map the
6 `MaestroSessionStatus` values. Proposed derivation (preserves meaning, changes only appearance):
- `needsInput` active → `pn-dot--wait` + `pn-sess__statustext--wait`, text "Needs input"
- `working`/`spawning` → `pn-dot--run` (+`--live` when `isLinkedLive`) + `statustext--run`
- `idle` → `pn-dot--idle`
- `completed` → `pn-dot--run` (no live) / **or** keep a done treatment — **GAP**
- `failed` → `pn-dot--block`
- `stopped` → `pn-dot--idle`
Status **text** comes from existing `SESSION_STATUS_LABELS` (unchanged data).

---

## C0. REVISION — pivot to the pn-st model (FINAL, implemented)

> **Coordinator redirect:** the correct target is the **pn-st SessionTile** model
> (`panel-redesign/tiles.jsx` `SessionTile` L147-211 + `redesign-tiles.css`), NOT pn-sess.
> Reason: the Session List worker shipped `SessionsSection.tsx` with `pn-team` group boxes +
> `pn-kids pn-kids--st` nesting (the tiles.jsx `SessionNode` tree) — built to wrap pn-st tiles.
> A pn-sess row inside `pn-kids--st` is visually incoherent. Verified against
> `screenshots/expected-full-layout-dark.png`.

**Implemented pn-st spine (SessionListItem.tsx):**
`pn-st`(+`--needsInput`/`--selected`/`--archived`/`--outOfTab`) → `pn-st__main` →
`pn-st__arrow`(+`--expanded`/`--empty`) · `pn-st__arrowCount` · `pn-st__radio`(/`--archived`,
`Glyph kind="archived"`) · `pn-st__title`(`AgentTile` + `pn-st__titleText`) · `pn-st__tag--done` /
out-of-tab `pn-st__tag` · `pn-st__live`(`pn-dot--run pn-dot--live`)/`pn-st__stopped` · `pn-mini`
docs(button→expand) + `pn-mini` worktree(`gitBranch`) · `pn-st__statusglyph`(`Glyph` + `data-status-anchor`) ·
`pn-st__actions`(teamView `pn-st__btn` / **Resume `pn-st__resume` WITH text label** / stop
`pn-st__btn--danger` / restore `Icon undo` / copy `pn-st__btn` / details caret `chevronD`).
Then `pn-st__tasklines` > `pn-st__taskline`(`Glyph kind={task.status}` + `pn-st__tasklineLabel`).
Then `pn-st__meta` > `pn-st__metasec` × (Status: `pn-badge--status-{kind}` + Glyph + **mode dropdown
via `createPortal` → `pn-pop-ov`/`pn-pop`/`pn-opt`/`pn-opt--cur`/`pn-opt__chk`, KEEPING
`updateSessionMode` + `modeBtnRef`**; model/strategy/worktree `pn-badge`; time `pn-tt__time`),
Tasks `pn-st__taskchip`, Docs `pn-docpill`, Actions `pn-st__actbtn` Details).

**Kit imports (all from `redesign/kit`):** `Icon, Glyph, AgentTile, type AgentKind`.
**Removed:** old `sessionTile*` classes (outright swap, RULING #1), the pn-sess attempt + its
`SessionListItem.redesign.css`, the `sessionTile__modePicker` leftover, `WorktreeBadge` import
(worktree now rendered as `pn-mini`/`pn-badge` per design), and 3 now-dead presentational consts.
**Section A preserved verbatim:** all 20 props, 3 store hooks, 4 state, `modeBtnRef`, both
effects/memos, every handler + `e.stopPropagation`, `aria-pressed`/`aria-label`/`data-status-anchor`.
**Status glyph map:** `needsInput → 'needsInput'`, else raw `status` (all 6 → kit `GlyphKind` 1:1).

**Verification:** `cd maestro-ui && bunx tsc -b --force` → SessionListItem.tsx **0 errors** (clean).
Only project error is `MaestroPanel.tsx` (concurrent PanelIconBar worker, mid-edit — not mine).
Vite prod build intentionally NOT run (team-wide concurrent-bundle SIGTERM; `tsc -b` is the gate).

---

## C. RESOLUTIONS (earlier pn-sess rulings — superseded by C0, retained for traceability)

> SRow is a MINIMAL demo, not an exhaustive spec. Zero-functionality rule stands: keep ALL
> controls, expressed in the design's visual vocabulary (`pn-ib`, `pn-chip`, `pn-tag`, `AgentTile`,
> `pn-dot`, disclosure regions, `pn-meta`).

### Render-path cross-check (CONFIRMED)
`SessionListItem.tsx` **is the actually-rendered row** — not a dead surface.
`SessionsSection.tsx` → `SessionNodeRenderer` (L574-662) is a recursive tree-walker that renders
`<SessionListItem>` at L611 and recurses into `node.children` at L635. There is **no competing inline
row renderer**. → I re-skin `SessionListItem.tsx`; my work is on the live surface.
**Boundary:** nesting/indentation is owned by `SessionsSection`'s outer `.sessionTreeNode--child`
(L608) + `.sessionTreeChildren` (L633) wrapper, NOT inside `SessionListItem`. So gap-10 `pn-kids`
indentation belongs to the **Session List worker** (sess_1780949404182_9xku5t2ky), not me — I keep
consuming the `depth` prop but add no nesting container.

| # | Gap | RULING |
|---|---|---|
| 1 | Collapse arrow + child count | Arrow → **leading `pn-ib`** BEFORE AgentTile, `Icon chevronR` (collapsed) / `chevronD` (expanded), 24×24, guarded by `hasChildren`. `childCount` → **`pn-chip`** in `pn-sess__trail`. |
| 2 | Human-complete radio / archived glyph | **Leading `pn-ib`** (same leading cluster, before AgentTile). Keep `aria-pressed={isHumanCompleted}`. Toggle → `Icon check`; archived → `Icon archive`. Do **not** overlay on AgentTile (tile = pure agent logo). |
| 3 | Actions cluster | **Hover/focus-revealed row of ICON-ONLY `pn-ib`** inside `pn-sess__trail` (also shown when `isSelected`). Icons: teamView→`teamview`, resume→`refresh`, stop→`x`, copyRef→`copy`, caret→`chevronD`, restore→**PENDING (gap 7)**. Resume is **icon-only** (no text label): `title='Resume'/'Resuming…'`, resuming = `disabled` + title. Keep every `onClick` + `e.stopPropagation` verbatim. |
| 4 | Expanded meta (`isMetaExpanded`) | Keep as **disclosure region BELOW** the `pn-sess` row. Badges→`pn-tag`; docs→rows w/ `Icon doc`; time→`pn-meta`. **Portal mode-dropdown (`updateSessionMode`) PRESERVED** — trigger reskinned as `pn-tag`/`pn-chip`-styled button; portal menu on `--pn-paper` + `--pn-line` border using pn tokens. (Escalate if a dedicated popover token is needed — don't invent.) |
| 5 | Inline task lines (`showTaskDetails`) | Render below row. **Drop cycling `TASK_LINE_COLORS`** (decorative, carried no status meaning); replace with a **`pn-dot` colored by each task's status** (TASK_STATUS → run/wait/idle/block). Title as body text. Task data preserved verbatim. |
| 6 | archived/done tags | **`pn-tag`** (text labels, like TRow `pn-tag--{prio}`). Counts → **`pn-chip`**. |
| 7 | Restore (`↩`) icon | **FOUNDATION GAP — pending.** Foundation adding an undo/restore glyph to PN_ICONS. Restore button `Icon name` = **TODO**, coordinator confirms on publish. Do NOT pick freehand. |
| 8 | status→dot | needsInput→`pn-dot--wait`+`statustext--wait`; working/spawning→`pn-dot--run` (+`--live` when `isLinkedLive`)+`statustext--run`; idle→`pn-dot--idle`; failed→`pn-dot--block`; stopped→`pn-dot--idle`; **completed→`pn-dot--idle`** (neutral; word "Completed" + absence of `--live` carries it). statustext words from existing `SESSION_STATUS_LABELS` unchanged. |
| 9 | teamColor accent bar | **DROP** `.sessionTile__accent` colored left-border (design bans colored left-bars, shell.jsx L5). Accent span is `aria-hidden` + purely visual → safe to remove; `--session-team-color` only read by that span → drop the style too. `teamColor` **prop signature stays** (interface preserved). Team identity lives only on **group-level `pn-team__dot`** (Session List worker). Do NOT double-encode on the tile. |
| 10 | depth>0 indentation | **Session List worker's surface** (`.sessionTreeChildren`/`pn-kids` in SessionsSection). I keep consuming `depth`; `isOutOfTab` keeps its existing render guard, no special visual. |

### Outstanding before implementation
- **Restore icon name** — blocked on foundation PN_ICONS publish (gap 7). Marked TODO in code.
- Confirm with Session List worker (sess_1780949404182_9xku5t2ky): team color on `pn-team__dot`
  only; indentation via `.sessionTreeChildren`/`pn-kids` — no overlap with my row.

---

## C-ARCHIVE. Original gap list (now resolved above — retained for traceability)

The `SRow`/`SessRow` design models a **minimal** session row (avatar · name · 1 status line ·
1 chip · 1 more-button). The real `SessionListItem` carries far more **functional** surface that
must be preserved verbatim. The design provides **no slot** for the following — I need a ruling on
placement/treatment for each (none can be dropped, per zero-functionality-change):

1. **Sub-session collapse arrow + child count badge** (`hasChildren`, `onToggleCollapse`,
   `isCollapsed`, `childCount`). SRow has no disclosure control. → Where does it mount — a leading
   `pn-ib` before the AgentTile? Reuse the Ledger `TaskNode` disclosure pattern?
2. **Leading human-complete radio / archived glyph** (`onToggleHumanComplete`, `aria-pressed`,
   archived `▫`). SRow leads with the AgentTile, not a control. → Overlay on the tile? A separate
   leading `pn-ib`?
3. **Full actions cluster** — teamView, resume(label+icon), stop, restore, copyRef, caret.
   SRow trail has exactly ONE `pn-ib` ("more"). → Collapse all into a `more` menu? Or render a row
   of `pn-ib` buttons in `pn-sess__trail` (hover-reveal)? Resume currently has a **text label**
   ("Resume"/"Resuming…") — keep label or icon-only?
4. **Expanded meta panel** (`isMetaExpanded`) — status/mode/model/strategy/worktree badges, editable
   **mode dropdown (portal)**, task chips, docs list, Details button. SRow has no expand state at
   all. → Keep as a disclosure region below the `pn-sess` row reskinned with `pn-chip`/`pn-tag`?
   Confirm the portal mode-dropdown stays (it's a real store mutation).
5. **Inline task lines** (`showTaskDetails && linkedTasks`) with cycling `TASK_LINE_COLORS`.
   Not in SRow. → Render below row; reskin to `pn-` tokens? Keep accent colors or map to status dots?
6. **`pn-tag` vs `pn-chip` for `archived`/`done` tags** — confirm which primitive.
7. **`restore` (`↩`) icon** — no kit icon for a return/undo arrow. → Add to PN_ICONS (foundation
   owns the map) or reuse `arrowRight` flipped/`refresh`?
8. **`completed`/`failed`/`stopped` status colors** — SRow only demonstrates run/wait/idle.
   Confirm `failed→pn-dot--block`, `completed→?`, `stopped→pn-dot--idle`.
9. **`teamColor` accent** (`.sessionTile__accent`, `--session-team-color`). The design philosophy is
   explicitly "status by dots + words, **never colored left-border bars**." → Drop the colored
   accent bar, or keep team color as a subtle dot/tile ring? Need a ruling (this is a deliberate
   design-system stance vs. an existing feature).
10. **`depth > 0` child indentation / `isOutOfTab` styling** — how should nested sub-session rows
    indent within the Roster list? SRow is flat.

**Until these are resolved I will not edit source.** Recommended default once unblocked: keep every
control, fold the action cluster into a hover-revealed `pn-ib` group + a `more` menu, mount the
collapse arrow as a leading `pn-ib`, and render the meta/task-lines as reskinned disclosure regions —
but I will wait for the coordinator's ruling on items 1-10 rather than invent.

---

## D. Verification plan (post-gate, step 5-6)
- Light + dark screenshots of the Roster list (running/needs-input/idle groups) diffed vs
  `panel-redesign` RosterRight.
- Contract check: every prop/hook/handler/ref/effect/a11y attr in section A still present.
- `bun run build:ui` typecheck passes.
