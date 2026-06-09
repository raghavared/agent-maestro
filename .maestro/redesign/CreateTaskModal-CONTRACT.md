# CreateTaskModal.tsx Re-skin — CONTRACT

**Worker:** ➕ Task Create Modal Worker (`tm_1780948940503_yqq1c649j`)
**Scope:** `maestro-ui/src/components/maestro/CreateTaskModal.tsx` (545 lines) **+ its 15 child components** under `maestro-ui/src/components/maestro/task-modal/` → the `pn-mdl` modal design.
**Coordinator:** Misc Coordinator (`sess_1780949287694_kcjl2idwr`)
**Status:** Steps 1–3 complete (study + contract). **Gate CLOSED** — no source edits until `FOUNDATION-DONE.md` is published.
**Design source of truth:** `panel-redesign/modals.jsx` `CreateTaskModal()` (lines 11–111) + `panel-redesign/modals.css` + `panel-redesign/kit.jsx`.

> **HEADLINE:** The design mockup is a small, **static** representation. The real component is ~10× richer (edit mode, overlay variant, draft lifecycle, auto-save, launch config, team selector, image staging, reference-task picker, confirm-discard dialog, and 3 tabs the mockup omits). The mockup covers the **create-mode happy path only**. Every functional surface with no design counterpart is enumerated in §5 (SILENT) and must be escalated, not invented.

---

## 0. HARD DEPENDENCY — modal classes come FROM foundation (consumed, not hand-ported)

**COORDINATOR RULING (Misc Coordinator):** Foundation owns and ports `panel-redesign/modals.css` **verbatim** into the redesign token scope and will **list those classes in `FOUNDATION-DONE.md`**. I **consume** them from the foundation stylesheet — I do **NOT** hand-port modals.css or define any `pn-mdl*/pn-fld*/pn-input/pn-prio-pill/pn-tool/...` rules myself. The table below is the verification checklist (every class I depend on); FOUNDATION-DONE.md must cover all the ❌ rows before my gate opens.

> ⚠️ **SCOPE NOTE FOR FOUNDATION:** two classes I depend on live in **tiles.css, not modals.css** — `pn-toggle`(`--on-wt`/`--on-danger`) and `pn-badge`(`--model`). The ruling names modals.css only, so these would be **missed** unless Foundation also ports them (or the Tiles worker covers them). **Flagged to coordinator** — see row notes.

**Verified** against the published `redesign-tokens.css` (status = "is it in the foundation stylesheet *today*"; all ❌ are expected to flip to ✅ via the modals.css port):

| Class family | Source file | In foundation tokens now? |
|---|---|---|
| `pn-mdl`, `pn-mdl__hd/__hdmain/__crumb/__titleinput/__close/__body/__foot/__footL/__footR` | modals.css | ❌ **MISSING** |
| `pn-fld`, `pn-flabel`(`.req`), `pn-fhint`, `pn-frow` | modals.css | ❌ **MISSING** |
| `pn-input`, `pn-textarea`(`--mono`) | modals.css | ❌ **MISSING** |
| `pn-desc`, `pn-desc__bar`, `pn-mchip`(`--ref`) | modals.css | ❌ **MISSING** |
| `pn-select` | modals.css | ❌ **MISSING** |
| `pn-prio-pills`, `pn-prio-pill`(`--active`), `pn-pdot` | modals.css | ❌ **MISSING** (note: a *different* `pn-prio` / `pn-prio--high/med/low` family already exists in tokens — **do not confuse**; CreateTaskModal needs the **pill** family) |
| `pn-mtabs`, `pn-mtab`(`--active`)(`__n`) | modals.css | ❌ **MISSING** |
| `pn-mdl__foot` + `pn-assignadd`, `pn-savehint` | modals.css | ❌ **MISSING** |
| `pn-toggle`(`--on-wt`/`--on-danger`) | **tiles.css** | ❌ **MISSING — outside the modals.css port; needs explicit coverage** (footer/details toggles) |
| `pn-badge`(`--model`) | **tiles.css** | ❌ **MISSING — outside the modals.css port; needs explicit coverage** (footer model chip) |
| `pn-seg`, `pn-seg-i`(`--active`) | tokens | ✅ present (not needed by CreateTaskModal; used by TeamMemberModal) |
| `pn-btn`(`--primary`/`--ghost`) | tokens | ✅ present (footer buttons) |
| `pn-dot`(`--idle` etc.) | tokens | ✅ present |

**Good news — no token gap:** every CSS *variable* the modal CSS references is already defined in `redesign-tokens.css` under both `html[data-redesign]` and `html[data-redesign][data-theme="dark"]`: `--pn-card, --pn-line, --pn-line-2, --pn-r-{lg,md,sm,pill}, --pn-sh-{pop,sm}, --pn-ui, --pn-mono, --pn-serif, --pn-ink{,-2,-3,-4}, --pn-brand, --pn-brand-soft, --pn-surface, --pn-hover, --pn-active, --pn-block, --pn-wait, --pn-idle, --pn-run`. And every Icon I need (`listChecks, chevronR, chevronD, x, paperclip, at, hash, doc, sliders, sparkles, calendar, gitBranch, shield, plus, play, users, check`) exists in foundation `kit.tsx`.

**STATUS per ruling:** Foundation is porting **modals.css verbatim** (covers the modals.css ❌ rows). **Outstanding ask:** confirm `pn-toggle*` + `pn-badge*` (from **tiles.css**) are also covered — either by Foundation or the Tiles worker — and listed in `FOUNDATION-DONE.md`. Until both modals.css AND those two tiles.css families are published, this task is BLOCKED at implementation. I consume all of these from the foundation stylesheet; I do not define any of them.

---

## 1. Functional surface — PRESERVE VERBATIM (zero behavior change)

The main file is almost entirely orchestration. Only `className` strings (and the wrapping JSX of the visual chrome) change. **Everything below is untouched.**

### Props (all 23 preserved exactly)
`isOpen, onClose, onCreate, onStartTask, project, parentId, parentTitle, mode, task, onUpdateTask, onAddSubtask, onToggleSubtask, onDeleteSubtask, onWorkOn, onNavigateToTask, onJumpToSession, onWorkOnSubtask, selectedAgentId, onAgentSelect, variant`. Default `mode="create"`, `variant="modal"`.

### Hooks (all preserved)
`useReferenceTaskPicker(project?.id)`, `useFileAutocomplete(project?.basePath, isOpen)`, `useSkillAutocomplete(project?.basePath, isOpen)`, `useMaestroStore` (selectors: `tasks`, `teamMembers`, `getState().tasks`, `getState().updateTask`), `useDraftTaskLifecycle({…})`, `useTaskForm(mode, isOpen, task, draft.draftTask)`, `useAutoSave({…})`.

### Refs (preserve)
`stagedFileInputRef` (hidden `<input type=file>`), `formStateRef` (stale-closure guard — **its `.current` is reassigned every render at lines 140-147; keep that assignment intact**).

### Derived state / memos (preserve)
`isEditMode`, `isOverlay`, `teamMembers` (useMemo filter `status==='active' && projectId===project.id`), `getAutoTitle` (useCallback), `effectiveEditMode` (`isEditMode || draft.phase==="created"`), `effectiveTask`, `subtasks`.

### useEffects (preserve all 4, with exact deps)
1. Auto-create trigger on first content (`mode/draft.phase/form.title/form.prompt`).
2. Upload staged images after draft creation (`draft.phase/draft.draftTaskId`).
3. Load reference tasks in edit mode (dynamic `import` of `maestroClient`; deps incl. `JSON.stringify(task?.referenceTaskIds)`).
4. Reset ref picker on create mode (`mode/isOpen`).
Plus `useAutoSave` internal debounce (1000ms) and `autoSaveFn` (useCallback).

### Handlers (preserve logic exactly; only buttons that call them get re-skinned)
`handleClose` (edit→saveNow then close; dirty create→confirm dialog), `handleConfirmDiscard`, `handleToggleLaunchConfig` (inits member configs), `handleSubmit(startImmediately)` (draft path `ensureCreated` vs normal `getCreatePayload` + `getMemberOverrides`), `handleSave`, `handleAddSubtask`, **`handleKeyDown` (⌘/Ctrl+Enter → save in edit / submit in create — KEEP)**.

### Early returns / portal (preserve)
`if (!isOpen) return null;`; overlay variant returns bare `modalContent`; modal variant returns `createPortal(<div.themedModalBackdrop onClick={handleClose}>…</div>, document.body)`. **Backdrop click-to-close and `onClick={e=>e.stopPropagation()}` on the card MUST be preserved** (a11y/dismiss behavior).

### a11y / semantics (preserve)
`type="button"` on every button, `type="text"/"file"/"date"/"checkbox"` on inputs, `title=` tooltips, `placeholder` semantics, `accept="image/*" multiple` on file input, autoFocus-on-open of the title input (TaskFormHeader's `setTimeout(focus,100)`).

---

## 2. Visual surface — REPLACE (old `themed*` class → new `pn-*` class + token/kit map)

The component renders through child components. Mapping is **per child** (each child is edited in place; no new files).

### 2a. `CreateTaskModal.tsx` (shell + portal)
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Card | `div.themedModal.themedModal--wide(.themedModal--overlay)` | `div.pn-mdl` (keep overlay modifier as extra class/data-attr) | `.pn-mdl` (modals.css:18) |
| Backdrop | `div.themedModalBackdrop` | restyle to scrim tokens — **design has no backdrop primitive (mockup is on a stage); ESCALATE §5** | TBD |
| Content region | `div.themedModalContent` / `themedModalDescriptionArea` | `div.pn-mdl__body` | `.pn-mdl__body` (43) |
| Tab content wrapper | `div.themedModalTabContent` (inline maxHeight/border styles) | second `div.pn-mdl__body` w/ `maxHeight:220` (mockup pattern, line 50) | `.pn-mdl__body` |

### 2b. `TaskFormHeader.tsx`
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Header bar | `div.themedModalHeader` | `div.pn-mdl__hd` → `div.pn-mdl__hdmain` + `button.pn-mdl__close` | `.pn-mdl__hd/__hdmain/__close` (27,28,38) |
| Breadcrumb / kicker | `span.themedModalTitle "[ NEW TASK ]"` / status badge | `div.pn-mdl__crumb` → `<Icon listChecks>` `<b>{project.name}</b>` `<Icon chevronR 11>` `New task` (or subtask) | `.pn-mdl__crumb` (29); icons `listChecks`,`chevronR` |
| Title input | `input.themedFormInput` (inline fontSize/weight) | `input.pn-mdl__titleinput` (serif 24px) | `.pn-mdl__titleinput` (32) |
| Close button | `button.themedModalClose "×"` | `button.pn-mdl__close` → `<Icon x>` | `.pn-mdl__close`; icon `x` |
| Edit-mode status badge | `span.themedTaskStatusBadge[data-status]` | **no design equivalent** → keep, restyle to token chip — **ESCALATE §5** | TBD |
| Edit breadcrumb / subtask subtitle | `div.themedFormHint` | reuse `pn-mdl__crumb` or `pn-fhint` | `.pn-fhint` (51) |

### 2c. `TaskDescriptionField.tsx`
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Field wrapper | `div.themedFormRow` + `div.themedFormLabel "Description"` | `div.pn-desc.pn-fld` (+ optional `pn-flabel`) | `.pn-desc`,`.pn-fld`,`.pn-flabel` (65,48,49) |
| Mentions textarea | `MentionsInput.mentionsInput` w/ JS `mentionsStyle` object | keep `react-mentions`, restyle the control to look like `.pn-textarea` (font/border/focus ring via tokens) — **mentionsStyle is JS, not CSS class; restyle inline values to tokens; ESCALATE if a class-only approach is required** | `.pn-textarea` (54,61) |
| Mention suggestions | `.suggestionItem(.focused)`, `.skillSuggestion*` | restyle to surface/line tokens — **no design primitive for the dropdown; ESCALATE §5** | TBD |
| Toolbar chips (children slot) | inline-styled `<span>`/`<button>` | `div.pn-desc__bar` → `button.pn-mchip` (Attach/Reference/Skill) + `span.pn-mchip.pn-mchip--ref` for selected | `.pn-desc__bar`,`.pn-mchip(--ref)` (66-74); icons `paperclip`,`at`,`hash`,`doc`,`x` |

### 2d. Image staging (inline in CreateTaskModal.tsx, lines 374-419) + `ImagesTab.tsx variant="bar"`
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Staged image chip | inline-styled `<span>` w/ thumb + name + × | `span.pn-mchip.pn-mchip--ref` (thumb stays, × via `<Icon x 11>`) | `.pn-mchip--ref`; icon `x` |
| "+ img" attach button | inline-styled `<button>` | `button.pn-mchip` → `<Icon paperclip>` Attach | `.pn-mchip`; icon `paperclip` |

### 2e. `ReferenceTaskPicker.tsx`
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Selected ref chip | (themed chips) | `span.pn-mchip.pn-mchip--ref` → `<Icon doc 12>` title `<Icon x 11>` | `.pn-mchip--ref`; icons `doc`,`x` |
| Toggle button | (themed) | `button.pn-mchip` → `<Icon at>` Reference | `.pn-mchip`; icon `at` |
| Picker dropdown/list | themed dropdown | **no design primitive** → token surface popover — **ESCALATE §5** | TBD |

### 2f. `TaskTabBar.tsx` (and create-mode tab strip)
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Tab bar | `div.themedModalTabBar` | `div.pn-mtabs` | `.pn-mtabs` (140) |
| Tab button | `button.themedModalTab(--active)` | `button.pn-mtab(.pn-mtab--active)` → `<Icon …>` label | `.pn-mtab(--active)` (141,147); icons per tab: details=`sliders`, skills=`sparkles`, subtasks=`listChecks`, refs/ref-docs=`at`, sessions=`?`(SILENT), gen-docs=`doc`, timeline=`?`(SILENT) |
| Tab count badge | `span.themedModalTabBadge` | `span.pn-mtab__n` | `.pn-mtab__n` (149) |
| Collapse "×" tab | `button.themedModalTab.themedModalTabClose` | `button.pn-mtab` → `<Icon x>` — **mockup has no collapse affordance; ESCALATE §5** | icon `x` |

> **Tab-set mismatch:** mockup tabs = `details, skills, subtasks, refs` (4). Existing tabs = `subtasks, skills, sessions, ref-docs, gen-docs, timeline, details` (7, edit-mode-gated). I keep **all existing tabs** and skin them; the 3 with no mockup icon (`sessions`, `gen-docs`, `timeline`) need icon assignment — **ESCALATE §5**.

### 2g. `DetailsTab.tsx`
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Priority | `div.themedSegmentedControl` + `button.themedSegmentedBtn` | `div.pn-prio-pills` + `button.pn-prio-pill(.--active)` → `span.pn-pdot`(color by priority) + label | `.pn-prio-pills/-pill(--active)/.pn-pdot` (105-113). `pdot` color map: high=`var(--pn-block)`, medium=`var(--pn-wait)`, low=`var(--pn-idle)` (mockup line 18) |
| Due date | `input[type=date].themedInput` + Clear `button.themedSegmentedBtn` | `div.pn-fld` `span.pn-flabel "Due date"` + relative-positioned `<Icon calendar 14>` + `input.pn-input{paddingLeft:32}`. **Keep `type="date"` + Clear button** (mockup uses a text input — preserve native date picker for function) | `.pn-fld/.pn-flabel/.pn-input`; icon `calendar` |
| Isolation (worktree) | `<label>` + `input[type=checkbox]` "Worktree" | `div.pn-fld` `span.pn-flabel "Isolation"` + `button.pn-toggle(.pn-toggle--on-wt)` → `<Icon gitBranch 14>` In-place/Git worktree. **Toggle must drive the same `useWorktree` boolean + `onUseWorktreeChange`** | `.pn-toggle(--on-wt)` (tiles.css:49,59); icon `gitBranch` |
| Edit-mode status/id line | inline-styled spans + `themedTaskStatusBadge` | restyle to `pn-fhint` / token chip — **ESCALATE §5** | `.pn-fhint` |

### 2h. `TaskModalFooter.tsx`
| Element | OLD | NEW | Tokens / kit |
|---|---|---|---|
| Footer bar | `div.themedFormActions` | `div.pn-mdl__foot` → `div.pn-mdl__footL` + `div.pn-mdl__footR` | `.pn-mdl__foot/__footL/__footR` (152-154) |
| Team member selector | `<TeamMemberSelector>` (dropdown) | left side: `span.pn-flabel "Assignee"` + avatar(s) + `button.pn-assignadd`(`<Icon plus 13>`) | `.pn-assignadd` (155); icon `plus` — **but mockup shows a single static avatar; the real multi-select dropdown has no design; ESCALATE §5** |
| Model badge | (none today) | `span.pn-badge.pn-badge--model` → `<AgentTile>` model `<Icon chevronD 9>` — **net-new; only render if model data exists; ESCALATE §5** | `.pn-badge--model` (tiles.css); `<AgentTile>`, icon `chevronD` |
| Launch-config gear | `button.launchConfigGearBtn(--active)` "⚙" | restyle to `pn-mchip`/icon button — **no mockup equivalent; ESCALATE §5** | icon `sliders`/`settings`? |
| Auto-save indicator | inline `<span>` "Saving…/Saved" | `span.pn-savehint` → `span.pn-dot` + text | `.pn-savehint`,`.pn-dot` (160) |
| Cancel | `button.themedBtn` | `button.pn-btn.pn-btn--ghost` | `.pn-btn--ghost` (193) |
| Create Task | `button.themedBtn.themedBtnPrimary` | `button.pn-btn` (plain) "Create" | `.pn-btn` (170) |
| Create & Run / $ exec | `button.themedBtn.themedBtnSuccess` | `button.pn-btn.pn-btn--primary` → `<Icon play 13>` Create & start | `.pn-btn--primary` (191); icon `play` |

### 2i. Children with NO mockup representation (skin to token primitives, escalate specifics — §5)
`LaunchConfigPanel.tsx`, `TeamMemberSelector.tsx`, `SubtasksTab.tsx`, `SessionsTab.tsx`, `GeneratedDocsTab.tsx`, `TimelineTab.tsx`, `RefDocsTab.tsx`, `ImagesTab.tsx` (full variant), `ConfirmDiscardDialog.tsx`.

---

## 3. Token & primitive inventory (drawn from foundation, once ported)

**CSS classes:** all `pn-mdl*`, `pn-fld`, `pn-flabel`(`.req`), `pn-fhint`, `pn-frow`, `pn-input`, `pn-textarea`, `pn-desc`, `pn-desc__bar`, `pn-mchip`(`--ref`), `pn-prio-pills`, `pn-prio-pill`(`--active`), `pn-pdot`, `pn-mtabs`, `pn-mtab`(`--active`,`__n`), `pn-assignadd`, `pn-savehint`, `pn-toggle`(`--on-wt`,`--on-danger`), `pn-badge`(`--model`), `pn-btn`(`--primary`,`--ghost`), `pn-dot`.
**Kit primitives** (`redesign/kit.tsx`): `<Icon name=… size=…>` — `listChecks, chevronR, chevronD, x, paperclip, at, hash, doc, sliders, sparkles, calendar, gitBranch, shield, plus, play, check`; `<AgentTile kind=…>` (footer model badge).
**Variables (never hardcode):** `--pn-card, --pn-surface, --pn-paper, --pn-hover, --pn-active, --pn-line, --pn-line-2, --pn-ink{,-2,-3,-4}, --pn-brand, --pn-brand-soft, --pn-r-{lg,md,sm,pill}, --pn-sh-{pop,sm}, --pn-ui, --pn-mono, --pn-serif, --pn-block, --pn-wait, --pn-idle, --pn-run`.

---

## 3.5. COORDINATOR RULINGS (resolved — bind the implementation phase)

- **(A) SCOPE — APPROVED.** I own the **entire `task-modal/` subtree (all 15 children) + `CreateTaskModal.tsx`**. Re-skin all for a faithful result. No sibling claims it.
- **(B) DUAL-THEME — SWAP OUTRIGHT (provisional).** `data-redesign` is DEFAULT-ON for this branch and acts as a global kill-switch, not a per-component toggle. → Adopt `pn-*` **unconditionally**, replace old `themed*` classNames outright. **No** conditional dual classNames / no `useRedesignTheme()` branching in JSX. (Coordinator escalated for one team-wide confirm; proceed unless overridden.)
- **(C) SILENT SURFACES — BLANKET APPROVAL.** Skin every silent functional surface (§5) to the **nearest foundation token primitive**, preserving 100% behavior. **EXCEPTION:** the mockup's **Permissions (Safe/YOLO) toggle is OMITTED** — it maps to no existing state; do not add new state. If any single surface has no sane nearest-primitive, escalate that ONE only.
- **tiles.css dep:** Foundation will verbatim-port `pn-toggle(--on-wt/--on-danger)` + `pn-badge(--model)` into the redesign scope and list them in `FOUNDATION-DONE.md §6`. Covered.

---

## 4. BOUNDARY OVERLAPS — de-conflict with siblings / coordinator

1. **Child-component ownership.** CreateTaskModal's visual surface lives across **15 child files** in `task-modal/`. My scope per the directive is "CreateTaskModal.tsx in place," but a faithful re-skin **requires editing those children** (header, footer, tabs, fields). **Decision needed:** confirm I own the full `task-modal/` subtree, or whether any child is assigned to another worker. No other contract in `.maestro/redesign/` currently claims them, but please confirm.
2. **`themed*` CSS deletion.** The old classes (`themedModal*`, `themedForm*`, `themedBtn*`, `themedSegmented*`, `themedModalTab*`) may be shared by OTHER modals (TeamMemberModal, etc.). I will **only swap classNames in my files**, not delete the global `themed*` rules (another worker / the old non-redesign theme may still use them). Confirm there is no requirement to remove old CSS.
3. **Dual-theme strategy.** Foundation scopes everything under `html[data-redesign]`. **Open question:** when `data-redesign` is OFF, must this modal still render with the old `themed*` look? If yes, swapping classNames outright breaks the legacy theme → I'd need conditional classNames keyed on `useRedesignTheme()`. **This is the single biggest architectural decision and I need an explicit ruling before implementing** (MaestroPanel-CONTRACT didn't resolve it either).
4. **`TeamMemberSelector.tsx`** is shared by the footer here and potentially elsewhere — re-skin coordination needed if another worker touches it.

---

## 5. SILENT EDGE STATES — escalate, DO NOT invent

The mockup is create-happy-path only. These have **no design** and need a ruling:
- **Backdrop/scrim** for the portal modal (mockup sits on a showcase stage).
- **Edit mode** entirely: status badge, breadcrumb trail, edit-mode header, auto-save states, the `$ exec` / "Close" buttons, status+id detail line.
- **Overlay variant** (`variant="overlay"`, `themedModal--overlay`, back button, description-area layout).
- **Draft lifecycle UI** (the "Close" vs "Cancel" swap, `$ exec` when `isDraft`).
- **LaunchConfigPanel** (replaces description+tabs when gear toggled) — large surface, no design.
- **Launch-config gear button** + its active state.
- **TeamMemberSelector dropdown** (mockup shows one static avatar + add; real is a multi-select) — and the **model badge** (net-new; needs data source + design confirmation).
- **react-mentions** suggestion dropdown + skill suggestion rows (`.suggestionItem`, `.skillSuggestion*`).
- **ReferenceTaskPicker** dropdown/candidate list.
- **3 extra tabs** (`sessions`, `gen-docs`, `timeline`) — need `pn-mtab` icons assigned.
- **Tab collapse "×"** affordance (no mockup equivalent).
- **ConfirmDiscardDialog** (no design — a nested confirm).
- **Permissions toggle** (mockup shows a Safe/YOLO `pn-toggle--on-danger`; the real DetailsTab has **no** permissions control — do I ADD it, or omit? It maps to no existing state. ESCALATE — likely omit to honor zero-functionality-change).
- **Native date input** vs mockup's text input — I keep `type="date"` for function; confirm acceptable.

---

## 6. Deliverables checklist
- [x] Read existing implementation (main + all 15 children catalogued)
- [x] Read design (modals.jsx, modals.css, kit.jsx; tiles.css for `pn-toggle`/`pn-badge`)
- [x] Verified foundation gap (modal classes missing; variables + icons present)
- [x] Contract written (this doc)
- [x] Rulings recorded (§3.5) and gate opened by coordinator
- [x] In-place implementation (swap-outright; files edited below)
- [x] `cd maestro-ui && bunx tsc -b` typecheck pass (clean, exit 0) — per coordinator policy, NOT the full vite bundle (concurrent bundles SIGTERM each other; see [[project-concurrent-buildui-storm]])
- [x] Self-verified light + dark render against real foundation CSS (`.maestro/redesign/screenshots/CreateTaskModal-{light,dark}.png`); official capture delegated to Screenshots Worker

### Files edited (in-place, swap-outright pn-*)
1. `CreateTaskModal.tsx` — shell `pn-mdl`, `pn-mdl__body` regions, tab-content `pn-mdl__body`, image-staging chips → `pn-mchip`, `Icon` import, threads `projectName`.
2. `task-modal/TaskFormHeader.tsx` — `pn-mdl__hd/__hdmain/__crumb/__titleinput/__close`; crumb = `<Icon listChecks> <b>{projectName}</b> <Icon chevronR> {New task | New subtask | status}`; breadcrumb/subtitle → `pn-fhint`.
3. `task-modal/TaskDescriptionField.tsx` — `pn-desc.pn-fld`, `pn-flabel`, textarea box via `--pn-*` tokens, mentions font → `var(--pn-mono)`, children → `pn-desc__bar`.
4. `task-modal/TaskTabBar.tsx` — `pn-mtabs`/`pn-mtab(--active)`/`pn-mtab__n`; icons: subtasks=listChecks, skills=sparkles, sessions=terminal, ref-docs=at, gen-docs=doc, timeline=clock, details=sliders, close=x.
5. `task-modal/DetailsTab.tsx` — `pn-prio-pills/pn-prio-pill(--active)/pn-pdot` (dot colors block/wait/idle), due date `pn-input` + Clear `pn-mchip`, isolation `pn-toggle(--on-wt)`. **Permissions toggle OMITTED** (no backing state, per ruling C).
6. `task-modal/TaskModalFooter.tsx` — `pn-mdl__foot/__footL/__footR`, gear → `pn-mchip`, autosave → `pn-savehint`+`pn-dot`, **model badge → `pn-badge--model` + `<AgentTile>` (renders only when exactly 1 member selected, using that member's real `model`/`agentTool` — no fabricated data)**, buttons → `pn-btn`/`--ghost`/`--primary` with `play` icon.
7. `task-modal/ReferenceTaskPicker.tsx` — selected chips → `pn-mchip--ref`, trigger → `pn-mchip` (`at` icon). Dropdown popover left on legacy `themedDropdown*` (no design primitive — nearest-primitive per ruling C).
8. `task-modal/TeamMemberSelector.tsx` — `Assignee` `pn-flabel` + trigger → `pn-mchip`. Dropdown popover legacy (nearest-primitive).
9. `task-modal/ConfirmDiscardDialog.tsx` — `pn-mdl` mini-dialog + `pn-btn` footer.
10. `task-modal/{RefDocsTab,GeneratedDocsTab,SessionsTab,TimelineTab,SubtasksTab}.tsx` — hints → `pn-fhint`, rows/buttons → tokens + `pn-mchip`/`pn-btn`/`pn-input`.

### Files edited — round 2 (coordinator ruling: skin both this pass)
11. `task-modal/LaunchConfigPanel.tsx` — Agent/Model `pn-select`, fields `pn-fld`/`pn-flabel`, Permissions `pn-toggle(--on-danger)` (Safe/YOLO — this IS backed by `config.isDangerous`, unlike the omitted create-mode toggle), header→`pn-flabel`+`pn-mchip` close, advanced toggle + command-group chevrons → `Icon`, hint→`pn-fhint`, mono via `var(--pn-mono)`. Shared `ClaudeCodeSkillsSelector` mounted as-is (no internal edits). Container/card/permCard legacy bgs overridden inline to `--pn-surface`/`--pn-line` tokens.
12. `task-modal/ImagesTab.tsx` — bar chips → `pn-mchip--ref`, Attach → `pn-mchip`, tab header → `pn-fhint`+`pn-mchip`, empty drop-area → `--pn` dashed token surface, thumbnail grid borders → `--pn-line-2`/`--pn-r-sm`. On-image overlays + lightbox keep `rgba(0,0,0,.x)` (theme-agnostic scrims).

### Light-theme container audit (Rule 2)
Audited `styles-*.css` bgs for every retained legacy class in my tree:
- `themedDropdownMenu` = **`#000000`** (ReferenceTaskPicker + TeamMemberSelector popovers) → **overridden inline** to `var(--pn-card)`+tokens (only my instances; shared global rule untouched per Git-safety).
- `tmModal__permCard` / `launchConfigInline__card` = faint `theme-primary-rgb` tint → overridden inline to `--pn-surface`.
- `themedModalBackdrop` = `rgba(0,0,0,.8)` scrim, `ImagesTab` lightbox/on-image overlays = `rgba(0,0,0,.x)` → **kept** (theme-agnostic, allowed).
- `launchConfigInline`/`__body`, `themedModalContent`, `terminalTabPane` = no bg → inherit `pn-mdl` paper. ✓
- **Verified via live light screenshot** (`screenshots/createtaskmodal-light.png`): paper card / paper description box / paper footer — no dark leak.

### Out of scope (design-silent / overlay-only)
- `themedModalDescriptionArea` + `themedModalTabContent--overlay` — overlay variant only; design-silent.
- react-mentions suggestion dropdown + dropdown option rows — no design primitive (§5); menu bg now token-paper.
