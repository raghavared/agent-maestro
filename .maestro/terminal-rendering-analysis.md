# Terminal Rendering Analysis — right-side panel vs board

## The three views and how they switch

**Right-side panel (the workspace center pane) — `AppWorkspace.tsx`**
This is the ONLY place actual xterm instances are created. It renders one
`<div className="terminalContainer" data-terminal-id={s.id}>` per session
(AppWorkspace.tsx:385-418), each wrapping a `<SessionTerminal>`. Only the
session matching `activeId` is visible; the rest get the `terminalHidden` class
(`visibility:hidden`). The xterm object is created in `SessionTerminal`'s
`useEffect` via `term.open(container)` and registered into a shared
`TerminalRegistry` keyed by session id (SessionTerminal.tsx:428).

**Session stats view — `SessionStatsView.tsx`**
Swapped in *instead of* the terminal inside the same center pane. Two triggers:
1. `inspectedMaestroSession` set — user clicked a session for inspection in the
   sidebar (AppWorkspace.tsx:348-354). Decided by
   `willOpenStatsOnClick()` in `utils/sessionClickRouting.ts`, applied in
   `SessionsSection.tsx:1035-1059`.
2. In-place swap: `s.exited && s.maestroSessionId && s.id === activeId` — the PTY
   died but the maestro session is still active (AppWorkspace.tsx:390-402).

**Board sessions view — `MultiProjectSessionsView.tsx`** (rendered via
`createPortal(..., document.body)` as an overlay while AppWorkspace stays
mounted — App.tsx:620, MultiProjectBoard.tsx:410).
The board does NOT create terminals. `ResizableSessionColumn` (lines 342-479)
**reparents the existing terminal DOM node** into its column host via
`host.appendChild(terminalEl)` and moves it back on cleanup.

## The core difference (and the bug)

There are THREE reparenting sites and they do NOT agree on *which node* they move:

| Site | Node moved | Source | Safe? |
|---|---|---|---|
| Board (`MultiProjectSessionsView.tsx:368-389`) | `[data-terminal-id]` — the **React-owned** `.terminalContainer` div | `document.querySelector` | **NO** |
| TeamView (`TeamView.tsx:467-507`) | `entry.term.element` — the **non-React** `.xterm` node | shared `registry` prop | YES |
| Workspace (`AppWorkspace.tsx`) | nothing — renders in place | React | n/a |

`TeamView.tsx:445-454` documents *exactly* why the board's approach is wrong:

> "we move `term.element` ... NOT the React-owned `[data-terminal-id]` container.
> Moving a React-managed node out of its tree makes React's reconciler throw
> `NotFoundError` when it later tries to remove that node (e.g. when a session
> disappears on connection loss). The xterm element isn't tracked by React, so
> relocating it is safe."

The board steals the React-owned container out of AppWorkspace's fiber tree.
AppWorkspace re-renders constantly (WebSocket session/activeId updates). While
the board holds the node:
- React's fiber still points at the moved node. When React needs to
  remove/reorder it (session exits, list changes), `parent.removeChild(node)`
  fails because `node.parentNode` is now the board → `NotFoundError`, breaking
  the right-side pane.
- Visibility desync: the board captures `wasHidden` at reparent time and restores
  it on cleanup. If `activeId` changed meanwhile, the wrong `terminalHidden`
  state is restored → right-side terminal is blank or shows the wrong session.
- On board close, the node is `appendChild`-ed back as the *last* child of the
  stale `originalParent`, not its React-expected slot → mis-ordered / mis-sized
  terminal until the next resize.

The board "renders well" in isolation because it owns the node while open. The
damage shows up in the **right-side panel** afterward, because that's whose React
tree got corrupted.

## Recommended fix

Make the board reparent the registry's `term.element` (the non-React `.xterm`
node) exactly like `TeamViewTerminalSlot` does, instead of the
`[data-terminal-id]` container:
- Thread the shared `registry` ref down to `MultiProjectSessionsView` /
  `ResizableSessionColumn` (App.tsx already holds it and passes it to TeamView).
- In the reparent effect, use `registry.current.get(session.id)?.term.element`
  instead of `document.querySelector('[data-terminal-id=...]')`.
- Add the `term.element` CSS class (`.terminalInTeamView` already exists, or
  reuse `.terminalInBoard`) and re-run `fit.fit()` after move + on cleanup.

This makes all reparenting consistent and keeps React's ownership of the
container intact, eliminating the NotFoundError / blank-terminal failure mode in
the right-side panel.

## Key file map
- `maestro-ui/src/SessionTerminal.tsx` — xterm creation (104-128), render patch
  (27-49), registry register (428), pending-data flush (431-461), resize/fit.
- `maestro-ui/src/components/app/AppWorkspace.tsx:348-420` — center-pane
  terminal/stats decision + the `data-terminal-id` containers.
- `maestro-ui/src/components/maestro/SessionStatsView.tsx` — stats UI.
- `maestro-ui/src/components/maestro/MultiProjectSessionsView.tsx:342-479` —
  board column + reparenting (the bug).
- `maestro-ui/src/components/maestro/TeamView.tsx:445-507` — the correct,
  documented reparenting pattern.
- `maestro-ui/src/utils/sessionClickRouting.ts` +
  `SessionsSection.tsx:1035-1059` — stats-vs-terminal click routing.
