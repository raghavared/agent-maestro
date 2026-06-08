# Session-to-Session Messaging — Current Flow + UX/Animation Design Proposal

> Status: design/research (no implementation). Author: maestro-worker. Date: 2026-06-08.
> Scope: cross-session messaging in `maestro-ui`, building on the redesigned session tiles
> (`SessionListItem`) and grouped Spaces section.

---

## PART 1 — How messaging works today

### 1.1 End-to-end flow

```
maestro session prompt <id> --message "..." --mode send|paste
        │  (CLI, sender reads MAESTRO_SESSION_ID)
        ▼
POST /api/sessions/:id/prompt   body: { content, mode, senderSessionId }
        │  (Express)
        ▼
sessionRoutes handler
   • validates content / mode / senderSessionId (inline)
   • loads target + sender sessions, rejects if missing or same
   • prefixes content → "[From: <senderName> (<senderId>)] <content>"
   • EMIT eventBus 'session:prompt_send'  (IMMEDIATE event, no batching)
   • append timeline event type 'prompt_received' on the TARGET session
        │
        ▼
WebSocketBridge.broadcastImmediate('session:prompt_send', data)
   • bypasses the 50ms batch window (latency-critical)
   • per-client sessionIds subscription filtering
        │  payload: { sessionId, content, mode, senderSessionId, timestamp }
        ▼
useMaestroStore  ws handler  case 'session:prompt_send'
   • usePromptAnimationStore.addAnimation({ sender, target, content })   ← VISUAL
   • find local terminal where maestroSessionId === target && !exited
   • Tauri invoke('write_to_session', { id: ptyId, data, source:'system' })
        - 'paste' → text only (no Enter)
        - 'send'  → text, wait 200ms, then '\r' (Enter)
        ▼
src-tauri pty.rs write_to_session → writes to PTY master (source 'system' skips recording)
        ▼
Text appears in the target agent's terminal; Claude reads it as input
```

Server later emits `session:updated` (batched) from the `prompt_received` timeline append,
which refreshes the target tile's metadata in the UI.

`spell:invoked` reuses the exact same UI path (PTY write + `addAnimation`) with
`senderMaestroSessionId: null`, so any improvement here also upgrades spell delivery.

### 1.2 Key code touch-points

| Layer | File | Lines | What |
|---|---|---|---|
| CLI | `maestro-cli/src/commands/session.ts` | ~1085–1119 | `session prompt`; POST with `{content, mode, senderSessionId}` |
| Server route | `maestro-server/src/api/sessionRoutes.ts` | ~984–1049 | validate, prefix sender, emit `session:prompt_send`, timeline `prompt_received` |
| Event type | `maestro-server/src/domain/events/DomainEvents.ts` | ~196–205 | `SessionPromptSendEvent` payload shape |
| WS bridge | `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` | 19, 145–217, 313–337 | `session:prompt_send` in `IMMEDIATE_EVENTS`; `broadcastImmediate` |
| Timeline | `maestro-server/src/application/services/SessionService.ts` | ~354–408 | `addTimelineEvent` → emits `session:updated` |
| UI ws handler | `maestro-ui/src/stores/useMaestroStore.ts` | 373–409 (spell 410–443) | `addAnimation` + `write_to_session` |
| Anim store | `maestro-ui/src/stores/usePromptAnimationStore.ts` | whole file | queue; auto-removes each anim after 1500ms |
| Anim render | `maestro-ui/src/components/PromptSendAnimation.tsx` | whole file | portal layer, `FlyingDot`, target/sender class toggles |
| Anim CSS | `maestro-ui/src/styles-sessions.css` | ~692–821 | `promptFly`, `promptPulseRing`, `promptReceiveGlow`, `promptSendFlash` |
| PTY write | `maestro-ui/src-tauri/src/pty.rs` | ~1023–1058 | `write_to_session` (source `user`/`system`) |

### 1.3 Existing messaging/status visuals (what already exists)

- **Flying-dot prompt animation (already built).** On `session:prompt_send`, a portal layer
  (`PromptSendAnimationLayer`, mounted in `App.tsx:482`) draws a `promptFlyingDot` that arcs
  from the sender tile center to the target tile center, then a `promptTargetPulse` ring, plus a
  `promptReceiveGlow` on the target and `promptSendFlash` on the sender. Color is `--theme-primary`.
  Auto-cleared after 1.5s.
- **Anchor mechanism.** `getSessionElement()` does `document.querySelector('[data-maestro-session-id="<id>"]')`
  and animates between the two `getBoundingClientRect()` centers.
- **needsInput glow.** `sessionTile--needsInput` → `needsInputGlow` 2s (white box-shadow pulse);
  status symbol renders `!` in amber.
- **Status dot/symbol.** `sessionDotPulse` 1.6s for `working`/`needsInput`; static colors for
  spawning/idle/completed/failed/stopped (`styles-maestro-sessions-v2.css` ~2195–2250).
- **Live agent dot.** `livePulse` 1.4s cyan dot when a tile has a live linked terminal.
- **Timeline events.** Color-coded event rows in the session detail overlay
  (`prompt_received` is recorded but has no dedicated styling/affordance in the list yet).

### 1.4 Spawn-chain / team relationship data available

- **Tree.** `useSessionTree.ts` builds parent→child nodes from `parentSessionId`; out-of-scope
  parents become roots. Rendered recursively by `SessionNodeRenderer` (`SessionsSection.tsx:509–574`)
  inside `.sessionTreeNode` / `.sessionTreeChildren` (the left border-line at
  `styles-maestro-sessions-v2.css` ~2086–2093 is the visible spawn edge).
- **Teams.** `teamGrouping.ts` groups by explicit `teamSessionId`, falling back to coordinator
  `mode` + `spawnedBy`/`parentSessionId`. Each group gets a `TeamColor` rendered as the tile's
  left accent bar (`--session-team-color`).

So "who talks to whom" is already expressible: sender/target tiles are locatable, and the
parent/child edge between a coordinator and its workers is already drawn as the tree connector.

### 1.5 Gaps found (the important part)

1. **The new tiles are NOT anchored.** The redesigned `SessionListItem` root and its
   `.sessionTreeNode` wrapper do **not** emit `data-maestro-session-id`. Only the *legacy*
   `SessionItem` (`SessionsSection.tsx:344`), `SpacesRail`, `MultiProjectSessionsView`, and
   `TeamView` do. **Result: in the redesigned main Sessions tree, the flying-dot animation can't
   find the sender/target and silently no-ops.** This is the single highest-value fix.
2. **No "awaiting response" / "response received" states.** The current animation covers
   *sent → in-flight → delivered* only. Nothing reflects "target is now thinking about my message"
   or "target replied." There is no `response` event today.
3. **Off-brand color.** Animation uses `--theme-primary` (matrix green) rather than the sender's
   team accent or the target's status color, so it reads as disconnected from the new tile system.
4. **Generic arc, not the spawn edge.** The dot flies a parabola between two centers; it ignores
   the existing tree connector even when sender→target *is* a parent/child edge.
5. **No content affordance.** The message text (and sender name) never surface in the UI; only the
   raw `[From: ...]` prefix lands in the terminal. A transient chip could show "→ <name>: <preview>".

---

## PART 2 — Proposed UX & animation design

Design goal: make a message feel like a small, legible packet that leaves the sender, travels the
spawn-chain to the receiver, and leaves a short-lived trace of the conversation — consistent with
the redesigned tiles (left human-complete radio, right agent-status symbol+color, expandable meta)
and the grouped Spaces section.

### 2.1 The five states (and how each is signaled)

| State | Trigger | Visual |
|---|---|---|
| **Sent** | `session:prompt_send` received in UI | Sender tile's **right status symbol** emits one outward ripple in the sender's team-accent color; brief `promptSendFlash` on the sender tile. |
| **In-flight** | immediately after | A **packet dot** travels sender→target. If sender/target are a parent/child pair, it travels **along the tree connector** (down the `.sessionTreeChildren` left edge); otherwise it falls back to the current arc. A small **chip** ("→ <targetName>: <preview>") rides near the dot or sits transiently under the sender tile. |
| **Delivered** | dot arrival (~700ms) | `promptTargetPulse` ring on the target's **status symbol** + one `promptReceiveGlow` on the target tile, recolored to the target's status color. |
| **Awaiting response** | derive: target transitions to `working` within ~Ns of delivery, OR `prompt_received` timeline entry is the latest | Target's status symbol shows the existing `working` pulse; a faint **directional tail** (small caret/线 on the connector) persists pointing sender→target to indicate "conversation open." Sender tile shows a subtle "awaiting" affordance (dimmed reply caret). |
| **Response received** | sender receives a `session:prompt_send` whose `senderSessionId` == the original target (i.e., reply travels the other direction), OR target's status returns to idle/needs_input after working | Run the same packet animation in **reverse** (target→sender) with the target's accent color; clear the "awaiting" affordance. |

> Note on "awaiting/response": these two states are **derivable today** without new server events
> by watching `session:updated` status transitions + the `prompt_received` timeline entry. A cleaner
> long-term option is a dedicated `session:prompt_response` event, but it is not required for v1.

### 2.2 Concrete component / CSS touch-points

**A. Fix the anchor (prerequisite, tiny).**
- Add `data-maestro-session-id={node.id}` to the `.sessionTreeNode` wrapper
  (`SessionsSection.tsx:531`) — or to `SessionListItem`'s root (`SessionListItem.tsx:168`).
  Without this nothing else in the new tree animates.
- Add a stable anchor for the **status symbol** specifically (e.g. `data-status-anchor`) so the
  packet can target the right-side symbol rather than the tile center.

**B. Travel along the spawn edge.**
- In `PromptSendAnimation.tsx`, when `senderEl` and `targetEl` are in a parent/child relationship
  (check `parentSessionId`, available via the session map), compute waypoints down the shared
  `.sessionTreeChildren` left border instead of the arc midpoint. Fall back to the existing arc
  otherwise (cross-team, cross-project, collapsed subtree).
- New keyframe `promptTravelEdge` (vertical glide + slight scale) alongside the existing
  `promptFly`. Keep `promptFly` as the fallback.

**C. Recolor to the tile system.**
- Pass the sender's `TeamColor` (already in `maestroColorMap`) into the animation payload; set the
  dot/glow via a CSS var (`--prompt-accent`) instead of hard-coding `--theme-primary`.
- Delivered glow uses the **target's status color** token (reuse the `sessionDotPulse` palette).

**D. Transient message chip.**
- New lightweight component `PromptChip` rendered in the portal layer: `→ <targetName>: <preview>`
  (preview = `content` with the `[From: ...]` prefix stripped, truncated ~40 chars). Fades in at the
  sender, rides toward the target, fades out on delivery (~900ms total). Pointer-events none.
- Reuse `usePromptAnimationStore` (already carries `content`); add optional `senderName`,
  `targetName`, `accent` to `PromptAnimation`.

**E. "Awaiting / conversation open" affordance.**
- Add `sessionTile--awaitingReply` (sender) and reuse `working` pulse (target). Drive it from a
  short-lived map in `usePromptAnimationStore` (sender→target, cleared on reverse message or after
  a timeout). New keyframe `awaitReplyShimmer` (very subtle, low-opacity) on the sender's reply caret.

**F. Timeline integration (low effort, high clarity).**
- Give the `prompt_received` timeline event dedicated styling + an icon in the detail overlay's
  timeline list, and surface "last message from <name>" in the tile's **expandable meta** so the
  conversation has a durable record beyond the 1.5s animation.

### 2.2b Routing: cross-project vs same-project (decided)

A message is one of two cases, decided by comparing the sender's and target's project:

- **Same project** → animate in the **right-side Spaces rail** (`SpacesRail`), sender icon → target icon.
- **Cross project** → animate in the **top project bar** (`ProjectTabBar`), sender tab → target tab.

**How the UI knows the projects.** Today `session:prompt_send` carries only
`{ sessionId, content, mode, senderSessionId, timestamp }` — **no projectId**. The server already
loads both session objects (which have `projectId`) when handling the prompt, so the cheapest robust
fix is to **add `senderProjectId` + `targetProjectId` to the event payload**
(`sessionRoutes.ts` emit + `DomainEvents.ts` `SessionPromptSendEvent`). Falling back to resolving
from the client session map is fragile because the sender's project may not be loaded in the current
view. → **Decision: add the two project IDs to the event.**

#### Cross-project — bubble travels along the project bar (decided)

- **Visual:** an **abstract dot tinted with the sender's project/team accent** glides horizontally
  along the bar from the sender's `.projectTab` to the receiver's `.projectTab`, with a brief glow on
  both tabs on depart/arrive. Transient, ephemeral. No text.
- **Anchors (already exist):** `ProjectTabBar.tsx:566` renders `data-project-id={p.id}` on each
  `.projectTab`. Reuse for `getBoundingClientRect()` of sender/receiver tabs. The bar already has a
  `projectTabNeedsInput` class + `projectTabWorkingDot` to harmonize with.
- **New CSS:** `promptTravelBar` keyframe (horizontal glide along the bar's y-center) + reuse a short
  tab glow (extend `projectTab` pulse). Layer sits in the same portal as `PromptSendAnimationLayer`.
- **Edge cases:**
  - Target tab **closed / not in the bar** → skip travel; pulse the visible endpoint only (usually
    the sender tab) so the user still sees "a message left this project."
  - Tabs **scrolled off-screen / overflow** → animate toward the bar edge in the target's direction,
    then fade (don't force-scroll the bar).
  - Both endpoints off-screen → drop silently (timeline still records it).

#### Same-project — bubble travels in the Spaces rail (decided)

- **Visual:** a small **sender puck** (sender initial/avatar, since the rail is already initial/icon
  based — `SpacesRail` `getSessionInitial`) glides from the sender session icon to the target session
  icon, then fades. Transient, ephemeral. Tinted with the sender's team accent.
- **Anchors (already exist):** `SpacesRail.tsx:71` renders `data-maestro-session-id` on each
  `.spacesRailSession` button. Reuse for endpoint geometry. (The rail is vertical, so travel is mostly
  vertical.)
- **New CSS:** `promptTravelRail` keyframe (glide between two rail buttons) + reuse `promptTargetPulse`
  on arrival, recolored to the target's status color.
- **Edge cases:**
  - Sender or target **not visible in the rail** (rail collapsed, filtered, or session not in current
    project view) → degrade to a single pulse on whichever endpoint is visible (prefer the target).
  - If the rail is **collapsed entirely** → fall back to the in-tree flying dot (which itself needs the
    v1 anchor fix in §2.2-A).

#### Decisions locked for this round

- **Content:** abstract — **no inline message text**. Bar = accent-tinted dot; rail = sender-initial
  puck. The message body still lands in the terminal and the `prompt_received` timeline entry.
- **Persistence:** **ephemeral animation only.** The existing `prompt_received` timeline event is the
  durable record (optionally styled per §2.2-F later); no new history UI in this round.
- **Spell delivery** (`spell:invoked`, sender null) → always same-project rail variant targeting the
  receiver icon (no sender endpoint → target pulse only).

### 2.3 Store/data changes (proposal only)

- `usePromptAnimationStore.PromptAnimation`: add `senderName?`, `targetName?`, `accent?`,
  `senderProjectId?`, `targetProjectId?`, `surface: 'tree' | 'rail' | 'bar'`,
  `direction: 'forward' | 'reply'`, and an `awaiting: Map<senderId,targetId>` slice.
- `useMaestroStore` `session:prompt_send` handler: read `senderProjectId`/`targetProjectId` from the
  event, pick `surface` (`bar` if projects differ, else `rail`/`tree`), enrich `addAnimation` with
  names + sender accent from `maestroColorMap`/session map; set `awaiting` on send.
- **Server (small, needed for cross-project):** add `senderProjectId` + `targetProjectId` to the
  `session:prompt_send` payload (`sessionRoutes.ts` emit + `DomainEvents.ts`). Both sessions are
  already loaded in the handler.
- Optional server addition (v2): emit `session:prompt_response` (or reuse the reverse
  `session:prompt_send`) so "response received" is event-driven instead of status-derived.
- `PromptSendAnimation.tsx` becomes a dispatcher: by `surface`, anchor on `[data-maestro-session-id]`
  (tree/rail) or `[data-project-id]` (bar), and render the matching keyframe variant.

### 2.4 Consistency & accessibility

- All motion respects `prefers-reduced-motion`: degrade to a single delivered-pulse + a static chip,
  no travel animation.
- Cap concurrent packets (e.g. ≤5) and coalesce rapid bursts to the same target into one packet with
  a count badge, to avoid a storm during coordinator fan-out.
- Colors come from existing team/status tokens — no new palette — so messaging reads as part of the
  same language as the tiles and Spaces groups.

### 2.5 Suggested implementation order (when greenlit)

1. **Anchor fix** (§2.2-A) — add `data-maestro-session-id` to the new tree tiles; makes the *existing*
   animation work at all in the redesigned Sessions tree.
2. **Recolor** to team/status tokens (§2.2-C).
3. **Routing + payload** — add `senderProjectId`/`targetProjectId` to the event; add `surface` to the
   animation store; turn `PromptSendAnimation` into a surface dispatcher (§2.2b, §2.3).
4. **Same-project Spaces-rail travel** — sender-initial puck between rail icons (§2.2b). *(decided)*
5. **Cross-project bar travel** — accent dot along the project tabs (§2.2b). *(decided)*
6. **Edge travel** for parent/child pairs in the tree (§2.2-B).
7. **Awaiting/response states** (§2.2-E) — status-derived first, event-driven later.
8. **Timeline + meta** durable record (§2.2-F).

Steps 1–3 are small and unlock everything. Steps 4–5 deliver the two surfaces you asked for
(rail bubble for same-project, bar bubble for cross-project), both abstract + transient + ephemeral.
Steps 6–8 layer on the richer conversation feel.
