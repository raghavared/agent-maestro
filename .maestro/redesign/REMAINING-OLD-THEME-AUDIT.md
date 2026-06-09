# Remaining Old-Theme Audit — maestro-ui

Read-only inventory of every maestro-ui surface still rendering in the **OLD dark theme** after the
warm-paper `pn-*` redesign. Produced by the Theme Audit Worker. **No code was edited.**

## How the redesign works (and why these are broken)

The redesign **adds** new `--pn-*` tokens and new `.pn-*` component classes, all scoped under
`html[data-redesign]` (default-on). It does **NOT** remap the legacy vars
(`--panel`, `--panel-2`, `--theme-primary`, `--theme-primary-rgb`, `--style-font-*`, `--bg`,
`--bg-elevated`, `--text`, `--text-secondary`, `--border`, `--terminal-*`).

Therefore a surface is **OLD-theme / broken** when it is *rendered* but styles itself with legacy
vars or hardcoded dark hex (`#0xxxxx`/`#1xxxxx`) and carries **no** `pn-*` class / no
`html[data-redesign]` override / is not wrapped in a `pnLeakSkin` or `pn-panel` subtree.
A few teams remediated via a `pnLeakSkin` wrapper (remaps legacy vars to pn for the subtree) or an
`html[data-redesign] .legacyClass{…}` override block — those count as DONE.

**Buckets:** **(A)** LIVE, un-redesigned, user-visible — needs fixing · **(B)** DEAD / orphaned
legacy CSS — harmless, optional cleanup · **(C)** data-driven / intentionally out-of-scope.

> User-confirmed most-visible breakage: **Document viewer, Excalidraw, and the header in the
> Sessions view of the project board.** These lead the bucket-A priority order below.

---

# BUCKET A — LIVE surfaces that NEED fixing (prioritized)

## A1. Document Viewer — `styles-docs-v2.css` (+ ProjectDocsList in sessions-v2)  ⬅ user-flagged #1
`DocViewer.tsx` / `DocsList.tsx` / `ProjectDocsList.tsx` render zero `pn-*` classes; every class uses
legacy vars / dark hex, none overridden.
- Hardcoded dark panels: `.docViewerPanel` `background:#0a0a0a` (styles-docs-v2.css:137);
  `.docViewerOverlay--fullscreen` `#0a0a0a` (:877); `.mermaidZoomControls` `rgba(20,20,20,0.9)` (:646).
- Accent/neon everywhere: `.docViewerIcon`/`.docViewerExtBadge`/`.docViewerMetaSessionBadge`/markdown
  `a`/`code`/`pre` use `var(--theme-primary,#00ff41)` + `rgba(var(--theme-primary-rgb),…)`
  (:179-184, :221-224, :291-294, :412-440, :447-468).
- Text/fonts: `var(--text)`/`var(--muted)` + `var(--style-font-ui)` across header, meta, markdown body
  (:198, :212-213, :271-278, :345-357, :369-540).
- DocsList cards: `.docsListCard*` legacy surfaces/accents (styles-docs-v2.css:17-108).
- ProjectDocsList: `.projectDocsList*` all `rgba(var(--theme-primary-rgb),…)` + `var(--font-mono)`
  (styles-maestro-sessions-v2.css:3143-3228).
- Inline TSX: `DocViewer.tsx:75` embed `border:'1px solid var(--border)'`, `background:'var(--bg-secondary)'`.
- **Fix:** add `pn-*` classes / a `pn-panel` wrapper to the three `.tsx` and rewrite rules to pn tokens
  (`--theme-primary→--pn-brand`, `theme-primary-rgb α→--pn-brand-soft/--pn-line`,
  `--text→--pn-text`, `--muted→--pn-text-muted`, `--style-font-ui→--pn-ui`, `#0a0a0a→--pn-card`).

## A2. Excalidraw — `styles-excalidraw.css`  ⬅ user-flagged #2  *(being fixed separately — note only)*
`ExcalidrawBoard.tsx` renders `excalidrawOverlay/Container/Canvas/Inline`, `excalidrawHeader`,
`excalidrawShortcutHint` — all legacy.
- `var(--bg, #0a0e16)` dark backing on `.excalidrawOverlay` (:11), `.excalidrawContainer` (:22),
  `.excalidrawCanvas` (:54), `.excalidrawInline` (:75).
- `.excalidrawHeader` `border var(--theme-border,…)` + `background rgba(var(--theme-primary-rgb),0.03)`
  (:32-33); `.excalidrawShortcutHint` `var(--style-font-ui)` + accent text (:46-47).
- Shared inline-doc backing in same file: `.docViewerInline` (:87), `.docViewerPanel--inline` (:91)
  `var(--bg,#0a0e16)`.
- **Fix:** `var(--bg,#0a0e16)→var(--pn-mp)`, header→`--pn-surface-2`/`--pn-border`, font→`--pn-ui`.
  (Excalidraw remediation is owned by a separate worker; listed for completeness.)

## A3. Sessions view in Project Board (incl. HEADER) — `styles-multi-project-board.css` + `styles-excalidraw.css`  ⬅ user-flagged #3
Rendered by `MultiProjectSessionsView.tsx`. Header/wrapper classes are `mpb*`; column body classes are
`sessionBoardColumn*`/`sessionColumn*` (which live, misplaced, inside styles-excalidraw.css — see A4).
- **Header (the flagged part):** `.mpbSessionProjectHeader` bg `rgba(var(--theme-primary-rgb),0.02)`
  (mpb:478); `.mpbSessionProjectName` `color:var(--theme-text,#f0f4f8)` (mpb:485);
  `.mpbSessionProjectCount` accent-muted (mpb:492); `.mpbUnifiedSessionBadge` bg/border accent
  (mpb:670-671); `.mpbUnifiedSessionBadgeName` `var(--theme-text,#f0f4f8)` (mpb:691);
  `.mpbProjectRowChevron` accent-muted (mpb:322-327).
- **Column body:** `.sessionBoardColumn` `background:var(--bg,#0a0e16)` + `var(--theme-border)`
  (excalidraw:566-567 — major dark surface); `.mpbSessionColumnCollapsed` `var(--bg,#0a0e16)`
  (mpb:595-596); `.sessionColumnName` `var(--theme-text,#f0f4f8)` (excalidraw:620);
  `.sessionColumnToggleBtn(:hover/--active)` accent (excalidraw:685-701);
  `.sessionBoardColumn--working` hardcoded `rgba(0,217,255,0.15)` cyan (excalidraw:723-724).
- **Inline TSX (legacy):** `MultiProjectSessionsView.tsx:400,427` idle dot
  `color:"rgba(var(--theme-primary-rgb),0.5)"`.
- **Fix:** add pn classes to `mpb*`/`sessionColumn*` and rewrite to pn tokens (text→`--pn-text`,
  surfaces→`--pn-surface*`/`--pn-mp`, accents→pn brand/run tokens). See A4 for the file-location problem.

## A4. MISPLACED board block in `styles-excalidraw.css` (~lines 104–818)  ⬅ coordinator priority
A ~64-hit block of `taskBoard*`/`sessionBoard*`/`sessionColumn*`/`dragGhostCard`/`spacesRailSpace*`
classes lives in the **Excalidraw** stylesheet — wrong domain. **None of these classes have any
`html[data-redesign]` override anywhere** (verified: `styles-multi-project-board.css` contains
`data-redesign` and these class names, but never on the same selector). Cascade verdict: the legacy
rules are fully un-overridden and win.

LIVE-vs-DEAD by rendered consumer:
- **LIVE (A) — owner = board domain:**
  - `dragGhostCard`, `taskBoardCard`, `taskBoardCard--ghost`, `taskBoardCardContent/Meta/Priority(--*)/Stripe/Title`
    → rendered by `DragGhostCard.tsx` (floating drag preview). Legacy, un-overridden = broken.
  - `sessionBoardColumn(*)`, `sessionColumn(Header/Name/Meta/StatusDot/Toggle/Timeline/Tasks…)`,
    `terminalInBoard` → rendered by `MultiProjectSessionsView.tsx` (= surface A3).
  - `terminalInTeamView` → rendered by `TeamView.tsx` (layout host; TeamView itself is redesigned —
    verify this class is just a terminal-host wrapper).
  - `docViewerInline`, `docViewerPanel--inline` → `DocViewer.tsx` (= A1 inline embed).
  - `excalidrawInline` → `ExcalidrawBoard.tsx` (= A2).
- **DEAD (B) — 0 tsx references** (MultiProjectBoard migrated to `pn-bcol`/`pn-tab`/`pn-tabs`/`pn-bcols`):
  `taskBoardColumn(*)`, `taskBoardColumns`, `taskBoardColumnBody/Header/Label/Count/Dot(--*)/Collapsed*`,
  `taskBoardTab(*)`, `taskBoardTabs`, `taskBoardTabSymbol`, `sessionBoardEmpty(*)`, `spacesRailSpace(*)`,
  `sessionColumnTaskCount`, `sessionColumnDuration`, `sessionColumnSectionLabel`,
  `sessionColumnTasksEmpty`, `sessionTaskCard*`, `mpbSessionResizeHandle*` (mpb:557-583).
- **Treatment — SPLIT, do not blanket-delete:**
  1. **Delete** the dead kanban-column/tab/spaces-rail subset (it duplicates the now-`pn-bcol` board).
  2. **Move** the LIVE board classes (`dragGhostCard`+`taskBoardCard--ghost` subset; `sessionBoardColumn*`/
     `sessionColumn*`/`terminalInBoard`) out of `styles-excalidraw.css` into the board-domain stylesheet
     (`styles-multi-project-board.css`) and re-skin to pn tokens — this also resolves A3's column body.
  3. Leave only the genuinely-Excalidraw rules (`excalidraw*`, and arguably the inline-doc backings) in
     `styles-excalidraw.css`, re-skinned per A2.

## A5. Modal system — `themedModal` + `.modal` families (≈14 live modals, ONE fix)
All rendered from `components/app/AppModals.tsx` as top-level siblings (outside any `pnLeakSkin`/`pn-panel`),
no `pn-*`, no `data-redesign` override:
- `.themedModal` `background:#000000` + neon `var(--theme-primary)` border/title
  (styles-themed-components.css:16-38) → **NewSessionModal, ProjectModal, ConfirmDeleteProjectModal,
  PathPickerModal** (AppModals:384/479/511/598).
- `.modal` dark gradient `linear-gradient(rgba(17,24,34,.98),rgba(10,14,20,.98))` +
  `var(--border)` (styles-file-explorer.css:393-394) → **PersistentSessionsModal, ManageTerminalsModal,
  SshManagerModal, SecureStorageModal, StartRecordingModal, RecordingsListModal, ReplayModal,
  ConfirmDeleteRecordingModal, ApplyAssetModal** (AppModals:405-662) + **AgentShortcutsModal**.
- `AgentModalViewer` uses `.agent-modal-overlay` — separate, no pn coverage confirmed (verify).
- **Fix (highest ROI):** add `html[data-redesign] .themedModal{…}` and `html[data-redesign] .modal{…}`
  override blocks → repaints ~14 surfaces at once. Literal hex (`#000000`, the gradient) requires a real
  override (a `pnLeakSkin` wrapper alone won't repaint literal hex).

## A6. SessionLogModal shell + chrome — `styles-terminal-task-detail.css` / `styles-session-log.css`
Rendered via `SessionsSection.tsx:1563` (portal to body, outside any pn scope).
- Shell: `.terminalTaskModal` `background:#0a0a0a` + `var(--terminal-green)` border + accent header
  (styles-terminal-task-detail.css:9-50).
- Header/meta chrome: `.sessionLogFileSelect` `var(--panel)`/`var(--border)`, `sessionLog*` headers use
  `--panel/--border/--text/--muted/--style-font-ui` (styles-session-log.css:46-57…).
- **OK / bucket C:** the transcript *content* (`.termStripOverlay` remaps to `--pn-term-*` warm graphite,
  styles-session-log.css:1266-1295) is intentionally always-dark — correct.
- **Fix:** add `pnLeakSkin` to `SessionLogModal.tsx:195` root **and** an
  `html[data-redesign] .terminalTaskModal{background:var(--pn-card);…}` override for the literal `#0a0a0a`.
  Fixes chrome + modal-path transcript without disturbing the TerminalStrip path.

## A7. Dashboard — `styles-dashboard.css`
Rendered `MultiProjectBoard.tsx:399`. Zero pn-*; 64 legacy hits.
- `.dash*` use `rgba(var(--theme-primary-rgb),…)` (:26), `var(--style-font-ui)` (:32),
  `var(--theme-primary)` (:69), `var(--style-surface-2,#10151e)` dark hex (:189).
- Inline TSX chart palette: `Dashboard.tsx:124-130` heatmap `LEVEL_COLORS` (theme-primary-rgb);
  `:244-252,357-363,515-516` hardcoded `#4ade80/#00d9ff/#a78bfa/#ef4444/#ffb000` (data-viz — see C2).
- **Fix:** rewrite `.dash*` to pn tokens; derive chart palette from pn (or accept as data-viz, C2).

## A8. Spells (SpellPicker) — `styles-spells.css`
Rendered `components/app/AppModals.tsx:681`. Zero pn-*, 51 legacy hits, no override.
- `.spellPicker__*` `var(--theme-primary[-rgb])` neon + glow (:23-39), legacy container/fonts.
- **Fix:** `--theme-primary→--pn-brand`, fills→`--pn-brand-soft`, container→`--pn-card`, overlay→pn scrim,
  fonts→`--pn-ui`.

## A9. ClaudeCodeSkillsSelector — `styles-claude-skills.css`
Rendered in CreateTaskModal / TeamMemberModal / TeamLaunchConfigModal / ModelProfileModal /
LaunchConfigPanel. `.claudeCodeSkill*`, 41 legacy hits, no override.
- `var(--style-font-ui)` (:7,46), `var(--theme-primary[-rgb])` (:15,18,44,52).
- **Fix:** rewrite to pn (`--theme-primary→--pn-brand`, α→`--pn-brand-soft`/`--pn-hover`, card→`--pn-card`,
  font→`--pn-ui`).

## A10. GitPanel — `styles-git.css`
Rendered `SessionDetailModal.tsx:263`. `.git-panel__*` BEM, zero pn-*, 19 legacy hits, no override.
- `var(--border-color,#333)` (:5), `var(--text-secondary,#aaa)` (:98,115,314…), `var(--border-color,#2a2a2a)` (:264).
- **Fix:** `--border-color→--pn-line`, `--text-secondary→--pn-ink-3`, or add `html[data-redesign] .git-panel*` block.

## A11. ExportToSessionPicker / ExportToTaskPicker (TSX inline — portal-escaped)
`createPortal` to body from `ExcalidrawBoard.tsx`; heavy inline styles, no pn, no wrapper.
- `var(--theme-bg,#1a1a2e)` (undefined var → literal dark) Session:82 / Task:118;
  `var(--theme-primary[-rgb])` neon throughout; `#00d9ff` cyan (Session:228 / Task:362).
- **Fix:** inline TSX edits required — `--theme-bg/#1a1a2e→var(--pn-card)`, `--theme-primary→--pn-brand/--pn-ink`,
  `#00d9ff→` a pn accent. (No CSS override can reach inline literal hex.)

## A12. Startup overlay — `styles-startup.css` (whole file)
`StartupSettingsOverlay.tsx` (App.tsx:45, first-run gated). Zero pn-*, entire file legacy/neon.
- `.startupOverlayBackdrop` `var(--bg,#0a0e16)` (:17); `.startupOverlayContent` `var(--panel,#10151e)` (:30);
  `var(--theme-primary,#00ff41)` titles/active/zoom/volume (:60,97,224,275,298,320);
  `.startupBtnPrimary` neon-green button (:358-365); inline swatch fallbacks
  `StartupSettingsOverlay.tsx:83-89`.
- **Fix:** re-skin whole file to pn (bg/surface/line/brand/ink) + `pn-btn` for the primary button.

## A13. Slide panel + Zoom/Theme settings — `styles-slide-panel.css`, `styles-theme-switcher.css`
`AppSlidePanel.tsx`/`SlidePanel.tsx` (App.tsx:574; opened via CommandPalette + keyboard) and
`ZoomSetting.tsx` (UI-Scale grid). No pn-*.
- `.slidePanel` hardcoded dark gradient `rgba(15,22,32,.92)→rgba(18,27,38,.92)` (styles-slide-panel.css:7);
  pervasive `var(--muted)/--text)/--border)` (:70-304).
- `styles-theme-switcher.css` `var(--border)` (:8,30), `var(--muted)` (:14),
  `rgba(var(--theme-primary-rgb),0.15)` (:45), `var(--theme-primary)` (:97-122).
- **Fix:** re-skin both files to pn (`--muted→--pn-ink-dim`, `--text→--pn-ink`, `--border→--pn-line`,
  `--theme-primary→--pn-brand`, gradient→`--pn-surface`).

## A14. Empty state "NO PROJECTS" — `styles-themed-components.css:732-771`
Inline in `App.tsx:529-538` (`.emptyState*`), shown when `projects.length===0`. No pn-*.
- `.emptyStateTitle` `var(--theme-primary)` (:745); `.emptyStateHint` `rgba(var(--theme-primary-rgb),0.5)` (:751);
  `.emptyStateBtn` neon border/bg/glow (:756-770).
- **Fix:** title→`--pn-ink`/`--pn-brand`, hint→`--pn-ink-dim`, button→`pn-btn` brass tokens.

## A15. Master-project settings toggle — `styles-master-project.css`
`.projectSettingsMaster*` (Project Settings master-toggle row). Tab icon already redesigned (:18-21);
toggle still legacy: `rgba(var(--theme-primary-rgb),…)` (:54-55,69,92), `var(--theme-primary)` (:86),
`var(--style-font-ui)` (:84,90). Gold `#ffd700` star is intentional (leave).
- **Fix:** `--theme-primary→--pn-brand`, `--style-font-ui→--pn-ui`.

## A16. Sessions-section session rows leak — `styles-sidebar-redesign.css`
Loaded after `styles-spaces-panel.css`, so its **bare** `.sessionItem`/`.sessionItemActive`/`.sessionStatus`/
`.sessionCmd`/`.sessionNameText` win at equal specificity over the redesigned spaces-panel rules, for the
LIVE `SessionsSection.tsx` (via SpacesPanel). 33 legacy hits.
- `.agentShortcutBtn` `var(--terminal-border)`/`rgba(0,0,0,.3)`/`var(--terminal-text-dim)` (:232-240) —
  `agentShortcut*` is shared by several live components.
- **Fix:** delete the dead sidebar-shell rules (see B) and `.spacesPanelContent`-scope or pn-rewrite the
  live `.sessionItem*`/`.agentShortcutBtn` rules.

## A17. Cluster in `styles-maestro-sessions-v2.css` with ZERO redesign overrides (LIVE)
This stylesheet has **no `html[data-redesign]` blocks at all**; these rendered components inherit old theme:
- **QueueStatusDisplay** (`MaestroSessionContent.tsx:220`, `SessionInTaskView.tsx:205`) — `.queueStatus*`.
- **StrategyBadge** (5 render sites: MaestroSessionContent:173, SessionStatsView:768,
  SessionDetailOverlay:172, SessionInTaskView:124, SessionDetailModal:151) — `.strategyBadge*`,
  hardcoded `#94A3B8` (:680), `#22D3EE` (:686), `var(--style-font-ui)` (:666).
- **ExecutionBar dropdowns** (`MaestroPanel.tsx:735`; run/coord buttons already pn via `RunCoordButton`) —
  `.executionBarDropdown*` `var(--terminal-border/text)` + `var(--style-font-ui)` (:1825-1828); inline
  `ExecutionBar.tsx:393,409` `accentColor="var(--terminal-amber,#ffab00)"`.
- **Fix:** add `html[data-redesign]` overrides (or pn classes) for these families — status→pn semantic
  tokens (`--pn-run/--pn-wait/--pn-idle`), text→`--pn-ink-2`, surfaces→`--pn-card`, font→`--pn-ui`,
  amber→a pn coord accent.

---

# BUCKET B — DEAD / orphaned legacy CSS (optional cleanup, no live impact)

- **Dead board CSS in `styles-excalidraw.css`** (see A4): `taskBoardColumn*`, `taskBoardColumns`,
  `taskBoardTab*`, `taskBoardTabs`, `sessionBoardEmpty*`, `spacesRailSpace*`, `sessionColumnTaskCount`,
  `sessionColumnDuration`, `sessionColumnSectionLabel`, `sessionColumnTasksEmpty`, `sessionTaskCard*`;
  `mpbSessionResizeHandle*` (styles-multi-project-board.css:557-583) — 0 tsx refs.
- **`.rightPanel` wrapper** `styles-spaces-panel.css:1180-1192` (`var(--panel)` + accent border) — rendered
  only by DEAD `AppRightPanel.tsx:153` / `app/RightPanel.tsx:53`. Live right surface uses `.pn-sp`.
- **Dead `#0a0e16` / sidebar-shell rules** in `styles-sidebar-redesign.css`: `.sidebar`, `.sidebarHeader`,
  `.sidebarResizeHandle`, `.sidebarActionMenu*`, `.createTaskSkill*`, `.createTaskAdvanced*` — consumer is
  dead `app/Sidebar.tsx` / no consumer.
- **`styles-skills-panel.css` — ~all dead.** `SkillsPanel.tsx` migrated to `pn-skill*`
  (redesign-views.css); only `.skillsPanelSpinner` is still rendered. Prune file (keep/rename spinner),
  drop the `styles.css:5` import.
- **`terminalMetaBadge--status-*`** (styles-terminal-theme.css:1131-1166;
  styles-inline-priority-picker.css:1830) — no component renders it; all status badges migrated to
  `pn-badge pn-badge--status-*` (redesign-tiles.css). The only live `terminalMetaBadge` is the
  `--model` variant inside pnLeakSkin (ModelProfilesPanel:85, OK). Safe to delete.
- **`styles-command-palette.css`** (`.command-palette*`, 8 legacy hits) — verify `CommandPalette.tsx` is
  still reachable; if not, dead. If reachable → bucket A (`--border→--pn-line-2`, `--style-font-code→--pn-mono`).
- **Dead components (zero imports — confirm before delete):** `components/maestro/CommandBar.tsx`,
  `components/maestro/SplitPlayButton.tsx`, `components/UpdateModal`(modals/UpdateModal.tsx),
  `components/app/AppTopbar.tsx`, `components/app/Topbar.tsx`, `components/app/Sidebar.tsx`,
  `components/app/RightPanel.tsx`, `components/app/index.ts` barrel, `components/AppRightPanel.tsx`,
  `components/ProjectsSection.tsx` (only imported by dead Sidebar).

---

# BUCKET C — data-driven / intentionally out-of-scope (leave)

- **Terminal / transcript content** — always-dark by design via `--pn-term-*`
  (`.termStripOverlay` in styles-session-log.css:1266-1295; session-log viewers carry no inline legacy
  hex). Correct. Only the *chrome* around it is bucket A (A6).
- **Project accent colors** — `#00d9ff` cyan as the default `projectColor` fallback
  (`MultiProjectSessionsView.tsx:94,232`; board fallbacks) is a data-driven entity color, not a theme
  surface. Acceptable; optionally pick a pn-friendly default.
- **Dashboard chart palette** — `#4ade80/#00d9ff/#a78bfa/#ef4444/#ffb000` (Dashboard.tsx data-viz) and
  heatmap levels are semantic data colors. Re-skin only if a pn data-viz ramp is desired.
- **Gold master-project star** `#ffd700` (styles-master-project.css) — intentional accent.
- **Mentions** — already remapped under `html[data-redesign]` (styles-mentions.css:256-316). DONE.
- **LaunchConfigDropdown** — `terminalLaunchDropdown*` already overridden under
  `html[data-redesign]` (styles-inline-priority-picker.css:2654+). DONE.
- **ModelProfilesPanel** — root is `terminalContent pnLeakSkin`, remapped. DONE. (Follow-up: verify
  `ModelProfileModal`, rendered as a sibling outside the pnLeakSkin at ModelProfilesPanel:111.)

---

# Prioritized fix order for Bucket A (most-visible first)

1. **A1 Document Viewer** — user-flagged; full-screen reading surface.
2. **A3 + A4 Sessions-view (header + columns) & the misplaced board block** — user-flagged; fix together
   (move/re-skin `sessionBoardColumn*`/`sessionColumn*` out of styles-excalidraw.css).
3. **A2 Excalidraw** — user-flagged *(coordinate with the separate Excalidraw worker)*.
4. **A5 Modal system** — one override block fixes ~14 modals (huge surface-area ROI).
5. **A6 SessionLogModal** shell + chrome.
6. **A7 Dashboard** — large, prominent panel.
7. **A8 Spells / A9 ClaudeCodeSkillsSelector** — frequently-opened pickers.
8. **A10 GitPanel.**
9. **A17 sessions-v2 cluster** (StrategyBadge / QueueStatusDisplay / ExecutionBar dropdowns) — pervasive
   small chrome across many session views.
10. **A11 Export pickers** (inline TSX edits).
11. **A16 sessions-section row leak / A13 slide panel + zoom / A12 startup / A14 empty state / A15 master toggle.**

**Two quick wins:** the A5 modal override block, and the A4/B dead-CSS deletion (kanban block in
styles-excalidraw.css + terminalMetaBadge--status-* + skills-panel prune).
