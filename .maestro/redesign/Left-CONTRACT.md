# Left Panel — Consolidated Contract Summary

**Coordinator:** 🧭 Left Panel Coordinator (`sess_1780949253577_ei828bbjb`, task `task_1780949213230_5590ucw9b`)
**Status:** All 4 worker contracts received (study phase). Gate CLOSED — no source edits until `FOUNDATION-DONE.md`.

## Worker contracts
| Worker | File(s) | Design target | Contract |
|---|---|---|---|
| 🎚️ Icon Rail | `PanelIconBar.tsx` | `pn-rail` (vertical) | `.maestro/redesign/contracts/PanelIconBar-CONTRACT.md` |
| 🗂️ Panel Shell | `MaestroPanel.tsx`, `TaskFilters.tsx` | `pn-mp` / `pn-subbar` / `pn-search` / `pn-filters` / `pn-scroll` | `.maestro/redesign/MaestroPanel-CONTRACT.md` |
| 🌲 List & Tree | `SortableTaskList.tsx` (+ recursion/indent) | `pn-sec-head` + recursive nodes + `pn-kids` | `.maestro/redesign/SortableTaskList-CONTRACT.md` |
| 🟦 Task Tile | **`TaskListItem.tsx`** (corrected) | `pn-row` (left-panels TaskRow) | `.maestro/redesign/TaskCard-CONTRACT.md` (to be revised) |

## Key architectural findings
1. **Rail/subbar = re-architecture.** Live `PanelIconBar` renders two horizontal bars (primary nav + contextual subtabs) inside the panel. Design = vertical `pn-rail` sibling column + `pn-subbar` inside `pn-mp`. State already in `MaestroPanel.tsx:243-247` → DOM relocation only, no state move. **ESCALATED to top coordinator for approval of faithful restructure.**
2. **Tile file scope error.** PLAN pointed Task Tile at `TaskCard.tsx`, but that is the Kanban BOARD card (`MultiProjectBoard`/`KanbanColumn`/`ProjectKanbanRow`). The left-panel list tile is `TaskListItem.tsx`. **ESCALATED; Task Tile worker redirected to `TaskListItem.tsx` → `pn-row`.**

## Kit / foundation gaps (relayed to foundation via top coordinator)
- **Subtask indent rail** missing: need `.pn-kids` (tiles.css ~232), `.pn-sub`, `.pn-sub--done`, `.pn-list` (left-panels.jsx).
- No primitive/token for: **error banner**, **loading spinner**, **execution-mode panel skin**, **tile drag-state**, **cancelled-title strike**.
- **"Mine" filter** has no backing state → recommend OMIT (escalated to confirm).

## Within-branch rulings issued (no escalation needed)
- Icon Rail: profiles→`bot` icon; Members/Teams map to existing `team` tab + `teamSubTab`; omit files/whiteboard/settings; keep union value `"team"`.
- Shell: owns `pn-subbar` + `pn-scroll`/`pn-fade` container; New-task in subbar (no footer, per canonical shell.jsx); add `pn-head` project header.
- Tree: owns `pn-scroll` contents (sec-head + nodes) + indent + dnd; remove column header; sectioning from EXISTING counts only.
- Tile: preserve all fields (extra meta into `pn-row__sub`); short `#id`; `med` label text; keep work-on visibility gate.
