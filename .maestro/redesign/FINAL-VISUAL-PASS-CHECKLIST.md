# Final Visual Pass — Operator Checklist

**Owner:** Integration Reviewer (Middle Panel Coordinator).
**Why:** live capture is bottlenecked on the macOS Accessibility grant, so empirical/visual verification is **decoupled** from branch completion (lead policy). Branches complete on their **static/code-level verdict**; every empirical item lands here and is run in **ONE pass** when the operator enables capture (Accessibility granted + staging window foregrounded).

**How to run (one pass, when capture is enabled):** for each item, drive the real Tauri app via the Screenshots Worker (`sess_1780953175711_pzzhco61r`), capture the before/after or light+dark pair, mark ✅/❌, and report the batch verdict to the lead. ❌ items route to the owning coordinator.

### Verification split (lead policy) — clear headless NOW, batch only populated visuals
Tag every item `[HEADLESS]` or `[OPERATOR]`:
- **`[HEADLESS]` — clear NOW, no Accessibility grant needed.** Anything provable on the empty-state/headless app or a static harness: `data-theme`/attribute roundtrips, localStorage persistence, class presence, and **computed styles** (e.g. force `html[data-redesign][data-theme=dark]`, assert a panel's `getComputedStyle(...).backgroundColor` === the `--pn-surface`/`--pn-paper` dark value → proves the bidirectional 2c flip without pixels). Drive these via the Screenshots Worker's headless mode and mark ✅ as they pass.
- **`[OPERATOR]` — needs the populated real app.** True-data visuals, live interactions (Settings→Theme UI flow, terminal-rendered output, real session/task tiles in light+dark). These are the only items that wait for the operator pass.

**Capture prerequisites:** ① user grants macOS Accessibility to the automation; ② staging window foregrounded; ③ deterministic `data-theme` force+assert per shot (no filename-trust); ④ fonts bundled (v2.2 ✅ — type is now authoritative in both app + harness).

---

## ◐ data-theme reconciliation (task_1780984431123_f017n5a6o) — code-level ACCEPTED; (1) PASS, (2)(3) pending populated app
1. ✅ **Persist across reload** — DETERMINISTIC PASS (headless data-theme readback): persisted `dark` survives reload, data-redesign stays on; mechanism confirmed (initRedesignTheme after initTheme reads the persisted key). CAVEAT: the only headless-reachable screen (empty-state "NO PROJECTS") is LEGACY-styled (green-on-black, not pn-tokenized) so it doesn't visually flip — proof is attribute readback, not pixels. A POPULATED-view visual before/after still wanted in the operator pass.
2. ☐ **No knock-out on legacy style change** — CODE-CONFIRMED (useThemeStore no longer writes data-theme). `[HEADLESS]` provable now: set data-theme=dark, invoke `applyToDom(style,color)`, assert data-theme still 'dark' (roundtrip). `[OPERATOR]` full Settings→Theme UI flow in populated app.
3. ☐ **Terminal follows dark** — `[HEADLESS]` assert `currentTerminalBg()` returns the dark value when data-theme=dark (pure fn). `[OPERATOR]` the actually-rendered terminal dark in the populated app.

## ☐ P1b — Middle Panel (code-level COMPLETE; harness-verified, re-confirm in real app)
4. **Terminal stays dark in BOTH themes** — `[HEADLESS]` assert `.terminalPane`/`.terminalContainer` computed bg === `--pn-term-bg` value under each data-theme (#1c1a16 light / #100E0A dark). `[OPERATOR]` rendered empty-state hero warm idiom (no neon green) + warm 16-color ANSI output in the live terminal.
5. **SessionStatsView dual-theme** — `[HEADLESS]` static harness already captured light+dark; assert computed bg = `--pn-paper` (light) / #15130E (dark) + brass accents + status colors via computed style. `[OPERATOR]` optional real-app confirm with live stats data (AGENT_HUES, no radial glow).
6. **Terminal font** — `[OPERATOR]` JetBrains Mono actually applied in the live terminal (webfont re-measure; may need one app reload for pre-existing terminals). `[HEADLESS]` assert `term.options.fontFamily` includes 'JetBrains Mono' + font is loaded.

## ☐ P1a — Left Panel — (code-level reviewed; static verdict CLEAN-with-2-findings; visuals pending)
Files: IconRail.tsx, PanelIconBar.tsx, MaestroPanel.tsx, TaskFilters.tsx, SortableTaskList.tsx, TaskTabContent.tsx, TaskListItem.tsx, styles-left-panel.css, + sweep (TaskListsPanel/TaskGraphPanel/ModelProfilesPanel via styles-panel-leak-fix.css).
- `[HEADLESS]` **Left container dual-theme** — assert `pn-mp` / `.appLeftPanel(Content)` computed bg === `--pn-surface` (light #FBFAF6 / dark #1B1810); IconRail `.pn-rail` === `--pn-paper`; sweep `.pnLeakSkin` panels flip (legacy `--panel`→`--pn-surface`).
- `[HEADLESS]` **Type fidelity** — left-panel computed `font-family` = Hanken/Newsreader/JetBrains Mono, not system fallback.
1. `[OPERATOR]` **Icon rail strip** — vertical `pn-rail`, Mark at top, 7 nav buttons w/ active accent + badges (99+ cap), both themes.
2. `[OPERATOR]` **MaestroPanel chrome** — `pn-head`, `pn-subbar` (New task + 4 subtabs w/ counts), `pn-search` (⌘K), `pn-filters`, `pn-scroll`+`pn-fade`, both themes.
3. `[OPERATOR]` **Two-section list + tree** — `pn-sec-head` per sub-tab; `pn-row` tiles collapsed + expanded meta; `pn-kids` indent rails per depth; dnd drag-reorder; both themes.
4. `[OPERATOR]` **TaskFilters dropdowns** — `pn-filters` pills + `pn-pop`/`pn-opt` dropdowns open/close (verify outside-click-close not regressed vs old mousedown listener), both themes.
5. `[OPERATOR]` **Sweep panels** — TaskLists / TaskGraph / ModelProfiles paper-in-light / graphite-in-dark via `.pnLeakSkin`.
6. `[OPERATOR]` **Typography** — `pn-ui` body / `pn-mono` counts across the left panel, both themes.
## ☐ P1c — Right Panel — (code-complete; populated-visual pending)
Files: `SpacesPanel.tsx`, `SpacesRail.tsx`, `NewSpaceDropdown.tsx`, `SessionsSection.tsx`, `SessionListItem.tsx`(→`pn-st`), `styles-spaces-panel.css`. Sanctioned exceptions: `SpacesLayout-CONTRACT.md` §Coordinator-sanctioned + `P1c-SANCTIONED-EXCEPTIONS.md`.
1. **Spaces panel container + chrome dual-theme** — `[HEADLESS]` computed-bg assert: `pn-sp`=`--pn-surface` light→`#FBFAF6` / dark→`#1B1810`; `spacesPanelContent`=transparent; `spacesRail`=`--pn-paper`. `[OPERATOR]` true light+dark pair shows paper-in-light / graphite-in-dark end-to-end (toolbar+chips+filter+subtabs+scroll).
2. **`pn-st` session tiles** — `[OPERATOR]` populated: AgentTile logo, `pn-st__radio`, `pn-st__statusglyph` (Glyph per status), `pn-st__tasklines`, `pn-st__actions` (resume w/ label, undo restore), `pn-st__meta` + mode dropdown portal. Tile bg=`--pn-card` (#FFFFFF↔#221E15).
3. **`pn-team` "Backend Squad" box + `pn-kids--st` nesting** — `[OPERATOR]` coordinator→worker tree renders (Option A IA, not RUNNING/IDLE status sections).
4. **`pn-srail` rail** — `[OPERATOR]` flat avatar stack, pulse/wait dots, completed=steady, 48px width, both themes.
5. **Quick-launch / sub-tabs / filters** — `[OPERATOR]` `pn-quick` chips (Terminal=`pn-plus`), `pn-subbar` Open/Done/Archived, `pn-filters` segmented filter, both themes.
6. **ResourcesView body** — `[OPERATOR]` token-restyle (JSX/IA unchanged), Resources tab both themes.
7. **Mode dropdown live interaction** — `[OPERATOR]` `pn-pop` portal opens + `updateSessionMode` mutates.
8. **Type fidelity** — `[HEADLESS]` right-panel computed `font-family` = Hanken/Newsreader/JetBrains Mono (v2.2), not system fallback.
## ☐ P1d — Misc / Modals — (pending hand-off)

## ☐ P1e — Board surfaces (project board / full board / team view) — code-level COMPLETE; tsc -b clean (all 6 board files); populated-visual pending
Files: `TaskCard.tsx`(→`pn-bcard`), `KanbanColumn.tsx`(→`pn-bcol`, dead code), `ProjectKanbanRow.tsx`(→`pn-mpr`/`pn-bcol`), `MultiProjectBoard.tsx`(→`pn-screen`/`pn-bd-hd`/`pn-tabs`/`pn-seg`/`pn-bcol`), `TeamView.tsx`(→`pn-tv*`), `ProjectSelectorSidebar.tsx`(→`pn-psb*`). Contracts: `TaskCard-CONTRACT.md`, `MultiProjectBoard-CONTRACT.md`, `TeamView-CONTRACT.md`. Sanctioned: measureElement (correctness-preserving structural change for variable-height `pn-bcard`, MultiProjectBoard-CONTRACT §); design-silent TaskCard states dropped (timeAgo / card-overdue border / cancelled-class / assignee Avatar — zero new data plumbing); Team View collapse = expanded-only (live file has no collapse state); `baton` = foundation-added glyph (phantom ref in design's own kit).
1. **Board card `pn-bcard` dual-theme** — `[HEADLESS]` computed-bg assert: `pn-bcard` = `--pn-card` light→`#FFFFFF` / dark→`#221E15`; no hardcoded hex (grep-verified). `[OPERATOR]` populated: pdot priority color, `pn-tag`, prog+progbar, `due--over`, foot sessions dot + "$ work on" button; paper-in-light / graphite-in-dark.
2. **Single-project columns `pn-bcol`** — `[HEADLESS]` `pn-bcol` computed bg = `--pn-surface` (light `#FBFAF6` / dark `#1B1810`); `pn-bcol__hd` Glyph per status. `[OPERATOR]` populated UnifiedKanbanView, collapsed-column variant, **measureElement smooth-scroll + no overlap/jump** on variable-height cards.
3. **Full board chrome (`pn-screen`/`pn-bd-hd`/tabs/seg/stats/close)** — `[HEADLESS]` container computed bg flips (`mpbOverlay`→`--pn-paper`, `mpbContainer`→`--pn-surface`). `[OPERATOR]` populated: `pn-tabs` (Tasks/Sessions/Dashboard), `pn-seg` grouped|unified toggle, Glyph+count stats, `pn-ib` close; both themes.
4. **Multi-project rows `pn-mpr`** — `[OPERATOR]` populated: `pn-mpr__dot` (project color), name/count/chev expand-collapse, nested `pn-bcols`; both themes.
5. **Project selector sidebar `pn-psb*`** — `[HEADLESS]` `pn-psb` computed bg = `--pn-surface`/`--pn-paper` flip; no hardcoded hex (grep-verified, token-bound). `[OPERATOR]` populated: collapse toggle, checkboxes, select-all, project color swatches; both themes; **confirm `MultiProjectSessionsView` (shares now-orphaned `mpb*` CSS) is visually unaffected**.
6. **Team view `pn-tv*` dual-theme** — `[HEADLESS]` `pn-tv__coord`/cols computed bg flip; `pn-tv__term` stays dark in BOTH themes (terminal exception, by design). `[OPERATOR]` populated coordinator session w/ ≥2 children: `pn-tv__coord` column + **baton** coordinator badge, worker columns (`pn-tv__col`/`--needs`), **resize drag** (coordW), drill bar, terminal lines; both themes.
7. **Type fidelity** — `[HEADLESS]` board computed `font-family` = Hanken / Newsreader / JetBrains Mono (v2.2), not system fallback.

## ☐ P1f — Terminal Strip (task_1780985947651_uvnqizdci) — code-level ACCEPTED (coordinator-verified, tsc -b EXIT 0); populated-visual pending
Files: NEW `session-log/TerminalStrip.tsx` (fuses old SessionLogStrip + SessionActionBar; both old files DELETED, zero dangling refs), `app/AppWorkspace.tsx` (renders one `<TerminalStrip>` at foot of `terminalPane`; old top-strip + floating-action-bar placements removed), `styles-session-log.css` (`.termStrip*` styles appended). Warm-graphite terminal palette (`--pn-term-*`) + green `#5aa777` LIVE accent; terminal-dark in BOTH app themes (no light variant, by design — like the terminal pane itself). Requires a LIVE maestro session with a Claude/codex log for the strip to render (`ready && selectedFile` gate).
1. `[OPERATOR]` **Collapsed strip** — `.termStripBar` pinned at foot of terminal: Session Log toggle (`.termStripToggle` chevron + label + pulsing green LIVE dot/tag when `isOngoing`), edge-faded stats rail (`.termStripRail` — circular context gauge `.termStripGauge` contextTokens/200k + `cache%`/out/turns/tools/duration), brass model pill `.termStripModel` kept fully visible outside the fade, actions `.termStripActionBtn` (attach paperclip / draw pencil / cast ✦) with tooltips.
2. `[OPERATOR]` **Expanded transcript** — click Session Log → `.termStripOverlay` opens UPWARD above the bar, rendering the `LogMessageGroup` viewer (reused verbatim); auto-scroll + live tail intact.
3. `[OPERATOR]` **Live behaviors** — attach injects `@paths`, draw opens whiteboard→session, cast opens spell picker for `maestroSessionId`; LIVE dot pulses while the session is ongoing.
4. `[HEADLESS]` **Palette binding** — assert `.termStripBar`/`.termStripOverlay` computed colors resolve to `--pn-term-*` values (graphite, not panel light theme) and the gauge fill = `--pn-term-acc`.

---

## ☐ Views panels (SkillsPanel / ConfirmActionModal / TeamMemberList+TeamMembersPanel / FileExplorerPanel) — code-level CLEAN PASS; populated-visual pending
- `[HEADLESS]` **Panel container dual-theme** — SkillsPanel / TeamMembers / FileExplorer container bg binds to `--pn-surface`/`--pn-paper` and FLIPS; ConfirmActionModal `.pn-dlg` bg flips; `.pn-dlg__icon--danger`=`--pn-block`, `--warn`=`--pn-wait`. (fired)
- `[HEADLESS]` **Type** — Views panels computed font-family = Hanken Grotesk, not system fallback. (fired)
1. `[OPERATOR]` **ConfirmActionModal** — danger + warn variants, busy 'Working…' state, both themes (8 consumers — spot-check one delete + one close flow).
2. `[OPERATOR]` **SkillsPanel** — re-skinned list/cards both themes.
3. `[OPERATOR]` **TeamMemberList + TeamMembersPanel** — members header non-dup + archived collapsible section, both themes.
4. `[OPERATOR]` **FileExplorerPanel** — `pn-fvrow` rows, FileIcon kept colored (file-type color), git decorations absent-by-design, both themes.

## Cross-branch / integration shots (run last)
- **Bidirectional 2c flip** — `[HEADLESS]` per-panel computed-bg assert (pn-mp / terminal / pn-st): light→paper, dark→graphite, terminal dark in both. `[OPERATOR]` the TRUE light+dark full-layout pixel pair (earlier "dark" capture was a mislabeled light shot).
- **In-app theme toggle reachability** — `[OPERATOR]` the TopBar Moon/Sun toggle actually flips `html[data-theme]` at runtime (not just devtools-forced), so dark is user-reachable.
- **Type fidelity, app vs harness** — `[HEADLESS]` assert computed `font-family` resolves to Hanken Grotesk (`--pn-ui`) / Newsreader (`--pn-serif`) / JetBrains Mono (`--pn-mono`), not a system fallback. `[OPERATOR]` visual confirm app == harness (v2.2 bundling).

---

## ☐ P2 — Old-theme cleanup sweep (static-verdict CLEAN; populated-visual pending)
Reviewer: 🎛️ Middle Panel Coordinator (independent). All P2 surfaces re-skin via additive `html[data-redesign]` override blocks (base legacy rules untouched, toggle-safe) or token-only swaps. Code-level Axis 0/1/2 PASSED; the items below are the decoupled [OPERATOR] visual confirmations + [HEADLESS] computed-style flip-asserts (queued with Screenshots sess_1781000510487_jsrsjlddu).

### Cluster A1 — Document Viewer (styles-docs-v2.css + sessions-v2 projectDocsList + DocViewer.tsx)
- `[HEADLESS]` `.docViewerPanel`/`.docsListCard` computed bg = `--pn-card` (NOT `#0a0a0a`); flips graphite in dark. `.docViewerMarkdown a/code` computed color = `--pn-brand` (no neon `#00ff41`).
- `[OPERATOR]` Open a markdown doc + a mermaid doc, both themes: paper panels, brass links/code, warm scrim overlay; fullscreen overlay = paper/graphite flip.

### Cluster A5/A6 — Modal system (themed-components .themedModal, file-explorer .modal/.agent-modal-overlay, terminal-task-detail .terminalTaskModal, session-log chrome)
- `[HEADLESS]` `.themedModal` + `.modal` + `.terminalTaskModal` computed bg = `--pn-card` (NOT `#000000`/`#0a0a0a`/dark gradient); flips dark. `.agent-modal-overlay` inline `--color-bg-*` resolve to pn.
- `[OPERATOR]` Spot-check ~3 modals each family (NewSession/Project + PersistentSessions/Ssh + SessionLogModal), both themes: paper shell, brass accents, legible text; SessionLogModal transcript CONTENT stays dark (bucket C, intended).

### Cluster A7–A10 — Panels (git, dashboard, spells, claude-skills)
- `[HEADLESS]` `.dashMetricCard`/`.dashChartWrap`/`.spellPicker`/`.claudeCodeSkillCard`/`.git-panel__file-list` computed bg = `--pn-card`/`--pn-surface`; flip dark. `.dashTeamProgressFill` = brass gradient (no neon green).
- `[OPERATOR]` Open Dashboard, SpellPicker, ClaudeCodeSkillsSelector, GitPanel, both themes: paper surfaces, brass accents. Dashboard chart-series/heatmap hexes stay data-viz (bucket C, intended).

### Cluster A3/A4 — Sessions-view + misplaced-board-block split (styles-excalidraw.css 862→146, board classes moved to styles-multi-project-board.css)
- `[HEADLESS]` `.sessionBoardColumn` computed bg = `--pn-surface`/`--pn-card` and FLIPS dark (the highest-risk forward+reverse leak); `.sessionBoardColumn--working` border = `--pn-run-soft` (no cyan `rgba(0,217,255)`). mpb* header bg flips.
- `[OPERATOR]` Project Board → Sessions view, both themes: paper columns + header, brass working accent, drag a card (DragGhostCard `taskBoardCard--ghost` = paper), terminal-in-board stays dark.

### Cluster command-palette (W7b — styles-command-palette.css, CommandPalette.tsx via App.tsx lazy-import)
- `[HEADLESS]` `.commandPalette` computed bg = `--pn-card` (NOT the legacy dark gradient); flips graphite in dark. `.commandPaletteItemSelected` = `--pn-brand-soft` (no indigo/neon).
- `[OPERATOR]` Open the command palette (keyboard), both themes: paper sheet, warm scrim, brass search icon + selected-row, mono shortcuts/kbd; quick-prompt items = paper cards. Confirm generic `.iconBtn`/`.shortcutHint` (overridden unscoped under data-redesign) look correct wherever else they appear.
