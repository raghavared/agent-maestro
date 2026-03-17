# Performance Audit: CSS & Rendering

**Scope**: `styles-docs-v2.css`, `styles-excalidraw.css`, `styles-maestro-sessions-v2.css`, `styles-sidebar-redesign.css`, `styles-terminal-theme.css`, `MermaidDiagram.tsx`, `DocViewer.tsx`

---

## 1. CSS Volume & Fragmentation

**Total CSS**: ~27,097 lines across ~40 CSS files (all loaded eagerly via imports).

| File | Lines |
|------|-------|
| styles-inline-priority-picker.css | 2,418 |
| styles-maestro-sessions-v2.css | 2,011 |
| styles-sessions.css | 1,405 |
| styles-spaces-panel.css | 1,343 |
| styles-terminal-theme.css | 1,276 |
| styles-maestro-panel.css | 1,135 |
| styles-docs-v2.css | 968 |
| styles-excalidraw.css | 818 |
| styles-sidebar-redesign.css | 427 |

**Impact**: All CSS is bundled and parsed at startup regardless of which views are active. The inline-priority-picker alone is 2,418 lines for what is a small UI component.

**Recommendation**: Code-split CSS by lazy-loading stylesheets with their associated components. Use Vite's CSS code-splitting (dynamic `import()` of component files that include their CSS).

---

## 2. `transition: all` Overuse (HIGH)

**Count**: **150+ instances** of `transition: all` across the codebase.

In the audited files alone:
- `styles-terminal-theme.css`: 10 instances
- `styles-docs-v2.css`: 9 instances
- `styles-excalidraw.css`: 3 instances
- `styles-maestro-sessions-v2.css`: 9 instances
- `styles-sidebar-redesign.css`: 2 instances

**Why it's expensive**: `transition: all` forces the browser to check *every* animatable property on every frame, including layout-triggering properties (`width`, `height`, `margin`, `padding`). Even when only `background` or `border-color` changes, the browser must evaluate all properties.

**Examples**:
```css
/* styles-terminal-theme.css:102 */
.sidebar .btnSmall { transition: all 0.2s ease; }
/* Only background, border-color, color, box-shadow actually change on hover */

/* styles-terminal-theme.css:618 */
.terminalTaskGroup { transition: all 0.2s ease; }
/* Only border-color and box-shadow change */
```

**Fix**: Replace with explicit property lists:
```css
.sidebar .btnSmall { transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
```

---

## 3. Expensive Animations (MEDIUM-HIGH)

### 3a. Scanline Animation — Continuous Transform on Large Element

```css
/* styles-terminal-theme.css:37-63 */
.maestroPanel.terminalTheme::before {
  /* Full-panel pseudo-element with repeating gradient */
  animation: scanlineMove 8s linear infinite;
}
@keyframes scanlineMove {
  0% { transform: translateY(0); }
  100% { transform: translateY(100%); }
}
```

**Impact**: This runs *continuously* on a pseudo-element covering the entire Maestro panel. Although `transform` is GPU-composited, the element spans potentially thousands of pixels. The pseudo-element lacks `will-change: transform` and `contain: strict`, so the browser may not promote it to its own compositor layer, causing it to repaint with the parent.

**Fix**: Add `will-change: transform; contain: strict;` to the pseudo-element, or consider using CSS `@media (prefers-reduced-motion)` to disable it. Better yet, use a static scanline pattern since the animation is very subtle (opacity: 0.15).

### 3b. Multiple Concurrent Infinite Animations

**Count**: **40+ elements** with `animation: ... infinite` across all CSS files.

Notable concurrent animations in the audited files:
- `pulseGlow` on `.terminalPromptSymbol` (2s, every panel)
- `statusPulse` on every in-progress/blocked task status icon
- `taskBoardPulse` on in-progress column dots and session dots
- `cursorBlink` on terminal cursor elements
- `blinkAlert` on disconnected indicators
- `errorPulse` on error banners (animates `box-shadow`)
- `terminalDotPulse` on loading spinner dots
- `mermaidSpin` on diagram loading spinners

**Impact**: When a project has many tasks in-progress or blocked, dozens of `statusPulse` animations run simultaneously. Each triggers repaints. The `errorPulse` animation is particularly bad because it animates `box-shadow`, which triggers paint on every frame.

**Fix**:
- Use `opacity` animations instead of `box-shadow`/`text-shadow` animations
- Batch similar animations to reduce unique animation timelines
- Use `animation-play-state: paused` for off-screen elements via Intersection Observer
- Consider `content-visibility: auto` on task rows (already partially implemented)

### 3c. `text-shadow` with Glow Effects

Multiple elements use `text-shadow: 0 0 Xpx color` for glow effects, which triggers paint:
```css
.terminalStatus--in_progress { text-shadow: 0 0 8px var(--terminal-cyan); }
.terminalStatus--completed { text-shadow: 0 0 6px var(--terminal-green); }
.terminalStatActive { text-shadow: 0 0 6px var(--terminal-cyan); }
```

These are static (not animated) so the paint cost is one-time, but they increase initial paint time for task lists with many items.

---

## 4. Expensive CSS Selectors (MEDIUM)

### 4a. `:has()` with Deep Matching

```css
/* styles-terminal-theme.css:748 */
.terminalTaskList:has(.terminalTaskRow--dropdownOpen)
  .terminalTaskRow:not(.terminalTaskRow--dropdownOpen):hover { ... }
```

**Impact**: `:has()` is a live relational selector. The browser must re-evaluate this on every DOM mutation inside `.terminalTaskList`. With many task rows, this can cause style recalculation spikes.

**Fix**: Use a class on the parent `.terminalTaskList` toggled via JS (e.g., `.terminalTaskList--hasOpenDropdown`) instead of `:has()`.

### 4b. Universal Selector with `body.dragging-active`

```css
/* styles-excalidraw.css:284-289 */
body.dragging-active,
body.dragging-active * {
  cursor: grabbing !important;
  user-select: none !important;
}
```

**Impact**: `body.dragging-active *` matches every single element in the DOM. When the class is toggled, the browser must restyle the entire document tree.

**Fix**: Apply `cursor: grabbing` only to `body.dragging-active` (cursor inherits) and use a more targeted selector for `user-select`.

### 4c. `.sidebar > *` z-index Override

```css
/* styles-sidebar-redesign.css:76-79 */
.sidebar > * {
  position: relative;
  z-index: 3;
}
```

**Impact**: Forces `position: relative` and creates new stacking contexts for all direct children of sidebar. This is needed for the scanline overlay approach, but creates unnecessary compositor layers.

---

## 5. `backdrop-filter` Usage (MEDIUM)

**Count**: ~26 instances across the codebase, including:
- `styles-docs-v2.css:649` — mermaid zoom controls
- `styles-maestro-panel.css` — 3 instances
- `styles-slide-panel.css:11` — `blur(14px) saturate(1.15)`
- `styles-spaces-panel.css:1259` — `blur(20px) saturate(180%)`
- `styles-sessions.css:838-839` — animated backdrop-filter (from blur(0) to blur(8px))

**Impact**: `backdrop-filter: blur()` is one of the most expensive CSS properties. It requires the browser to render all content behind the element, then apply a GPU blur pass. High blur radii (14px, 16px, 20px) are particularly costly. The animated backdrop-filter in styles-sessions.css is extremely expensive.

**Fix**:
- Replace with semi-transparent solid backgrounds where possible
- Reduce blur radii (4-8px is usually sufficient)
- Never animate `backdrop-filter` — use a crossfade opacity on a pre-blurred element instead

---

## 6. Layout Thrashing Patterns in JS (MEDIUM)

### 6a. `getComputedStyle` in MermaidDiagram.tsx

```tsx
// MermaidDiagram.tsx:23
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  // reads 3 CSS custom properties
}
```

Called on every diagram render via `ensureMermaidInit()`. `getComputedStyle()` forces a style recalculation. Since this reads CSS custom properties on `document.documentElement`, it invalidates the entire style tree.

**Fix**: Cache the theme colors and only recompute on theme change (already partially done with `lastMermaidTheme`, but the guard could miss rapid renders).

### 6b. Multiple `getBoundingClientRect` calls in Dropdown Positioning

Found in: `ExecutionBar.tsx`, `TaskListItem.tsx`, `SplitPlayButton.tsx`, `TeamMemberModal.tsx`, `NewSpaceDropdown.tsx`, `SessionsSection.tsx`, `ProjectsSection.tsx`, `ProjectTabBar.tsx`.

Each of these reads `getBoundingClientRect()` followed by `window.innerWidth`/`window.innerHeight`. While individually fine, they can cause layout thrashing if called in rapid succession (e.g., multiple dropdowns repositioning during a resize event).

### 6c. FLIP Animation in ProjectsSection.tsx

```tsx
// ProjectsSection.tsx:67
nextRects.set(id, item.getBoundingClientRect());
// Later: reads prevRects, computes deltas, applies transforms
```

This is a proper FLIP pattern (read-then-write), which is good. No issue here.

### 6d. ScrollHeight Reads in SessionLogModal/SessionLogStrip

```tsx
// SessionLogModal.tsx:98
isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
// SessionLogModal.tsx:105
el.scrollTop = el.scrollHeight;
```

Reading `scrollHeight` then setting `scrollTop` causes a forced reflow. This is in scroll handlers which fire frequently.

**Fix**: Use `requestAnimationFrame` to batch the read-then-write, or use `scrollTo({ top: el.scrollHeight, behavior: 'instant' })` which the browser can optimize.

---

## 7. Paint/Composite Triggers (MEDIUM)

### 7a. `box-shadow` Animations

```css
/* styles-terminal-theme.css:229-239 */
@keyframes errorPulse {
  0%, 100% { box-shadow: 0 0 0 rgba(255, 59, 59, 0.4); }
  50% { box-shadow: 0 0 12px rgba(255, 59, 59, 0.6); }
}
```

`box-shadow` changes trigger paint on every frame. This animation runs infinitely.

**Fix**: Use `outline` (doesn't trigger layout) or replace with an animated pseudo-element using `opacity`.

### 7b. Hover Transforms on Task Cards

```css
/* styles-excalidraw.css:311-318 */
.taskBoardCard:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), ...;
}
```

Combining `transform` (composite) with `box-shadow` (paint) means the hover triggers both a composite update and a repaint. In a kanban board with many cards, hovering rapidly across cards triggers many repaints.

**Fix**: Pre-promote cards with `will-change: transform` or separate the shadow into a pseudo-element.

---

## 8. `will-change` Underuse

Only **9 instances** of `will-change` in the entire codebase:
- `styles-resize.css`: 7 instances (all `will-change: width`)
- `styles-docs-v2.css:603`: 1 instance (`will-change: transform` on mermaid overlay)

**Missing `will-change`** on:
- Scanline pseudo-elements (continuous transform animation)
- Task cards during drag operations
- Slide panel transitions
- Any element with `backdrop-filter`

**Recommendation**: Add `will-change` judiciously to:
1. Elements with continuous animations (scanlines)
2. Elements that will be dragged (task cards, during drag only)
3. Do NOT add `will-change` to idle elements — it wastes GPU memory

---

## 9. Content Containment (GOOD — Partial)

Good usage of CSS containment found:
- `styles-docs-v2.css:9` — `.docsListGrid { contain: content; }`
- `styles-terminal-theme.css:593` — `.terminalTaskList { contain: content; }`
- `styles-excalidraw.css:265` — `.taskBoardColumnBody { contain: content; }`
- `styles-sidebar-redesign.css:175` — `.sessionList { contain: content; }`
- `styles-maestro-panel.css:20` — `.maestroPanel { contain: layout style paint; }`
- `content-visibility: auto` on `.docsListCard` and `.terminalTaskRow`

**Gap**: No containment on:
- Individual task cards (`.taskBoardCard`)
- Session board columns
- Modal overlays

---

## 10. MermaidDiagram.tsx Rendering (MEDIUM)

### 10a. `dangerouslySetInnerHTML` SVG Injection

The component injects mermaid SVGs via `dangerouslySetInnerHTML`. This bypasses React's virtual DOM and forces the browser to parse and render raw SVG on every render. The SVG is sanitized via DOMPurify, which is correct for security.

**Good**: SVG caching (`svgCache` with LRU eviction at 50 entries) prevents re-rendering the same diagram.

**Issue**: When the zoom overlay opens, the same SVG is injected a *second time* into the overlay DOM. This duplicates potentially large SVG trees.

**Fix**: Consider using a React portal to move the existing SVG into the overlay rather than duplicating it.

### 10b. Event Listeners in Effect Without Stable Refs

```tsx
// MermaidDiagram.tsx:111-126
useEffect(() => {
  if (!isZoomed) return;
  el.addEventListener("wheel", handleWheel, { passive: false });
  return () => el.removeEventListener("wheel", handleWheel);
}, [isZoomed]);
```

The `{ passive: false }` on wheel events prevents scroll optimizations. This is necessary for ctrl+wheel zoom, but should be limited to the overlay only (which it is).

---

## 11. DocViewer.tsx Rendering (LOW)

### 11a. ReactMarkdown Rerenders

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
  {doc.content}
</ReactMarkdown>
```

`remarkPlugins={[remarkGfm]}` creates a new array on every render, which triggers ReactMarkdown to re-parse. The `markdownComponents` object is defined outside the component (good), but `remarkPlugins` should be memoized.

**Fix**: Move `[remarkGfm]` to a module-level constant:
```tsx
const REMARK_PLUGINS = [remarkGfm];
```

### 11b. Lazy MermaidDiagram

Good: `MermaidDiagram` is lazy-loaded via `React.lazy()`, so the mermaid library (~800KB) is only loaded when a markdown doc contains a diagram.

---

## Summary: Priority Actions

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| HIGH | Replace `transition: all` with explicit properties | Reduces style recalc on every hover/interaction | Low (mechanical) |
| HIGH | Remove/simplify scanline animation | Eliminates continuous full-panel repaint | Low |
| HIGH | Fix `box-shadow` animations → use opacity | Eliminates per-frame paint in infinite animations | Low |
| MEDIUM | Replace `:has()` selector with JS class toggle | Reduces style recalculation scope | Low |
| MEDIUM | Replace `body.dragging-active *` with inheritance | Eliminates full-tree restyle on drag | Low |
| MEDIUM | Reduce/eliminate animated `backdrop-filter` | Eliminates extremely expensive blur animation | Low |
| MEDIUM | Batch scroll reads in SessionLogModal | Prevents forced reflow in scroll handlers | Low |
| MEDIUM | Add `will-change` to animated pseudo-elements | Promotes to compositor layer, avoids repaints | Low |
| LOW | Memoize remarkPlugins array in DocViewer | Prevents unnecessary markdown re-parsing | Trivial |
| LOW | Use portal for MermaidDiagram zoom overlay | Avoids duplicating large SVG trees | Medium |
| LOW | CSS code-splitting for large stylesheets | Reduces initial parse time | High |
