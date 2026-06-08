# Hierarchical Team View — Implementation Plan

_Implements the confirmed design from `team-board-vs-session-tree.md` §3.4._

## Goal

Rebuild the full-screen **Team View** as a **re-rootable, breadcrumb-driven,
live-terminal** overlay that walks the `parentSessionId` spawn hierarchy one
level at a time:

- **Left pane:** the current root session's **live terminal**.
- **Right pane:** the current root's **direct children** as **live terminals**.
- **Drill:** clicking a child that itself has children **re-roots** the overlay
  to that child (its direct children move to the right pane). A leaf child
  (no children) just focuses/opens its terminal.
- **Breadcrumbs:** path `trueRoot ▸ … ▸ currentRoot`; click any crumb to re-root
  there.
- **Entry point:** a "team view" button on **any** `SessionListItem` whose node
  has children, opening the overlay rooted at that session.

All structure is keyed off `parentSessionId` (the same data the sidebar tree
uses). `buildTeamGroups`/`teamSessionId` is **not** used for structure anymore —
only for team color/name metadata.

---

## Affected files

| # | File | Change |
|---|---|---|
| 1 | `maestro-ui/src/stores/useUIStore.ts` | Replace `teamViewGroupId` state with `teamViewRootId` |
| 2 | `maestro-ui/src/components/maestro/TeamView.tsx` | Refactor: props become `{ rootSession, children }`; add breadcrumb bar + drillable right slots |
| 3 | `maestro-ui/src/App.tsx` | Resolve `root + direct children` from `parentSessionId`; build breadcrumb; pass re-root callback |
| 4 | `maestro-ui/src/components/maestro/SessionListItem.tsx` | Add "team view" button when `childCount > 0` |
| 5 | `maestro-ui/src/components/SessionsSection.tsx` | Thread an `onOpenTeamView(session)` callback into the tree renderer |
| 6 | `maestro-ui/src/styles-maestro-sessions-v2.css` (or TeamView's stylesheet) | Breadcrumb bar + drillable-slot styles |
| 7 | `maestro-ui/src/components/maestro/TeamSessionGroup.tsx` | **Delete** (dead code; was the old trigger) |

No server changes required. (Optional, deferred: expose `rootSessionId` on the
UI `MaestroSession` type to validate the breadcrumb's top — not needed for v1.)

---

## Step 1 — `useUIStore`: re-root state

Replace the group-id slot with a root-session-id slot.

- Remove: `teamViewGroupId: string | null` / `setTeamViewGroupId`.
- Add:
  ```ts
  teamViewRootId: string | null;            // current root maestro session id
  setTeamViewRootId: (sessionId: string | null) => void;
  ```
- `open(sessionId)` and `re-root` both call `setTeamViewRootId(sessionId)`;
  close calls `setTeamViewRootId(null)`.

Breadcrumb trail is **derived** (walk `parentSessionId` up from the current
root), so it does **not** need its own state.

> Grep for existing references before deleting: `teamViewGroupId` currently
> appears in `useUIStore.ts`, `App.tsx`, `components/app/AppWorkspace.tsx`
> (`teamViewOpen` check), and the soon-to-be-deleted `TeamSessionGroup.tsx`.
> Update `AppWorkspace.tsx`'s `teamViewOpen` to read `teamViewRootId !== null`.

## Step 2 — `App.tsx`: resolve root + children, build breadcrumb

Currently (`App.tsx` ~307–315) `teamViewGroup` is resolved from
`buildTeamGroups`. Replace with `parentSessionId`-based resolution:

```ts
const teamViewRootId = useUIStore((s) => s.teamViewRootId);
const setTeamViewRootId = useUIStore((s) => s.setTeamViewRootId);

// maestroSessions is already available (App.tsx:274)
const teamViewData = useMemo(() => {
  if (!teamViewRootId) return null;
  const root = maestroSessions[teamViewRootId];
  if (!root) return null;

  // direct children by parentSessionId
  const children = Object.values(maestroSessions)
    .filter((s) => s.parentSessionId === root.id);

  // breadcrumb: walk parentSessionId up to the top
  const trail: MaestroSession[] = [];
  let cur: MaestroSession | undefined = root;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    trail.unshift(cur);
    cur = cur.parentSessionId ? maestroSessions[cur.parentSessionId] : undefined;
  }

  return { root, children, trail };
}, [teamViewRootId, maestroSessions]);
```

Mount (`App.tsx` ~613–623) becomes:

```tsx
{teamViewData && (
  <React.Suspense fallback={null}>
    <LazyTeamView
      root={teamViewData.root}
      childrenSessions={teamViewData.children}
      trail={teamViewData.trail}
      registry={registry}
      onReRoot={(sessionId) => setTeamViewRootId(sessionId)}
      onClose={() => setTeamViewRootId(null)}
      onSelectSession={handleSelectSession}
    />
  </React.Suspense>
)}
```

`registry` (App.tsx:72) and `handleSelectSession` (App.tsx:322) already exist.
`buildTeamGroups` import in App.tsx can be dropped if no longer used there
(verify — it may still feed the sidebar through other paths; `SessionsSection`
imports it independently, so App.tsx's import is likely now removable).

> **Color/name metadata (optional):** if we still want the team accent color in
> the overlay, compute a `maestroColorMap` from `buildTeamGroups` (as
> `SessionsSection` does) and pass `root`/child colors in. Not required for v1.

## Step 3 — `TeamView.tsx`: refactor to root + children + breadcrumbs

Current `TeamView` takes `group: TeamGroup` and derives coordinator/worker
slots. Refactor the **input** while **keeping the terminal-reparenting machinery**
(`TeamViewTerminalSlot`) untouched — that part is correct and reusable.

**New props:**

```ts
interface TeamViewProps {
  root: MaestroSession;
  childrenSessions: MaestroSession[];
  trail: MaestroSession[];             // trueRoot → … → root (inclusive)
  registry: React.MutableRefObject<TerminalRegistry>;
  onReRoot: (sessionId: string) => void;
  onClose: () => void;
  onSelectSession: (localSessionId: string) => void;
}
```

**Slot derivation:** replace the `slots` useMemo. The left slot is `root`; the
right slots are `childrenSessions`. For each, resolve the **live local session
id** so the terminal can be reparented. Today `TeamView` got `localSessionId`
from the `TeamGroup`. Now we need a maestro→local map. Two options:

- (a) Pass a `linkMap: Map<maestroSessionId, localSessionId>` prop from `App.tsx`
  (build it the same way `SessionsSection` does at lines 883–891), **or**
- (b) build it inside `TeamView` from `useSessionStore((s) => s.sessions)`.

Prefer **(a)** for a single source of truth. A child without a live local
terminal (exited / not yet spawned) renders a placeholder slot (no terminal to
reparent) but is still drillable / resumable.

**Each right-pane slot needs to know if it's drillable:**

```ts
const childHasChildren = (childId: string) =>
  childrenSessions /* no */ ;  // NOTE: need ALL sessions, not just this level
```

The current level only has `childrenSessions`; to know whether a child is
itself a parent we must check the full session set. Simplest: pass a
`hasChildren: (sessionId: string) => boolean` predicate from `App.tsx`
(computed once from `maestroSessions` via `parentSessionId`), so each child slot
can show a drill affordance and decide click behavior.

**Right-slot click behavior:**

- If `hasChildren(child.id)` → **drill**: `onReRoot(child.id)`.
- Else (leaf) → keep the old behavior: `onSelectSession(localId)` + `onClose()`
  (jump to its terminal in the main view).
- Provide an explicit **drill button** (e.g. `⤵` / "open") on slots that have
  children so a user can drill without losing the "double-click opens terminal"
  affordance. Recommended: single-click drill button = re-root; double-click on
  terminal body = open in main view.

**Breadcrumb bar** (new, above `teamViewBody`):

```tsx
<div className="teamViewBreadcrumbs">
  {trail.map((s, i) => {
    const isCurrent = s.id === root.id;
    const label = nameOf(s); // avatar + teamMemberSnapshot name || s.name
    return (
      <React.Fragment key={s.id}>
        {i > 0 && <span className="teamViewBreadcrumbs__sep">▸</span>}
        <button
          type="button"
          className={`teamViewBreadcrumbs__crumb ${isCurrent ? "teamViewBreadcrumbs__crumb--current" : ""}`}
          disabled={isCurrent}
          onClick={() => onReRoot(s.id)}
        >
          {label}
        </button>
      </React.Fragment>
    );
  })}
</div>
```

**Header / label:** keep the existing header; the team label can become the
current root's name. The resizable split between left (root) and right
(children) stays as-is. When `childrenSessions.length === 0`, render the root
full-width (the existing `hasWorkers` conditional already handles the
"coordinator only" layout — reuse it).

**Escape / close:** existing `onClose` on Escape stays. Add: a "back" shortcut
(optional) — Backspace re-roots to `trail[trail.length - 2]` if present.

## Step 4 — `SessionListItem.tsx`: the entry-point button

Add an "open team view" button in the `sessionTile__actions` block (around
line 242), shown only when `hasChildren` (already computed at line 127):

```tsx
{hasChildren && (
  <button
    type="button"
    className="sessionTile__btn sessionTile__btn--teamView"
    onClick={(e) => { e.stopPropagation(); onOpenTeamView(session); }}
    title="Open team view (terminals)"
  >
    {/* grid/columns glyph */}⊞
  </button>
)}
```

Add `onOpenTeamView: (session: MaestroSession) => void;` to
`SessionListItemProps`.

## Step 5 — `SessionsSection.tsx`: thread the callback

- Add a handler:
  ```ts
  const handleOpenTeamView = useCallback((session: MaestroSession) => {
    useUIStore.getState().setTeamViewRootId(session.id);
  }, []);
  ```
- Pass `onOpenTeamView={handleOpenTeamView}` down through `SessionNodeRenderer`
  → `SessionListItem` (add to `SessionNodeRendererProps` and the recursive
  pass-through, mirroring `onToggleHumanComplete`).

## Step 6 — CSS

Add styles for:

- `.teamViewBreadcrumbs`, `.teamViewBreadcrumbs__crumb`,
  `.teamViewBreadcrumbs__crumb--current`, `.teamViewBreadcrumbs__sep`.
- `.sessionTile__btn--teamView`.
- Drillable right-slot affordance (hover state + drill button) on
  `.teamViewWorkerSlot`.

Reuse existing `teamView*` tokens/colors already in the stylesheet.

## Step 7 — Delete dead code

- Delete `components/maestro/TeamSessionGroup.tsx` (unreferenced once the new
  button replaces its old trigger).
- Confirm no remaining imports: `grep -rn "TeamSessionGroup" maestro-ui/src`.

---

## Edge cases

- **Root has no children:** render root terminal full-width (reuse existing
  no-workers layout). The entry-point button won't appear on leaf tiles anyway.
- **Child has no live terminal (exited/spawning):** slot shows a placeholder +
  status; drill still works (re-root shows its children); offer resume via
  existing flow if desired.
- **Cycle protection:** breadcrumb walk uses a `seen` set (above) so a malformed
  `parentSessionId` cycle can't infinite-loop.
- **Parent out of project / not loaded:** breadcrumb walk stops when
  `maestroSessions[parentId]` is missing — current root becomes the top crumb.
- **Session list updates while open:** `teamViewData` is a `useMemo` over
  `maestroSessions`, so children/terminals update live (new spawns appear on the
  right automatically).
- **Re-root to a now-removed session:** if `teamViewRootId` no longer resolves,
  `teamViewData` is `null` and the overlay closes — acceptable.

## Testing / verification

- **Unit:** breadcrumb-walk + direct-children selection are pure functions of
  `maestroSessions` — extract to a small helper (e.g. `resolveTeamView(rootId,
  sessions)`) and unit-test depth-1, depth-N, cycle, missing-parent.
- **Manual (the golden path):** spawn a coordinator with workers, where at least
  one worker spawns a sub-worker. From the sidebar tree, click the team-view
  button on the coordinator → verify coordinator terminal left, workers right,
  all live. Click the worker-with-children → verify re-root + breadcrumb grows.
  Click a breadcrumb segment → verify re-root up. Click a leaf → verify it opens
  that terminal in the main view and closes the overlay.
- **Regression:** confirm the sidebar tree, the board "Sessions" tab, and
  `AppWorkspace`'s `teamViewOpen` gating still behave. Run `bun run test` in
  `maestro-ui`.

## Suggested phasing (PR-sized)

1. **State + plumbing:** Step 1 (`useUIStore`) + Step 4/5 (button + callback) +
   Step 7 (delete `TeamSessionGroup`). Wire the button to open the *existing*
   TeamView temporarily (rooted at clicked node) to prove the entry point.
2. **TeamView refactor:** Steps 2 + 3 — root/children props, live-terminal
   slots, breadcrumb bar, drill-on-click. The bulk of the work.
3. **Polish:** Step 6 CSS, edge-case handling, optional team-color metadata,
   optional Backspace-to-go-up.

Each phase is independently shippable and leaves the app in a working state.
