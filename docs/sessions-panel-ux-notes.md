# Sessions Panel UX — Final Implementation Notes

Scope: UI-only finalization of the **Open / Done / Archived** model (Option 3 from
`docs/session-state-model.md`). No server changes. Files touched:
- `maestro-ui/src/utils/sessionLifecycle.ts` (unchanged logic — verified)
- `maestro-ui/src/components/SessionsSection.tsx`
- `maestro-ui/src/components/maestro/SessionListItem.tsx`
- `maestro-ui/src/styles-maestro-sessions-v2.css`
- `maestro-ui/src/__tests__/sessionLifecycle.test.ts`

## Key decisions

1. **Mark done does NOT stop any terminal.** "Done" is a pure human-intent marker:
   clicking the `○` radio only stamps `humanCompletedAt` and moves the root to the
   Done tab. Terminals keep running (liveness is decoration in Option 3).
   - *Why least-surprising:* a coordinator can be "done by me" while its workers are
     still live; stopping only the coordinator's own terminal (the old behavior) left
     worker terminals orphaned under a Done coordinator. Not stopping anything keeps
     the whole subtree coherent and never destroys in-progress work.
   - Stopping terminals remains the job of **Close (✕)**, which cascades the whole
     subtree (`closeAndArchiveTree`) and archives it.
   - Documented in a 1-line comment at `handleToggleHumanComplete` in SessionsSection.tsx.

2. **Resume from Done → back to Open.** `handleResume` clears both `archivedAt` and
   `humanCompletedAt`, so resuming a done session revives its terminal and returns it
   to Open. The `○`/`✓` radio also toggles done off directly (no resume needed).

3. **Liveness comes from `linkMap` (terminal liveness), never the stale `status`
   field.** Live dot, stopped dot, the prominent Resume affordance, and the "N live"
   sub-tab count all read liveness. `status` is used only for the read-only status
   symbol/color.

4. **Non-live tiles get a prominent Resume button + a subtle stopped dot** directly on
   the tile (not buried in the meta expander — that buried button was removed). For
   non-resumable agents (anything other than `claude-code`) the button is disabled with
   an explanatory tooltip instead of a dead button, and title-click falls back to
   opening details.

5. **"N live" decoration spans all tabs.** `liveCount` iterates every session in the
   project (Open/Done/Archived) and counts live terminals from `linkMap`.

## Manual QA checklist (run in staging: `bun run dev:all`)

Spawn a couple of Claude Code sessions (ideally one coordinator that spawns a worker)
so you have a spawn tree to exercise. Sessions filter must include "Sessions".

### Live vs non-live tiles (Open tab)
- [ ] A session with a running terminal shows a **green live dot** and the agent-icon
      live ring; clicking its title **switches to that terminal**.
- [ ] Stop/close a session's terminal from the terminal area (or let it exit) — the
      tile now shows a **grey stopped dot** and a **green "↻ Resume" button** appears.
- [ ] The "N live" pill in the sub-tab bar matches the number of running terminals and
      drops by one when a terminal exits.

### Resume from Open
- [ ] Click the **Resume** button on a non-live tile → label shows "Resuming…", the
      button is disabled during the resume, a terminal revives, and the tile flips back
      to the live dot.
- [ ] Click the **title** of a non-live (Claude) tile → it resumes (same as the button).
- [ ] For a non-`claude-code` agent (e.g. codex), the Resume button is **disabled** with
      tooltip "Resume is only available for Claude Code sessions", and title-click opens
      the details overlay instead of erroring.

### Mark done → Done tab
- [ ] Click the `○` radio on an Open tile → it gets a "done" tag and **moves to the Done
      tab**. Count on Open decreases, Done increases.
- [ ] **Its terminal keeps running** — the live dot/"N live" count is unchanged. (This is
      the intended behavior: done is an intent marker, not a stop.)
- [ ] Mark a **coordinator** done with a live worker under it → the whole subtree moves to
      Done together; the worker's terminal is still live (no orphaned worker in Open).

### Resume from Done → back to Open
- [ ] In the Done tab, click **Resume** on a (non-live) done session → it returns to the
      **Open tab** (humanCompletedAt cleared) and its terminal revives.
- [ ] Alternatively, click the `✓` radio in the Done tab → done cleared, session returns
      to **Open** with no resume.

### Close → Archived
- [ ] Click **✕** on an Open or Done tile with no live terminal → it moves to **Archived**
      immediately.
- [ ] Click **✕** on a tile with live terminal(s) in its subtree → a confirm dialog warns
      "N live terminals will be stopped"; confirming stops every terminal in the subtree
      and archives the whole subtree.

### Restore from Archived
- [ ] In the Archived tab, click **↩** → the subtree un-archives. A session that was only
      closed returns to **Open**; one that was marked done *before* being closed returns to
      **Done**.

### Subtree consistency
- [ ] After mark-done on a root, expand it — children render nested under the Done root;
      no child is stranded in a different tab.
- [ ] After Close on a coordinator, all workers are archived with it (none left live in
      Open).
- [ ] After Restore on a coordinator, all workers come back together.

### Empty states
- [ ] Empty Open: "No open sessions" / "New and unaddressed sessions appear here…".
- [ ] Empty Done: "No sessions marked done" / "Click the ○ next to an open session…".
- [ ] Empty Archived: "No archived sessions" / "Sessions you close with ✕ are dismissed
      here. Restore them anytime."

## Verification
- `cd maestro-ui && bunx tsc --noEmit` → clean.
- `cd maestro-ui && bun run test` → 85 passed (9 files), including the new
  `resolveSessionTab` liveness/status-agnostic invariant test.
