# Maestro UI v2 — Design Plan

## Overview

Restructure the app layout: move the Maestro panel to the **left** with a vertical icon rail, move sessions to the **right** as a "Spaces" panel. The center remains the active content area (terminal, whiteboard, doc, etc.). Goal: maximize terminal/workspace real estate with a collapsible left panel.

---

## New Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Project Tab Bar (unchanged)                                      │
├──┬──────────────┬─────────────────────────────┬──────────────────┤
│  │              │                             │  Spaces Panel    │
│I │  Expanded    │                             │  (vertical list) │
│C │  Maestro     │     Active Space            │                  │
│O │  Sidebar     │     Content                 │  [+ new space]   │
│N │              │                             │  ─────────────── │
│  │  (shows      │     (Terminal /             │  ▶ Session: W-1  │
│R │   content    │      Whiteboard /           │    Session: R-1  │
│A │   for the    │      Doc / Board)           │    Whiteboard 1  │
│I │   selected   │                             │    Doc: API Spec │
│L │   icon)      │                             │                  │
│  │              │                             │                  │
├──┴──────────────┴─────────────────────────────┴──────────────────┤
```

### Three-column structure:
1. **Left: Icon Rail + Expandable Maestro Sidebar**
2. **Center: Active Space Content** (whatever space is selected)
3. **Right: Spaces Panel** (vertical list of all open spaces)

---

## Left Panel: Icon Rail + Maestro Sidebar

### Icon Rail (always visible, single narrow column ~48px)

The icon rail **replaces** the current horizontal `PanelIconBar` tabs. Each icon corresponds to a section. Clicking an icon expands the sidebar to show that section's content.

| # | Icon | Label | Content when expanded |
|---|------|-------|-----------------------|
| 1 | Tasks icon | Tasks | Current task list with sub-tabs (Current / Pinned / Completed / Archived). Same as current Tasks tab content. |
| 2 | Members icon | Members | Team members list. Same as current Team > Members sub-tab. |
| 3 | Teams icon | Teams | Teams list. Same as current Team > Teams sub-tab. |
| 4 | Skills icon | Skills | Skills browser. Same as current Skills tab content. |
| 5 | Lists icon | Lists | Task lists. Same as current Lists tab content. |
| 6 | Files icon | Files | File explorer (relocated from current right panel). |
| 7 | Whiteboard icon | Whiteboard | Clicking this opens/creates a new whiteboard **space** on the right. The icon acts as a shortcut. |

### Expand/Collapse Behavior

- Clicking an icon **expands** the sidebar to show that section.
- Clicking the **same active icon** again **collapses** the sidebar back to just the rail.
- When collapsed, the center area takes maximum width.
- Only one section is visible at a time.
- Sub-tabs (e.g., Current/Pinned/Completed for Tasks) remain **inside** the expanded content area, not in the icon rail.
- Keyboard shortcut: `Cmd+B` / `Ctrl+B` to toggle collapse.

### Expanded Sidebar Content

- The expanded sidebar shows the same content that the current Maestro panel sections show.
- All existing internal state, filters, drag-and-drop, execution bar, etc. are preserved.
- Width is resizable via drag handle (same as current sidebar behavior).

---

## Right Panel: Spaces Panel

### What is a Space?

A **space** is any content that can be displayed in the center area. Space types:

| Type | Description | How created |
|------|-------------|-------------|
| **Session** | A Maestro agent session (terminal + logs). This is the current "session" concept. | Running a task, clicking "Claude" or "Codex" in the + menu, or implicitly via maestro |
| **Terminal** | A raw shell terminal (no maestro session). | Clicking "Terminal" in the + menu |
| **Whiteboard** | An Excalidraw whiteboard (no longer a full-screen overlay). | Clicking "Whiteboard" in the + menu, or clicking the whiteboard icon in the left rail |
| **Doc** | A document view. | Clicking "Doc" in the + menu, or clicking a document from a task |
| **Board** | Multi-project board (currently an overlay). | Clicking "Board" in the + menu. Opens as overlay (stays overlay for now). |

### Spaces Panel Layout (Right Side)

The spaces panel is a **vertical list** on the right side, similar to how `SessionsSection` currently works on the left. It replaces the current `SessionsSection`.

```
┌─────────────────────┐
│ [+] [T] [D] [W]     │  <- New space toolbar (+ and quick-create icons)
│     [C] [X] [R] [B] │  <- Claude, Codex, Refresh, Board
├─────────────────────┤
│ ▶ Worker-1          │  <- Session space (active, highlighted)
│   ├ avatar + status │
│   ├ team info       │
│   └ task badges     │
├─────────────────────┤
│   Researcher        │  <- Session space
│   ├ avatar + status │
│   └ task badges     │
├─────────────────────┤
│   Whiteboard 1      │  <- Whiteboard space (icon differentiation)
├─────────────────────┤
│   API Spec          │  <- Doc space (icon differentiation)
├─────────────────────┤
│   Terminal           │  <- Raw terminal space
└─────────────────────┘
```

### New Space Toolbar (Top of Spaces Panel)

A row of small icon buttons at the top for quick space creation:

| Icon | Action |
|------|--------|
| **+** | Generic "new space" (may show dropdown) |
| **Terminal** | Opens a new raw terminal space |
| **Doc** | Creates a new document space |
| **Whiteboard** | Creates a new whiteboard space |
| **Claude** | Opens a new Claude session space |
| **Codex** | Opens a new Codex session space |
| **Refresh** | Refreshes the spaces list |
| **Board** | Opens the multi-project board overlay |

### Session Space Items

Session-type spaces preserve **all existing session item UI**:
- Agent icon with live indicator (green dot)
- Session name with avatar
- Team member info and avatars
- Status badges (exited, closing, needs input)
- Recording indicator
- Expand button to show maestro tasks
- Action buttons (logs, close)
- Drag-and-drop reordering
- Team grouping

Non-session spaces (Whiteboard, Doc, Terminal) show simpler items:
- Type icon + name
- Close button
- Active indicator

---

## Center: Active Space Content

The center area displays the content of the **currently selected space**:

- **Session space**: Shows the terminal + workspace (same as current `AppWorkspace`)
- **Terminal space**: Shows just the terminal (xterm)
- **Whiteboard space**: Shows `ExcalidrawBoard` inline (not as overlay)
- **Doc space**: Shows a document viewer/editor
- **Board space**: Could be inline or stays as overlay (Phase 2 decision)

The center area remains exactly as-is for session/terminal spaces. The only change is that whiteboard and doc are now rendered inline here instead of as overlays.

---

## What Stays the Same

- **Project Tab Bar**: Unchanged, stays at top.
- **All Maestro panel internal logic**: Tasks, team, skills, lists — same components, same state management, same filters, same drag-and-drop. Just relocated.
- **Session item components**: Same `SessionsSection` items with all their logic (team grouping, status, avatars, expand/collapse, logs). Just relocated to the right.
- **AppWorkspace / Terminal rendering**: Unchanged center content.
- **All stores**: No changes to Zustand stores (maybe minor additions for space type tracking).
- **Backend/Server**: Zero changes.
- **Styling system**: Same CSS variables, same themes.

---

## What Changes

| Component | Current | New |
|-----------|---------|-----|
| `App.tsx` layout | Sidebar(left) + Terminal(center) + MaestroPanel(right) | IconRail+MaestroSidebar(left) + ActiveSpace(center) + SpacesPanel(right) |
| `PanelIconBar` | Horizontal tabs at top of Maestro panel | Vertical icon rail on far left edge |
| `SessionsSection` | Left sidebar | Right side, becomes `SpacesPanel` |
| `QuickPromptsSection` | Left sidebar | **Removed** |
| `AppRightPanel` | Wraps MaestroPanel on right | Wraps SpacesPanel on right |
| `ExcalidrawBoard` | Full-screen overlay | Inline in center as a space |
| `FileExplorerPanel` | Inside right panel | Inside left panel (icon rail item) |
| Mobile responsive | 3-panel switcher | Not supported for now |

---

## Phase 1: Layout Swap (Core Restructure)

**Goal**: Move Maestro panel left, Sessions panel right. Icon rail. Collapsible sidebar. Everything functional.

### Tasks:

1. **Create `IconRail` component**
   - Vertical column of icon buttons (~48px wide)
   - Icons: Tasks, Members, Teams, Skills, Lists, Files, Whiteboard
   - Active state indicator (highlight bar or background)
   - Click toggles expand/collapse of sidebar
   - Always visible

2. **Create `AppLeftPanel` component** (replaces left `<aside>` sidebar)
   - Contains `IconRail` + expanded content area side by side
   - Expanded content renders: MaestroPanel sections (Tasks/Members/Teams/Skills/Lists) or FileExplorer
   - Collapsible: when collapsed, only IconRail is visible
   - Resize handle on right edge

3. **Refactor `PanelIconBar`**
   - Split horizontal tabs into vertical icon rail items
   - Sub-tabs (Current/Pinned/Completed) remain as horizontal tabs inside the expanded content
   - Team tab splits into two icon rail items: Members and Teams

4. **Create `SpacesPanel` component** (replaces `SessionsSection` on right)
   - Vertical list of spaces (sessions + other types)
   - Reuses existing `SessionsSection` session item components and all their logic
   - Adds space type differentiation (icon per type)
   - New space toolbar at top with quick-create buttons

5. **Restructure `App.tsx` layout**
   - Left: `<AppLeftPanel>` (icon rail + maestro sidebar)
   - Center: `<main>` active space content
   - Right: `<SpacesPanel>` (with resize handle)
   - Remove `QuickPromptsSection`
   - Remove mobile responsive panel switcher (for now)

6. **Update resize logic**
   - Left panel: resize handle between expanded sidebar and center
   - Right panel: resize handle between center and spaces panel
   - When left sidebar collapsed, handle disappears, center expands

7. **Update CSS**
   - New layout grid/flex rules
   - Icon rail styles (narrow column, icon sizing, active indicators)
   - Collapsed/expanded transition animations
   - Adjust existing panel styles to work in new positions

### Phase 1 Deliverables:
- Maestro panel fully functional on the left with icon rail navigation
- Sessions panel fully functional on the right as Spaces panel
- Collapsible left sidebar
- All existing functionality preserved (tasks, team, sessions, drag-drop, etc.)
- Only session-type spaces exist (other types are Phase 2)

---

## Phase 2: New Space Types + Polish

**Goal**: Add non-session space types, whiteboard-as-space, doc-as-space, new space toolbar.

### Tasks:

1. **Space type system**
   - Define `SpaceType` union: `"session" | "terminal" | "whiteboard" | "doc"`
   - Extend session store or create a new spaces store to track non-session spaces
   - Each space has: `id`, `type`, `name`, `active` flag

2. **New space toolbar**
   - Row of icon buttons at top of SpacesPanel
   - Terminal, Doc, Whiteboard, Claude, Codex, Refresh, Board
   - Each button creates the corresponding space type

3. **Whiteboard as space**
   - `ExcalidrawBoard` renders inline in center when a whiteboard space is active
   - Support multiple whiteboards (each is a separate space)
   - Remove full-screen overlay behavior (or keep as fallback)
   - `Cmd+Shift+X` creates/focuses a whiteboard space

4. **Doc as space**
   - Doc viewer/editor renders in center when a doc space is active
   - Created when clicking a doc from task details, or from the + menu
   - Basic markdown/text rendering

5. **Terminal as space (raw)**
   - A terminal-only space without maestro session overhead
   - Uses existing xterm terminal component

6. **Task filter improvements**
   - Enhance task filters in the left panel
   - Better filter UI suited to the vertical sidebar layout

7. **Polish & transitions**
   - Smooth expand/collapse animations for left sidebar
   - Space switching transitions
   - Icon rail hover tooltips
   - Keyboard shortcuts for navigating spaces

---

## File Impact Summary

### New Files (Phase 1):
- `src/components/IconRail.tsx` — Vertical icon navigation
- `src/components/AppLeftPanel.tsx` — Left panel wrapper (icon rail + expanded content)
- `src/components/SpacesPanel.tsx` — Right panel spaces list

### Modified Files (Phase 1):
- `src/App.tsx` — Major layout restructure
- `src/components/maestro/MaestroPanel.tsx` — Remove PanelIconBar integration, accept activeSection prop
- `src/components/maestro/PanelIconBar.tsx` — Deprecated / refactored into IconRail
- `src/components/AppRightPanel.tsx` — Repurposed to wrap SpacesPanel instead of MaestroPanel
- `src/components/SessionsSection.tsx` — Reused inside SpacesPanel with minimal changes
- `src/stores/useUIStore.ts` — Add icon rail state, collapse state, active icon
- `src/styles.css` — New layout rules, icon rail styles
- `src/hooks/useAppLayoutResizing.ts` — Adjust for new panel positions

### Removed/Deprecated (Phase 1):
- `QuickPromptsSection` usage removed from App.tsx
- Mobile responsive panel switcher removed (for now)

### New Files (Phase 2):
- `src/stores/useSpacesStore.ts` — Space type tracking
- `src/components/DocSpace.tsx` — Document viewer space
- `src/components/SpaceToolbar.tsx` — New space creation toolbar

---

## Open Decisions (to revisit)

1. **Icon style**: Reuse existing SVG icons from PanelIconBar, or switch to a library (Lucide)?
2. **Board**: Keep as overlay or make it a space type?
3. **Icon rail width**: ~40px or ~48px?
4. **Expanded sidebar default width**: Reuse current sidebar width defaults (~250px)?
5. **Keyboard shortcuts**: `Cmd+B` for collapse, `Cmd+1-7` for icon rail items?
