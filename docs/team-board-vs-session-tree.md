# Team Board View vs. Session Tree — Reconciliation Proposal

_Research note. No code changed. Goal: explain how the older "team board" view
relates to the new spawn-chain session tree in `SessionsSection.tsx`, and
recommend how they should fit together._

## TL;DR

There are **four** distinct session presentations in the codebase, three of
which overlap heavily:

1. **Session tree** (NEW) — `SessionsSection.tsx` + `useSessionTree` — recursive
   hierarchy keyed by `parentSessionId`. This is the sidebar's primary view.
2. **Team sidebar grouping** (OLD) — `TeamSessionGroup.tsx` — a flat
   coordinator→workers group keyed by `teamSessionId`. **Currently dead code:
   imported by nobody.**
3. **Full-screen Team View** (OLD) — `TeamView.tsx` — a side-by-side
   multi-terminal overlay (coordinator left, workers right) keyed by
   `teamSessionId`. **Currently unreachable: its only trigger button lives in
   the dead `TeamSessionGroup`.**
4. **Board "Sessions" tab** — `MultiProjectSessionsView.tsx` — live terminals
   grouped by **project** (not team), reachable from the board's `◈ Sessions`
   tab.

The new tree is a strict generalization of the old team grouping for the common
2-level case. **Recommendation: keep the tree as the canonical list, delete the
dead team-grouping sidebar component, and rebuild the full-screen Team View as a
re-rootable, breadcrumb-driven, live-terminal overlay** that walks the
`parentSessionId` hierarchy one level at a time. This last point is the user's
confirmed target UX — see §3.4. Details below.

**Confirmed UX (from clarifying questions):** Team View shows the current root
session's live terminal on the left and its **direct children** as live
terminals on the right. Clicking a child that has its own children **re-roots**
the view to that child (its direct children now on the right). A **breadcrumb**
trail (true root ▸ … ▸ current root) lets you click any segment to re-root.
A "team view" button appears on **any** session tile that has children.

---

## 1. What each view shows today

### 1a. Session tree (new) — `SessionsSection.tsx`

- **Data source:** all `MaestroSession`s for the active project
  (`projectMaestroSessions`), fed into `useSessionTree`.
- **Grouping key:** `parentSessionId`. `useSessionTree`
  (`hooks/useSessionTree.ts`) builds a `childrenMap` from each session's
  `parentSessionId`; sessions whose parent isn't in the current set are promoted
  to roots. Output is `SessionTreeNode = MaestroSession & { children: [] }`.
- **Tile** (`SessionListItem.tsx`): expand/collapse arrow + child count on the
  left, a **human-complete radio** (`onToggleHumanComplete` → `humanCompletedAt`),
  the title/avatars, a live-terminal dot, and an **agent-status symbol + color**
  on the right. An expandable meta section shows status/mode pickers.
- **Active/Completed split:** `visibleRoots` filters roots by
  `humanCompletedAt` — sessions move to "Completed" only when a **human** ticks
  the radio, never from agent status.
- **Color:** `maestroColorMap` is still derived from `buildTeamGroups(...)` — so
  the tree borrows team colors even though it doesn't use team grouping for
  structure.
- **Spaces** (drawings/documents/files) render grouped below the tree.

### 1b. Team sidebar grouping (old) — `TeamSessionGroup.tsx`

- **Data source:** a single `TeamGroup` from `buildTeamGroups`
  (`utils/teamGrouping.ts`).
- **Renders:** a header (team avatar/name, aggregate status badge, member
  count, an "open team view" `⊞` button), a strip of **worker member chips**
  (avatar + name + status dot), a **task-progress bar** aggregated across all
  member sessions, and the member session items (coordinator-only when
  collapsed).
- **Status:** **orphaned.** `grep` for `<TeamSessionGroup` / importers returns
  nothing outside its own file. It is no longer mounted anywhere.

### 1c. Full-screen Team View (old) — `TeamView.tsx`

- **Data source:** the `TeamGroup` resolved in `App.tsx` from `teamViewGroupId`
  (`useUIStore`) via `buildTeamGroups`.
- **Renders:** a portal overlay. Coordinator terminal on the left, worker
  terminals stacked on the right, with a draggable split. Terminals are
  **reparented** (`appendChild`) into slot hosts to escape stacking contexts,
  then moved back on unmount — the same trick `MultiProjectSessionsView` uses.
- **Trigger:** `setTeamViewGroupId(group.teamSessionId)` — called **only** from
  `TeamSessionGroup`'s header button. Since 1b is unmounted, **Team View is
  currently unreachable**, even though it's still lazily wired in `App.tsx`
  (`LazyTeamView`, lines ~613–623).

### 1d. Board "Sessions" tab — `MultiProjectSessionsView.tsx`

- Reachable from the board (`◈ Sessions` tab; board opened via the sidebar
  `layers` icon → `setShowBoardRequested` / `MaestroPanel`, or the multi-project
  board).
- Groups **live terminal sessions by project** (`grouped` / `unified` layout
  modes), not by team or spawn chain. Renders resizable terminal columns with a
  terminal/timeline toggle. Independent of `buildTeamGroups` and
  `useSessionTree`.

---

## 2. The data-model overlap (`parentSessionId` vs `teamSessionId`)

All three lineage fields are set at spawn time in
`maestro-server/src/api/sessionRoutes.ts` (~lines 1476–1552):

| Field | Meaning | Set to (spawned session) | Set to (coordinator/root) |
|---|---|---|---|
| `parentSessionId` | Immediate spawner | `resolvedParentSessionId` | `undefined` |
| `teamSessionId` | "Team" link | `resolvedParentSessionId` (**= the immediate parent**) | its own id (set on first spawn) |
| `rootSessionId` | Top of spawn chain | `resolvedRootSessionId` | — |

**Key insight:** for the common **2-level** case (a coordinator spawns workers
directly), `teamSessionId === parentSessionId` for every worker. The two views
are describing the *same edges* — the team grouping is just the depth-1
flattening of the spawn tree, plus extras (color, saved-Team name/avatar match,
aggregate status, progress).

**Where they diverge — deep chains:** `teamSessionId` is set to the *immediate*
parent, not the root. So if coordinator `C` spawns worker `W`, and `W` spawns
sub-worker `S`:

- Tree: `C → W → S` (correct nesting via `parentSessionId`).
- `buildTeamGroups`: `S.teamSessionId === W`, so it forms a **second** group
  headed by `W`, and `C`'s group contains only `W`. The team board would show
  two flat teams instead of one nested chain.

So the tree is **more correct** for nested spawns; the flat team board loses the
grandparent relationship. (Note: `rootSessionId` exists on the **server** type
and is set at spawn, but is **not exposed on the UI `MaestroSession` type** — so
neither view currently uses it. It would be the natural key for "whole chain =
one team".)

`buildTeamGroups` also has a **Strategy 2 fallback**: when no `teamSessionId` is
present it finds sessions whose `mode` is a coordinator variant and attaches
children by `spawnedBy`/`parentSessionId`. So the team grouping is already
*partly* a `parentSessionId` tree — just collapsed to one level.

### What the team views add that the tree doesn't have

- Saved-`Team` matching: coordinator's `teamMemberId` → `team.leaderId`, giving
  a real team **name + avatar** (and `team.subTeamIds` for team-of-teams, which
  nothing renders yet).
- **Aggregate** status and **task-progress** rollup across all members.
- A **multi-terminal** workspace (TeamView) — watch the whole team's terminals
  at once. The tree only ever shows one terminal (the active one); tiles are
  links/launchers, not live terminals.

### When a user wants which

- **Tree (sidebar):** triage / navigation. "What sessions exist, how are they
  related, which need input, which are done." One-terminal-at-a-time workflow.
- **Team View (overlay):** active supervision of a running coordinator+workers
  team — watching several terminals side by side.
- **Board Sessions tab:** cross-project terminal wall, grouped by project.

These are genuinely different jobs: a **tree** (structure/triage) vs. a
**terminal grid** (live multi-watch). The conflict is only in the *grouping
metadata* (team color/name/progress), which both want.

---

## 3. Recommendation

**Keep both _concepts_, but collapse the structural duplication into the tree
and re-home the multi-terminal Team View.**

### 3.1 Make the spawn tree the single source of structure

- The tree (`parentSessionId`) already subsumes the depth-1 team grouping and
  handles deep chains correctly. Keep it canonical. **No structural role for
  `buildTeamGroups` going forward** beyond metadata.

### 3.2 Delete the dead team-grouping sidebar component

- `TeamSessionGroup.tsx` is unreferenced. Once Team View is re-triggered from
  the tree (3.4), delete it. Until then it's pure dead weight.
- Touch-points: remove `components/maestro/TeamSessionGroup.tsx`.

### 3.3 Keep `buildTeamGroups` only as a *metadata* provider

- Today `SessionsSection` already uses it just for `maestroColorMap`. Keep that.
- Optionally enrich the tree's **root tiles** with the team metadata
  `buildTeamGroups` computes (saved team name/avatar, aggregate status,
  task-progress rollup) when a root is a coordinator. That folds 1b's useful
  bits into the tree without a second list.
- Consider keying team identity off `rootSessionId` (once exposed to the UI
  type) instead of `teamSessionId`, so deep chains resolve to one team. This is
  the one real data-model fix worth doing.

### 3.4 Rebuild Team View as a re-rootable, breadcrumb-driven overlay (confirmed direction)

This is the user's target UX, confirmed via clarifying questions. The old
`TeamView` (coordinator left, members right, **live terminals**) comes back, but
it becomes **navigable through the spawn hierarchy** instead of showing a single
flat team.

**Confirmed decisions:**

1. **Right pane = direct children only.** When session `R` is the current root,
   the right pane shows exactly `R`'s immediate `parentSessionId`-children — one
   level at a time. Not flattened descendants.
2. **Live terminals in every slot.** Keep the old `TeamView` reparenting trick
   (`appendChild` real xterm terminals into slot hosts, move back on unmount).
   The current root's terminal is the big left pane; each direct child is a live
   terminal on the right.
3. **Entry point = a button on _any_ parent tile.** Every `SessionListItem`
   whose node has children gets an "open team view" button. Clicking it opens
   the overlay **rooted at that session** (not always the top of the chain).
4. **Breadcrumbs = click any crumb to re-root.** The overlay shows the path from
   the true spawn-chain root down to the current root; clicking any segment
   re-roots the view there.

**Interaction model (the core loop):**

- Open overlay rooted at `R` → left = `R` (live terminal), right = `R`'s direct
  children (live terminals).
- A child `W` on the right that **itself has children** is drillable. Clicking it
  (drill action) makes `W` the new root: left = `W`, right = `W`'s direct
  children. `R` is pushed onto the breadcrumb trail.
- A child with **no** children is a leaf — clicking just focuses/opens it (e.g.
  double-click to jump to its terminal in the main view and close, like the old
  `handleSlotDoubleClick`).
- Breadcrumb `Root ▸ … ▸ R ▸ W` — click any crumb to re-root at that level.

**Data:** everything keys off `parentSessionId`. Compute the current level with
`useSessionTree(...).getChildren(currentRootId)` (already returns direct children).
Compute the breadcrumb trail by walking `parentSessionId` up from the current
root to the top. No new server fields strictly required, though exposing
`rootSessionId` to the UI type (3.3) lets you validate/cap the breadcrumb root
cheaply.

**Why this replaces the old `teamSessionId` model:** the old `TeamView` resolved
a single flat `TeamGroup` (coordinator + workers) via `buildTeamGroups` keyed by
`teamSessionId`, which can't express depth >1. Re-rooting on `parentSessionId`
expresses arbitrary depth natively, so the overlay should be driven by the tree,
not by `buildTeamGroups`. `buildTeamGroups` stays only for color/team-name
metadata (3.3).

**State change:** replace `teamViewGroupId: string | null` in `useUIStore` with
something like `teamView: { rootSessionId: string } | null` (current root, not a
team-group id). `App.tsx` resolves the live-terminal slots for `currentRoot +
getChildren(currentRoot)` instead of a `TeamGroup`. Breadcrumb state can live
inside the overlay (derived from `parentSessionId`) — no need to persist it.

**Build vs. reuse `TeamView.tsx`:** the slot/terminal-reparenting machinery in
`TeamView.tsx` is directly reusable; what changes is (a) the input becomes
`{ rootSession, childrenSessions }` instead of a `TeamGroup`, (b) add a
breadcrumb bar, (c) make right-pane slots drillable when they have children.
Recommend refactoring `TeamView.tsx` in place rather than starting over.

### 3.5 Leave the Board "Sessions" tab alone

- `MultiProjectSessionsView` serves a different axis (project, cross-project,
  live terminals). It doesn't conflict with the tree. No change.

### Concrete touch-points

| Action | File(s) |
|---|---|
| Canonical structure = tree | `SessionsSection.tsx`, `hooks/useSessionTree.ts` (reuse `getChildren` for level/breadcrumb) |
| Delete dead grouping | `components/maestro/TeamSessionGroup.tsx` (remove) |
| Keep metadata provider | `utils/teamGrouping.ts` (keep; used for color, optional root enrichment) |
| Rebuild Team View (re-rootable + breadcrumbs + live terminals) | `components/maestro/TeamView.tsx` (refactor input to `{rootSession, children}`, add breadcrumb bar + drill-on-click) |
| "Team view" button on parent tiles | `components/maestro/SessionListItem.tsx` (show when `childCount > 0`) |
| Re-root state | `stores/useUIStore.ts` (`teamViewGroupId` → `teamView: { rootSessionId } \| null`), `App.tsx` (resolve `root + getChildren(root)` slots) |
| Optional: validate root by chain | expose `rootSessionId` on UI `MaestroSession` (`app/types/maestro.ts`) |
| No change | `MultiProjectSessionsView.tsx`, `MultiProjectBoard.tsx` |

### Net effect

One **tree** for structure + triage (handles nesting correctly), enriched with
team metadata on root tiles, with a button to pop the **multi-terminal Team
View** for live supervision. Removes one dead component and one unreachable
trigger path, and fixes the deep-chain grouping bug as a bonus.
