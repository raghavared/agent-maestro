# Screenshot Service Queue

Service owner: 📸 Screenshots Worker (sess_1780953175711_pzzhco61r)
Staging: http://localhost:4568 (server :4569)
Capture: Playwright (preferred) / screencapture fallback
Save path: .maestro/redesign/screenshots/<label>-<theme>.png

Process STRICTLY ONE AT A TIME. Overwrite on re-request.

## Per-surface capture notes (honor these when re-shooting live)
- Terminal Theme (durqpap2m): do NOT flag missing top bar (pn-term-bar) or '/' input row —
  intentionally skipped, coordinator-approved (zero-functionality rule). Verify only: terminal
  container gutter dark var(--pn-term-bg) in BOTH themes, warm empty-state hero (dim ASCII,
  brass '>' caret, ink text), warm-grey xterm scrollbar. Body ●/›/✓ stream colors = xterm-theme
  scope (not this worker). Worker's own fixtures: session docs 'Terminal reskin — light/dark'.
- Task List & Tree (8do14zuz9): to capture nested-subtask tree lines (pn-kids indent rail),
  EXPAND a parent first — click chevron on e.g. 'Maestro Redesign … (6)' before shooting.
  Collapsed capture (icon-rail-leftpanel-dark) correctly shows no tree lines — not a regression.
  Open question escalated to Left Panel Coord: sectioning 'In progress/Up next' vs single 'Current·9'.
- Middle Panel Coord (6jpoi5ju2): prefers future review requests as a named branch's LIGHT+DARK
  pair captured side-by-side.
- Modal Sweep / Misc Coord (kcjl2idwr): capture LIGHT+DARK of 5 re-skinned modals, save as
  modal-<name>-{light,dark}.png. Ref markup: .maestro/redesign/modal-sweep-preview.html. Nav:
    * modal-tasklist     : open a project -> Task Lists panel -> New list
    * modal-modelprofile : Settings -> model profiles -> New profile
    * modal-team         : project w/ >=1 active team member -> Teams -> New team (leader select needs active member)
    * modal-sessiondetail: click an existing session row (a worktree session is richest — exercises Git section)
    * modal-teamlaunch   : team launch flow w/ coordinator + >=1 worker selected; expand a member card (command permissions)
  More Misc views (NEED Tauri dev window — abort in headless chromium, initApp uses invoke/listen):
    * settings-appsettings    : top-bar Settings gear; capture each tab THEME/DISPLAY/SOUNDS/GIT/SHORTCUTS
    * settings-projectsettings: active project tab's gear; capture INFO + SOUNDS (seed >=1 project open)
    * createtaskmodal         : Maestro panel -> 'New task' CREATE mode, Details tab; type a title;
                                seed project w/ >=1 active member that has a model set (opus-4.8) so
                                footer Assignee + pn-badge--model show
    * teammembermodal-A : Team panel -> New Team Member. Base form + Capabilities tab (pn-caps switches +
                          Workflow + Command Permissions) + Sound tab (pn-instr + signature grid)
    * teammembermodal-B : Team panel -> click existing DEFAULT member (e.g. Simple Worker). DEFAULT pn-badge,
                          locked name, Memory card, Reset-Default (pn-btn--danger), autosave pn-savehint

## Pending RE-captures (code landed after batch 1/2 — old shots now stale)
- [READY after hot-reload] right-panel-sessions-light + right-panel-dark — Session Tile (k4g46x2hz)
  shipped pn-st rewrite (was pn-sess). Re-shoot right panel L+D; verify pn-st spine, pn-st__tasklines,
  pn-kids--st nesting. Overwrite old files.
- [UNBLOCKED 03:xx — pn-rail LANDED] far-left rail L+D — Icon Rail (51yks6j43) pn-rail re-skin
  shipped (tsc -b green). Save as icon-rail-pn-light.png / icon-rail-pn-dark.png. Verify: pn-rail-mark
  chevron logo top; 7 pn-rail-btn icons (listChecks/users/team/sparkles/inbox/graph/folder);
  pn-rail-badge 99+ on tasks/members/teams; active accent bar+pn-active bg; spacer; EMPTY bottom
  (CORRECTED: no settings gear, no whiteboard pen). Rail width = 56px (ICON_RAIL_WIDTH 48->56).
  Also re-capture left panel (two-section In-progress/Up-next list once it lands, Left Panel Coord ei828bbjb).
- [READY — pn-mp LANDED] Maestro left panel L+D — Shell Worker (b5z53ot4v) MaestroPanel.tsx chrome
  pass shipped: pn-head (project+standup), pn-subbar (New task + Current/Pinned/Completed/Archived +
  action rows), pn-search (⌘K), pn-filters (All/High/Overdue + Status/Priority/Sort pn-pop), pn-scroll+pn-fade.
  Capture tasks tab w/ a few tasks; pop a filter dropdown if it holds. ONE left-panel shot/theme covers
  rail (pn-rail) + panel chrome (pn-mp) + task list together.

## Batch 3 (user-supplied, 2026-06-09 03:06-03:08) — integrated redesign + modals (mostly LIGHT panels)
New files: full-layout-dark.png (OVERWRITTEN — now integrated pn-rail+pn-mp+terminal+pn-st),
createtaskmodal-light, teammembermodal-A-light, members-list-dark, teams-panel-light,
skills-panel-dark, tasklists-panel-light, graphs-panel-light, files-panel-dark, teams-panel-empty-light.
Routed: full-layout-dark -> all coords + Spaces/Shell/SessionTile/SessionList/IconRail/TaskTree/TaskTile/TopBar/Terminal;
createtaskmodal-light -> TaskCreate(56vyenz1x)+Misc; teammembermodal-A-light -> TeamMemberModal(5zs1882o5)+Misc;
panel-tab shots -> Shell(b5z53ot4v).

## OPEN — biggest unblock: ONE populated LIGHT full-layout pass
Multiple container-leak light fixes landed (IconRail .pn-rail paper; Shell appLeftPanelContent->--pn-surface;
Spaces .spacesPanelContent transparent->pn-sp --pn-surface). A single LIGHT full-layout (rail+left tasks+right sessions
visible) verifies ALL at once: IconRail paper 56px strip, Shell paper left pane, Session List/Right Coord/Spaces paper
right panel+toolbar+tiles. Requested from user.
Still also pending: DARK modals (createtask, teammember A); teammember State B; modal-tasklist/modelprofile/team/
sessiondetail/teamlaunch; app/project settings; terminal L/D close-ups; session-stats.

## KEY CORRECTION (03:08): full-layout-dark.png is actually LIGHT theme
Panels render on warm paper; only the center terminal is dark (by design). Re-saved as
full-layout-light.png. This single shot CLOSED the light container-paper gate for: Icon Rail
(56px pn-rail strip is paper, not #080a0f — orphaned old rule dead), Shell (appLeftPanelContent
paper pane), Task Tile (pn-tt rows on paper), Session List + Spaces + Right Coord (right panel
paper end-to-end). All notified. A TRUE dark full-layout (toggle html data-theme=dark) still pending
as the clean labeled pair.

## Terminal close-up capture requirements (Terminal Theme durqpap2m) — MUST follow
- Use a session with ACTUAL output (diff/test/ls) — full-layout terminal is idle (cursor only).
- Cmd+R reload the DEV window FIRST (or open a FRESH session): JetBrains Mono + warm theme only
  apply to terminals created AFTER the SessionTerminal.tsx change. NOT from installed Maestro.app.
- Verify: parchment #D9D2C4 text, brass #E0A45A cursor, warm desaturated ANSI (no neon),
  JetBrains Mono glyphs, bg #1B1812 (light) / #100E0A (dark).

## Next-pass priorities (Misc Coord, 03:08) + gate confirmations
CONFIRMED CLOSED by full-layout-light.png: Icon Rail (paper 56px strip, badges 9/49/2), Task Tile
(paper rows), Shell (paper pane), Session List/Spaces/Right Coord (paper right panel).
HIGH (verify open audit items):
  1. App Settings modal + Project Settings modal — LIGHT (confirm dialogs render PAPER; flagged
     hardcoded dark bgs in styles-project-settings.css). Tabs: app=Theme/Display/Sounds/Git/Shortcuts,
     project=Info+Sounds.
  1b. FRESH left-panel LIGHT (+dark) — Task List & Tree two-section fix landed: verify 'In progress · N' /
     'Up next · N' pn-sec-heads (was single CURRENT), paper containers + tokenized empty/loading (no
     dark/green leak), expand a parent for pn-kids rail. (current full-layout-light.png predates this.)
MED (fold in):
  2. TRUE dark full-layout (toggle html data-theme=dark) — clean labeled pair.
  3. Terminal close-up (reload first + active-output session, L+D) — see requirements above.
  4. DARK: createtaskmodal-dark, teammembermodal-A-dark.
  5. TeamMember State B (L+D); modal-tasklist/modelprofile/team/sessiondetail/teamlaunch (L+D); session-stats (L+D).
DEFERRED (wait for Misc ping that TeamMember fix landed):
  6. LaunchConfigDropdown EXPANDED inside TeamMemberModal + ModelProfileModal, LIGHT — confirms the
     .terminalLaunchDropdown #0a0a0a dark-leak now paints paper.

## HEADLESS CAPTURE — BLOCKED (diagnosed 03:1x)
Playwright vs :4568 renders 'NO PROJECTS'. From inside page: REST :4567/api/projects=200 (32 projects),
ZERO console errors / failed requests — but app project/session hydration is Tauri-invoke + WS-state bound
(App.tsx, useProjectManager import @tauri-apps/api/core invoke), doesn't resolve in plain browser.
=> Populated 3-panel/board/modal views CANNOT be shot headlessly without scripting project/space repro.
capture.mjs HAS deterministic theme force+readback+assert (verified) — ready if hydration ever solved.
Default API base = http://localhost:4567/api (serverConfig.ts). Staging :4569 has 5 projects, :4567 has 32.
PROTOCOL (proposed to coordinator): capture from real Tauri app (correct fonts now); theme via real top-bar
toggle (html dataset.theme ''<->'dark'); theme EXPLICITLY stated per shot, NEVER inferred (inference = mislabel cause).

## Newly queued (need real-app populated capture)
- project-board (Project Board worker sess_1780984031180_qn8999zvf): single-project kanban overlay, tasks tab,
  pn-bcard cards across todo/in_progress/blocked/in_review/completed. Both themes.
- team-view (Team View worker sess_1780984036780_gzu6y2sjf): full-screen team overlay (pn-tv__coord coordinator
  column w/ brass top-rule + baton badge, resize handle, pn-tv__col worker terminal cols). Needs coordinator
  session w/ >=2 children. Both themes.
- settings-savedprojects (Misc): project '+'/open-saved menu -> 'Saved Projects' dialog; LIGHT (was #000000 -> pn-mdl).
- secondary-panels 6x2 (Shell followup sess_1780983943436_5iycqnwpg): TaskLists, Skills(Installed+Marketplace),
  TaskGraph(list), TeamMembers, Teams, ModelProfiles — LIGHT+DARK each (12 shots). Have 5 PRE-fix interim refs
  (tasklists/teams/graphs light, members/skills dark); need fresh AFTER-fix set.
  AFTER criteria: LIGHT=warm-paper bg, dark warm ink #23201B, brass #B26A2B accents, NO neon-green/cyan/#000.
  DARK=warm-graphite bg, warm near-white text, brass accents, no pure-black leak.

## CONSOLIDATED OUTSTANDING (next real-app pass, label each by EXPLICIT theme):
  P1: true DARK full-layout (toggle to dark) -> Left/Right/Middle coords + Coordinator. (full-layout-light.png done)
  P2: settings appsettings/projectsettings/savedprojects (L+D) -> Misc
  P2: secondary-panels 6x2 (L+D) -> Shell-followup
  P3: project-board (L+D); team-view (L+D, needs seeded coordinator+2 children)
  P3: two-section left panel (L+D); terminal close-up (reload+active output, L+D); session-stats (L+D)
  P3: dark variants createtask/teammember-A; teammember State B; remaining modals tasklist/modelprofile/team/
      sessiondetail/teamlaunch; LaunchConfigDropdown expanded (after Misc signals TeamMember fix)

## FULL-AUTOMATION ATTEMPT — BLOCKED (permissions + window visibility)
Coordinator/user authorized driving the Tauri window myself. Tooling check:
- screencapture: WORKS (screen-recording granted). But full-screen grab shows ONLY wallpaper —
  staging agents-ui window is NOT on the visible Space (minimized/other desktop). 3 agents-ui PIDs live.
- cliclick: present BUT "Accessibility privileges not enabled. Many actions may fail." (clicks won't register).
- osascript/System Events: error -25211 "not allowed assistive access" (can't enumerate windows/bounds).
NEEDED to automate: (1) grant Accessibility to the terminal/host app in System Settings > Privacy & Security >
Accessibility; (2) bring the staging window to the foreground / current Space. Until then, automation can't click
or even see the window — fallback = operator-provided shots (toggle theme + state theme explicitly).

## More queued requests
- multi-project-board (sess_1780984033695_cp9u5hv4g): all-projects board overlay (MultiProjectBoard), TASKS tab,
  BOTH layouts: GROUPED (pn-seg layers -> pn-mpr project rows + pn-bcols) and UNIFIED (pn-seg grid -> 5 pn-bcol
  Backlog/Blocked/In progress/Review/Done w/ Glyph headers + TaskCards). Show pn-bd-hd header (pn-tabs, pn-meta
  chips, pn-ib close). Both themes.
- secondary-panels NARROWED to 3x2 (Shell followup sess_1780983943436): ONLY TaskLists, TaskGraph(list),
  ModelProfiles (Skills/TeamMembers/Teams moved to Views branch — DROP). L+D each.

## Headless behavioral test — PERSISTENCE PASS (persist-test.mjs)
For Middle Coord (6jpoi5ju2) + TopBar (hds7pyadg) data-theme reconciliation:
- PERSIST: PASS. baseline data-theme='' (persisted=null) -> set localStorage maestro-redesign-theme-v1='dark'
  -> reload -> data-theme='dark', data-redesign on, persisted='dark'. Dark survives reload.
  Mechanism: App.tsx:161-165 initTheme() then initRedesignTheme() (reads key, re-applies). Clobber fix:
  useThemeStore no longer writes data-theme (owned by useRedesignTheme).
  CAVEAT: empty-state 'NO PROJECTS' screen is LEGACY-styled (not pn-tokenized) so it doesn't visually flip —
  proof is attribute readback, not pixels. _persist-1-before-light.png / _persist-2-afterreload-dark.png saved.
- NO-KNOCKOUT(clobber): code-confirmed; behavioral (Settings->Theme) needs populated app.
- TERMINAL-FOLLOWS: needs populated app.

## Headless computed-style asserts — P1a LEFT ALL PASS (assert-styles.mjs, re-runnable)
Forced html[data-redesign][data-theme] + injected fixtures (.pn-mp/.pn-rail/.pnLeakSkin) + getComputedStyle.
Light AND dark:
1. .pn-mp bg == --pn-surface (L #FBFAF6 / D #1B1810) PASS
2. .pn-rail bg == --pn-paper (L #F4F2EC / D #15130E) PASS
3. .pnLeakSkin legacy var(--panel) -> --pn-surface, flips L<->D PASS
4. var(--pn-ui) -> 'Hanken Grotesk',... PASS; 4b @font-face registered (main.tsx @fontsource) PASS;
   4c document.fonts.load+check true (real load, not fallback) PASS.
Cleared Middle Coord (6jpoi5ju2) [HEADLESS] LEFT checklist items.

## Headless computed-style asserts — P1e BOARD ALL PASS (assert-board.mjs, re-runnable)
Light AND dark: taskBoardOverlay/mpbOverlay == --pn-paper; taskBoardContainer/mpbContainer == --pn-surface;
.pn-bcol == --pn-surface; .pn-bcard == --pn-card (#FFFFFF/#221E15); .pn-tv == --pn-surface (all flip);
.pn-tv__term stays DARK by-design (#1c1a16 light / #100E0A dark). Cleared Board [HEADLESS] items.
FYI flagged: styles-multi-project-board.css lines ~106/348/528/595 still on var(--bg,#0a0e16) (non-overlay, maybe pre-swap).

REUSABLE HARNESS NOTE: assert-styles.mjs + assert-board.mjs + assert-views.mjs pattern (force theme + inject
class fixtures + getComputedStyle vs expected token rgb) clears [HEADLESS] token-binding items for ANY surface
without the populated app — offer to other branches' [HEADLESS] checklist items.

## Headless computed-style asserts — P1f VIEWS ALL PASS (assert-views.mjs, re-runnable)
Light AND dark: .pn-vstage==--pn-paper; .pn-vframe(panel container)==--pn-surface; .pn-dlg==--pn-card (all flip);
.pn-dlg__icon--danger color==--pn-block (#BB4D3D/#DA7D6A); --warn color==--pn-wait (#BD8A2A/#D9AA49);
Views font==Hanken Grotesk + loaded. Caveat: tested canonical .pn-vstage/.pn-vframe (the bindings Skills/
TeamMembers/FileExplorer render within), not each literal per-panel root class. Cleared Views [HEADLESS] items.
[Confirmed by Middle Coord: the 4 mpb var(--bg) leftovers = orphaned dead CSS, no action.]

## Headless computed-style asserts — P1d MISC ALL PASS (assert-misc.mjs, re-runnable)
Light AND dark: .pn-top==--pn-paper; .pn-mdl==--pn-card; .pn-input/.pn-textarea==--pn-surface;
.pn-btn--danger bg==--pn-block (color=--pn-paper by design); .terminalLaunchDropdown bg==--pn-card
(was fixed #0a0a0a — LEAK FIXED), text==--pn-ink; font==Hanken Grotesk+loaded. All flip.
=> ALL FOUR axes cleared headlessly: P1a LEFT, P1e BOARD, P1f VIEWS, P1d MISC.
Relayed dropdown leak-fix token proof to Misc Coord (kcjl2idwr) — their live expanded-dropdown VISUAL still queued.

## Headless computed-style asserts — P1c RIGHT ALL PASS (assert-right.mjs, re-runnable)
Light AND dark: .pn-sp==--pn-surface; .pn-st (was pn-sess) base TRANSPARENT (inherits surface, hover/selected
token-driven, not stuck dark); .pn-team==--pn-card, .pn-team__head==--pn-surface; .pn-srail==--pn-paper;
font==Hanken Grotesk+loaded. All flip.
[INFO #4] .rightPanel outer wrapper bg = rgb(16,21,30)/#10151E (legacy var(--panel)) in BOTH themes — STUCK dark,
does NOT flip; covered by .pn-sp so no visible leak, but latent legacy wrapper (pre-existing/out-of-scope).
=> ALL FIVE axes headless-proven: LEFT, BOARD, VIEWS, MISC, RIGHT. Suite: assert-{styles,board,views,misc,right}.mjs

## More queued (need real-app populated capture)
- terminal-strip (Terminal Strip worker sess_1780986232150_3e7k8zzoc): terminal pane on ACTIVE session,
  (1) COLLAPSED .termStripBar (Session Log toggle+green LIVE dot, stats rail context gauge+cache%/out/turns/
  tools/duration, brass model pill, attach/draw/cast actions), (2) EXPANDED .termStripOverlay (transcript up).
  Warm-graphite + green #5aa777. Needs integration build (single build:ui) + live session. Both themes.

## Status legend
- pending — received, not started
- in-progress — currently capturing
- done — saved + returned to sender

## Queue

| # | requester | label | how-to-reach | themes | status |
|---|-----------|-------|--------------|--------|--------|
| - | - | - | - | - | - |

## Distributed batch (user-supplied live captures, 2026-06-09 02:46, DARK only)

Source: 4 manual screenshots of the live staging Tauri app. 3 were component-relevant
(the 4th was a meta orchestration view — not distributed).

Files:
- full-layout-dark.png — full three-panel layout (icon rail + left tasks + middle modal + right resources + top project bar)
- left-panel-tasklist-dark.png — left panel task list close-up (CURRENT·9, filters, run/coordinate, task tiles)
- middle-detail-modal-dark.png — middle detail/session modal header (tabs, assignee, model chip, Close/Run)

Routed to:
- Left Panel Coord (ei828bbjb) → full-layout, left-panel-tasklist
- Middle Panel Coord (6jpoi5ju2) → full-layout, middle-detail-modal
- Right Panel Coord (lsa9z2fxx) → full-layout
- Maestro Panel Shell (b5z53ot4v) → middle-detail-modal, full-layout
- Task List & Tree (8do14zuz9) → left-panel-tasklist
- Task Tile (vyx6xexg9) → left-panel-tasklist
- Spaces Layout (1fzd3ds4z) → full-layout
- Project Bar/TopBar (hds7pyadg) → full-layout
- Icon Rail (51yks6j43) → full-layout
- Session List (9xku5t2ky) → full-layout
- Session Tile (k4g46x2hz) → full-layout

NOT in this batch (no relevant surface in the 4 shots — await targeted capture):
Misc Coord, Terminal Theme, Session Stats Theme, Task Create Modal, Team Member Modal,
Settings Panel, Modal Sweep. Light-theme variants pending for everyone.

## Batch 2 (user-supplied, 2026-06-09 02:58-03:00) — LIGHT + close-ups + EXPECTED ref

New files:
- middle-detail-modal-light.png — LIGHT warm-paper detail modal header
- right-panel-sessions-light.png — LIGHT right-panel session cards
- topbar-leftpanel-light-partial.png — partial light (top bar + left list light; mid/right dark)
- icon-rail-leftpanel-dark.png — DARK icon rail + left task list close-up (badges 99+/49/2)
- right-panel-dark.png — DARK right-panel close-up
- expected-full-layout-dark.png — EXPECTED DESIGN TARGET (rail+task tree | middle terminal | right Sessions RUNNING/IDLE groups)

Routed:
- Middle Panel Coord (6jpoi5ju2) → middle-modal-light, expected
- Maestro Panel Shell (b5z53ot4v) → middle-modal-light, expected
- Right Panel Coord (lsa9z2fxx) → right-sessions-light, right-panel-dark, expected
- Session List (9xku5t2ky) → right-sessions-light (LIGHT req fulfilled), right-panel-dark, expected
- Session Tile (k4g46x2hz) → right-sessions-light, right-panel-dark, expected
- Icon Rail (51yks6j43) → icon-rail-leftpanel-dark, expected
- Left Panel Coord (ei828bbjb) → icon-rail-leftpanel-dark, topbar-leftpanel-light-partial, expected
- Task List & Tree (8do14zuz9) → icon-rail-leftpanel-dark, topbar-light-partial, expected
- Task Tile (vyx6xexg9) → icon-rail-leftpanel-dark, topbar-light-partial, expected
- Spaces Layout (1fzd3ds4z) → expected
- TopBar (hds7pyadg) → topbar-light-partial, expected
- Terminal Theme (durqpap2m) → expected (middle terminal = their surface)

STILL MISSING (need targeted captures): clean full-layout LIGHT; live terminal view (light+dark);
Session Stats view; Create Task modal; Team Member modal; Settings panel; Modal Sweep surfaces.
Workers still unserved: Session Stats Theme (s388hwzpf), Task Create Modal (56vyenz1x),
Team Member Modal (5zs1882o5), Settings Panel (4nulvtpgf), Modal Sweep (geywofuu2), Misc Coord (kcjl2idwr).
