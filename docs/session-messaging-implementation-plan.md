# Session Messaging UX — Implementation Plan

> Companion to `docs/session-messaging-ux-spec.md`. This is the build plan: file-by-file changes,
> new types/keyframes, acceptance criteria, and test notes. Date: 2026-06-08.
> Principle: each phase is independently shippable and leaves the app in a working state.

Legend: **[S]** server · **[U]** UI/React · **[C]** CSS · **[T]** test

---

## Phase 0 — Payload + anchors (foundation, no visible change on its own)

This phase unblocks everything else. Two small, safe changes.

### 0.1 [S] Add project IDs to the prompt event
The cross-project router needs to know both projects. Both session objects are already loaded in the
handler, so this is a pure additive payload change.

- `maestro-server/src/domain/events/DomainEvents.ts` (~196–205): extend `SessionPromptSendEvent.data`
  with `senderProjectId: string | null` and `targetProjectId: string | null`. Update the
  `TypedEventMap` entry if it duplicates the shape.
- `maestro-server/src/api/sessionRoutes.ts` (~1029–1035): when emitting `session:prompt_send`, include
  `senderProjectId: senderSession.projectId ?? null` and `targetProjectId: targetSession.projectId`.
- No validation change (these are server-derived, not request inputs).
- **Acceptance:** WS clients receive both fields; existing consumers ignore unknown fields (no break).

### 0.2 [U] Anchor the redesigned tree tiles
The existing flying-dot animation queries `[data-maestro-session-id]`, but the redesigned tree tiles
don't emit it, so it silently no-ops in the main Sessions tree.

- `maestro-ui/src/components/SessionsSection.tsx` (~531): add
  `data-maestro-session-id={node.id}` to the `.sessionTreeNode` wrapper `<div>`.
- (Optional, finer target) `maestro-ui/src/components/maestro/SessionListItem.tsx` (~168 root `<div>`):
  add a `data-status-anchor` span around the right-side status symbol (lines ~233–239) so packets can
  aim at the symbol rather than the tile center.
- **Acceptance:** sending a prompt between two visible tree sessions now plays the existing dot.
- **[T]** manual: `maestro session prompt <id> --message "hi"` between two same-project sessions in the
  tree → dot appears.

---

## Phase 1 — Animation store + dispatcher refactor

Generalize the existing single-surface animation into a surface-aware system. No new surfaces yet —
this phase keeps the current in-tree behavior but routes through the new shape.

### 1.1 [U] Extend the animation model
`maestro-ui/src/stores/usePromptAnimationStore.ts`:
- Extend `PromptAnimation` with:
  ```ts
  surface: 'tree' | 'rail' | 'bar';
  senderProjectId?: string | null;
  targetProjectId?: string | null;
  accent?: string;            // sender team color, hex
  senderName?: string;
  targetName?: string;
  senderInitial?: string;     // for rail puck
  direction?: 'forward' | 'reply';
  ```
- Keep the 1500ms auto-remove. Add a concurrency cap (drop oldest when > 6 active) to avoid storms
  during coordinator fan-out.

### 1.2 [U] Populate at the event boundary
`maestro-ui/src/stores/useMaestroStore.ts` `case 'session:prompt_send'` (~373–409):
- Read `senderProjectId`, `targetProjectId` from `message.data`.
- Compute `surface`:
  - `bar` if `senderProjectId && targetProjectId && senderProjectId !== targetProjectId`
  - else `rail` if the Spaces rail is mounted/visible (see 1.4 for the visibility check), else `tree`.
- Resolve `accent` from the team color map and `senderName`/`targetName`/`senderInitial` from the
  session map. (Reuse `teamGrouping`/`maestroColorMap` logic; extract a small helper if needed.)
- `spell:invoked` (~410–443): same enrichment, `surface: 'rail'`, `senderMaestroSessionId: null`.
- PTY write path is unchanged.

### 1.3 [U] Dispatcher in the render layer
`maestro-ui/src/components/PromptSendAnimation.tsx`:
- Split `FlyingDot` into three variants by `animation.surface`:
  - `TreeDot` — current behavior (arc between `[data-maestro-session-id]` centers).
  - `RailPuck` — Phase 2.
  - `BarDot` — Phase 3.
- Generalize `getSessionElement` → `getAnchor(surface, id)`:
  - tree/rail → `[data-maestro-session-id="<id>"]`
  - bar → `[data-project-id="<id>"]`
- **Acceptance:** in-tree behavior identical to today, now driven by `surface: 'tree'`.

### 1.4 [U] Rail visibility signal
Add a tiny shared flag (e.g. in `useUIStore` or `useSpacesStore`) for "Spaces rail mounted & expanded",
set by `SpacesRail` on mount/unmount, read in 1.2 to choose `rail` vs `tree`.

---

## Phase 2 — Same-project: Spaces-rail bubble (decided)

### 2.1 [C] Rail keyframes
`maestro-ui/src/styles-sessions.css` (near existing prompt CSS ~692–821):
- `.promptRailPuck` — small circle (18px) showing sender initial, `background: var(--prompt-accent)`,
  positioned `fixed`, animated by `@keyframes promptTravelRail` (glide `--start-*` → `--end-*`, mostly
  vertical, slight scale at midpoint, fade at end). ~0.7s `cubic-bezier(0.4,0,0.2,1)`.
- Reuse `.promptTargetPulse` on arrival; set its color via `--prompt-accent` instead of hard-coded
  `--theme-primary`.

### 2.2 [U] RailPuck component
In `PromptSendAnimation.tsx`:
- Anchor sender + target via `[data-maestro-session-id]` (rail buttons already have it —
  `SpacesRail.tsx:71`).
- Set `--prompt-accent` from `animation.accent`; render `animation.senderInitial` inside the puck.
- Edge cases: sender icon missing → render target pulse only; both missing → no-op.
- **Acceptance:** same-project prompt with rail open → initial puck travels sender→target icon, fades,
  target pulses.
- **[T]** manual: two sessions in the same project, rail open; `session prompt` → puck animates.

---

## Phase 3 — Cross-project: project-bar bubble (decided)

### 3.1 [C] Bar keyframes
`maestro-ui/src/styles-sessions.css`:
- `.promptBarDot` — abstract dot, `background: var(--prompt-accent)`, glow; `@keyframes promptTravelBar`
  horizontal glide along the bar's y-center (`--start-x` → `--end-x`, fixed `--bar-y`). ~0.7s.
- Tab glow: extend `ProjectTabBar` styling with a transient `.projectTab--msgGlow` class
  (short box-shadow pulse in `--prompt-accent`) applied to sender + receiver tabs on depart/arrive.

### 3.2 [U] BarDot component
In `PromptSendAnimation.tsx`:
- Anchor sender/target via `[data-project-id]` (`ProjectTabBar.tsx:566` already emits it).
- Compute y from the tab rect; x from sender→target tab centers. Add `.projectTab--msgGlow` to both
  tabs for ~600ms (cleanup on unmount).
- Edge cases (per spec §2.2b):
  - target tab not in DOM → pulse sender tab only.
  - target off-screen (overflow) → animate toward the bar edge in the target's direction, then fade.
  - both off-screen → no-op (timeline still records).
- **Acceptance:** prompt between sessions in two different open projects → dot travels sender tab →
  receiver tab, both glow.
- **[T]** manual: spawn sessions in two projects; `session prompt` across → bar animation.

---

## Phase 4 — Polish: edge-travel, recolor cleanup, reduced-motion

### 4.1 [U/C] Tree edge-travel for parent/child
When `surface === 'tree'` and target is the sender's `parentSessionId` or vice-versa, route the dot
down the shared `.sessionTreeChildren` left edge (`promptTravelEdge` keyframe) instead of the arc.
Fallback to arc otherwise. (Spec §2.2-B.)

### 4.2 [C] Token recolor
Replace remaining hard-coded `--theme-primary` in prompt CSS with `--prompt-accent` (set per
animation; default to `--theme-primary`). Delivered glow uses the target's status color token from the
`sessionDotPulse` palette (`styles-maestro-sessions-v2.css` ~2195–2250).

### 4.3 [C] Reduced motion
Wrap all travel keyframes in `@media (prefers-reduced-motion: no-preference)`. Under reduced motion:
no travel; just a single delivered pulse on the target (rail/tree) or a single tab glow (bar).

---

## Phase 5 — (Optional, later) Awaiting/response + durable record

Not required for the bubbles, but completes the "5 states" from the spec.

- **5.1 [U]** Awaiting: on send, mark `awaiting: Map<senderId,targetId>` in the store; show a subtle
  `sessionTile--awaitingReply` affordance on the sender; clear on reverse message or after timeout.
- **5.2 [U]** Response received: when a `session:prompt_send` arrives whose sender == original target,
  run the bubble in reverse (`direction: 'reply'`, target's accent). Optionally drive via a new
  `session:prompt_response` server event later.
- **5.3 [U/C]** Timeline + meta: style the existing `prompt_received` event in the detail-overlay
  timeline; surface "last message from <name>" in the tile's expandable meta.

---

## Touch-point index (quick reference)

| Area | File | Phase |
|---|---|---|
| Event payload | `maestro-server/src/domain/events/DomainEvents.ts` | 0.1 |
| Event emit | `maestro-server/src/api/sessionRoutes.ts` (~1029) | 0.1 |
| Tree tile anchor | `maestro-ui/src/components/SessionsSection.tsx` (~531) | 0.2 |
| Status anchor (opt) | `maestro-ui/src/components/maestro/SessionListItem.tsx` (~233) | 0.2 |
| Animation model | `maestro-ui/src/stores/usePromptAnimationStore.ts` | 1.1 |
| Event → animation | `maestro-ui/src/stores/useMaestroStore.ts` (~373, ~410) | 1.2 |
| Dispatcher + variants | `maestro-ui/src/components/PromptSendAnimation.tsx` | 1.3, 2.2, 3.2, 4.1 |
| Rail visibility flag | `useUIStore`/`useSpacesStore` + `SpacesRail.tsx` | 1.4 |
| Rail CSS | `maestro-ui/src/styles-sessions.css` | 2.1 |
| Bar CSS + tab glow | `maestro-ui/src/styles-sessions.css` + ProjectTabBar styles | 3.1 |
| Recolor/reduced-motion | `maestro-ui/src/styles-sessions.css` | 4.2, 4.3 |

## Testing strategy

- **Unit (Vitest, `maestro-ui`):** `usePromptAnimationStore` — add/auto-remove, concurrency cap,
  surface selection helper (project-equality → `bar`/`rail`/`tree`).
- **Server (Jest):** `session:prompt_send` payload now includes both project IDs (assert on emitted
  event in the prompt route test).
- **Manual matrix:** same-project (rail open / rail collapsed / tile-only) × cross-project (both tabs
  visible / target tab closed / target off-screen) × reduced-motion on/off × spell:invoked.
- **Regression:** ensure PTY injection (`write_to_session`) still fires regardless of animation outcome
  — animation is best-effort and must never block delivery.

## Rollout / risk notes

- Phases 0–1 are invisible-but-safe; ship first.
- Animation is purely cosmetic and wrapped in best-effort try/catch already; failures must never
  affect message delivery (the PTY write is independent of `addAnimation`).
- No new server request inputs → no new attack surface; payload additions are server-derived.
