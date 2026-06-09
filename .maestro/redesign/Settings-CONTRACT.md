# Settings-CONTRACT.md

Worker: Settings Panel Worker (⚙️) · Scope: re-skin the settings UI in place with foundation tokens.
Phase: STUDY + CONTRACT (gate CLOSED — no source edits yet).
Branch: `maestro-redesign`.

---

## STEP 1 — Component inventory (the settings map)

The settings surface is **not** a single component. The canonical host is
**`maestro-ui/src/components/ProjectTabBar.tsx`** — it defines two settings
dialogs inline and pulls in five content components.

```
ProjectTabBar.tsx                         ← HOST (renders the gear triggers + dialogs)
├─ AppSettingsDialog  (inline, lines 67–166)        ← PRIMARY app settings modal
│   sidebar tabs: THEME · DISPLAY · SOUNDS · GIT · SHORTCUTS
│   ├─ <ThemeSwitcher/>            components/ThemeSwitcher.tsx      [THEME tab]  ⚠ boundary w/ Theme worker
│   ├─ <DisplaySettings/>          components/DisplaySettings.tsx    [DISPLAY tab]
│   ├─ <SoundSettingsContent/>     components/modals/SoundSettingsModal.tsx [SOUNDS tab]
│   ├─ <GitSettings/>              components/GitSettings.tsx        [GIT tab]
│   └─ SHORTCUTS table             (inline in ProjectTabBar, SHORTCUT_ROWS)
├─ ProjectSettingsDialog (inline, lines 168–307)    ← PER-PROJECT settings modal
│   sidebar tabs: INFO · SOUNDS
│   ├─ INFO rows (name/path/sessions/created + MASTER toggle + close/delete) (inline)
│   └─ <ProjectSoundSettings/>     components/modals/ProjectSoundSettings.tsx [SOUNDS tab]
├─ SavedProjects dialog  (inline, lines 704–741)    ← list picker (settings-adjacent)
└─ projectTabBar / projectTabs / actions             ← ⚠ TOP-BAR surface, see boundary note

StartupSettingsOverlay.tsx   components/StartupSettingsOverlay.tsx  ← first-run wizard
  rendered by App.tsx:615 (not by ProjectTabBar). Full-screen 2-step onboarding
  (theme/color/scale → sound). ⚠ design-silent, see escalation E6.

SoundSettingsModal (export in SoundSettingsModal.tsx) ← standalone modal wrapper,
  NOT used by the settings host (host uses SoundSettingsContent only). Grep shows
  no live <SoundSettingsModal/> usage — re-skin the wrapper for parity but it is
  low priority / possibly dead. CONFIRM with coordinator before spending effort (E7).
```

**Stores / services touched (must be preserved verbatim):**
`useZoomStore`, `useThemeStore`, `useGitSettingsStore`, `useProjectStore`,
`soundManager` (service singleton), `maestroClient.getGitCapabilities()`,
`soundTemplates` helpers, `localStorage` (STORAGE_SETUP_COMPLETE_KEY).

**Primary settings host = `ProjectTabBar.tsx` + the two dialog components + the 5 content components.** Reported to coordinator.

---

## STEP 2 — Hard dependency: classes PROVIDED BY FOUNDATION redesign stylesheet

**Coordinator ruling (2026-06-09):** Foundation will port `panel-redesign/modals.css`
VERBATIM into the redesign token scope and LIST the ported classes in
`FOUNDATION-DONE.md`. I **consume** these from the foundation stylesheet — I will
**not** hand-port modals.css or define any of these classes myself. The list below
is the dependency manifest to verify FOUNDATION-DONE.md covers everything I need.

Verified already published in redesign-tokens.css today: all CSS variables (`--pn-*`),
`.pn-btn*`, `.pn-seg*`, `.pn-tag*`, `.pn-pill*`, `.pn-scroll`, `.pn-eyebrow`, `.pn-meta`.

**Classes I depend on — must appear in FOUNDATION-DONE.md (provided by foundation stylesheet, scoped under `html[data-redesign]`):**

| Need | Class(es) from modals.css |
|---|---|
| Modal shell | `.pn-mdl` `.pn-mdl__hd` `.pn-mdl__hdmain` `.pn-mdl__crumb` `.pn-mdl__titleinput` `.pn-mdl__close` `.pn-mdl__body` `.pn-mdl__foot` `.pn-mdl__footL` `.pn-mdl__footR` |
| Field group | `.pn-fld` `.pn-flabel` (+ `.req`) `.pn-fhint` `.pn-frow` |
| Inputs | `.pn-input` `.pn-textarea` (+`--mono`) `.pn-select` |
| Tabs | `.pn-mtabs` `.pn-mtab` (+`--active`) `.pn-mtab__n` |
| Toggle list | `.pn-caps` `.pn-cap` `.pn-cap__body` `.pn-cap__name` `.pn-cap__desc` |
| Switch | `.pn-switch` (+`--on`) |
| Instrument picker | `.pn-instr` `.pn-instr-i` (+`--active`) `.pn-instr-i__name` |
| Tool selector | `.pn-toolsel` `.pn-tool` (+`--active`) `.pn-tool__name` |

`.pn-toggle*` lives in `tiles.css` (confirm Foundation also ports it — used nowhere
critical in my scope); `.pn-seg*`/`.pn-btn*` already in tokens.
**STEP 4 (edits) is gated on FOUNDATION-DONE.md confirming the above classes are
ported.** No hand-porting on my side per coordinator ruling.

---

## STEP 3 — Side-by-side surface map (functional VERBATIM ↔ visual REPLACE ↔ token/primitive)

### A. AppSettingsDialog (ProjectTabBar 67–166)
**Preserve verbatim:** `activeTab` state + setter; all 5 tab buttons' `onClick`
handlers; conditional rendering of each tab body; SHORTCUT_ROWS data + the
`role="table"/row/columnheader/cell` a11y attributes; `onClose` backdrop click +
`stopPropagation` on dialog.

| Visual element (current class) | New design | Token / primitive |
|---|---|---|
| `.projectSettingsBackdrop` (scrim) | modal scrim | `var(--pn-paper)` overlay rgba; matches modals.css stage pattern |
| `.appSettingsDialog` (card) | `.pn-mdl` shell | `--pn-card` bg, `--pn-line-2` border, `--pn-r-lg`, `--pn-sh-pop` |
| `.projectSettingsHeader` + `.projectSettingsTitle` "[ SETTINGS ]" | `.pn-mdl__hd` + serif title (E5: drop `[ ]` mono) | `--pn-serif` 24px `--pn-ink` |
| `.projectSettingsClose` "×" | `.pn-mdl__close` | `--pn-ink-3`, hover `--pn-hover` |
| `.appSettingsSidebar` + `.appSettingsTabBtn(Active)` | **⚠ vertical tabs — design SILENT (E1)** | candidate: `.pn-mtab` reoriented, or `.pn-seg` vertical |
| `.appSettingsTabContent` / `.appSettingsContent` | `.pn-mdl__body` + `.pn-scroll` | `--pn-line-2` scrollbar |
| SHORTCUTS `.appShortcutsTable/Row` | keep table; restyle rows | `--pn-line` row divider, `--pn-mono` keys, `--pn-ink-3` |

### B. ProjectSettingsDialog (ProjectTabBar 168–307)
**Preserve verbatim:** `activeTab` (info/sounds); `setProjects` map updater +
`soundManager.setProjectConfig/removeProjectConfig` in `handleSoundConfigChange`;
`toggleMasterProject`; INFO rows reading `project.name/basePath/createdAt/isMaster`;
`onCloseProject`/`onDelete` button handlers; sessionCount prop.

| Visual element | New design | Token / primitive |
|---|---|---|
| dialog shell/header/close | as A | `.pn-mdl*` |
| `.projectSettingsRow` + Label/Value (NAME/PATH/SESSIONS/CREATED) | read-only field rows | `.pn-fld`+`.pn-flabel`(mono) / value in `--pn-ink` |
| `.projectSettingsMasterToggle` + `.projectSettingsMasterSwitch` | **`.pn-switch`** (+`--on`) | `--pn-run` on-state; preserve checkbox input + onChange |
| `.projectSettingsMasterHint` | `.pn-fhint` | `--pn-ink-3` 11px |
| `.projectSettingsDivider` | hairline | `--pn-line` |
| `.projectSettingsCloseBtn` | `.pn-btn` | `--pn-ink-2`; keep `<Icon name="close">` |
| `.projectSettingsDeleteBtn` | `.pn-btn--danger` (E3) | `--pn-block`/`--pn-block-soft`; keep `<Icon name="trash">` |

### C. DisplaySettings.tsx
**Preserve verbatim:** `useZoomStore` read/`setZoomLevel`; ZOOM_LEVELS map; active
class logic; preview `calc()` inline font-size; reset button conditional.

| Visual element | New design | Token / primitive |
|---|---|---|
| `.displaySettingsSection` | `.pn-fld` | gap 6px |
| `.displaySettingsLabel` / `.displaySettingsHint` | `.pn-flabel` / `.pn-fhint` | mono / `--pn-ink-3` |
| `.displaySettingsOption(Active)` scale buttons | `.pn-seg` + `.pn-seg-i(--active)` (published) | `--pn-card` active fill, `--pn-sh-sm` |
| `.displaySettingsPreviewBox` | bordered card | `--pn-surface`, `--pn-line-2`, `--pn-r-sm` |
| `.displaySettingsReset` | `.pn-btn` | ghost |

### D. GitSettings.tsx
**Preserve verbatim:** all `useGitSettingsStore` getters/setters + `reset`;
`useEffect` capability fetch w/ cancel flag; `caps`/`capsError` state; `isDefault`
calc; input `value`/`onChange`/`id`/`htmlFor`/`placeholder`/`spellCheck`;
`previewBranchName`; the `<code>` hints; CapBadge title attrs.

| Visual element | New design | Token / primitive |
|---|---|---|
| `.gitSettingsSection` | `.pn-fld` | |
| `.gitSettingsLabel`(+`label/htmlFor`) / `.gitSettingsHint` | `.pn-flabel` / `.pn-fhint` | |
| `.gitSettingsInput` (text) | `.pn-input` | `--pn-surface`, focus `--pn-brand`+`--pn-brand-soft` ring |
| `.gitSettingsToggle` (auto-discard checkbox) | `.pn-cap` row + `.pn-switch` | `--pn-run` on |
| `.gitSettingsPreview` / `<code>` | inline mono chip | `--pn-mono`, `--pn-active` bg |
| `.gitSettingsCapBadge--ok/--missing` ✓/✕ | E2: `.pn-pill--run` (ok) / `.pn-pill--block` (missing) | `--pn-run`/`--pn-block` |
| `.gitSettingsReset` | `.pn-btn` | ghost |

### E. SoundSettingsContent (SoundSettingsModal.tsx)
**Preserve verbatim:** all `soundManager` calls (isEnabled/getVolume/getEnabledCategories/
getMultiMemberMode/setEnabled/setVolume/setCategoryEnabled/setMultiMemberMode/
playCategorySound); CATEGORY_LABELS/DESCRIPTIONS/GROUPS data; all `disabled={!enabled}`
gating; the mount `useEffect` sync; every checkbox `checked`/`onChange`.

| Visual element | New design | Token / primitive |
|---|---|---|
| `.soundSettingSection` | `.pn-fld` group | |
| master enable + per-category checkboxes (`.soundSettingLabel`+`.soundSettingTitle`/`Description`) | `.pn-caps`/`.pn-cap`/`.pn-cap__name`/`.pn-cap__desc` + `.pn-switch` | replace native checkbox visual; keep input for handler |
| `.soundSettingGroupTitle` | `.pn-flabel` (mono eyebrow) | `--pn-ink-3` |
| multi-member mode buttons (inline-styled `--theme-primary`) | `.pn-seg` + `.pn-seg-i(--active)` | removes hardcoded `--theme-primary`/`#fff` |
| `.soundBulkBtn` (Enable/Disable All) | `.pn-btn` | |
| `.soundVolumeSlider` (range) | E4: `.pn-range` if Foundation ships it, else native restyled w/ tokens | ⏸ pending |
| `.soundTestBtn` ▶ / `.soundVolumeValue` | `.pn-btn--ghost` icon / `--pn-mono` `--pn-ink-3` | |

### F. ProjectSoundSettings.tsx
**Preserve verbatim:** all props (`config`/`onChange`); `updateConfig`,
`handleTemplateChange/handleInstrumentChange/handleCategoryToggle/
handleCategoryInstrumentOverride/handleTestSound/handleSaveTemplate/
handleDeleteCustomTemplate/handleResetToGlobal`; `getTemplates/getTemplateById/
saveTemplate/deleteTemplate/templateToProjectConfig/getInstrumentEmoji/
getInstrumentRole`; `showAdvanced/saveTemplateName/showSaveTemplate` state.

| Visual element | New design | Token / primitive |
|---|---|---|
| `.projectSoundRow`/`.projectSoundLabel` | `.pn-fld`/`.pn-flabel` | |
| template `<select className="themedFormSelect">` | `.pn-select` | preserve value/onChange/options |
| **instrument picker** (inline-styled buttons) | **`.pn-instr` + `.pn-instr-i(--active)` + `__name`** (exact match in modals.css) | removes all inline `--theme-primary` styles; emoji stays via getInstrumentEmoji |
| `.themedBtn`/`.themedBtnPrimary` actions | `.pn-btn`/`.pn-btn--primary` | |
| `.themedFormInput` (save-template name) | `.pn-input` | |
| `.themedBrowseToggle` + arrow (advanced) | `.pn-btn--ghost` + caret | keep `--open` class toggle |
| per-category override `<select>` + ▶ | `.pn-select` + `.pn-btn--ghost` | |
| custom-template rows + delete | `.pn-cap` row + `.pn-btn--danger` (E3) | `--pn-block` |

### G. StartupSettingsOverlay.tsx — **DEFER (E6 APPROVED). Do NOT touch this pass.**

### H. SoundSettingsModal wrapper — **SKIP (E7 APPROVED, dead export). Re-skin `SoundSettingsContent` only.**

### I. ThemeSwitcher.tsx — restyle **VISUALS ONLY** (container/swatches → tokens). Do NOT alter theme logic; escalate if logic couples to Foundation theme wiring.

---

## ESCALATIONS — COORDINATOR RULINGS (2026-06-09, RESOLVED)

- **E1 — Vertical tab rail → DESIGN FOR VERTICAL.** Foundation asked to add a
  **vertical `.pn-mtabs` variant** (keeps current settings IA). Build markup for the
  vertical variant; **fallback = horizontal `.pn-mtabs`** if Foundation declines.
  ⏸ HOLD final tab markup until coordinator confirms the variant exists.
- **E2 — Git capability badges → APPROVED.** Reuse `.pn-pill--run` (✓) /
  `.pn-pill--block` (✕). Both already published. No new primitive.
- **E3 — Danger button → USE `.pn-btn--danger`.** Foundation is adding it; apply to
  delete-project + delete-template. ⏸ HOLD danger-button styling until it lands.
- **E4 — Range slider → PENDING.** Foundation asked for a `.pn-range` primitive;
  **fallback = native `<input type=range>` restyled with tokens**. ⏸ HOLD slider
  styling pending Foundation ruling.
- **E5 — Header style → ADOPT `.pn-mdl__hd`.** Drop the `[ SETTINGS ]` mono treatment;
  use the foundation modal header pattern (serif title) for cross-modal consistency.
- **E6 — StartupSettingsOverlay → DEFER (APPROVED).** No design spec. **Do NOT touch
  this file this pass.**
- **E7 — SoundSettingsModal wrapper → SKIP (APPROVED).** Dead/unused export; leave it.
  Re-skin `SoundSettingsContent` only.

## BOUNDARY / SCOPE — CONFIRMED BY COORDINATOR
- **I own the DIALOG BODIES only:** `AppSettingsDialog` + `ProjectSettingsDialog`
  content regions (inside `ProjectTabBar.tsx`), plus the tab-content component files:
  `DisplaySettings`, `GitSettings`, `SoundSettingsContent`, `ProjectSoundSettings`,
  `ThemeSwitcher`.
- **I do NOT touch:** the project tab strip, the `pn-top` bar, or the gear/trigger
  buttons — those are the **TopBar worker's** scope (same file `ProjectTabBar.tsx`).
- **SERIALIZATION:** `ProjectTabBar.tsx` is shared. I edit the inline dialog-body
  regions **AFTER** the TopBar worker lands their bar changes; coordinator sequences
  me at gate-open to avoid conflicts.
- **ThemeSwitcher:** restyle **VISUALS ONLY**; do not change theme logic. If I find
  logic coupling with Foundation's theme wiring, **escalate** before editing.

## DUAL-THEME STRATEGY (provisional, coordinator confirming team-wide)
- **SWAP OUTRIGHT:** `data-redesign` default-on; no conditional old-look retained.

## DELIVERABLES (status) — CODE COMPLETE ✅
- [x] Component inventory + this contract (all 7 escalations RESOLVED)
- [x] In-place edits — ALL 6 files done (see below). Zero functionality changes.
- [x] `tsc -b` clean for all my files (verified: no Settings file appears in tsc errors;
  remaining tsc errors are in MaestroPanel.tsx/PanelIconBar — another Misc worker's WIP,
  not my scope). Per policy I do NOT run the production vite bundle.
- [→] Light + dark screenshots — handed to the dedicated Screenshots Worker
  (sess_1780953175711_pzzhco61r). Capture states listed below.

## FILES EDITED (final mapping applied)
1. `DisplaySettings.tsx` — `pn-fld`/`pn-flabel`/`pn-fhint`; UI-scale → `pn-seg`/`pn-seg-i--active`;
   preview → `pn-card-s`; reset → `pn-btn`.
2. `GitSettings.tsx` — fields `pn-fld`/`pn-input`; auto-discard → `pn-cap`+`sr-only` checkbox+`pn-switch`;
   cap badges → `pn-pill--run`(✓)/`pn-pill--idle`(✕); reset → `pn-btn`.
3. `modals/SoundSettingsModal.tsx` (SoundSettingsContent) — master + category toggles →
   `pn-cap`+`sr-only`+`pn-switch`; volume → `pn-range`; multi-member → `pn-seg`; bulk → `pn-btn`;
   group titles → `pn-flabel`; test → `pn-btn--ghost` + kit `Icon play`. Wrapper export `SoundSettingsModal` left dead (E7).
4. `modals/ProjectSoundSettings.tsx` — template/override → `pn-select`; instrument → `pn-instr`/`pn-instr-i--active`;
   save-name → `pn-input`; actions → `pn-btn`/`pn-btn--primary`; delete → `pn-btn--danger`; advanced toggle →
   `pn-btn--ghost`+kit chevron; category toggles → `pn-cap`+`sr-only`+`pn-switch`.
5. `ThemeSwitcher.tsx` — VISUALS ONLY (useThemeStore logic untouched): labels `pn-flabel`;
   style/color pickers → `pn-tool`/`pn-tool--active` in flex-wrap row; color swatch → `pn-dot` (data color inline).
6. `ProjectTabBar.tsx` (dialog bodies ONLY) — AppSettingsDialog + ProjectSettingsDialog:
   card → `pn-mdl`; header → `pn-mdl__hd`+`pn-mdl__titleinput` (serif, dropped `[ SETTINGS ]` per E5);
   close → `pn-mdl__close`+kit `Icon x`; vertical tab rail → `pn-mtabs pn-mtabs--vert`/`pn-mtab--active`;
   content area → `pn-mdl__body`; shortcuts table → `pn-caps`/`pn-cap` (role=table/row/cell PRESERVED);
   project info rows → `pn-cap` list; master toggle → `pn-cap`+`sr-only`+`pn-switch`; close/delete →
   `pn-btn`/`pn-btn--danger` (kept `./Icon` close/trash — kit has no such icons). Backdrop kept
   `projectSettingsBackdrop` (styles-project-settings.css, NOT a TopBar-owned file; provides fixed scrim).
   Did NOT touch pn-top bar, project tab strip, gear triggers, or TopBar onClick wiring.

## KNOWN MINOR EXCEPTIONS (flagged, not hardcoded design chrome)
- Instrument-picker emoji uses inline `fontSize` (content glyph sizing, not chrome).
- Theme/info/sound layout uses inline `display:flex`/`flex`/`minHeight` (layout only — no
  colour/spacing/font/radius/shadow hardcodes).
- Section spacing inside content components is `pn-fld` gap (6px), not the design's 16px modal-body
  gap, because each content component has a single `pn-fld` root inside `pn-mdl__body`. Consistent & token-based.

## SCREENSHOT CAPTURE STATES (for Screenshots Worker)
App settings modal: click the **Settings gear** in the top bar → capture each tab (THEME, DISPLAY,
SOUNDS, GIT, SHORTCUTS). Project settings modal: click the **per-project gear** on the active project
tab → capture INFO + SOUNDS tabs. Both in **light** (default) and **dark** (`<html data-theme="dark">`).
Seed: at least one project open; GIT tab readout depends on local git/gh (cosmetic if absent).
