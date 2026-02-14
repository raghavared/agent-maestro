# Design Plan: Configurable Font Size & Layout Sizing

## Problem

All panels (sidebar, terminal, Maestro panel) can be too small on some screens. Users need a way to configure:
1. **Font size** — independent of layout zoom
2. **App layout scale** — overall UI density/size

Currently there is a `useZoomStore` with 4 zoom levels (small/normal/large/xlarge) that scales the root `font-size` via `--app-zoom-scale`, but:
- It is **not exposed in the Settings UI** — users cannot access it
- It only scales the root font-size; hardcoded `px` font-sizes throughout `styles.css` (~584 occurrences of `font-size`) bypass the zoom entirely
- There is no separate font-size control

## Current Architecture

### Layout Structure (`App.tsx`)
```
┌─────────────────────────────────────────────────────┐
│ ProjectTabBar (fixed top)                           │
├──────────┬──────────────────────┬───────────────────┤
│ Sidebar  │ Main (Terminal)     │ Right Panel       │
│ (fixed   │ (flex: 1)          │ (Maestro/Files)   │
│  width)  │                    │ (fixed width)     │
│ 260px    │                    │ 320px             │
│ default  │                    │ default           │
├──────────┴──────────────────────┴───────────────────┤
│ AppSlidePanel (overlay)                             │
└─────────────────────────────────────────────────────┘
```

- **Sidebar width**: Resizable via drag handle, persisted to localStorage (`STORAGE_SIDEBAR_WIDTH_KEY`), min 180px / max 800px
- **Right panel width**: Resizable via drag handle, persisted to localStorage (`STORAGE_RIGHT_PANEL_WIDTH_KEY`), min 280px / max 1000px
- **Terminal area**: Flex-grows to fill remaining space
- **Responsive mode**: Kicks in at 960px breakpoint, switches to mobile tab-based panel switching

### Existing Stores
- `useZoomStore` — Has `ZoomLevel` (small/normal/large/xlarge) with scale factors 0.875/1.0/1.125/1.25. Sets `--app-zoom-scale` CSS variable and `data-zoom` attribute on `<html>`. Persisted to `STORAGE_ZOOM_KEY`.
- `useThemeStore` — Sets `data-theme` attribute on `<html>`. Persisted to `STORAGE_THEME_KEY`.
- `useUIStore` — Manages sidebar/right-panel widths, responsive mode, etc.

### Settings UI (`ProjectTabBar.tsx` → `AppSettingsDialog`)
The app settings dialog has a sidebar with tabs: **THEME**, **SOUNDS**, **SHORTCUTS**. This is where the new controls belong.

### CSS Architecture (`styles.css`)
- Root defines `--app-zoom-scale: 1.0`
- `html { font-size: calc(16px * var(--app-zoom-scale)); }` — scales the root font size
- **Problem**: ~584 `font-size` declarations use hardcoded `px` values (10px, 11px, 12px, 13px, etc.) so they don't respond to the zoom scale at all

---

## Proposed Design

### Approach: Two Independent Controls

1. **UI Scale** (existing zoom, but exposed in settings) — Scales the overall layout proportionally
2. **Font Size** — A separate multiplier that applies to all text independently

### 1. Extend `useZoomStore` → Add Font Size

Add a `fontSizeLevel` alongside the existing `zoomLevel`:

```typescript
// useZoomStore.ts additions
export type FontSizeLevel = 'small' | 'normal' | 'large' | 'xlarge';

export const FONT_SIZE_LEVELS: FontSizeLevel[] = ['small', 'normal', 'large', 'xlarge'];

export const FONT_SIZE_CONFIG: Record<FontSizeLevel, { label: string; scale: number }> = {
  small:  { label: 'Small',       scale: 0.85 },
  normal: { label: 'Normal',      scale: 1.0  },
  large:  { label: 'Large',       scale: 1.15 },
  xlarge: { label: 'Extra Large', scale: 1.3  },
};
```

The font size level sets a new CSS variable `--font-size-scale` on `<html>`.

### 2. CSS Variable Strategy

Add a `--font-size-scale` variable and use it to make hardcoded font sizes responsive:

```css
:root {
  --app-zoom-scale: 1.0;
  --font-size-scale: 1.0;
}

html {
  font-size: calc(16px * var(--app-zoom-scale));
}
```

Then convert hardcoded `px` font sizes to use `calc()` with the font scale:

```css
/* Before */
.projectTab { font-size: 12px; }

/* After */
.projectTab { font-size: calc(12px * var(--font-size-scale)); }
```

This can be done incrementally. The key areas to convert:
- **ProjectTabBar** elements (12px, 10px, 11px)
- **Sidebar** session list items (11px, 12px, 13px)
- **MaestroPanel** task items and headers
- **Terminal** (xterm has its own font-size config)
- **Modal/dialog** text
- **Workspace** panels

### 3. Settings UI — New "Display" Tab

Add a **DISPLAY** tab to the `AppSettingsDialog` in `ProjectTabBar.tsx`:

```
Tabs: THEME | DISPLAY | SOUNDS | SHORTCUTS
```

The Display tab contains:

```
┌───────────────────────────────────────────┐
│  UI SCALE                                 │
│  ○ Small  ● Normal  ○ Large  ○ X-Large   │
│                                           │
│  FONT SIZE                                │
│  ○ Small  ● Normal  ○ Large  ○ X-Large   │
│                                           │
│  PREVIEW                                  │
│  ┌─────────────────────────────────────┐  │
│  │ The quick brown fox jumps over the  │  │
│  │ lazy dog. ABCDEFGHIJKLMNOPQR 12345  │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  [Reset to Defaults]                      │
└───────────────────────────────────────────┘
```

### 4. Implementation Components

#### A. New component: `DisplaySettings.tsx`
```typescript
// src/components/DisplaySettings.tsx
// - Radio/button group for UI Scale (reads/writes useZoomStore.zoomLevel)
// - Radio/button group for Font Size (reads/writes useZoomStore.fontSizeLevel)
// - Live preview text area
// - Reset to defaults button
```

#### B. Modify `useZoomStore.ts`
- Add `fontSizeLevel` state, `setFontSizeLevel` action
- Add `STORAGE_FONT_SIZE_KEY` constant
- `applyFontSizeToDom()` sets `--font-size-scale` on `<html>`
- Call in `initZoom()`

#### C. Modify `ProjectTabBar.tsx` → `AppSettingsDialog`
- Add `'display'` to `SettingsTab` type
- Add DISPLAY tab button
- Render `<DisplaySettings />` when active

#### D. Modify `styles.css`
- Add `--font-size-scale: 1.0` to `:root`
- Convert hardcoded `px` font-sizes to `calc(Xpx * var(--font-size-scale))` for major UI elements
- Priority areas (convert these first):
  - `.projectTab` and tab bar elements
  - `.sessionTab`, `.sessionTabLabel`
  - `.maestroPanel`, `.maestroTask` elements
  - `.quickPromptsSection` elements
  - Modal/dialog text
  - Sidebar section headers and buttons

#### E. Modify `defaults.ts`
- Add `STORAGE_FONT_SIZE_KEY = "agents-ui-font-size-v1"`

---

## Implementation Steps

### Step 1: Store Changes
1. Add `STORAGE_FONT_SIZE_KEY` to `defaults.ts`
2. Extend `useZoomStore.ts` with `fontSizeLevel`, `setFontSizeLevel`, `applyFontSizeToDom()`
3. Update `initZoom()` to also apply font size on startup

### Step 2: CSS Changes
1. Add `--font-size-scale: 1.0` to `:root` in `styles.css`
2. Convert high-priority hardcoded `font-size: Xpx` declarations to `font-size: calc(Xpx * var(--font-size-scale))`
3. Focus on the most visible UI elements first (tab bar, sidebar, panels, modals)

### Step 3: Settings UI
1. Create `DisplaySettings.tsx` component with scale/font-size selectors
2. Add "DISPLAY" tab to `AppSettingsDialog` in `ProjectTabBar.tsx`

### Step 4: Polish
1. Test all 4x4 combinations (4 zoom levels x 4 font sizes)
2. Ensure responsive mode still works properly at larger scales
3. Verify modal/dialog sizing doesn't break
4. Test terminal font rendering (xterm may need separate handling)

---

## Files to Modify

| File | Change |
|------|--------|
| `maestro-ui/src/app/constants/defaults.ts` | Add `STORAGE_FONT_SIZE_KEY` |
| `maestro-ui/src/stores/useZoomStore.ts` | Add font size level state + DOM application |
| `maestro-ui/src/styles.css` | Add `--font-size-scale` var; convert `px` font-sizes |
| `maestro-ui/src/components/ProjectTabBar.tsx` | Add DISPLAY tab to settings dialog |
| `maestro-ui/src/components/DisplaySettings.tsx` | **New file** — Display settings controls |

## Files Not Modified (by design)

- `App.tsx` — No changes needed; zoom is initialized via `initZoom()`
- `useThemeStore.ts` — Theme is independent
- `useUIStore.ts` — Panel widths are already resizable by drag; zoom handles proportional scaling

---

## Risks & Considerations

1. **px-to-calc migration**: ~584 font-size declarations. We should convert the most visible ones first (maybe ~50-80 key ones), not all at once. Low-priority ones (tooltips, tiny badges) can be converted later.

2. **Terminal font size**: xterm.js manages its own font size. The zoom store's scale won't affect terminal text. This is actually desirable — terminal font size should be a separate concern or handled by xterm's own resize logic.

3. **Layout breakpoints**: The responsive mode breakpoint (960px) uses `window.innerWidth`, which is unaffected by zoom. At higher zoom levels, the effective viewport is smaller, so responsive mode may trigger earlier — this is correct behavior.

4. **Panel minimum widths**: At large zoom + large font, the sidebar min-width (180px) might feel cramped. We could optionally scale min-widths by zoom, but this is a polish item.

5. **Persistence**: Both settings persist to localStorage independently (`STORAGE_ZOOM_KEY` and `STORAGE_FONT_SIZE_KEY`), ensuring they survive across sessions.
