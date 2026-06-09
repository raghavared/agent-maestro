# ModalSweep — CONTRACT

**Worker:** Modal Sweep (🧹) · session `sess_1780949537955_geywofuu2`
**Scope:** Re-skin 5 remaining modals in place, applying `panel-redesign/modals.css` + `modals.jsx` primitives consistently.
**Phase:** STUDY + CONTRACT (no edits made; gate still closed).
**Design source of truth:** `panel-redesign/modals.jsx`, `panel-redesign/modals.css`, `panel-redesign/theme.css` (`.pn-btn` family), `panel-redesign/kit.jsx` (`Icon`, `AgentTile`, `PN_ICONS`).
**Foundation consumption point:** `maestro-ui/src/components/maestro/redesign/{redesign-tokens.css, kit.tsx, useRedesignTheme.ts}`.
**Theme scope:** every class lands under `html[data-redesign]`; dark overrides under `html[data-redesign][data-theme="dark"]`.

---

## ⛔ HARD DEPENDENCY — modal/form classes provided by Foundation (blocks edit phase)

**Coordinator ruling (2026-06-09):** Foundation owns and ports `panel-redesign/modals.css` **verbatim** into the redesign token scope and lists the classes in `FOUNDATION-DONE.md`. **I consume those classes from the foundation stylesheet — I do NOT hand-port `modals.css` or define any of these classes myself.** This section is the verification checklist: every class below must appear in `FOUNDATION-DONE.md` before my edit phase opens.

I audited the currently-published `redesign-tokens.css`: **only `.pn-btn*` (8 rules) and `.pn-seg*` (3 rules) exist so far.** All classes below are the dependency I am waiting on.

**Classes I depend on — must be provided by the foundation redesign stylesheet (`html[data-redesign]`):**

| Group | Classes |
|---|---|
| Shell | `.pn-mdl`, `.pn-mdl__hd`, `.pn-mdl__hdmain`, `.pn-mdl__crumb`, `.pn-mdl__titleinput`, `.pn-mdl__close`, `.pn-mdl__body`, `.pn-mdl__foot`, `.pn-mdl__footL`, `.pn-mdl__footR` |
| Fields | `.pn-fld`, `.pn-flabel`, `.pn-flabel .req`, `.pn-fhint`, `.pn-frow`, `.pn-input`, `.pn-textarea`, `.pn-textarea--mono`, `.pn-select` |
| Description bar | `.pn-desc`, `.pn-desc__bar`, `.pn-mchip`, `.pn-mchip--ref` |
| Pickers | `.pn-prio-pills`, `.pn-prio-pill`, `.pn-pdot`, `.pn-toolsel`, `.pn-tool`, `.pn-tool__name`, `.pn-avatar-edit`, `.pn-instr`, `.pn-instr-i` |
| Toggles / caps | `.pn-toggle` (+ `--on-wt`, `--on-danger`), `.pn-caps`, `.pn-cap`, `.pn-cap__body/__name/__desc`, `.pn-switch` (+ `--on`) |
| Tabs | `.pn-mtabs`, `.pn-mtab` (+ `--active`), `.pn-mtab__n` |
| Footer extras | `.pn-assignadd`, `.pn-savehint`, `.pn-badge`, `.pn-badge--model` |

`.pn-btn`, `.pn-btn--primary`, `.pn-btn--ghost`, `.pn-btn--block`, `.pn-seg`, `.pn-seg-i` are already available — safe to consume now.

**Until these ship under `html[data-redesign]`, my in-place edits cannot render.** Escalating to coordinator → Foundation.

---

## ✅ CROSS-CUTTING RULINGS (RESOLVED by coordinator 2026-06-09)

Apply **IDENTICAL class semantics across all 5 modals** for consistency. **No net-new primitives** beyond what Foundation ports verbatim (+ `pn-toggle`/`pn-badge`).

- **A1 — Multi-select checkbox lists → APPROVED: reuse `.pn-cap` row + `.pn-switch`.** `TeamModal` (members, sub-teams) and `TeamLaunchConfigModal` (command-permission grids) become `.pn-cap` rows with a trailing `.pn-switch`. Preserve underlying readOnly checkbox + label `onClick` handler semantics. No new primitive.
- **A2 — Error banner → APPROVED: reuse `.pn-fhint` with a danger color token.** Keep the dismiss button. Do NOT introduce `.pn-banner`.
- **A3 — Static header title → APPROVED: `.pn-mdl__hd` with a static title element** (not `.pn-mdl__titleinput`) for `TaskListModal`, `SessionDetailModal`, `TeamLaunchConfigModal`. `TeamModal`/`ModelProfileModal` keep the editable `.pn-mdl__titleinput` (name lives in header).
- **A4 — Header meta → use existing primitives:** member-count → `.pn-badge`; session status → `.pn-dot`/`.pn-pill` (see B-block). No new primitive.
- **A5 — TeamModal avatar text-input** (2-char emoji `<input>`) → APPROVED: keep the `<input>` styled as a `.pn-avatar-edit` box; preserve `value`/`onChange` + `maxLength={2}`.

### Coverage note
`redesign-modals.css` already provides: `pn-mdl*`, `pn-fld*`, `pn-input`, `pn-textarea`, `pn-select`, `pn-prio-pill`, `pn-toolsel`, `pn-tool`, `pn-mchip`, `pn-caps`, `pn-cap`, `pn-switch`, `pn-mtabs`, `pn-instr`, `pn-savehint`, `pn-assignadd`. **Requested from Foundation (verbatim from tiles.css): `pn-toggle`(+`--on-danger`), `pn-badge`.** Coordinator verifies full list against `FOUNDATION-DONE.md §6` on publish.

### Dual-theme (provisional)
**SWAP OUTRIGHT** — `data-redesign` default-on, no conditional old-look fallback. (Coordinator confirming team-wide.)

---

## MODAL 1 — `TeamModal.tsx` (345 lines)

### (a) Functional surface — PRESERVE VERBATIM
- Props: `isOpen`, `onClose`, `projectId`, `team?`.
- State: `name`, `description`, `avatar`, `leaderId`, `selectedMemberIds`, `selectedSubTeamIds`, `isSaving`, `error`. `isEditMode = !!team`.
- Store hooks: `useMaestroStore` → `createTeam`, `updateTeam`, `teamMembers`, `teams`.
- Memos: `activeMembers`, `otherTeams`, `ancestorIds`, `availableSubTeams`.
- Effects: hydrate-on-open effect (`[isOpen, team]`); auto-include-leader effect (`[leaderId]`).
- Handlers: `handleClose`, `handleSubmit` (create/update branch), `toggleMember`, `toggleSubTeam`, `handleKeyDown` (⌘/Ctrl+Enter).
- a11y / behavior: `createPortal(..., document.body)`; backdrop `onClick={handleClose}`; inner `stopPropagation`; `autoFocus` on name input; all `disabled={isSaving}`; readOnly checkboxes with label `onClick` preventDefault.

### (b) Visual surface → primitive mapping
| Existing | New |
|---|---|
| `themedModalBackdrop` | scrim wrapper (keep div + handlers; restyle via tokens) |
| `themedModal themedModal--wide` | `.pn-mdl` |
| `themedModalHeader` | `.pn-mdl__hd` > `.pn-mdl__hdmain` |
| `themedModalTitle` `[ NEW/EDIT TEAM ]` | `.pn-mdl__crumb` (`Icon name="users"` + `agent-maestro` ▸ New/Edit team) + name input promoted to `.pn-mdl__titleinput` |
| name `themedFormInput` | `.pn-mdl__titleinput` (placeholder "e.g., Frontend Squad") |
| `themedModalClose` (×) | `.pn-mdl__close` + `Icon name="x"` |
| `themedModalContent` | `.pn-mdl__body` |
| error banner | **A2** |
| Description `themedFormInput` textarea | `.pn-fld` + `.pn-flabel` "Description" + `.pn-textarea` |
| Avatar `themedFormInput` (maxLength 2) | **A5** below |
| Leader `themedFormSelect` | `.pn-fld` + `.pn-flabel` "Leader `<span class=req>*</span>`" + `.pn-select` |
| Members `terminalTaskCheckbox` rows | **A1** |
| Sub-teams `terminalTaskCheckbox` rows | **A1** |
| `tmModal__footer` / `themedBtn` / `themedBtnPrimary` | `.pn-mdl__foot` > `.pn-mdl__footR` + `.pn-btn--ghost` (Cancel) + `.pn-btn--primary` (Create/Save) |

- **A5 — Avatar input.** Design's `.pn-avatar-edit` is a 46×46 monogram **button**; here it is a 2-char emoji **text `<input>`**. **Proposal:** keep the `<input>` (functional), style with `.pn-avatar-edit` box treatment. Escalate.

---

## MODAL 2 — `ModelProfileModal.tsx` (165 lines)

### (a) Functional surface — PRESERVE VERBATIM
- Props: `isOpen`, `onClose`, `profile?`.
- State: `name`, `description`, `launchConfig`, `activeTool`, `isSaving`, `error`. `isEditMode = !!profile`. `DEFAULT_CONFIG` const.
- Store hooks: `createModelProfile`, `updateModelProfile`.
- Effect: hydrate-on-open `[isOpen, profile]`.
- Handlers: `handleClose`, `handleSubmit` (sanitize → create/update). Imports `createLaunchConfig`, `formatLaunchConfigLabel`, `getAgentToolForLaunchConfig`, `sanitizeLaunchConfig`.
- Child: `<LaunchConfigDropdown>` (props `launchConfig`, `activeTool`, `onActiveToolChange`, `onLaunchConfigChange`, `showAdvancedOptions`) — **OUT OF SCOPE**, leave wrapper + props intact.
- a11y: portal; backdrop `handleClose`; `stopPropagation`; `autoFocus` name; `disabled={isSaving}`.

### (b) Visual surface → primitive mapping
| Existing | New |
|---|---|
| `themedModal --wide` | `.pn-mdl` |
| header + `themedModalTitle` `[ NEW/EDIT MODEL PROFILE ]` | `.pn-mdl__hd`/`__crumb` (`Icon name="sliders"`) + name → `.pn-mdl__titleinput` (placeholder "e.g., Heavy") |
| `themedModalClose` | `.pn-mdl__close` + `Icon name="x"` |
| `themedModalContent` | `.pn-mdl__body` |
| `themedFormHint` (explainer) | `.pn-fhint` |
| Description label+`themedFormInput` | `.pn-fld` + `.pn-flabel` "Description" + `.pn-input` |
| Launch config label (`formatLaunchConfigLabel`) | `.pn-flabel` "Launch config" + inline label suffix |
| `terminalLaunchDropdown--inline` wrapper | keep wrapper; `<LaunchConfigDropdown>` untouched (**flag: child not themed**) |
| footer `themedBtn*` | `.pn-mdl__foot`/`__footR` + `.pn-btn--ghost` / `.pn-btn--primary` |

- Note: `LaunchConfigDropdown` is a separate component owned elsewhere; it will visually clash until separately themed. Flagging as a **secondary dependency** (not mine to edit).

---

## MODAL 3 — `TaskListModal.tsx` (109 lines)

### (a) Functional surface — PRESERVE VERBATIM
- Props: `isOpen`, `projectId`, `list?`, `onClose`.
- State: `name`, `description`, `isSaving`, `error`. `isEditMode = !!list`.
- Store hooks: `createTaskList`, `updateTaskList`.
- Effect: hydrate-on-open `[isOpen, list]`.
- Handler: `handleSubmit(e?)` with `e?.preventDefault()` — **wrapped in `<form onSubmit>`; preserve form + submit button `type="submit"`.**
- a11y: NO portal (renders inline); backdrop `onClick={onClose}`; `stopPropagation`.

### (b) Visual surface → primitive mapping
| Existing | New |
|---|---|
| `themedModalBackdrop` / `themedModal` (narrow) | scrim + `.pn-mdl` (default width) |
| `themedModalTitle` `[ NEW/EDIT TASK LIST ]` (static) | `.pn-mdl__crumb` (`Icon name="listChecks"`) + **A3** static title |
| `themedModalClose` | `.pn-mdl__close` + `Icon name="x"` |
| `<form>` + `themedModalContent` | keep `<form>`; inner `.pn-mdl__body` |
| Name `themedFormRow`/`themedFormLabel`/`themedFormInput` | `.pn-fld` + `.pn-flabel` "Name" + `.pn-input` |
| Description `themedFormTextarea` (rows=3) | `.pn-fld` + `.pn-flabel` "Description" + `.pn-textarea` |
| error `themedFormHint` (danger) | **A2** |
| `themedFormActions` / `themedBtn*` | `.pn-mdl__foot`/`__footR` + `.pn-btn--ghost` (Cancel) + `.pn-btn--primary` (`type="submit"`) |

---

## MODAL 4 — `SessionDetailModal.tsx` (280 lines) — ⚠ READ-ONLY DETAIL VIEW

> **Biggest divergence.** This is not a form modal. `modals.jsx` has no detail-view, info-grid, section-header, status-badge, or timeline primitive. **Escalating heavily (B-block below).**

### (a) Functional surface — PRESERVE VERBATIM
- Props: `sessionId`, `isOpen`, `onClose`.
- Store hooks: `sessions[sessionId]`, `tasks`, `fetchSession`.
- Refs: `timelineContainerRef`, `isUserScrolledToBottomRef`.
- Effects: fetch-on-open `[isOpen, sessionId, fetchSession]`; Escape-key listener `[isOpen, onClose]`; auto-scroll `[timelineLength]`.
- Handler: `handleScroll` (useCallback). `linkedTasks` derivation. Const maps `SESSION_STATUS_LABELS`, `TASK_STATUS_SYMBOLS`. Helpers `formatDate`, `formatTimeAgo`.
- Children — **OUT OF SCOPE, untouched:** `SessionTimeline`, `DocsList`, `StrategyBadge`, `GitPanel`, `WorktreeBadge` (+`getWorktreeInfo`), `PrChip` (+`getPrInfo`).
- a11y: NO portal; overlay `onClick={onClose}`; `stopPropagation`; Escape closes.

### (b) Visual surface → primitive mapping (shell only — see B-block)
| Existing | New |
|---|---|
| `maestroModalOverlay` | scrim wrapper |
| `terminalTaskModal` | `.pn-mdl` |
| `terminalModalHeader`/`Content` (title `h2`) | `.pn-mdl__hd`/`__hdmain` + **A3** static title (`session.name`) |
| `terminalModalBtn` (✕, header) | `.pn-mdl__close` + `Icon name="x"` |
| `terminalModalMeta` status/model/mode badges, worktree/PR chips | **A4** — `.pn-badge` chip row under title (badges keep their conditional logic) |
| `terminalModalBody` | `.pn-mdl__body` |
| section titles `▸ Info / Linked Tasks / Git / Timeline` | **B1** |
| `sessionDetailInfoGrid` / `InfoRow` / `terminalDetailLabel`/`Value` | **B2** |
| `sessionDetailTaskItem` rows | **B3** |
| `terminalModalFooter`/`Left`/`Right`, `terminalModalBtn` (Close) | `.pn-mdl__foot`/`__footL` (session id via `.pn-savehint`) / `__footR` + `.pn-btn--ghost` (Close) |

**B-block — RULING (resolved):** restyle shell + `.pn-mdl__hd` header + footer **AND** apply tokens to the info-grid section headers + status badges using **existing primitives**. Defer ONLY genuinely design-silent sub-structures (e.g. timeline if no clean primitive). **Preserve 100% of read-only behavior + all data bindings.**
- **B1 — Section headers** (`▸ Info`, `▸ Linked Tasks`, `▸ Git`, `▸ Timeline`) → `.pn-flabel` (mono uppercase) per section.
- **B2 — Info key/value grid** → `.pn-fld`-style rows: `.pn-flabel` (key) + value span via tokens.
- **B3 — Status / model / mode badges** → `.pn-dot`/`.pn-pill` for status; `.pn-badge` for model/mode. `WorktreeBadge`/`PrChip` stay (child components).
- **B4 — Linked-task rows** (status symbol + title) → `.pn-cap`-style rows (read-only, no switch).
- **Deferred:** `SessionTimeline` internals (child component) — keep as-is unless a clean primitive emerges; wrapper `.sessionDetailTimelineScroller` restyled via tokens only.

---

## MODAL 5 — `TeamLaunchConfigModal.tsx` (471 lines) — most complex

### (a) Functional surface — PRESERVE VERBATIM
- Props: `isOpen`, `onClose`, `coordinatorId`, `workerIds`, `teamMembers`, `projectId`, `onLaunch`, `onSave?`, `onSaveAsTeam`.
- State: `configs` (Record<id, MemberConfig>), `showSaveDialog`, `teamName`, `expandedCommandGroups` (Set).
- Store hook: `useProjectStore` → `projectWorkingDir`.
- Memo/cb: `buildInitialConfigs` (useCallback). Effect: reset-on-open `[isOpen, buildInitialConfigs]`.
- Handlers: `updateConfig`, `handleToolChange`, `handleCommandToggle`, `toggleCommandGroup`, `toggleMemberExpanded`, `buildOverrides`, `handleLaunch`, `handleSave`, `handleSaveAsTeam`. Imports `getEffectiveCommandEnabled`, `isCommandAllowedForMode`, `toggleCommandOverride`, agent-tool constants, `COMMAND_GROUPS`.
- Child — **OUT OF SCOPE:** `ClaudeCodeSkillsSelector` (props `selectedSkills`, `onSelectionChange`, `projectPath`).
- a11y: portal; backdrop `onClick={onClose}`; `stopPropagation`; team-name input `autoFocus` + Enter/Escape handlers.

### (b) Visual surface → primitive mapping
| Existing | New |
|---|---|
| `themedModal --wide launchConfigModal` | `.pn-mdl` (keep `launchConfigModal` for width override) |
| header `themedModalTitle` `[ LAUNCH CONFIGURATION ]` + count | `.pn-mdl__crumb` (`Icon name="play"`) + **A3** static title + **A4** member-count chip |
| `themedModalClose` | `.pn-mdl__close` + `Icon name="x"` |
| `themedModalContent` | `.pn-mdl__body` |
| `launchConfigMembers` / `launchConfigCard` (+`--coordinator`) | **C1** per-member card — no primitive; keep card class, restyle borders/spacing via tokens |
| `launchConfigCardAvatar`/`Name`/`Role` | identity row via tokens; avatar like `.pn-avatar-edit` static |
| `launchConfigBadge--coordinator` (COORD) | `.pn-badge` |
| `launchConfigSelect` (tool, model) | `.pn-select` |
| `launchConfigToggle` (danger/safe) | `.pn-toggle` + `--on-danger` (exists in CreateTask) |
| `launchConfigExpandBtn` (▲/▼) | `.pn-mchip` icon-button or `.pn-mdl__close`-style ghost btn (confirm) |
| `launchConfigSection` / inline-styled command grid | **A1** (command checkbox grids) + `.pn-fhint` for the helper text |
| `tmModal__permCard`/`Label` | `.pn-fld` + `.pn-flabel` |
| command-group collapse buttons (inline styles) | restyle via tokens (`.pn-flabel`-ish); preserve `▶/▼` toggle logic |
| `tmModal__footer` + multi-state buttons | `.pn-mdl__foot`/`__footR` + `.pn-btn` family; team-name `themedFormInput` → `.pn-input` |

- **C1 — Per-member card.** `launchConfigCard` has identity + control cluster + expandable detail. No `modals.jsx` analogue (it's closer to a roster/tile pattern). **Proposal:** retain `launchConfigCard` as the structural wrapper, restyle with tokens (border `--pn-line-2`, radius `--pn-r-md`, surface `--pn-surface`); map selects/toggles/badges to primitives above. Confirm this hybrid is acceptable or escalate to whoever owns tile primitives.

---

## IMPLEMENTATION STATUS (2026-06-09 — gate open, holds lifted)
All 5 modals edited in place. `Icon` consumed from `./redesign/kit`. Identical class semantics applied:
- **TaskListModal** ✅ — `pn-mdl` shell, static title (`h2.pn-mdl__titleinput`), `pn-fld`/`pn-input`/`pn-textarea`, error→`pn-fhint`+`var(--pn-block)`, `pn-mdl__foot`+`pn-btn`. `<form onSubmit>` + submit button preserved.
- **ModelProfileModal** ✅ — editable `pn-mdl__titleinput` (name), hint→`pn-fhint`, description `pn-fld`/`pn-input`, launch-config `pn-flabel` wrapping untouched `LaunchConfigDropdown`, footer `pn-btn`.
- **TeamModal** ✅ — editable titleinput, avatar `<input class="pn-avatar-edit">` (value/onChange/maxLength kept), `pn-textarea` desc, `pn-select` leader (`.req`), members + sub-teams as `pn-cap`+`pn-switch` (hidden readOnly checkbox + row onClick preserved), error `pn-fhint`, footer `pn-btn`.
- **SessionDetailModal** ✅ — read-only: `pn-mdl` shell + static title; status → `pn-pill`+`pn-dot`(+`--live`); model/mode → `pn-badge`/`pn-badge--model`; section headers `pn-flabel` w/ hairline; info grid `pn-fld` key/value; linked tasks `pn-cap` rows (token-colored status glyph); footer `pn-mdl__foot`+`pn-btn`. Children (`SessionTimeline`/`DocsList`/`GitPanel`/`StrategyBadge`/`WorktreeBadge`/`PrChip`) + all refs/effects/handlers untouched.
- **TeamLaunchConfigModal** ✅ — `pn-mdl` shell, static title + `pn-badge` member count; per-member `launchConfigCard` retained, token-inline restyled; tool/model → `pn-select`; danger → `pn-toggle`/`pn-toggle--on-danger`; expand → ghost `pn-mdl__close` icon btn; COORD → `pn-badge`; command grids → `pn-cap`+`pn-switch`; footer multi-state `pn-btn` + `pn-input` team name. `ClaudeCodeSkillsSelector` untouched.

Backdrop scrims kept as functional positioning surfaces (`themedModalBackdrop` / `maestroModalOverlay`) — no `pn-` scrim primitive exists; card-level visuals fully swapped.

## DELIVERABLES — COMPLETE (2026-06-09)
- ✅ In-place edits to all 5 modal files — zero functionality change (every prop/hook/handler/ref/effect/a11y preserved).
- ✅ **Typecheck gate:** `cd maestro-ui && bunx tsc -b` → **exit 0, clean** (per coordinator's build ruling: workers run typecheck only; coordinator runs ONE authoritative `bun run build:ui` for the branch).
- ✅ **Light + dark screenshots:** `.maestro/redesign/modal-sweep-light.png` + `modal-sweep-dark.png`, via static harness `.maestro/redesign/modal-sweep-preview.html` (+ `shoot-modal-sweep.mjs`) rendering my exact `pn-` markup against the real foundation CSS (tokens+tiles+modals), headless Chrome. Dark theme applies automatically through `[data-theme="dark"]` token overrides — no modal-specific dark rules required.

### Screenshot method note (transparency)
This environment has **no browser-automation tooling wired to the live Tauri app** (no Playwright MCP; the 5 modals open behind app state — sessions/team-members/projects — not addressable routes). Rather than fabricate live captures, I rendered a **static harness** that mirrors the shipped JSX `pn-` structure 1:1 with representative mock data, against the actual foundation stylesheets. This faithfully shows the re-skinned visual result in both themes. If the coordinator wants true live-app captures, that needs either a Playwright-MCP/driver against `localhost:4568` with seed data, or the owner to capture from a running session.

### Tokens-only / kit-only verification
- No hardcoded colours/spacing/fonts/radii/shadows — all via `var(--pn-*)`. Inline styles (info-grid, member cards, command rows) reference only `--pn-*` tokens.
- All icons via `Icon` from `./redesign/kit`; status via `pn-dot`/`pn-pill`; badges via `pn-badge`; danger via `pn-toggle--on-danger`.
- Backdrops (`themedModalBackdrop`/`maestroModalOverlay`) intentionally retained as functional scrim/positioning surfaces (no `pn-` scrim primitive exists); all card-level visuals fully swapped.

## ESCALATIONS — STATUS (all resolved by coordinator 2026-06-09)
1. **KIT GAP** — Foundation owns verbatim `modals.css` port + `pn-toggle`/`pn-badge`; I consume. ✅ ruled (gated on `FOUNDATION-DONE.md §6`).
2. **A1** — `.pn-cap` row + `.pn-switch`. ✅ approved.
3. **A2** — `.pn-fhint` + danger color token. ✅ approved.
4. **A3** — static title element in `.pn-mdl__hd`. ✅ approved.
5. **A4** — `.pn-badge` (count) / `.pn-dot`+`.pn-pill` (status). ✅ approved.
6. **A5** — avatar `<input>` styled as `.pn-avatar-edit` (default; not separately ruled).
7. **B-block** — SessionDetail: shell+header+footer + info-grid headers + status badges via existing primitives; defer only timeline internals. ✅ ruled.
8. **C1** — retain `launchConfigCard`; selects→`pn-select`, danger→`pn-toggle--on-danger`, expand→ghost icon btn. ✅ approved.
9. **Secondary deps (not mine):** `LaunchConfigDropdown`, `ClaudeCodeSkillsSelector`, `SessionTimeline`/`DocsList`/`GitPanel` and the `WorktreeBadge`/`PrChip`/`StrategyBadge` children will clash until separately themed — out of my scope.

**Gate status:** HOLDING in study+contract. Awaiting coordinator broadcast that `FOUNDATION-DONE.md` (incl. modal CSS port) is published.
