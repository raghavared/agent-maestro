# TeamMemberModal.tsx → `pn-mdl` — Re-skin Contract

**Worker:** 👤 Team Member Modal Worker (`tm_1780948940669_urd37beqv`)
**Scope file:** `maestro-ui/src/components/maestro/TeamMemberModal.tsx` (1228 lines)
**Target design:** `panel-redesign/modals.jsx` `TeamMemberModal` (L114–231) + `panel-redesign/modals.css` (whole file)
**Supporting design refs:** `theme.css` (`pn-seg`, `pn-btn`, `pn-dot`, tokens), `kit.jsx` (`Icon`, `AgentTile`)
**Foundation outputs:** `redesign/kit.tsx` (`Icon`, `AgentTile`, `Mark`), `redesign/redesign-tokens.css` (692 L), `redesign/useRedesignTheme.ts`
**Status:** STUDY + CONTRACT (gate CLOSED — no source edits until Misc Coordinator opens gate)

> ⚠️ **HARD BLOCKER — FOUNDATION KIT GAP.** `modals.css` is **NOT ported** into `redesign-tokens.css`. Verified by grep: the tokens file has only `pn-btn*` + `pn-seg*` from `theme.css`. **Every** modal class this re-skin needs (§5) is missing. This component **cannot** be re-skinned until Foundation ports `modals.css` under `html[data-redesign]`. Escalated to coordinator.

---

## 1. Functional surface — PRESERVE VERBATIM (zero functionality changes)

### 1a. Props (L279–285)
| # | Surface | Line | Rule |
|---|---|---|---|
| P1 | `isOpen, onClose, projectId, teamMember` | 279–285 | Signature unchanged. `isEditMode = !!teamMember` (290), `isDefault = teamMember?.isDefault` (291) drive conditional UI — preserve both. |

### 1b. Store hooks (NONE may be added/removed/reordered)
| # | Hook | Line |
|---|---|---|
| S1 | `useProjectStore(s => project.basePath\|\|workingDir)` → `projectWorkingDir` | 294–297 |
| S2 | `useMaestroStore` selectors: `createTeamMember`, `updateTeamMember`, `workflowTemplates`, `fetchWorkflowTemplates`, `modelProfiles`, `fetchModelProfiles` | 359–364 |
| S3 | `useMaestroStore.getState().teamMembers` imperative read inside populate (instrument diversity) | 432 |

### 1c. Local state (22 `useState`) — ALL preserved (L300–322)
`name, role, avatar, identity, agentTool, model, mode, isSaving, error, activeTab, selectedSkills, capabilities, commandOverrides, expandedGroups, workflowTemplateId, useCustomWorkflow, customWorkflow, permissionMode, soundInstrument, scope, modelProfileId` + auto-save `changeVersion`.

### 1d. Refs (L327–333)
`populateCounterRef`, `lastPopulateCounterRef` (populate-vs-edit version guard), `launchBtnRef` (dropdown anchor).

### 1e. Memo / derived
| # | Surface | Line |
|---|---|---|
| M1 | `modelProfiles` useMemo (sorted) | 365–368 |
| M2 | `filteredTemplates`, `selectedTemplateObj` | 378–379 |
| M3 | `hasUnsavedChanges` useMemo (deep dirty-check, edit mode) | 448–469 |
| M4 | `autoSaveFn` useCallback → builds `UpdateTeamMemberPayload` | 471–492 |
| M5 | `useAutoSave({changeVersion,hasChanges,saveFn,debounceMs:1000,enabled:isEditMode})` → `autoSaveStatus`, `saveTeamMemberNow` | 494–500 |
| M6 | `memoryEntries = teamMember?.memory \|\| []` | 624 |
| M7 | `launchConfig` useMemo + `launchLabel` | 625–629 |
| M8 | `bumpVersion` useCallback, `computeLaunchDropdownPos` useCallback | 326, 336–352 |

### 1f. Effects (5) — order & deps preserved
| # | Effect | Line |
|---|---|---|
| E1 | `useLayoutEffect` set launch-dropdown pos on open | 354–356 |
| E2 | fetch model profiles on open if empty | 370–372 |
| E3 | fetch workflow templates on open if empty | 374–376 |
| E4 | **populate form** on `[isOpen, teamMember]` — full edit/create branch incl. `assignRandomInstrument` (L382–445) | 382–445 |
| E5 | bump auto-save version on field change, skipping populate-triggered (counter guard) | 503–509 |

### 1g. Handlers
`handleCapabilityToggle` (512), `handleCommandToggle` (516, uses `toggleCommandOverride`), `toggleGroupExpanded` (520), `toggleTab` (528), `handleClose` (530, **auto-saves dirty edit before close**), `handleResetToDefault` (538, default members only, reads `DEFAULT_CONFIGS`), `handleSubmit` (560, validates name+role, create vs update payload), `handleKeyDown` (616, ⌘/Ctrl+↵ = save/submit), `handleLaunchConfigChange` (630–642, maps LaunchConfig → agentTool/model/permissionMode).

### 1h. Imported logic / sub-systems (DO NOT alter)
- `commandPermissions`: `getEffectiveCommandEnabled`, `isCommandAllowedForMode`, `toggleCommandOverride`.
- `agentTools`: `DEFAULT_MODEL_BY_AGENT_TOOL`, `createLaunchConfigFromLegacy`, `formatLaunchConfigLabel`, `getAgentToolForLaunchConfig`, `sanitizeLaunchConfig`.
- `soundManager` + `getNotesForDisplay`; `soundTemplates`: `assignRandomInstrument`, `getInstrumentEmoji`, `getInstrumentRole`.
- Components reused as-is: `<ClaudeCodeSkillsSelector>` (Skills tab body), `<LaunchConfigDropdown>` (launch portal), `<MentionsInput>/<Mention>` (identity editor).
- `useAutoSave` hook (edit-mode debounced save).
- Module consts: `CAPABILITY_DEFS`, `COMMAND_GROUPS`, `DEFAULT_CONFIGS`, `getDefaultCapabilities`, `permissionModeFromAccessMode`, `SOUND_ROWS`, `mentionsStyle`, and internal `<SoundSignatureGrid>` (L201–275).
- `createPortal` to `document.body` for both modal root and launch dropdown — preserve.

### 1i. a11y / interaction attributes to carry verbatim
`type="button"` on every button; `autoFocus` on name input (create only); `disabled` gating on `isSaving`/`isDefault`; `maxLength={2}` on avatar; `title` tooltips (mode badge, scope toggle, instruments, commands, launch button, model-profile select); hidden-checkbox + `readOnly` pattern for capability & command toggles; `placeholder` text; `onKeyDown={handleKeyDown}` on name/role/identity.

**Net: no prop, store hook, ref, effect, memo, handler, or imported subsystem is added or removed. Visual layer only.**

---

## 2. Visual surface — REPLACE (existing class → `pn-*`)

| Region | Old class(es) | New design class(es) | Notes |
|---|---|---|---|
| Backdrop | `themedModalBackdrop` (675) | *(no design token — keep existing backdrop; design renders card only)* | ★ V-OPEN-A |
| Card | `themedModal themedModal--wide` (677) | `pn-mdl` | width 600 in design; ours is "--wide". Reconcile width. ★ V-OPEN-B |
| Header | `themedModalHeader` (682) | `pn-mdl__hd` > `pn-mdl__hdmain` (`pn-mdl__crumb` + `pn-mdl__titleinput`) + `pn-mdl__close` | "[ NEW/EDIT TEAM MEMBER ]" title → crumb `‹Icon users› agent-maestro › New/Edit team member`; **name input** moves to `pn-mdl__titleinput` (serif). |
| DEFAULT badge | `themedTaskStatusBadge` (685) | *(no design home)* | ★ V-OPEN-C |
| Close btn | `themedModalClose` (708) | `pn-mdl__close` + `<Icon name="x"/>` | |
| Body | `themedModalContent` (712) | `pn-mdl__body` | |
| Error banner | `terminalErrorBanner` (714) | *(no design home)* | ★ V-OPEN-D — keep functional banner; needs token. |
| Default hint | `themedFormHint` (722) | `pn-fhint` | |
| Role/Avatar/Mode/Scope row | `tmModal__section/__row/__field/__fieldSmall` + `themedFormLabel` + `themedFormInput` + `themedSegmentedControl/Btn` (728–817) | `pn-frow` > `pn-fld`(s); labels `pn-flabel` (`.req` for `*`); Role `pn-input`; Avatar `pn-avatar-edit`; Mode `pn-seg`/`pn-seg-i`(`--active`); Scope `pn-toggle`(`--on-wt`) | matches design L134–154 closely. |
| Identity | `mentionsWrapper`/`mentionsInput` + `mentionsStyle` (821–843) | `pn-fld` > `pn-flabel` + `pn-textarea pn-textarea--mono` styling | **Keep `<MentionsInput>`** (functional); restyle its `mentionsStyle` object + wrapper to match `pn-textarea--mono` tokens. ★ V-OPEN-E |
| Agent & model | **`<LaunchConfigDropdown>`** button+portal (footer, 644–668 / 1172–1190) | `pn-fld` > `pn-flabel` "Agent & model" + `pn-toolsel`(`pn-tool`/`--active`/`pn-tool__name` via `AgentTile`) + `pn-frow` of two `pn-select` (model, permission mode) | **MAJOR restructure** — design replaces the launch dropdown with inline tool tiles + 2 selects. ★ V-OPEN-F (largest). |
| Memory (edit) | `tmModal__memoryCard/...` (846–883) | *(no design home — "New member" mock omits memory)* | ★ V-OPEN-G |
| Tab strip | `themedModalTabBar`/`themedModalTab`(`--active`) (1112–1146) | `pn-mtabs` > `pn-mtab`(`--active`) with `<Icon>` | Design tabs = **Capabilities / Skills / Sound**; ours = **Sound / Skills / Permissions**. Re-map (§4). |
| Caps tab | inside Permissions tab (1013–1037) | `pn-caps` > `pn-cap` > `pn-cap__body`(`pn-cap__name`+`pn-cap__desc`) + `pn-switch`(`--on`) | switch replaces hidden-checkbox+checkmark (keep handler/readOnly semantics). |
| Skills tab | `<ClaudeCodeSkillsSelector>` (929) | `pn-fld` wrapper; design shows `pn-mchip` chips | **Keep `<ClaudeCodeSkillsSelector>`** functionally; chip styling is design-only mock. ★ V-OPEN-H |
| Sound tab | instrument buttons + `<SoundSignatureGrid>` (890–926) | `pn-fld` > `pn-flabel` + `pn-instr`/`pn-instr-i`(`--active`)/`pn-instr-i__name` | instrument picker maps; **`<SoundSignatureGrid>` has no design home** ★ V-OPEN-I. |
| Permissions tab | Permission Mode select + Workflow select/textarea + Command Permissions groups (932–1106) | *(NO design home — permission-mode folds into Agent&model select; Workflow + Command Permissions absent)* | ★ V-OPEN-J (high priority). |
| Footer | `tmModal__footer/__footerLeft/__footerRight` + model-profile `themedFormSelect` + launch button + `themedBtn`(`Primary`/`Danger`) (1150–1223) | `pn-mdl__foot` > `pn-mdl__footL`(`pn-savehint` + `pn-dot--idle`) + `pn-mdl__footR`(`pn-btn pn-btn--ghost` Cancel/Close, `pn-btn pn-btn--primary` Create) | design footL is just "⌘↵ to save"; our footL holds **model-profile select + launch button** ★ V-OPEN-F. Reset-Default + autosave-status indicator have no design home ★ V-OPEN-C/K. |

---

## 3. Tab decomposition mapping (existing 3 tabs ↔ design 3 tabs)

| Concern | Existing home | Design home | Action |
|---|---|---|---|
| Capabilities (4 toggles) | Permissions tab | **Capabilities** tab (`pn-caps`) | promote to own tab |
| Permission Mode select | Permissions tab | Agent&model body `pn-select` #2 | move to body |
| Workflow (select + custom textarea) | Permissions tab | **none** | ★ V-OPEN-J |
| Command Permissions (collapsible groups) | Permissions tab | **none** | ★ V-OPEN-J |
| Skills | Skills tab | Skills tab | unchanged |
| Sound: instrument picker | Sound tab | Sound tab (`pn-instr`) | unchanged |
| Sound: signature grid | Sound tab | **none** | ★ V-OPEN-I |

---

## 4. Exact token / kit mapping

- **kit primitives** (from `redesign/kit.tsx`): `Icon` (`users`, `x`, `chevronR`, `shield`, `sparkles`, `music`, `plus`); `AgentTile kind={'claude'|'codex'|'gemini'}` for `pn-toolsel` tiles — assets already bundled. Map our `AgentTool` enum → `AgentTile` kind.
- **Mode**: `pn-seg-i--active` when `mode==='worker'`/`'coordinator'` (design "Worker"/"Orchestrator"). Preserve mode-change side effects (resets capabilities + clears workflowTemplateId, L767–789).
- **Scope**: `pn-toggle--on-wt` when `scope==='global'`.
- **Capability switch**: `pn-switch--on` bound to `capabilities[cap.key]`; row `pn-cap` `onClick`→`handleCapabilityToggle`.
- **Instrument**: `pn-instr-i--active` on `soundInstrument===i`; label via existing list `['piano','guitar','violin','trumpet','drums']` (keep `getInstrumentEmoji`/`getInstrumentRole` titles).
- **CSS tokens** (need to exist under `html[data-redesign]` once Foundation ports modals.css): `--pn-card --pn-surface --pn-line --pn-line-2 --pn-hover --pn-active --pn-brand --pn-brand-soft --pn-ink/-2/-3/-4 --pn-run --pn-serif --pn-ui --pn-mono --pn-r-xs/-sm/-md/-lg/-pill --pn-sh-sm/-pop`. Dark handled by `html[data-theme="dark"]` overrides — no per-component dark CSS.

---

## 5. HARD DEPENDENCY — modal classes PROVIDED BY FOUNDATION redesign stylesheet

**Coordinator ruling:** Foundation owns + ports `panel-redesign/modals.css` **verbatim** into the redesign token scope and lists these classes in `FOUNDATION-DONE.md`. This worker **consumes** them — does **NOT** hand-port or define any. The list below is for FOUNDATION-DONE.md coverage verification only. None are in `redesign-tokens.css` as of this draft. **Verification list:**
`pn-mdl`, `pn-mdl__hd`, `pn-mdl__hdmain`, `pn-mdl__crumb`, `pn-mdl__titleinput`, `pn-mdl__close`, `pn-mdl__body`, `pn-mdl__foot`, `pn-mdl__footL`, `pn-mdl__footR`, `pn-fld`, `pn-flabel` (+`.req`), `pn-fhint`, `pn-frow`, `pn-input`, `pn-textarea` (+`--mono`), `pn-desc`/`pn-desc__bar`, `pn-mchip` (+`--ref`), `pn-avatar-edit`, `pn-toolsel`, `pn-tool` (+`--active`), `pn-tool__name`, `pn-select`, `pn-caps`, `pn-cap`, `pn-cap__body`, `pn-cap__name`, `pn-cap__desc`, `pn-switch` (+`--on`), `pn-instr`, `pn-instr-i` (+`--active`), `pn-instr-i__name`, `pn-mtabs`, `pn-mtab` (+`--active`, `pn-mtab__n`), `pn-toggle` (+`--on-wt`/`--on-danger`), `pn-savehint`, `pn-assignadd`.
(Already present: `pn-btn*`, `pn-seg*`, `pn-dot*`, `pn-agent*`.)

---

## 6. RESOLVED RULINGS — from Misc Coordinator (was OPEN; now binding spec)

> **DUAL-THEME = SWAP OUTRIGHT.** `data-redesign` default-on; **no conditional old-look branch**. Replace the old visual layer entirely (provisional, coordinator confirming team-wide).

| ID | Ruling (binding) |
|---|---|
| **F (launch config)** | **PROVISIONAL — KEEP full `<LaunchConfigDropdown>` functionality, restyled with foundation tokens.** Do NOT reduce to the mockup's 2 selects — it also carries `reasoningEffort`, `speed`, `accessMode`; dropping them = zero-functionality violation. Use `pn-toolsel` (claude/codex/gemini) for the provider/agent-tool pick where it maps; wire model + permission as `pn-select`; **preserve every other launch knob** (restyle, don't remove). Model-profile "resolves at spawn" binding **stays exactly where it is** (footer). **CONSTRAINT (coordinator-approved):** do NOT modify `<LaunchConfigDropdown>` internals — it is reused by other components; mount it **as-is** for the deeper knobs and add `pn-toolsel` alongside, both writing the SAME setters (`setAgentTool`/`setModel`/`setPermissionMode`), NO new state. If the dual agentTool control reads as visually redundant once built, flag it in screenshots for a design call. |
| **J (Workflow + Command Permissions)** | **PROVISIONAL — KEEP both as live surfaces, in their current Capabilities tab/section.** Workflow template-select + textarea → `pn-select` + `pn-textarea`; Command Permissions collapsible per-group toggles → `pn-cap`/`pn-switch` rows. **No 4th tab, do not drop.** |
| **G (Memory edit section)** | **KEEP, restyle with tokens** (label `pn-flabel`, content `pn-textarea`/list). No new design; preserve behavior. |
| **A (backdrop/scrim)** | Use the modal stage scrim from redesign-modals.css (`pn-mdl-stage`). |
| **B (card width)** | Follow `modals.css` modal width; use the design's `--wide` variant if present for this larger modal. **Do not hardcode 600.** |
| **C (DEFAULT badge + Reset-Default + name-lock)** | Preserve **all** behavior; badge via `pn-badge` (from Foundation), buttons via `pn-btn` family. |
| **D (error banner)** | Reuse `pn-fhint` with danger token (no net-new `pn-banner`). |
| **E (Identity MentionsInput)** | Restyle container/input with `pn-input`/`pn-textarea` tokens; **keep MentionsInput behavior intact.** |
| **H (Skills selector)** | Keep `<ClaudeCodeSkillsSelector>` structurally as-is; restyle only its container chrome. Don't restructure. |
| **I (SoundSignatureGrid)** | **KEEP** (don't drop); restyle container to tokens. |
| **K (autosave status)** | Use `pn-savehint` for the saved/saving hint. |

**Foundation confirmed coming (FOUNDATION-DONE §6):** `pn-toggle`(`--on-wt`/`--on-danger`), `pn-switch`, `pn-caps`, plus `pn-badge` (ruling C). Add `pn-badge` to §5 verification list.

**Net effect on §2/§3 map:** no functional surface is dropped. Agent&model body adopts `pn-toolsel` for tool pick **and** retains the restyled `<LaunchConfigDropdown>` for advanced knobs; Permissions content (Workflow + Command Permissions + Permission Mode) stays under the Capabilities tab/section; Memory, SoundSignatureGrid, error banner, DEFAULT/Reset all preserved and token-restyled. If any single surface still lacks a sane nearest-primitive after this, escalate that ONE.

---

## 7. Deliverables (post-gate) — STATUS

1. ✅ Contract — `.maestro/redesign/TeamMemberModal-CONTRACT.md` (rulings folded into §6).
2. ✅ **In-place re-skin of `TeamMemberModal.tsx` COMPLETE.** Swap-outright to `pn-*`. Summary:
   - Header → `pn-mdl__hd` / `pn-mdl__crumb` (`users` icon + project name + `chevronR`) / `pn-mdl__titleinput` (name) / `pn-mdl__close`. DEFAULT badge → `pn-badge pn-badge--status-in_progress`.
   - Body → `pn-mdl__body`; error → `pn-fhint` danger; avatar `pn-avatar-edit`, role `pn-input`, mode `pn-seg`, scope `pn-toggle--on-wt`.
   - Identity → `MentionsInput` kept, wrapper + `mentionsStyle` retokenised (`pn-textarea--mono` look).
   - Agent&model → `pn-toolsel` (claude/codex/gemini + **hermes** via `AgentTile` init-fallback) + model & permission `pn-select`; **`<LaunchConfigDropdown>` kept verbatim** (footer launch button, deeper knobs) — both write same setters, no new state. Bypass warning → `pn-fhint`.
   - Memory (edit) → token-restyled card.
   - Tabs → `pn-mtabs`: **Capabilities / Skills / Sound**. Caps tab = `pn-caps`/`pn-cap`/`pn-switch` + Workflow (`pn-select`+`pn-textarea`) + Command Permissions (collapsible `pn-cap`/`pn-switch` rows). Skills = `<ClaudeCodeSkillsSelector>` unchanged. Sound = `pn-instr` + `SoundSignatureGrid` (retokenised).
   - Footer → `pn-mdl__foot`: model-profile `pn-select` + launch `pn-btn--ghost`; Reset `pn-btn--danger`; autosave `pn-savehint`+`pn-dot`; Cancel/Create `pn-btn`.
   - **Zero functionality changes** — every prop/22 state/3 store hooks/3 refs/8 memo/5 effects/8 handlers/imported subsystems preserved. Added only: `projectName` selector (read-only, existing store) + `TOOL_TILES`/`PERMISSION_OPTIONS` consts + `Icon`/`AgentTile` import + `MODELS_BY_AGENT_TOOL` import.
3. ✅ Light + dark verified (static harness under real foundation CSS; matches `panel-redesign/modals.jsx`; dark tokens flip via `data-theme="dark"`). Official capture handed to Screenshots Worker.
4. ✅ `cd maestro-ui && tsc -b` passes clean (full `vite build` also passed once: 5m21s, exit 0). Per coordinator policy, per-worker gate = typecheck only.
5. ✅ Contract check: all §1 surfaces preserved.

### Light-theme container-leak audit (Rule 2) — FIXED
Swapping leaf classNames wasn't enough; two **unscoped dark** rule-sets leaked in light mode. Both repointed to `--pn-*` under `html[data-redesign]` (additive, scoped — no existing rules deleted, no shared-file reset → Rule 1 safe):
- **`styles-mentions.css`** — `.mentionsInput textarea` forced `color:#f0f4f8` (invisible on paper) + green-tint bg via `!important`. Added scoped override (textarea/highlighter/suggestions popup/items → pn tokens). **Verified in the real app**: Identity field renders dark text on paper (Screenshots Worker `teammembermodal-A-light.png`).
- **`styles-inline-priority-picker.css`** — `.terminalLaunchDropdown` `#0a0a0a`, `__details` `rgba(8,12,10,.96)`, `__providers` `rgba(0,0,0,.32)`, model/tool/section bgs+borders all dark. Added scoped override repointing every container bg/border/text → `--pn-card/--pn-surface/--pn-line/--pn-ink*/--pn-brand*`, shadow → `--pn-sh-pop`. **`LaunchConfigDropdown.tsx` TSX untouched** — CSS-only, all functionality verbatim (provider/model/reasoningEffort/speed). Verified light=paper + dark=correct.

### Deviations flagged for coordinator
- **Backdrop:** kept `themedModalBackdrop` (real fixed-overlay/scrim/centering) rather than `pn-mdl-stage` (a non-overlay showcase container) — ruling-#2 "re-skin the real overlay element." Flag if a `pn` scrim token is wanted.
- **Dual agent-tool control** (V-OPEN-F): `pn-toolsel` + kept LaunchConfigDropdown may read redundant — flagged for design call per coordinator.
- **Hermes tile:** design shows only 3 tools; added 4th (hermes) to avoid dropping a real `AgentTool` (init-letter fallback).
