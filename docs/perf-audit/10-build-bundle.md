# Perf Audit #10: Build, Bundle & Code Splitting

## Executive Summary

The maestro-ui build produces **~12+ MB of uncompressed JavaScript** across ~150 chunks. The `manualChunks` strategy correctly isolates heavy vendor libraries (monaco, excalidraw, mermaid, recharts, xterm), and `React.lazy()` is used for the heaviest components. However, the **main entry chunk is 772 KB** — far too large for initial load — and several optimization opportunities remain.

---

## 1. Build Output Analysis

### Chunk Size Breakdown (Top Offenders)

| Chunk | Size (KB) | Status |
|-------|-----------|--------|
| `vendor-monaco` | 3,787 | Lazy-loaded via `LazyCodeEditorPanel` |
| `subset-shared.chunk` (excalidraw internals) | 1,823 | Lazy-loaded via `LazyExcalidrawBoard` |
| `flowchart-elk-definition` (mermaid ELK) | 1,448 | Lazy-loaded via `LazyMermaidDiagram` |
| `vendor-excalidraw` | 1,129 | Lazy-loaded via `LazyExcalidrawBoard` |
| **`index` (main app chunk)** | **772** | **Eagerly loaded — TOO LARGE** |
| `vendor-mermaid` | 471 | Lazy-loaded via `LazyMermaidDiagram` |
| `cytoscape.esm` (mermaid dep) | 442 | Lazy-loaded (mermaid sub-dep) |
| `vendor-recharts` | 401 | Lazy-loaded (inside `LazyBoard` → `Dashboard`) |
| `treemap` (mermaid sub-diagram) | 374 | Lazy-loaded |
| `vendor-xterm` | 282 | **Eagerly loaded** |
| `katex` (markdown math) | 262 | Lazy-loaded (markdown sub-dep) |
| `index` (secondary) | 194 | Eagerly loaded |
| `vendor-dnd` | 187 | **Eagerly loaded** |
| `vendor-markdown` | 157 | Lazy-loaded via `LazyDocViewer` |

### Total Initial Load (Eager)

Estimated **~1,150+ KB** of JavaScript before a user sees the app:
- Main index chunk: 772 KB
- Secondary index: 194 KB
- vendor-xterm: 282 KB (via `SessionTerminal` → `AppWorkspace`)
- vendor-dnd: 187 KB (DnD Kit used in task lists in sidebar)
- vendor-react: ~140 KB (react + react-dom)

---

## 2. Current Code Splitting (What's Working Well)

### Lazy-Loaded Components (via `React.lazy`)

**In `App.tsx`:**
- `LazyCommandPalette` — CommandPalette (good, rarely used)
- `LazyBoard` — MultiProjectBoard (good, includes Dashboard + recharts)
- `LazyTeamView` — TeamView (good, only on team drill-down)

**In `AppWorkspace.tsx`:**
- `LazyExcalidrawBoard` — Excalidraw whiteboard (good, 1.1 MB + 1.8 MB shared)
- `LazyDocViewer` — DocViewer with markdown (good, includes react-markdown + remark-gfm)
- `LazyCodeEditorPanel` — Monaco code editor (good, 3.7 MB)
- `LazyMermaidDiagram` — Mermaid diagrams (good, 471 KB + sub-deps)

**In `DocViewer.tsx`:**
- `LazyMermaidDiagram` — nested lazy inside already-lazy DocViewer (good double-gate)

### `manualChunks` Configuration

The `vite.config.ts` correctly separates:
- `vendor-react` (react, react-dom)
- `vendor-monaco` (monaco-editor, @monaco-editor/react)
- `vendor-excalidraw` (@excalidraw/excalidraw)
- `vendor-mermaid` (mermaid)
- `vendor-recharts` (recharts)
- `vendor-xterm` (xterm, xterm-addon-fit)
- `vendor-markdown` (react-markdown, remark-gfm)
- `vendor-dnd` (@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities)

---

## 3. Issues Found

### ISSUE 10-1: Main Index Chunk is 772 KB (HIGH)
**File:** `vite.config.ts`, `App.tsx`

The main entry bundle contains ALL eagerly-imported application code. This includes:
- All Zustand stores (~15 stores initialized at import)
- `SessionTerminal.tsx` (pulls in xterm)
- `AppModals.tsx` (imports 18 modal components eagerly)
- `AppLeftPanel.tsx` (MaestroPanel + all sidebar components)
- `AppWorkspace.tsx` (terminal management)
- `SpacesPanel`, `ProjectTabBar`, `PromptSendAnimationLayer`
- `soundManager.ts` (1,038 lines, singleton eagerly initialized)
- `buildTeamGroups` utility, `createMaestroSession` service
- All hooks (`useKeyboardShortcuts`, `useAppLayoutResizing`, etc.)

**Impact:** Slow initial page load. User must download and parse 772 KB before seeing anything.

### ISSUE 10-2: AppModals is Eagerly Loaded with 18 Modal Imports (HIGH)
**File:** `src/components/app/AppModals.tsx`

`AppModals` eagerly imports every modal in the app:
- `NewSessionModal`, `ProjectModal`, `SshManagerModal`, `PathPickerModal`
- `PersistentSessionsModal`, `ManageTerminalsModal`, `AgentShortcutsModal`
- `ConfirmDeleteProjectModal`, `ConfirmDeleteRecordingModal`
- `ApplyAssetModal`, `SecureStorageModal`, `StartRecordingModal`
- `RecordingsListModal`, `ReplayModal`, `AgentModalViewer`
- Multiple `ConfirmActionModal` instances

Most of these modals are opened rarely (SSH manager, recordings, secure storage, path picker). All their code is bundled into the main chunk.

**Recommendation:** Lazy-load infrequently-used modals:
```tsx
const LazySshManagerModal = React.lazy(() => import("../modals/SshManagerModal"));
const LazyRecordingsListModal = React.lazy(() => import("../modals/RecordingsListModal"));
const LazyReplayModal = React.lazy(() => import("../modals/ReplayModal"));
const LazySecureStorageModal = React.lazy(() => import("../modals/SecureStorageModal"));
// etc.
```

### ISSUE 10-3: xterm Eagerly Loaded (282 KB) (MEDIUM)
**File:** `src/SessionTerminal.tsx`, `src/main.tsx`

`xterm` is imported at top level in `SessionTerminal.tsx`:
```tsx
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
```
And its CSS in `main.tsx`:
```tsx
import "xterm/css/xterm.css";
```

While terminals are core functionality, the initial render often doesn't need a terminal immediately (e.g., startup settings overlay, empty project state). The 282 KB xterm vendor chunk loads before the user even creates a session.

**Recommendation:** Lazy-load `SessionTerminal` since it's only rendered inside `AppWorkspace` when sessions exist. The empty-state check is already in place.

### ISSUE 10-4: vendor-dnd Eagerly Loaded (187 KB) (MEDIUM)
**File:** Multiple components

`@dnd-kit` is used for sortable task lists and session reordering. It's 187 KB. While DnD is used in the sidebar, it's not needed on first render.

**Recommendation:** Consider lazy-loading the DnD-enabled components (sortable lists) or using a lighter DnD solution for simple reordering.

### ISSUE 10-5: soundManager.ts Singleton Eagerly Initialized (LOW)
**File:** `src/services/soundManager.ts`

The `SoundManager` class (1,038 lines) is instantiated at module load:
```tsx
export const soundManager = SoundManager.getInstance();
```

It reads from localStorage and sets up configuration on import. The `preloadSounds()` method creates `HTMLAudioElement` instances eagerly. While the source is mostly data tables (note mappings) and doesn't pull in heavy deps, the singleton pattern forces initialization even when sounds are disabled.

**Recommendation:** Defer instantiation with a lazy getter:
```tsx
let _instance: SoundManager | null = null;
export function getSoundManager(): SoundManager {
  if (!_instance) _instance = new SoundManager();
  return _instance;
}
```

### ISSUE 10-6: recharts in manualChunks but Not Used Directly (LOW)
**File:** `vite.config.ts`

`recharts` (401 KB) is listed in `manualChunks` as `vendor-recharts`. It's only imported in `Dashboard.tsx`, which is imported by `MultiProjectBoard.tsx`, which is already lazy-loaded via `LazyBoard`. The manual chunk is technically redundant since Rollup would auto-split it anyway, but it doesn't hurt.

**No action needed** — just noting that the manual chunk is unnecessary for already-lazy-loaded deps.

### ISSUE 10-7: All CSS Loaded Eagerly (50+ files) (LOW)
**File:** `src/styles.css`

The main `styles.css` imports 50+ CSS files via `@import`, including:
- `styles-excalidraw.css` — only needed when whiteboard is open
- `styles-dashboard.css` — only needed for Dashboard
- `styles-multi-project-board.css` — only needed for multi-project board
- `styles-ssh-modal.css` — only needed when SSH modal is open
- `styles-create-task-modal.css` — only needed when creating tasks

All CSS is bundled into a single file loaded upfront. For a Tauri desktop app this is less impactful than web (local file load), but it still adds to initial parse time.

**Recommendation:** Move component-specific CSS to co-located imports inside lazy-loaded components. Vite supports CSS code splitting natively when CSS is imported inside lazy components.

### ISSUE 10-8: Missing `optimizeDeps` Configuration (LOW)
**File:** `vite.config.ts`

No `optimizeDeps` configuration for Vite's dev-mode pre-bundling. Large libraries like mermaid, excalidraw, and monaco have many internal modules that benefit from explicit `include`:

```ts
optimizeDeps: {
  include: ['react', 'react-dom', 'zustand'],
  exclude: ['@excalidraw/excalidraw'], // has ESM issues with pre-bundling
}
```

This primarily affects dev-mode cold start speed, not production builds.

### ISSUE 10-9: No Compression Plugin (INFO)
**File:** `vite.config.ts`

The build doesn't use `vite-plugin-compression` for pre-compressing assets with gzip/brotli. For a Tauri desktop app served from local filesystem, this isn't needed. But if assets are ever served over a network (e.g., remote dev), pre-compression would help.

`reportCompressedSize: false` is correctly set to speed up builds.

---

## 4. Dependency Weight Analysis

### Heavy Dependencies (npm sizes, approximate)

| Package | Approx Size | Used In | Lazy? |
|---------|-------------|---------|-------|
| `monaco-editor` | ~3.8 MB | CodeEditorPanel | Yes |
| `@excalidraw/excalidraw` | ~2.9 MB | ExcalidrawBoard | Yes |
| `mermaid` | ~2.5 MB (w/ sub-deps) | MermaidDiagram | Yes |
| `recharts` | ~400 KB | Dashboard | Yes (via LazyBoard) |
| `xterm` + `xterm-addon-fit` | ~283 KB | SessionTerminal | **No** |
| `@dnd-kit/*` | ~187 KB | Various sortable lists | **No** |
| `react-markdown` + `remark-gfm` | ~157 KB | DocViewer | Yes |
| `react-dom` | ~130 KB | Core | No (expected) |
| `zustand` | ~8 KB | All stores | No (expected, tiny) |
| `fuse.js` | ~25 KB | Task search | **No** |
| `date-fns` | ~20 KB (tree-shakeable) | Dashboard, hooks | Partial |
| `dompurify` | ~15 KB | MermaidDiagram | Yes (inside lazy) |
| `react-mentions` | ~30 KB | Prompt input | **No** |

### Potential Dependency Cleanup

- `@types/react-mentions` listed as runtime dependency instead of devDependency

---

## 5. Recommendations Summary (Priority Order)

### P0 — High Impact
1. **Lazy-load `AppModals`** or individual infrequent modals (SSH, recordings, replay, secure storage, path picker). Could save ~50-100 KB from initial chunk.
2. **Lazy-load `SessionTerminal`** to defer xterm (282 KB) until a session is actually created.

### P1 — Medium Impact
3. **Split the main index chunk** by lazy-loading `AppLeftPanel` → `MaestroPanel` (the entire Maestro sidebar) since it's hidden when `iconRailActiveSection === null`.
4. **Lazy-load DnD components** — wrap sortable task list components with `React.lazy()` to defer the 187 KB `@dnd-kit` bundle.

### P2 — Low Impact / Housekeeping
5. **Defer `soundManager` instantiation** — lazy getter instead of eager singleton.
6. **Move feature CSS into lazy components** — excalidraw, dashboard, SSH modal styles.
7. **Add `optimizeDeps.include`** for dev-mode pre-bundling performance.
8. **Move `@types/react-mentions`** to devDependencies.

### Estimated Impact

| Action | Estimated Savings (Initial Load) |
|--------|----------------------------------|
| Lazy-load infrequent modals | ~50-100 KB |
| Lazy-load SessionTerminal/xterm | ~282 KB |
| Lazy-load MaestroPanel sidebar | ~100-150 KB |
| Lazy-load DnD components | ~187 KB |
| **Total potential** | **~620-720 KB** (~50% of current 1,150 KB initial) |

---

## 6. Vite Config Assessment

```ts
// Current config — vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2021",
    sourcemap: Boolean(process.env.TAURI_DEBUG),
    minify: process.env.TAURI_DEBUG ? false : "esbuild",
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-monaco': ['monaco-editor', '@monaco-editor/react'],
          'vendor-excalidraw': ['@excalidraw/excalidraw'],
          'vendor-mermaid': ['mermaid'],
          'vendor-recharts': ['recharts'],
          'vendor-xterm': ['xterm', 'xterm-addon-fit'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
```

**Assessment:** The `manualChunks` config is well-structured. The heavy libraries are correctly isolated. The `target: "es2021"` is appropriate for Tauri (modern Chromium). `esbuild` minification is the right default for speed.

**Missing:**
- No `build.cssCodeSplit` explicitly set (defaults to `true`, which is correct)
- No `build.modulePreload` configuration (could set `polyfill: false` for Tauri since it uses modern Chrome)
- No `optimizeDeps` for dev-mode performance
