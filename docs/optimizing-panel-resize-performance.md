# Optimizing Panel Resize Performance

This document outlines best practices for achieving smooth, 60fps panel resizing in the agents-ui three-panel layout (sidebar, terminal, right panel).

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [CSS Optimization Techniques](#css-optimization-techniques)
3. [JavaScript Optimization Patterns](#javascript-optimization-patterns)
4. [GPU Acceleration](#gpu-acceleration)
5. [React-Specific Optimizations](#react-specific-optimizations)
6. [Terminal/xterm.js Considerations](#terminalxtermjs-considerations)
7. [Implementation Checklist](#implementation-checklist)

---

## Current Architecture

The app uses a three-panel flex layout:

```
┌─────────────────────────────────────────────────────────────┐
│                      Project Tab Bar                         │
├──────────┬───┬─────────────────────────┬───┬────────────────┤
│          │ ↔ │                         │ ↔ │                │
│  Sidebar │   │      Terminal/Main      │   │  Right Panel   │
│  (left)  │   │        (center)         │   │   (maestro)    │
│          │   │                         │   │                │
└──────────┴───┴─────────────────────────┴───┴────────────────┘
              ↑                           ↑
         Resize Handle              Resize Handle
```

### Current Implementation

- **Sidebar**: Fixed width via inline style, `flex-shrink: 0`
- **Main/Terminal**: `flex: 1 1 0` - takes remaining space
- **Right Panel**: Fixed width via inline style, `flex-shrink: 0`
- **Resize**: Uses CSS variables during drag to bypass React re-renders

---

## CSS Optimization Techniques

### 1. CSS Containment

The `contain` property isolates a subtree from the rest of the page, limiting layout recalculations:

```css
/* Apply to each panel */
.sidebar,
.main,
.rightPanel {
  contain: layout style;
}

/* For panels with known/fixed dimensions */
.sidebar {
  contain: strict;
  contain-intrinsic-size: 260px 100vh;
}

/* Terminal content - strictest containment */
.terminalPane {
  contain: strict;
}
```

**Containment levels:**
- `layout`: Element's internals don't affect external layout
- `style`: Counters and quotes don't escape
- `paint`: Element's content doesn't draw outside bounds
- `size`: Element can be sized without examining children
- `content`: Shorthand for `layout paint style`
- `strict`: Shorthand for `layout paint style size`

### 2. will-change Property

Apply `will-change` dynamically during resize, not statically:

```css
/* During resize only - applied via class */
:root.sidebar-resizing .sidebar {
  will-change: width;
}

:root.right-panel-resizing .rightPanel {
  will-change: width;
}

/* Remove after resize */
.sidebar,
.rightPanel {
  will-change: auto;
}
```

**Warning:** Static `will-change` on many elements increases memory usage. Only apply during actual animations.

### 3. CSS Variables for Live Updates

Using CSS variables avoids direct style manipulation and enables smooth transitions:

```css
:root {
  --sidebar-width: 260px;
  --right-panel-width: 320px;
}

/* Live variables during drag */
:root.sidebar-resizing .sidebar {
  width: var(--sidebar-width-live) !important;
  transition: none !important;
}

:root.right-panel-resizing .rightPanel {
  width: var(--right-panel-width-live) !important;
  transition: none !important;
}
```

```javascript
// Update CSS variable instead of inline style during drag
document.documentElement.style.setProperty('--sidebar-width-live', `${width}px`);
```

### 4. Disable Pointer Events During Resize

Prevent terminal from capturing events during resize:

```css
:root.sidebar-resizing .terminalPane,
:root.right-panel-resizing .terminalPane {
  pointer-events: none;
}
```

### 5. Container Queries for Responsive Content

Use container queries instead of JavaScript-based resize observation:

```css
.rightPanel {
  container-type: inline-size;
  container-name: right-panel;
}

/* Adapt content based on panel width */
@container right-panel (max-width: 300px) {
  .taskListItem {
    flex-direction: column;
  }
}

@container right-panel (max-width: 250px) {
  .taskMeta {
    display: none;
  }
}
```

---

## JavaScript Optimization Patterns

### 1. requestAnimationFrame for All DOM Updates

Never update DOM directly in event handlers:

```javascript
// BAD - multiple updates per frame
element.addEventListener('mousemove', (e) => {
  panel.style.width = e.clientX + 'px';
});

// GOOD - batched to animation frame
let rafId = null;
let pendingWidth = null;

element.addEventListener('mousemove', (e) => {
  pendingWidth = e.clientX;

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      panel.style.width = pendingWidth + 'px';
      rafId = null;
    });
  }
});
```

### 2. Document-Level Event Listeners

Attach move/up listeners to document, not the target element:

```javascript
const onResizeStart = (e) => {
  e.preventDefault();

  const startX = e.clientX;
  const startWidth = currentWidth;

  // Add to document for reliable tracking
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
};

const onPointerMove = (e) => {
  // Handle resize
};

const onPointerUp = () => {
  // Remove listeners
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerUp);
};
```

### 3. Pointer Capture for Reliable Tracking

```javascript
const onResizeStart = (e) => {
  const target = e.currentTarget;
  const pointerId = e.pointerId;

  try {
    target.setPointerCapture(pointerId);
  } catch {}

  // ... rest of handler

  const onPointerUp = () => {
    try {
      target.releasePointerCapture(pointerId);
    } catch {}
    // ... cleanup
  };
};
```

### 4. Throttling for Visual Updates

Throttle to 60fps (16ms) for smooth visual feedback:

```javascript
function throttle(fn, delay = 16) {
  let lastCall = 0;
  let timeoutId = null;

  return function(...args) {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      // Ensure final call happens
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, delay - (now - lastCall));
    }
  };
}

const updateWidth = throttle((width) => {
  document.documentElement.style.setProperty('--panel-width', `${width}px`);
}, 16);
```

### 5. Debouncing for Heavy Operations

Debounce operations that don't need real-time feedback:

```javascript
function debounce(fn, delay = 150) {
  let timeoutId = null;

  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Visual updates: throttled (fast)
const updateVisual = throttle(setWidth, 16);

// State persistence: debounced (delayed)
const persistState = debounce(saveToLocalStorage, 150);

// Terminal fit: debounced (expensive)
const fitTerminal = debounce(fitAddon.fit, 100);
```

### 6. Avoiding Layout Thrashing

Never interleave reads and writes:

```javascript
// BAD - forces multiple layouts
function bad() {
  const width = element.offsetWidth;   // Read - forces layout
  element.style.width = width + 10;    // Write - invalidates layout
  const height = element.offsetHeight; // Read - forces layout again!
  element.style.height = height + 10;  // Write - invalidates layout
}

// GOOD - batch reads, then batch writes
function good() {
  // Batch all reads
  const width = element.offsetWidth;
  const height = element.offsetHeight;

  // Batch all writes in RAF
  requestAnimationFrame(() => {
    element.style.width = `${width + 10}px`;
    element.style.height = `${height + 10}px`;
  });
}
```

---

## GPU Acceleration

### 1. Force Compositing Layer

For elements that will animate:

```css
.panel {
  /* Creates GPU layer */
  transform: translateZ(0);
  /* or */
  transform: translate3d(0, 0, 0);

  /* Prevents flickering */
  backface-visibility: hidden;
}
```

**Warning:** Don't apply to all elements - increases memory usage.

### 2. GPU-Accelerated Properties

Only these properties can be fully GPU-accelerated:
- `transform` (translate, scale, rotate, skew)
- `opacity`
- `filter` (most browsers)

For resize animations, consider using `transform: scaleX()` instead of `width`:

```css
/* GPU-friendly approach for animations */
.panel {
  transform-origin: left center;
  transition: transform 0.15s ease-out;
}

.panel.collapsed {
  transform: scaleX(0.1);
}
```

### 3. Isolation for Complex Content

```css
.terminalPane {
  isolation: isolate;
  transform: translateZ(0);
}
```

---

## React-Specific Optimizations

### 1. React.memo for Panel Components

```jsx
const Panel = React.memo(function Panel({ width, children }) {
  return (
    <div style={{ width }}>
      {children}
    </div>
  );
}, (prev, next) => {
  // Only re-render if width actually changes
  return prev.width === next.width;
});
```

### 2. useCallback for Event Handlers

```jsx
const handleResize = useCallback((newWidth) => {
  // Memoized - won't cause child re-renders
  setWidth(newWidth);
}, []);
```

### 3. useDeferredValue for Heavy Content

```jsx
function ResizablePanel({ width }) {
  // Defer expensive content updates
  const deferredWidth = useDeferredValue(width);

  return (
    <div style={{ width }}>
      {/* Resize handle updates immediately */}
      <ResizeHandle />

      {/* Heavy content uses deferred value */}
      <HeavyContent width={deferredWidth} />
    </div>
  );
}
```

### 4. useTransition for Non-Blocking Updates

```jsx
function PanelLayout() {
  const [width, setWidth] = useState(300);
  const [isPending, startTransition] = useTransition();

  const handleResize = (newWidth) => {
    // Immediate visual update
    setWidth(newWidth);

    // Defer heavy state updates
    startTransition(() => {
      updateContent(newWidth);
    });
  };

  return (
    <div className={isPending ? 'resizing' : ''}>
      <Panel width={width} onResize={handleResize} />
    </div>
  );
}
```

### 5. Custom Hook for Optimized Resize

```jsx
function useOptimizedResize(initialWidth, onResizeEnd) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const rafRef = useRef(null);
  const timeoutRef = useRef(null);

  const startResize = useCallback(() => {
    setIsResizing(true);
    document.documentElement.classList.add('panel-resizing');
  }, []);

  const resize = useCallback((newWidth) => {
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      setWidth(newWidth);
      rafRef.current = null;
    });

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onResizeEnd?.(newWidth);
    }, 150);
  }, [onResizeEnd]);

  const endResize = useCallback(() => {
    setIsResizing(false);
    document.documentElement.classList.remove('panel-resizing');
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { width, isResizing, startResize, resize, endResize };
}
```

---

## Terminal/xterm.js Considerations

### 1. Debounced FitAddon

The `fit()` method is expensive. Always debounce:

```javascript
class TerminalManager {
  constructor(container) {
    this.terminal = new Terminal();
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Debounce fit calls - 100ms recommended
    this.debouncedFit = debounce(() => {
      this.fitAddon.fit();
    }, 100);
  }

  handleContainerResize() {
    this.debouncedFit();
  }
}
```

### 2. ResizeObserver Instead of Window Resize

```javascript
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    debouncedFit();
  }
});

resizeObserver.observe(terminalContainer);
```

### 3. Separate Visual from PTY Resize

```javascript
// Visual resize - throttled (fast feedback)
const visualResize = throttle(() => {
  fitAddon.fit();
}, 50);

// PTY resize - debounced (only final dimensions matter)
const ptyResize = debounce(() => {
  const { cols, rows } = terminal;
  ptyProcess.resize(cols, rows);
}, 150);

function handleResize() {
  visualResize();
  ptyResize();
}
```

### 4. CSS for Terminal Container

```css
.terminalPane {
  /* Strictest containment */
  contain: strict;

  /* Prevent content from affecting layout */
  overflow: hidden;

  /* GPU acceleration */
  transform: translateZ(0);
}

/* During resize - reduce terminal work */
:root.panel-resizing .terminalPane {
  pointer-events: none;
}
```

---

## Implementation Checklist

### CSS

- [ ] Add `contain: layout style` to all panels
- [ ] Add `contain: strict` to terminal pane
- [ ] Use CSS variables for live width during drag
- [ ] Apply `will-change` dynamically via classes
- [ ] Disable `pointer-events` on terminal during resize
- [ ] Add `transition: none` during resize
- [ ] Use container queries for responsive content
- [ ] Create GPU layers with `transform: translateZ(0)` on animating elements

### JavaScript

- [ ] Use `requestAnimationFrame` for all DOM updates
- [ ] Attach event listeners to `document`, not target
- [ ] Use pointer capture for reliable tracking
- [ ] Throttle visual updates to 16ms (60fps)
- [ ] Debounce state persistence (150ms)
- [ ] Debounce terminal fit (100ms)
- [ ] Batch DOM reads and writes to avoid layout thrashing
- [ ] Track pointer ID for multi-touch safety

### React

- [ ] Wrap panel components in `React.memo`
- [ ] Use `useCallback` for all event handlers
- [ ] Consider `useDeferredValue` for heavy child content
- [ ] Consider `useTransition` for non-critical updates

### Testing

- [ ] Profile with Chrome DevTools Performance tab
- [ ] Check for layout thrashing (forced reflows)
- [ ] Verify 60fps during resize
- [ ] Test with slow CPU throttling
- [ ] Test with large terminal content
- [ ] Test with many tasks in right panel

---

## Performance Profiling

Use Chrome DevTools to measure:

1. **Performance tab**: Record during resize, look for:
   - Long frames (>16ms)
   - Layout/Reflow events
   - Paint events

2. **Rendering tab**: Enable:
   - Paint flashing (highlights repaints)
   - Layout Shift Regions
   - Frame Rendering Stats

3. **Layers tab**: Check:
   - Number of compositing layers
   - Memory usage per layer

### Target Metrics

- Frame time: <16ms (60fps)
- Layout time: <4ms per frame
- Paint time: <4ms per frame
- No forced synchronous layouts

---

## References

- [CSS Containment - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)
- [will-change - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [CSS GPU Animation - Smashing Magazine](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/)
- [What Forces Layout/Reflow - Paul Irish](https://gist.github.com/paulirish/5d52fb081b3570c81e3a)
- [useDeferredValue - React Docs](https://react.dev/reference/react/useDeferredValue)
- [useTransition - React Docs](https://react.dev/reference/react/useTransition)
- [xterm-addon-fit - npm](https://www.npmjs.com/package/xterm-addon-fit)
- [Container Queries - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
