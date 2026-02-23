# Maestro UI Performance Analysis: Panel Rendering & Terminal Resizing

## Overview

Analysis of laggy left panel (MaestroPanel) open/close and terminal resize performance in the Maestro UI app.

---

## Critical Issues

### 1. MaestroPanel Mounts/Unmounts on Every Toggle

**File:** `src/components/AppLeftPanel.tsx:127-157`

**Problem:** The MaestroPanel is conditionally rendered with `{isExpanded && (<MaestroPanel />)}`. Every toggle causes a full mount/unmount cycle of a massive component (~1100 lines) with 25+ useState calls, 10+ useMemo computations, 6+ useEffect hooks (including API calls), and multiple Zustand store subscriptions.

**Impact:** ~100ms+ delay on every panel open.

**Fix:** Keep MaestroPanel always mounted, hide with CSS (`display: none` when collapsed):

```tsx
<div
    className="appLeftPanelContent"
    style={{
        width: `${maestroSidebarWidth}px`,
        display: isExpanded ? undefined : 'none',
    }}
>
    {activeProject && (
        <MaestroPanel isOpen={isExpanded} ... />
    )}
</div>
```

---

### 2. CSS `width` Transitions Trigger Full Layout Reflow

**File:** `src/styles.css:1448-1456, 1476-1484`

**Problem:** Both `.appLeftPanel` and `.spacesPanel` have `transition: width 0.15s ease`. Animating `width` triggers layout recalculation on every frame across the entire flex row: left panel + main area + right panel. The terminal (xterm.js) inside `.main` gets resized on every animation frame.

**Impact:** Layout thrashing for 150ms on every open/close.

**Fix Option A (simplest):** Remove transitions entirely — instant open/close feels snappier than a laggy animation:

```css
.appLeftPanel {
    /* Remove: transition: width 0.15s ease; */
}
.spacesPanel {
    /* Remove: transition: width 0.15s ease; */
}
```

**Fix Option B (smooth + performant):** Use `transform: translateX()` for GPU-composited animation that doesn't trigger layout.

---

### 3. Terminal Resize Storm During Panel Transitions

**Problem:** During the 150ms width transition, xterm.js's ResizeObserver fires on every frame. Each resize recalculates character grid dimensions, potentially re-renders the terminal buffer, and sends a PTY resize signal to the backend.

**Fix:** Debounce terminal `fit()` to only fire after transition ends (use `transitionend` event). During transition, set `pointer-events: none` on `.terminalPane`.

---

## Secondary Issues

### 4. App.tsx Subscribes to Too Many Store Slices

**File:** `src/App.tsx:160-167`

**Problem:** App.tsx subscribes to `iconRailActiveSection`, `maestroSidebarWidth`, `rightPanelWidth`, `spacesRailActiveSection` from useUIStore. Any change re-renders the entire ~600-line App component and its full tree.

**Fix:** Move width subscriptions out of App.tsx into the resize handle components or use refs.

### 5. Inline Callbacks in App.tsx

**File:** `src/App.tsx:429-541`

**Problem:** ~15 inline arrow functions passed as props to SpacesPanel and ProjectTabBar create new references every render, causing unnecessary child re-renders.

**Fix:** Wrap in `useCallback`.

### 6. Resize Handler Dependencies Include Width

**File:** `src/hooks/useAppLayoutResizing.ts:83`

**Problem:** `handleMaestroSidebarResizePointerDown` has `maestroSidebarWidth` in its dependency array. After every resize, the callback is recreated, triggering re-renders in App.tsx.

**Fix:** Use a ref for the width value inside the callback.

---

## Quick Wins Ranked by Impact

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| 1 | Keep MaestroPanel mounted (hide with CSS) | **Huge** | Low |
| 2 | Remove `transition: width` from panels | **Huge** | Trivial |
| 3 | Add `contain: strict` to panels | **Medium** | Trivial |
| 4 | Move width subscriptions out of App.tsx | **Medium** | Low |
| 5 | Memoize inline callbacks in App.tsx | **Medium** | Low |
| 6 | Use ref for width in resize handlers | **Small** | Trivial |

**Fixes #1 and #2 combined should make panel open/close feel instant and smooth.**
