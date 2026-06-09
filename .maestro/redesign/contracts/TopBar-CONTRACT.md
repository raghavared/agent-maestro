# TopBar / Project Bar (`pn-top`) — Redesign Contract

**Worker:** 🪧 Project Bar / TopBar Worker (`tm_1780948940364_m0hjcurua`)
**Task:** `task_1780949391336_i4weyggn2`
**Phase:** STUDY + CONTRACT (gate closed — no source edits yet)
**Status:** Contract FINALIZED per coordinator rulings (2026-06-09). Escalations #1–#3 resolved below. **1 new kit-icon gap (sound) escalated.**

### Coordinator rulings (locked)
- **#1 — `pn-lights`:** **Option A** — omit `pn-lights`, keep **native OS decorations**, zero Tauri risk. (Parent coordinator may still redirect before gate; do NOT implement frameless (B) unless explicitly told.)
- **#2 — extra buttons:** Keep **all** as `pn-ib`. `pn-top-r` left→right order: **[Multi-Project Board] [Whiteboard] [Sound toggle] [App-Settings]** then design trio **[Theme] [Search] [⌘K]** as rightmost cluster. Flat row, **no overflow menu** (escalate if it crowds at min width).
- **#3 — `pn-ptab` adornments:** Approved as proposed — dot mapping `needsInput→wait`, else `working>0→run+live`, else `idle`; keep ★ / count chips / needs-input / active-gear (gear on hover, retain `.projectTabSettingsBtn` + drag-skip). FLIP `useLayoutEffect` + `handleTabPointerDown` verbatim.
- **NEW additions confirmed:** theme→`useRedesignTheme().toggle`; search + ⌘K→`useUIStore.setCommandPaletteOpen(true)`.

---

## 0. Files in scope (read & catalogued)

| File | Role |
|---|---|
| `maestro-ui/src/components/ProjectTabBar.tsx` (748 lines) | The component being re-skinned. **Note: lives at `src/components/`, NOT `src/components/maestro/`.** |
| `maestro-ui/src/App.tsx` (`ProjectTabBar` mount @ line 502, props 503-516) | Parent — supplies all props; renders `<ProjectTabBar>` directly under `.app`. |
| `maestro-ui/src/styles-project-tabs.css` | Current styling (`.projectTabBar` etc.). |
| `maestro-ui/src-tauri/tauri.conf.json` / `.prod.json` | Window config (decorations / drag — see Escalation #1). |
| `panel-redesign/shell.jsx` `TopBar` (lines 240-258) | Design source. |
| `panel-redesign/theme.css` lines 113-202, 523-541 | `pn-top` / `pn-lights` / `pn-ptab` / `pn-ib` / `pn-kbd` / `pn-dot` tokens. |
| `maestro-ui/src/components/maestro/redesign/{redesign-tokens.css,kit.tsx,useRedesignTheme.ts}` | Foundation outputs (already on disk; `FOUNDATION-DONE.md` not yet published). |

**Token confirmation:** all `pn-top`, `pn-lights`, `pn-ptabs`, `pn-ptab`, `pn-ptab--active`, `pn-top-r`, `pn-ib`, `pn-kbd`, `pn-dot*` classes exist verbatim in `redesign-tokens.css` (scoped `html[data-redesign] …`, lines 196-214, 537-555). ✅
**Kit confirmation:** `Icon` (with `moon`, `sun`, `search`, `plus`, `settings`, `folder`, `layers`, `pen`, `more` names), exported from `redesign/kit.tsx`. ✅
**Theme hook confirmation:** `useRedesignTheme()` returns `{ theme, isDark, toggle, setTheme }`, flips `html[data-theme]` between `"dark"` and `""`. ✅

---

## 1. Design target (`shell.jsx` TopBar, lines 240-258)

```
div.pn-top
 ├─ div.pn-lights            → <i><i><i>  (3 decorative traffic dots)
 ├─ div.pn-ptabs             → project tabs
 │    ├─ span.pn-ptab--active → <span.pn-dot.pn-dot--run> + "agent-maestro"
 │    ├─ span.pn-ptab         → "voice-alexa"
 │    └─ button.pn-ib (26×26) → <Icon name="plus" size=14>   (add project)
 └─ div.pn-top-r             → right group
      ├─ button.pn-ib  title=Light/Dark → <Icon name={dark?'sun':'moon'}>   (theme toggle)
      ├─ button.pn-ib  title=Search     → <Icon name="search">
      └─ button.pn-ib  title=Command    → <span.pn-kbd>⌘K</span>
```

The design's reference toggle uses local `useState` + `document.documentElement.dataset.theme`. **We replace that with the foundation `useRedesignTheme()` hook** (no duplicated state).

---

## 2. Functional surface — PRESERVE VERBATIM

Every item below must survive the re-skin unchanged (props, store hooks, handlers, refs, effects, a11y).

### 2.1 Props (`ProjectTabBarProps`, lines 18-33) — all preserved
`projects`, `activeProjectId`, `sessionCountByProject`, `workingAgentCountByProject`, `needsInputByProject`, `onSelectProject`, `onNewProject`, `onDeleteProject`, `onCloseProject`, `onFetchSavedProjects`, `onReopenProject`, `onMoveProject`, `onOpenMultiProjectBoard?`, `onOpenWhiteboard?`.

### 2.2 Store hooks
- `useProjectStore((s) => s.setProjects)` and `s.toggleMasterProject` (inside `ProjectSettingsDialog`).
- `soundManager` singleton: `isEnabled()`, `setEnabled()`, `setProjectConfig()`, `removeProjectConfig()`.

### 2.3 Local state (lines 325-338) — all preserved
`settingsProjectId`, `appSettingsOpen`, `soundEnabled`, `draggingProjectId`, `dropTarget`, `addMenuOpen`, `savedProjects`, `savedProjectsLoading`, `savedProjectsOpen`.

### 2.4 Refs (lines 334-338) — all preserved
`addMenuRef`, `tabsRef`, `previousItemRectsRef`, `activeAnimationsRef`.

### 2.5 Effects / side effects — all preserved
- `useEffect` (372-381): outside-click closes add menu.
- `useLayoutEffect` (389-431): **FLIP reorder animation** over `.projectTab` items via `tabsRef`. Reads `data-project-id`; uses `previousItemRectsRef` + `activeAnimationsRef`. **→ The reordered tab element MUST keep `className` containing `projectTab` and the `data-project-id` attribute, or this animation silently breaks.** (See §3 mapping note.)
- `handleTabPointerDown` (433-561): full pointer-drag reorder — drag threshold, pointer capture, edge auto-scroll on `tabsRef`, `elementFromPoint` hit-testing `.projectTab` / `data-project-id`, `getDropPosition`, `onMoveProject`, click-vs-drag disambiguation (`onSelectProject` on no-drag pointerup), body cursor/userSelect mutation + restore. **Depends on `.projectTab` class + `data-project-id` + `.projectTabSettingsBtn` selector + `touchAction:'none'`.**

### 2.6 Handlers — all preserved
`handleDelete`, `handleCloseProject`, `handleOpenSavedProjects`, `handleDragEnd`, `handleTabPointerDown`, plus inline: project select, settings-gear open, add-menu toggle, new-project, open-saved-project, multi-project board, whiteboard, app-settings open, sound toggle.

### 2.7 Sub-dialogs (must remain mounted & functional)
`AppSettingsDialog` (theme/display/sounds/git/shortcuts tabs + `SHORTCUT_ROWS` table), `ProjectSettingsDialog` (info/sounds, master toggle, close/delete project), Saved-Projects dialog. **These are out of `pn-top`'s visual scope but their triggers live in the bar — see Escalation #2.**

---

## 3. Visual surface — REPLACE (old → new mapping)

| Existing element | Existing class | New class / structure | Token / kit source |
|---|---|---|---|
| Bar container | `.projectTabBar` | `div.pn-top` | `redesign-tokens.css:537` |
| Tabs scroller | `.projectTabs` (ref=`tabsRef`) | `div.pn-ptabs` (ref=`tabsRef`) | `:547` |
| One project tab | `.projectTab` (+`Active`/`Dragging`/`DropBefore`/`DropAfter`/`NeedsInput`) | `span.pn-ptab` / `span.pn-ptab--active` — **MUST also retain literal `projectTab` class + `data-project-id` for FLIP+drag (see note)** | `:548`,`:553` |
| Tab status indicator | working dot `.projectTabWorkingDot` / count badges | `span.pn-dot pn-dot--{run\|wait\|idle}` inside ptab | `theme.css:113-118`, `:554` |
| Tab label | `.projectTabName` | text node inside `pn-ptab` | — |
| Master star | `.projectTabMasterIcon` (★) | **design-silent → Escalation #3** | — |
| Per-tab settings gear | `.projectTabSettingsBtn` (active only) | **design-silent → Escalation #3** | — |
| Add-project button | `.projectTabBarBtn` + add-menu dropdown | `button.pn-ib` (26×26) `<Icon name="plus" size=14>` | `:206`, kit `Icon` |
| Add-menu dropdown | `.projectAddMenu` / `.projectAddMenuItem` | keep dropdown; reskin items (design-silent on dropdown → Escalation #3) | — |
| Multi-proj board btn | `.projectTabBarBtn` `<Icon layers>` | `button.pn-ib` in `pn-top-r` (pos 1) `<Icon name="layers">` | `:206`, kit `layers` ✅ |
| Whiteboard btn | `.projectTabBarBtn` `<Icon edit>` | `button.pn-ib` in `pn-top-r` (pos 2) `<Icon name="pen">` (kit has no `edit`; `pen` = shell.jsx rail Whiteboard) | `:206`, kit `pen` ✅ |
| Sound toggle | `.globalSoundToggle` `<Icon volume/volume-off>` | `button.pn-ib` in `pn-top-r` (pos 3) — **icon GAP, Escalation #4** | `:206`, kit ❌ |
| App-settings btn | `.projectTabBarBtn` `<Icon settings>` | `button.pn-ib` in `pn-top-r` (pos 4) `<Icon name="settings">` | `:206`, kit `settings` ✅ |
| **NEW** theme toggle | — (none today) | `button.pn-ib` `<Icon name={isDark?'sun':'moon'}>` → `useRedesignTheme().toggle` | kit `Icon` `sun`/`moon` |
| **NEW** search btn | — (none today) | `button.pn-ib` `<Icon search>` → `useUIStore.setCommandPaletteOpen(true)` | kit `Icon` |
| **NEW** ⌘K btn | — (none today) | `button.pn-ib` `<span.pn-kbd>⌘K</span>` → `useUIStore.setCommandPaletteOpen(true)` | `:198` |
| Right action group | `.projectTabBarActions` | `div.pn-top-r` | `:555` |
| Traffic lights | — (native OS today) | **INTENTIONALLY DROPPED** — `pn-lights` NOT rendered; native OS decorations retained per coordinator Option A. *Reviewer note: do not flag as missing.* | n/a (Option A) |

> **FLIP/drag preservation note:** the design renders tabs as `span.pn-ptab`, but `handleTabPointerDown` + the FLIP `useLayoutEffect` both query `.projectTab` and read `data-project-id`. To preserve drag-reorder verbatim, the re-skinned tab element must carry **both** the visual class (`pn-ptab`/`pn-ptab--active`) **and** the functional class `projectTab` + `data-project-id` + inline `touchAction:'none'`. The drag-state modifiers (`projectTabDragging/DropBefore/DropAfter`) keep their existing classes; their CSS in `styles-project-tabs.css` may need a pn-scoped equivalent (escalate if a drop-indicator token is missing).

### Command palette wiring (search + ⌘K)
- Store: `useUIStore((s) => s.setCommandPaletteOpen)` (confirmed: `CommandPalette.tsx:90`, opened elsewhere via `useKeyboardShortcuts.ts:72` on ⌘K).
- Both the search `pn-ib` and the ⌘K `pn-ib` call `setCommandPaletteOpen(true)`.
- This is **additive** — no existing handler removed. The global ⌘K keyboard shortcut already exists and is untouched.

### Theme toggle wiring
- `const { isDark, toggle } = useRedesignTheme({ ensureRedesign: false });` (flag already set in `main.tsx:15`; pass `ensureRedesign:false` to avoid re-asserting — confirm with foundation).
- Button: `title={isDark ? 'Light mode' : 'Dark mode'}`, `onClick={toggle}`, `<Icon name={isDark ? 'sun' : 'moon'} />`.

---

## 4. ESCALATIONS

**#1–#3 RESOLVED** by coordinator (see rulings at top). Original analysis retained below for the record. **#4 is OPEN.**

### 🟡 Escalation #4 — kit `Icon` has no sound/mute icon (OPEN)
The Sound toggle (`pos 3` of `pn-top-r`) currently uses `volume` / `volume-off`. **Neither exists in `kit.tsx` PN_ICONS** (available audio-ish names are only `music` and `mic`, both semantically wrong for a mute/unmute toggle). Per coordinator rule "if an icon is missing from kit Icon, escalate — don't hardcode an inline SVG." **Request:** ask Foundation to add `volume` + `volume-off` (or a single `mute`) to the kit. Until then the sound `pn-ib` is blocked. Existing handler/state (`soundManager`, `soundEnabled`) is unaffected and preserved regardless.

### ✅ Escalation #1 — Tauri title bar / `pn-lights` conflict (RESOLVED → Option A)
**Finding:** There is **no `data-tauri-drag-region` anywhere in the codebase**, and `tauri.conf.json` does **not** set `decorations: false`. The window uses the **native OS title bar**: native macOS traffic-light controls render above the web content, and window dragging is handled natively. The current `ProjectTabBar` sits *below* that native bar and has no drag responsibility.

**Conflict:** The design's `pn-lights` (3 colored `<i>` dots) is a *decorative* reproduction of macOS traffic lights. Rendering it in the live app would **duplicate** the real native controls and produce three non-functional dots.

**The directive's premise ("preserve the data-tauri-drag-region on pn-top") does not match the codebase — no such region exists.**

**Options (need your pick):**
- **(A) Omit `pn-lights` entirely** — keep native decorations; render `pn-top` starting at `pn-ptabs`. Simplest, zero Tauri risk. *(Worker's recommendation.)*
- **(B) Go frameless** — set `decorations:false`, render `pn-lights` as *functional* window controls (close/min/max via `@tauri-apps/api/window`), and add a drag region (`data-tauri-drag-region` on `pn-top` or CSS `-webkit-app-region:drag`). Larger scope, touches Rust/Tauri config + window-control handlers, must verify drag + controls in dev on macOS.
- **(C) Decorative only** — render `pn-lights` as pure non-interactive dots accepting the visual duplication. (Not recommended.)

### ✅ Escalation #2 — Homes for existing right-side controls (RESOLVED → keep all in `pn-top-r`)
The design's `pn-top-r` shows only **theme / search / ⌘K**. The current bar additionally has **App-Settings**, **Sound toggle**, **Multi-Project Board**, and **Whiteboard** buttons. Zero-functionality rule forbids dropping them.
**Proposed (needs approval):** render each as an extra `button.pn-ib` inside `pn-top-r`, ordered `[board?] [whiteboard?] [settings] [sound] | [theme] [search] [⌘K]`. Confirm ordering / whether any should move into the ⌘K palette or a `more` overflow menu instead. *(`onOpenWhiteboard` is currently **not** passed by `App.tsx:502-516` — it renders only when the prop exists, so it stays conditional.)*

### ✅ Escalation #3 — Per-tab affordances not in design (RESOLVED → keep all as inline adornments)
Design's `pn-ptab` shows only `dot + name`. Current tab carries: **master ★**, **working-count chip**, **session-count chip**, **needs-input state**, and an **active-tab settings gear**. Need a mapping:
- **Proposed dot semantics:** `needsInput → pn-dot--wait`; else `workingCount>0 → pn-dot--run pn-dot--live`; else `pn-dot--idle`. (Active tab keeps the dot per design.)
- **Master ★, counts, gear:** keep as small inline adornments within `pn-ptab` (escalate exact placement) or drop the visual count chips. **Do not invent — confirm.** The settings gear must remain reachable (it opens `ProjectSettingsDialog`); proposal: show it on the active `pn-ptab` on hover, retaining `.projectTabSettingsBtn` class (drag code skips clicks on it).

---

## 5. Deliverables checklist (post-gate)
- [x] In-place edit of `ProjectTabBar.tsx` (pn-top / pn-ptabs / pn-ptab / pn-top-r / pn-ib / pn-kbd).
- [x] `styles-project-tabs.css` rewritten to pn-token-only functional rules (drag/drop, chips, gear, dropdown, scroll), scoped `html[data-redesign]`.
- [x] Theme toggle via `useRedesignTheme().toggle`; search + ⌘K via `useUIStore.setCommandPaletteOpen(true)`.
- [x] All §2 functional surface preserved (drag-reorder, FLIP, dialogs, sound, board, settings, ★/counts/gear).
- [x] Light + dark screenshots → `.maestro/redesign/contracts/screenshots/topbar-{light,dark}.png` (verified faithful).
- [x] **`cd maestro-ui && bunx tsc -b` → EXIT 0, clean** (per coordinator's per-worker gate; full production vite bundle is run once by the coordinator for the whole Misc branch, not per-worker).
- [x] Live-app corroboration: `.maestro/redesign/screenshots/full-layout-dark.png` shows `pn-top` rendering correctly in the running staging app (tabs + dots + count chips + `+` + `pn-top-r` cluster).

### Implementation notes (extra functional couplings preserved)
- `PromptSendAnimation.tsx` queries `.projectTabBar` to clamp the send-dot to the bar bounds → kept `projectTabBar` class on the `pn-top` div as a **JS-only hook** (no CSS attached).
- `styles-master-project.css` styled `.projectTabActive .projectTabMasterIcon` (old active class) → added `html[data-redesign] .pn-ptab--active .projectTabMasterIcon` (brass `--pn-brand`, no neon glow).
- Sound glyph: kit shipped `volume` + `volumeOff` (Foundation Phase 0) → used directly; **Escalation #4 resolved**.

**Open dependencies:** typecheck confirmation once the team-wide build contention clears.
