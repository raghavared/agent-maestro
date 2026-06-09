# P1c — Right Panel — Coordinator-Sanctioned Exceptions

For the static reviewer to **pre-load before flagging** my branch diff. Each item is a deliberate, reasoned exception — not a defect. Per-worker contracts: `SpacesLayout-CONTRACT.md`, `SessionList-CONTRACT.md`, `SessionTile-CONTRACT.md`.

Branch files (Right-exclusive; `App.tsx` untouched; no git resets):
`SpacesPanel.tsx`, `SpacesRail.tsx`, `NewSpaceDropdown.tsx`, `SessionsSection.tsx`, `SessionListItem.tsx`, `styles-spaces-panel.css` (ResourcesView restyled here, JSX untouched).

## Design-target / IA decisions
- **Session Tile targets `pn-st` (tiles.jsx SessionTile), NOT `pn-sess`** (the Roster SRow demo). `pn-st` is the native 1:1 match for `SessionListItem`'s rich surface (collapse, radio, actions, meta, tasklines, status glyph, nesting). Don't flag pn-st usage as a deviation from the Roster row.
- **Option A IA — coordinator→worker SPAWN TREE preserved** (`pn-team` + `pn-kids--st` nesting), top-level **RUNNING/IDLE status sections deliberately dropped**. The mockup shows status sections; adopting them would re-bucket the existing tree IA = a logic/IA change, out of bounds for an appearance-only pass. Approved descope (optional future pure-display layer).
- **`SessionListItem` is the live row** (mounted by `SessionsSection.SessionNodeRenderer`); `MultiProjectSessionsView.tsx` is the board (out of scope) — not edited.

## Dual-theme / container (Axis 2c)
- **All surfaces bound to flipping `--pn-*` vars**: `pn-sp`=`--pn-surface`, `spacesRail`=`--pn-paper`, tiles=`--pn-card`, `pn-team`=`--pn-card`/`--pn-surface`, `spacesPanelContent`=transparent, `.spacesPanel` aside=no override. Grep-verifiable: no hardcoded light/dark container bg.
- **`#ffaa00`** in `styles-spaces-panel.css` (rail pulse-dot) is on a **DEAD/renamed class** — no live element (live rail uses `pn-srail-pulse`). Non-flipping but inert; future cosmetic tidy. **Not a live dual-theme violation.**
- **Center terminal stays dark in BOTH themes by design** (`shell.jsx`). A light capture showing a dark terminal column beside paper panels is expected, not a leak.
- The earlier "paper-in-dark" report was a **mislabeled LIGHT capture** (coordinator-confirmed false alarm), not a bug.

## Component deviations (functionality preserved)
- **Worktree**: `WorktreeBadge` component → design's `pn-mini` (main row) + `pn-badge` (meta); branch value preserved.
- **Session tile avatars**: member-avatar emoji dropped → `AgentTile` agent logo + member **name** in `pn-st__titleText`; `Avatars` omitted for sessions per `shell.jsx` canonical. `avatars`/`memberNames` derivation still present (no data lost).
- **Title click** stays whole-tile select (NOT the demo's title→toggle-meta) — preserves original behavior.
- **48px rail width kept** (`DEFAULTS.SPACES_RAIL_WIDTH`) vs design 52px (ruling #7, layout math); clipped active edge-bar is the accepted consequence.
- **Rail maestro initial-letter fallback** = plain ink text (design-silent).
- **`.sessionTreeNode` class PRESERVED** — it is a JS selector for `PromptSendAnimation.tsx:51`, NOT a theme class. Intentionally not removed.

## Foundation gaps (escalated, non-blocking)
- **`pn-ib--active`** active-tint variant absent; sidebarHeader toggles use the class forward-compatibly (`aria-pressed` conveys state meanwhile). Foundation to add.

## Verification state
- `bunx tsc -b` = **exit 0** (6 files individually clean; any project-wide errors are other branches' in-flight files).
- RULING #1 (outright swap; no dual/conditional className, no `useRedesignTheme` gating) + RULING #2 (in-place, no fabricated statics) verified across all files.
- Light gate visually satisfied (`full-layout-light.png`); true-dark populated capture is on the FINAL-VISUAL-PASS checklist (operator pass).
