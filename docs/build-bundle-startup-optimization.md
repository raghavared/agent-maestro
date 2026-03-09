# Build, Bundle & Startup Optimization Analysis

## 1. Vite Config (maestro-ui/vite.config.ts)

### Issues Found

**CRITICAL: No Chunk Splitting Strategy**
- `vite.config.ts` has zero `build.rollupOptions.output.manualChunks` configuration
- All vendor dependencies are bundled into a single chunk
- Heavy libraries (mermaid ~2.5MB, monaco-editor ~8MB, excalidraw ~4MB, recharts ~500KB, xterm ~300KB, react-markdown ~200KB) all end up in the same initial bundle or a single vendor chunk
- No `chunkSizeWarningLimit` override indicates this was never profiled

**Missing Build Optimizations:**
- No `build.cssCodeSplit: true` (defaults to true, but explicit is better for large apps)
- No `build.reportCompressedSize: false` for faster builds in CI
- No `build.assetsInlineLimit` tuning for icon/font assets
- Target is `es2021` which is fine, but no differential serving config

**Recommended `manualChunks` Configuration:**
```ts
build: {
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
      }
    }
  }
}
```

---

## 2. Code Splitting & Lazy Loading (maestro-ui)

### What's Already Lazy (Good)
- `AppWorkspace.tsx` lazy-loads: `ExcalidrawBoard`, `DocViewer`, `CodeEditorPanel`, `MermaidDiagram`
- These are wrapped in `<Suspense>` with fallbacks

### Issues Found

**HIGH: DocViewer imports MermaidDiagram eagerly**
- `DocViewer.tsx:5` — `import { MermaidDiagram } from "./MermaidDiagram"` is a static import
- Since `DocViewer` itself is lazy-loaded, mermaid gets pulled into the DocViewer chunk
- But when DocViewer renders, it always pulls in the full mermaid library (~2.5MB) even for non-mermaid documents
- **Fix**: Use `React.lazy` for MermaidDiagram inside DocViewer, only loading it when a mermaid code block is detected

**HIGH: Dashboard (recharts) not lazy-loaded**
- `MultiProjectBoard.tsx:25` — `import { Dashboard } from "./Dashboard"` is a static import
- Dashboard imports `recharts` (~500KB) which is always bundled with MultiProjectBoard
- Board itself is conditionally rendered (`showMultiProjectBoard` state) but recharts is still in the main bundle because Board is imported statically in `App.tsx`
- **Fix**: The Board component in `App.tsx` is conditionally rendered but statically imported — should be `React.lazy`

**MEDIUM: Board/MultiProjectBoard not lazy-loaded in App.tsx**
- `App.tsx:42` — `import { Board } from "./components/maestro/MultiProjectBoard"` is a static import
- Board is only shown when `showMultiProjectBoard === true` (Cmd+Shift+B)
- This pulls in Board + Dashboard + recharts + all task management UI into the initial bundle
- **Fix**: `const LazyBoard = React.lazy(() => import("./components/maestro/MultiProjectBoard"))`

**MEDIUM: TeamView not lazy-loaded in App.tsx**
- `App.tsx:43` — `import { TeamView } from "./components/maestro/TeamView"` is a static import
- TeamView is only shown when `teamViewGroup` is truthy
- **Fix**: `const LazyTeamView = React.lazy(() => import("./components/maestro/TeamView"))`

**MEDIUM: CommandPalette not lazy-loaded**
- `App.tsx:33` — `import { CommandPalette } from "./CommandPalette"` is a static import
- CommandPalette is an overlay triggered by keyboard shortcut, not needed at startup
- **Fix**: Lazy-load it

**LOW: StartupSettingsOverlay is conditional but statically imported**
- Only shown on first launch when setup is not complete
- Could be lazy-loaded since it's only needed once

**LOW: xterm CSS imported in main.tsx**
- `main.tsx:8` — `import "xterm/css/xterm.css"` loads xterm CSS regardless of whether any terminal is open
- Minor impact but could be moved to SessionTerminal component

---

## 3. Heavy Dependencies Analysis (maestro-ui/package.json)

| Dependency | Approx Size (minified) | Lazy-loaded? | Usage |
|---|---|---|---|
| `monaco-editor` | ~8 MB | Yes (CodeEditorPanel) | Code editor |
| `@excalidraw/excalidraw` | ~4 MB | Yes (ExcalidrawBoard) | Whiteboard |
| `mermaid` | ~2.5 MB | Partially (lazy in AppWorkspace, eager in DocViewer) | Diagrams |
| `recharts` | ~500 KB | No (static in Dashboard) | Charts |
| `xterm` | ~300 KB | No (static in SessionTerminal) | Terminal |
| `react-markdown` + `remark-gfm` | ~200 KB | Via DocViewer (lazy) | Markdown |
| `fuse.js` | ~25 KB | No (static) | Search — acceptable |
| `dompurify` | ~50 KB | Via MermaidDiagram (lazy) | Sanitization |
| `date-fns` | tree-shakeable | N/A | Date formatting |
| `zustand` | ~3 KB | N/A | State — negligible |

**Estimated initial bundle bloat from non-lazy imports: ~500KB+ (recharts + Board tree)**

---

## 4. Server Startup (maestro-server)

### Issues Found

**MEDIUM: Sequential Repository Initialization**
- `container.ts:177-183` — 7 repositories are initialized sequentially with `await`:
  ```ts
  await projectRepo.initialize();
  await taskRepo.initialize();
  await taskListRepo.initialize();
  await sessionRepo.initialize();
  await orderingRepo.initialize();
  await teamMemberRepo.initialize();
  await teamRepo.initialize();
  ```
- Each repository reads from disk (readdir + readFile for each JSON file)
- These are independent and could be parallelized:
  ```ts
  await Promise.all([
    projectRepo.initialize(),
    taskRepo.initialize(),
    taskListRepo.initialize(),
    sessionRepo.initialize(),
    orderingRepo.initialize(),
    teamMemberRepo.initialize(),
    teamRepo.initialize(),
  ]);
  ```
- **Impact**: Startup time scales with number of stored entities. With many sessions/tasks, this could be 1-5+ seconds sequentially vs <1 second parallel

**MEDIUM: Migration runs on every startup**
- `container.ts:186` — `migrateTeamMemberTasks` calls `taskRepo.findAll()` every startup
- This iterates all tasks to check for `taskType === 'team-member'`
- Should have a migration flag file to skip on subsequent runs
- **Fix**: Write a `.migrated-team-member-tasks` sentinel file after first run

**LOW: No compression middleware**
- `server.ts` uses `helmet`, `cors`, `express-rate-limit` but no `compression` middleware
- API responses (especially task lists, session data) are sent uncompressed
- For a local server this is acceptable, but for remote/production use, gzip/brotli would help
- `compression` package is not in `package.json` dependencies

**LOW: Synchronous imports in server.ts**
- All route modules are imported at top level synchronously
- 12 route modules + infrastructure imports loaded before server starts
- For a Node.js server this is normal, but for faster cold starts, routes could be lazily registered
- **Impact**: Minimal — Node.js module loading is fast

**INFO: DI Container Overhead**
- `createContainer()` is async but the actual construction is mostly synchronous (new instances)
- The overhead is negligible — the async part is repository initialization
- No real concern here — this is a clean pattern

---

## 5. Server Build (maestro-server/tsconfig.json)

### Issues Found

**LOW: sourceMap enabled in production build**
- `tsconfig.json` has `"sourceMap": true` — source maps are generated for the server
- For production binaries (built with @yao-pkg/pkg), source maps add overhead
- Should be conditional or disabled for production builds

**INFO: CommonJS output**
- Server uses `"module": "commonjs"` — this is fine for Node.js and @yao-pkg/pkg compatibility
- Tree-shaking is not a concern for server-side code as unused modules don't affect runtime performance significantly

---

## 6. CLI Build (maestro-cli)

### Observations
- Uses esbuild bundler (`scripts/bundle.mjs`) for creating a single CJS bundle — good
- Then uses @yao-pkg/pkg to create standalone binaries — good
- No issues found with the CLI build pipeline

---

## Summary: Priority-Ordered Recommendations

### Critical
1. **Add `manualChunks` to vite.config.ts** — Split vendor bundles to enable parallel loading and better caching

### High
2. **Lazy-load Board/MultiProjectBoard in App.tsx** — Saves ~500KB+ from initial bundle (recharts + board UI)
3. **Lazy-load MermaidDiagram inside DocViewer** — Avoid pulling 2.5MB mermaid into DocViewer chunk for non-diagram docs

### Medium
4. **Parallelize repository initialization** in container.ts — `Promise.all()` for 7 independent repo inits
5. **Add migration sentinel file** — Skip `migrateTeamMemberTasks` scan after first successful run
6. **Lazy-load TeamView in App.tsx** — Only needed when viewing team
7. **Lazy-load CommandPalette in App.tsx** — Only needed on keyboard shortcut

### Low
8. **Add compression middleware** to server for production deployments
9. **Disable source maps** in server production builds
10. **Move xterm CSS import** from main.tsx to SessionTerminal component
11. **Lazy-load StartupSettingsOverlay** — Only shown on first launch
