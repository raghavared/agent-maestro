# TeamView.tsx → pn-tv* re-skin CONTRACT

Worker: 🪼 Team View Worker · Task P1e.3 · branch `maestro-redesign`
File owned/edited: `maestro-ui/src/components/maestro/TeamView.tsx` (+ leak-gate repoint in `maestro-ui/src/styles-sessions.css`).
Design source of truth: `panel-redesign/boards.jsx` (TeamView/WorkerCol/TVTerm/TVStats) + `redesign-boards.css` (pn-tv*, all verified present).

APPEARANCE ONLY. ZERO functionality changes.

---

## (a) Functional surface PRESERVED VERBATIM

Every prop / hook / ref / handler below is kept byte-for-byte. Only JSX className/structure/icons change.

**Props:** `root`, `childrenSessions`, `trail`, `registry`, `linkMap`, `childStats`, `onReRoot`, `onClose`, `onSelectSession` — unchanged.

**Store hooks:** `useSessionStore(s=>s.setActiveId)`, `useMaestroStore(s=>s.resumeSession)`, `useUIStore.getState().reportError` — unchanged.

**State / refs:**
- `resumingId` / `setResumingId` — kept.
- `bodyRef` (resize measurement) — kept, stays on the body element.
- **RESIZE (LIVE impl — PRESERVE EXACTLY, do NOT swap to design's coordW px logic):**
  - `rootFraction` / `setRootFraction` (0.2..0.8)
  - `resizingRef`, `resizeStartXRef`, `resizeStartFractionRef`
  - `handleResizeStart` (sets refs + `document.body.style.cursor/userSelect`)
  - `useEffect` adding window `mousemove`/`mouseup` (getBoundingClientRect math `dx/bodyRect.width`, clamp 0.2..0.8; cleanup restores body cursor/userSelect)
  - `rootStyle` = `{ flex: '0 0 calc(${f*100}% - 3px)' }`, `childrenStyle` = `{ flex: '0 0 calc(${(1-f)*100}% - 3px)' }` — applied as inline style to coord + workers (overrides pn-tv CSS flex; preserves exact resize behavior).
- **useMemo:** `rootSlot`, `childSlots` (+ derived `hasChildSlots`, `memberCount`, `statusLabel`, `statusKey`) — kept. `rootSlot.avatar`/`childSlots[].avatar` retained in SlotInfo even though AgentTile now renders the agent logo (no behavior change; emoji no longer painted — see note).
- **useCallback:** `handleResume`, `handleOpenTerminal`, `handleChildActivate` — kept.
- **useEffect (keyboard):** Escape→onClose, Backspace→onReRoot(trail[-2]) with editable-target guard — kept verbatim.
- `createPortal(..., document.body)` — kept.
- `data-maestro-session-id` attrs on coord + worker columns — kept (terminal reparent targets).
- Sub-components `TeamViewTerminalSlot` (xterm reparent logic — UNTOUCHED), `TeamViewSlotStats`, `TeamViewResumeBtn`, `TeamViewPlaceholder` — internals re-skinned but all logic/props preserved.

**New real-data derivation (NOT invented — uses existing field):**
- `needsInput: boolean` added to `SlotInfo`, sourced from `session.needsInput?.active ?? false`. This is the live signal that maps to the design's `w.needsInput` → drives `pn-tv__col--needs` + `Glyph kind="needsInput"`. No new hook; pure derivation inside existing useMemo.

---

## (b) className map (old → new pn-tv*)

| Old | New |
|---|---|
| `teamViewOverlay` (portal root) | kept as wrapper (fullscreen fixed scrim) — bg repointed to `--pn-paper` (leak gate); see §c |
| `teamViewContainer` | `pn-screen pn-tv` (inline `height:100%` to fill overlay) |
| `teamViewHeader` | `pn-tv__hd` |
| `teamViewHeaderLeft` + `teamViewHeaderLabel` | `pn-tv__title` (`<AgentTile kind lg/>` + name) |
| `teamViewHeaderStatus--{statusKey}` | `pn-tv__pill pn-tv__pill--{active\|idle}` + `<span pn-dot pn-dot--run/idle>` |
| `teamViewHeaderCount` | `pn-tv__count` |
| `teamViewHeaderHint` | `pn-tv__hint` |
| `teamViewCloseBtn` (✕) | `pn-tv__close` + `<Icon name="x"/>` |
| `teamViewBreadcrumbs` | `pn-tv__crumbs` |
| `teamViewBreadcrumbs__sep` (▸) | `pn-tv__crumb-sep` + `<Icon name="chevronR" size={12}/>` |
| `teamViewBreadcrumbs__crumb(--current)` | `pn-tv__crumb(pn-tv__crumb--current)` |
| `teamViewBreadcrumbs__avatar` (emoji) | `<Avatar a={{initial,name,color,bg}}/>` (monogram from labelOf initial) |
| `teamViewBody` | `pn-tv__body` (ref=bodyRef) |
| `teamViewCoordinator` | `pn-tv__coord` (inline rootStyle) |
| root `teamViewSlotHeader` | `pn-tv__coordhd` (coordring+coordname+coordbadge+slotsp+TVStats+resume) |
| `teamViewSlotAvatar` (root) | `pn-tv__coordring` > `<AgentTile kind lg/>` |
| `teamViewSlotName` (root) | `pn-tv__coordname` |
| `teamViewSlotRole` "root" | `pn-tv__coordbadge` (Coordinator) — icon PENDING escalation |
| `teamViewResizeHandle` | `pn-tv__resize` (onMouseDown=handleResizeStart) |
| `teamViewWorkers` | `pn-tv__workers` (inline childrenStyle) |
| `teamViewWorkerSlot(--drillable)` | `pn-tv__col(pn-tv__col--needs)` ; collapsed → `pn-tv__col pn-tv__col--collapsed` |
| worker `teamViewSlotHeader` | `pn-tv__slothd` |
| `teamViewSlotAvatar` (worker) | `<AgentTile kind/>` |
| `teamViewSlotName` (worker) | `pn-tv__slotname` |
| `teamViewSlotStatus--{status}` | `<Glyph kind={needsInput?'needsInput':status}/>` |
| WorktreeBadge (branch) | `pn-mini` + `<Icon name="gitBranch" size={12}/>` (title=worktree branch) |
| `teamViewSlotHeaderActions` | inline buttons after `pn-tv__slotsp` |
| `teamViewSlotDrillBtn` (⤵) | `pn-tv__drillbar` footer (drill in → onReRoot) |
| `teamViewSlotResumeBtn` (↻) | `pn-tv__colbtn` + `<Icon name="refresh"/>` |
| collapse toggle (new per-col) | `pn-tv__colbtn` + `<Icon name="chevronL"/>` (expanded) ; collapsed col body `pn-tv__colv` + `pn-tv__colvname` |
| `teamViewSlotTerminal--host` | `pn-tv__term` host (reparent host div) |
| `teamViewSlotPlaceholder` | `pn-tv__ph` ; drill/resume → `pn-tv__ph__resume` |
| `TeamViewSlotStats` (`teamViewSlotStats*`) | `pn-tv__stats` + `pn-tv__statchip` + `pn-dot pn-dot--run/idle` |

**Per-column collapse (design feature):** design WorkerCol has collapse/expand. Live currently has NO per-column collapse state. The design's `collapsed`/`toggle` is part of the *visual* WorkerCol API. Adding a collapse toggle = NEW functionality → I will NOT invent it unless coordinator approves. DECISION: render expanded columns only (no collapse chevron / no pn-tv__col--collapsed path) to honor ZERO-functionality-change, OR escalate. **Escalating** — see §d.

## (c) leak gate

`styles-sessions.css .teamViewOverlay { background: rgba(0,0,0,0.92) }` is the only hardcoded container bg feeding TeamView. Repoint to `var(--pn-paper)` so it flips paper(light)/graphite(dark). Inner `pn-tv` already binds every surface to `--pn-*` (flips automatically). Terminal `pn-tv__term` stays dark in both themes by design (hex in CSS). All other `teamView*` rules become dead once classes are swapped — leave the CSS (other workers may share file); only repoint the leaking bg.

## (d) kit primitive per icon/glyph/avatar/agenttile

- Header agent + coord ring + worker tiles → `AgentTile kind={agentTool} [lg]` (agentTool from `session.metadata.agentTool` default 'claude-code'→ maps to 'claude').
- Status → `Glyph kind={needsInput?'needsInput':status}`.
- Breadcrumb + (design) coordinator avatars → `Avatar`.
- close=x, crumb-sep=chevronR, resume=refresh, collapse=chevronL, branch=gitBranch, drill=arrowRight, coordbadge=**baton (ESCALATED — missing from kit)**.

## ESCALATIONS — RESOLVED
1. `baton` icon missing from kit PN_ICONS (coordbadge). FINAL RULING: Foundation IS authoring a real 'baton' glyph (design motif theme.css:27). WIRE `<Icon name="baton" />` into pn-tv__coordbadge now. tsc -b may transiently error ONLY on `name="baton"` not assignable to IconName until Foundation lands it — expected/transient, re-run after their ping; do NOT work around.
2. Per-column collapse: RULING (A) — render expanded-only; do NOT add a collapse useState/toggle. Live file has no collapse state → nothing to preserve, nothing to add. Drop the collapsed branch; pn-tv__col--collapsed/colv/colvname CSS left unused (harmless).
