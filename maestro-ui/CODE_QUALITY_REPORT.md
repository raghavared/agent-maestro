# Code Quality Report: maestro-ui

**Date:** 2026-02-25
**Branch:** ui-v2
**Reviewer:** AI Code Quality Auditor (Senior Engineer)

---

## Executive Summary

| Dimension | Grade |
|-----------|-------|
| **Overall** | **C+** |
| Architecture & Component Design | B- |
| TypeScript Quality | C+ |
| CSS/Styling | D+ |
| Performance | C |
| Accessibility (a11y) | D |
| Error Handling | D |
| Testing | F |
| Security | B- |
| Open Source Readiness | C+ |
| Production Readiness | C |

### Key Strengths
- Well-structured Zustand store architecture with clean separation of concerns
- Extensive custom hooks library (55 hooks) extracting logic from components
- Good use of `useMemo`/`useCallback` in many components (444 occurrences across 91 files)
- Comprehensive README with demo, features, architecture docs, FAQ, and keyboard shortcuts
- Mermaid securityLevel set to "strict" — good security posture
- TypeScript strict mode enabled in tsconfig.json
- Clean app entry point pattern — App.tsx is a thin layout shell with domain state in stores

### Critical Issues
1. **Zero test files** — no test coverage whatsoever
2. **No error boundaries** — a single component crash will take down the entire app
3. **52 CSS files totaling 26,316 lines** — massive, un-scoped global CSS with high specificity collision risk
4. **No linter, formatter, or CI configuration** present in the UI package
5. **Missing CONTRIBUTING.md, LICENSE, CODE_OF_CONDUCT.md, SECURITY.md** in the UI package directory

---

## Detailed Findings

### 1. Architecture & Component Design — Grade: B-

**Strengths:**
- Clean layered architecture: `stores/` → `hooks/` → `components/` → `App.tsx`
- Zustand for state management is a strong modern choice; 18 stores with focused responsibilities
- 55 custom hooks extract business logic out of components
- Good separation between app shell (`components/app/`) and domain features (`components/maestro/`)
- Services layer (`services/maestroService.ts`) for API calls
- Utility modules organized by domain (`utils/claude-log/`, `app/utils/`, `app/types/`)

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **God components**: `FileExplorerPanel.tsx` (1,298 lines), `CodeEditorPanel.tsx` (1,051 lines), `TeamMemberModal.tsx` (1,039 lines), `SessionsSection.tsx` (932 lines). These should be decomposed into smaller sub-components. |
| High | **App.tsx** is 658 lines — too large for a "thin layout shell". Contains inline type definitions (`RunningSessionsByProject` at line 57), complex state management, and business logic that should be extracted to hooks. |
| Medium | **Flat component directory**: 132 TSX files with many at the top level of `components/`. Some sub-organization exists (`maestro/`, `maestro/task-modal/`, `maestro/panels/`, `modals/`, `app/`, `session-log/`) but not consistently applied. |
| High | **MaestroContext.tsx is dead code** (484 lines). `MaestroProvider` is never mounted anywhere in the application — search for `MaestroProvider` and `useMaestroContext` in all TSX/TS files returns zero results outside the file itself. The entire context layer has been superseded by `useMaestroStore`. This misleads future developers and inflates the codebase. |
| Medium | **Likely dead code**: `hooks/useAppInit.ts` (657 lines) appears superseded by `stores/initApp.ts` — App.tsx imports from `stores/initApp` but not `hooks/useAppInit`. The hook takes ~25 props as parameters, a clear sign of the old pattern before the Zustand refactor. |
| Medium | **Top-level component misplacement**: `CommandPalette.tsx`, `SessionTerminal.tsx`, `SlidePanel.tsx` sit at `src/` root but are fully functional components — should live in `src/components/`. |
| Low | **Duplicate type definitions**: `Prompt` type is defined in both `app/types/app.ts` and `app/types/app-state.ts`. |
| Low | Type definitions inside component files (e.g., `RunningSessionsByProject` inside App.tsx) rather than in the `app/types/` directory. |

### 2. TypeScript Quality — Grade: C+

**Strengths:**
- `strict: true` in tsconfig.json
- Dedicated `app/types/` directory with typed interfaces for core domain models (maestro, session, space, workspace, recording, app-state, storage)
- Most components have typed props

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **69 occurrences of `: any`** across 26 files. Highest offenders: `useMaestroStore.ts` (13 `as any`), `parseJsonl.ts` (6), `persistence.ts` (6), `useExecutionMode.ts` (5), `initApp.ts` (5). |
| High | **32 occurrences of `as any`** type assertions across 14 files — bypasses type safety entirely. Many stem from Rust/TS schema mismatches (e.g., `initApp.ts:297-311`, `persistence.ts:42,61,74` — comments acknowledge "Rust uses 'title', TS uses 'name'"). |
| Medium | **ESLint suppression comments**: `react-hooks/exhaustive-deps` suppressed in `useProjectManager.ts:123` and `AppModals.tsx:245,334` — potentially incorrect dependency arrays. |
| Medium | `global.d.ts` has whole-file `/* eslint-disable @typescript-eslint/no-explicit-any */` suppression. |
| Medium | No `noUncheckedIndexedAccess` in tsconfig — array/object index access is not type-safe. |
| Low | `@types/react-mentions` in `dependencies` instead of `devDependencies`. |
| Low | `skipLibCheck: true` — hides potential issues in dependency type definitions. |

### 3. CSS/Styling — Grade: D+

**Strengths:**
- Variables file (`styles-variables.css`, 155 lines) provides a centralized design token layer
- Themed components pattern via `styles-themed-components.css` (1,011 lines)
- Feature-based CSS file splitting makes it easier to locate styles for a given feature

**Issues:**

| Severity | Finding |
|----------|---------|
| Critical | **52 CSS files totaling 26,316 lines** of global CSS. All imported via `@import` in `styles.css`. This is a monolithic global stylesheet — any class name collision will cause bugs with no warning. |
| High | **No CSS modules, CSS-in-JS, or scoping mechanism**. All styles are global class names (e.g., `.mermaidDiagram`, `.task-card`, `.team-modal`). High risk of name collisions as the codebase grows. |
| High | **Largest CSS files are extremely large**: `styles-inline-priority-picker.css` (2,387 lines), `styles-maestro-sessions-v2.css` (2,010 lines), `styles-spaces-panel.css` (1,343 lines). These are difficult to maintain. |
| High | **External font loading** via Google Fonts CDN (`@import url('https://fonts.googleapis.com/...')`) in styles.css — blocks rendering, adds external dependency, privacy concern for a desktop app. Should be self-hosted. |
| Medium | No CSS linting (no stylelint config found). |
| Medium | Inconsistent naming conventions — mix of camelCase (`mermaidDiagram`), kebab-case (`task-card`), and BEM-like (`mermaidDiagram--zoomed`). |
| Low | `styles-style-overrides.css` (171 lines) suggests accumulated hacks to override other styles — a code smell. |

### 4. Performance — Grade: C

**Strengths:**
- Good use of `useMemo`/`useCallback` (444 occurrences across 91 files)
- Zustand with selectors avoids unnecessary re-renders
- Vite build with esbuild minification
- Conditional sourcemaps (only in TAURI_DEBUG mode)

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **Minimal code splitting**. Only one `React.lazy` usage found (`CodeEditorPanel` in `AppWorkspace.tsx:23`). All other heavy dependencies (Excalidraw, Monaco Editor, Mermaid, xterm.js) are eagerly loaded, inflating initial bundle significantly. |
| High | **Monaco Editor** and **Excalidraw** bundled eagerly — these are massive libraries (Monaco alone is ~5MB). They should be lazy-loaded. |
| Medium | **No bundle analysis** configured (no rollup-plugin-visualizer or similar). |
| Medium | 52 CSS files loaded upfront — no critical CSS extraction or CSS code splitting. |
| Medium | `MermaidDiagram` calls `reinitMermaid()` on every render/chart change — mermaid initialization is expensive. |
| Medium | **Unstable function references**: `TaskDetailOverlay.tsx:44-79` defines all handlers as plain `async` functions without `useCallback` — new references on every render. `MaestroPanel.tsx:226` has the same issue with `handleCreateTask`. |
| Medium | **Uncleaned `setTimeout` calls**: `MaestroPanel.tsx:183` and `TaskStatusControl.tsx:100,105` use `setTimeout` without clearing on unmount — potential state updates on unmounted components. |
| Low | No `React.memo` wrapping for frequently re-rendered list items (e.g., `TaskCard`, `TaskListItem`, `TeamListItem`). Note: 17 components do use `React.memo` (`AppWorkspace`, `MaestroPanel`, `Board`, `TaskCard`, `SessionTerminal`, etc.). |
| Low | Vite config has no `build.rollupOptions.output.manualChunks` — no vendor chunk splitting. |

### 5. Accessibility (a11y) — Grade: D

**Strengths:**
- Some keyboard event handling exists (199 occurrences of `aria-*`, `role=`, `tabIndex`, `onKeyDown` across 37 files)
- Command palette has keyboard navigation
- Keyboard shortcuts documented in README

**Issues:**

| Severity | Finding |
|----------|---------|
| Critical | **No systematic a11y audit**. Of 132 TSX components, only 37 have any accessibility attributes — 72% of components have zero a11y markup. |
| High | **No skip navigation** links for keyboard users. |
| High | **~80 interactive `<div>`/`<span>` elements with `onClick`** lacking `role`, `tabIndex`, or keyboard handlers (e.g., `MermaidDiagram` uses `onClick` on a div without `role="button"`). |
| High | **~399 `<button>` elements missing `type=` attribute** — browsers default to `type="submit"` which can cause unexpected form submissions. |
| High | **No focus management** for modals — when modals open, focus should be trapped inside. No evidence of focus trapping. |
| Medium | **No color contrast validation** — the terminal theme with green-on-black text may not meet WCAG AA contrast ratios. |
| Medium | **No `alt` text audit** for images/icons. The `Icon.tsx` component should ensure proper `aria-label` or `aria-hidden`. |
| Medium | No `aria-live` regions for dynamic content updates (task status changes, session events). |
| Low | No automated a11y testing (e.g., jest-axe, @axe-core/react). |

### 6. Error Handling — Grade: D

**Strengths:**
- `MermaidDiagram` has a try/catch with proper error state rendering
- `MaestroPanel` has a `PanelErrorState` component for error display
- Cancelled async operations handled in some effects (e.g., MermaidDiagram's `cancelled` flag)
- Event listener cleanup is excellent — all `addEventListener` calls are properly paired with cleanup in `useEffect` returns across ~25 files

**Issues:**

| Severity | Finding |
|----------|---------|
| Critical | **Zero error boundaries** in the entire application. Search for `ErrorBoundary`, `componentDidCatch`, `getDerivedStateFromError` returned no results. A single component crash will white-screen the entire app. |
| High | **Silent error swallowing** in multiple critical paths: `initApp.ts:402` has empty `catch {}` on maestro server sync; `useMaestroWebSocket.ts:220` silently catches JSON parse errors with empty `catch {}`; `useMaestroWebSocket.ts:115` sets `ws.onerror = () => {}` (no-op); `claudeCliBuilder.ts:168` silently swallows config parse errors. |
| High | **Store operations lack error handling**: `initApp.ts` (813 lines) performs complex initialization but error handling coverage is unclear for all paths. |
| High | **No global error handler**. No `window.onerror` or `window.onunhandledrejection` handlers to catch and report uncaught errors. |
| Medium | **Empty re-throw anti-pattern** in `MaestroClient.ts:66-68` — `catch (error) { throw error; }` adds no value. |
| Medium | **Tauri invoke calls** may fail silently if not properly try/caught. |
| Low | `localStorage.getItem` wrapped in try/catch in App.tsx (line 74) — good pattern, but not consistently applied. |

### 7. Testing — Grade: F

| Severity | Finding |
|----------|---------|
| Critical | **Zero test files found**. No `.test.*`, `.spec.*`, or `__tests__/` directories exist. |
| Critical | **No test framework configured**. No Jest, Vitest, React Testing Library, or Playwright in `package.json`. |
| Critical | **No test script** in `package.json` scripts. |
| Critical | **132 TSX components, 55 hooks, 18 stores, and 0 tests** — this is the single largest quality gap. |

**Priority testing targets if tests were to be added:**
1. Zustand stores (pure logic, highly testable)
2. Custom hooks (business logic)
3. Utility functions (`app/utils/`, `utils/claude-log/`)
4. Critical user flows: session creation, task management, keyboard shortcuts
5. E2E tests for the Tauri app

### 8. Security — Grade: B-

**Strengths:**
- Mermaid configured with `securityLevel: "strict"` — prevents XSS via diagram injection
- Tauri's built-in security model provides OS-level sandboxing
- Optional encryption at rest for sensitive data (macOS Keychain)
- No hardcoded API keys or secrets found in source
- `envPrefix: ["VITE_", "TAURI_"]` in vite config prevents accidental env var exposure

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **`dangerouslySetInnerHTML`** used in `MermaidDiagram.tsx` (lines 124, 134) to render SVG. While mermaid's strict mode mitigates this, SVG is a rich attack surface. The rendered SVG should be sanitized (e.g., via DOMPurify) before injection. |
| Medium | **No Content Security Policy (CSP)** configured for the Tauri webview. |
| Medium | External CDN dependency for fonts (Google Fonts) — potential supply chain risk and privacy issue for a desktop app. |
| Low | `localStorage` used for state persistence — data is unencrypted and accessible to any code in the webview context. |
| Medium | **Deprecated APIs**: `document.execCommand("copy")` used in 3 locations (`SessionTerminal.tsx:80`, `FileExplorerPanel.tsx:127`, `domUtils.ts:26`) — deprecated in favor of `navigator.clipboard.writeText`. Two files bypass the shared `domUtils.ts` utility and implement their own inline clipboard logic. |
| Medium | **Deprecated `navigator.platform`** in `useKeyboardShortcuts.ts:45` — should use `navigator.userAgentData?.platform` or user-agent matching. |
| Low | **Brittle internal API coupling**: `initApp.ts:77-88` accesses private xterm.js internals (`_core`, `_renderService`, `_renderer`) via `as any` — will break on xterm.js updates. |
| Low | No dependency auditing configured (no `npm audit` in CI, no Dependabot/Snyk). |

### 9. Open Source Readiness — Grade: C+

**Strengths:**
- Comprehensive README (417 lines) with demo GIF, features, quick start, keyboard shortcuts, FAQ, architecture, security section
- AGPL-3.0 license referenced in README badge
- Contributing section references CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, SUPPORT.md
- Clear development instructions and project structure documentation

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **CONTRIBUTING.md, CODE_OF_CONDUCT.md, LICENSE, SECURITY.md, SUPPORT.md** are referenced in README but **not present** in the maestro-ui directory. These may exist at a repo root level, but the package itself is incomplete as a standalone. |
| Medium | **No `.eslintrc` or `.prettierrc`** — no code style enforcement. Contributors will introduce inconsistent styles. |
| Medium | **No `.editorconfig`** file for consistent editor settings. |
| Medium | **Version mismatch**: package.json says `0.3.0`, README badge says `0.2.2`. |
| Medium | **package.json name** is `agents-ui-desktop` but the project is called "Agent Maestro" / "maestro-ui" — confusing. |
| Low | No issue templates or PR templates found. |
| Low | Multiple markdown spec/docs files at root (`MAESTRO-UI-SPEC.md`, `PERFORMANCE-ANALYSIS.md`, `REFACTORING_GUIDE.md`, `SPACES-KNOWLEDGE-BASE.md`, `SPEC-REVIEW.md`, `UI-V2-DESIGN-PLAN.md`) — internal docs that may confuse OSS contributors. |

### 10. Production Readiness — Grade: C

**Strengths:**
- Vite production build with esbuild minification
- Conditional sourcemaps and minification based on TAURI_DEBUG
- Tauri v2 native app framework provides stable distribution model
- Bundled sidecar tools (nu, zellij) eliminate system dependencies

**Issues:**

| Severity | Finding |
|----------|---------|
| High | **No CI/CD pipeline** visible (no `.github/workflows/`, no `Jenkinsfile`, no pipeline config). |
| High | **No linting in build pipeline** — `build` script is just `tsc -b && vite build` with no lint step. |
| High | **No bundle size tracking or budgets** — bundle could grow unchecked. |
| Medium | **No environment-specific config management** beyond Vite's env prefix. |
| Medium | **No health checks or crash reporting** integration. |
| Medium | `concurrently` in devDependencies suggests dev workflow coupling between UI and server. |
| Low | No pre-commit hooks (no husky/lint-staged). |
| Low | Only 3 TODO/FIXME comments found — either very clean or comments aren't being used to track tech debt. |

---

## Top 10 Actionable Recommendations (Prioritized by Impact)

### 1. Add Error Boundaries (Critical — Stability)
**Effort:** Low | **Impact:** Critical

Add `React.ErrorBoundary` wrappers at minimum around:
- The entire app (`App.tsx`)
- Each major panel (Maestro panel, file explorer, code editor, terminal)
- Modal contents

This prevents a single component crash from white-screening the entire app.

### 2. Introduce a Testing Framework (Critical — Quality)
**Effort:** Medium | **Impact:** Critical

1. Add Vitest + React Testing Library to `devDependencies`
2. Start with unit tests for the 18 Zustand stores and utility functions
3. Add component tests for critical flows (session creation, task management)
4. Set up a coverage threshold (start at 30%, increase over time)
5. Consider Playwright for E2E tests of the Tauri app

### 3. Implement Code Splitting / Lazy Loading (High — Performance)
**Effort:** Medium | **Impact:** High

Lazy-load heavy dependencies:
```tsx
const ExcalidrawBoard = React.lazy(() => import('./components/ExcalidrawBoard'));
const CodeEditorPanel = React.lazy(() => import('./components/CodeEditorPanel'));
const MermaidDiagram = React.lazy(() => import('./components/maestro/MermaidDiagram'));
```
Add `Suspense` boundaries with loading fallbacks. This could cut initial bundle size by 50%+.

### 4. Adopt CSS Modules or a Scoping Solution (High — Maintainability)
**Effort:** High | **Impact:** High

Migrate from 52 global CSS files (26K+ lines) to CSS Modules (Vite supports them natively with `.module.css`). This:
- Eliminates class name collision risk
- Enables dead CSS detection
- Makes component styles co-located and deletable
- Can be done incrementally, one component at a time

### 5. Add ESLint + Prettier (High — Code Quality)
**Effort:** Low | **Impact:** High

```bash
npm install -D eslint prettier eslint-config-prettier @typescript-eslint/eslint-plugin
```
Configure with strict TypeScript rules. Add `lint` and `format` scripts. This catches bugs, enforces consistency, and is essential for open-source collaboration.

### 6. Eliminate `any` Types (Medium — Type Safety)
**Effort:** Medium | **Impact:** Medium

69 `: any` and 32 `as any` occurrences. Priority targets:
- `useMaestroStore.ts` (13 `as any`) — this is a core store
- `parseJsonl.ts` (6 `: any`) — data parsing is high-risk for runtime errors
- `initApp.ts` (5 `: any`) — app initialization is critical path

Replace with proper types, `unknown`, or type guards.

### 7. Decompose God Components (Medium — Maintainability)
**Effort:** Medium | **Impact:** Medium

Break down oversized components:
- `FileExplorerPanel.tsx` (1,298 lines) → tree view, toolbar, context menu, upload handler
- `CodeEditorPanel.tsx` (1,051 lines) → tab bar, editor, status bar
- `TeamMemberModal.tsx` (1,039 lines) → sections, form fields, action buttons
- `SessionsSection.tsx` (932 lines) → session list, session item, controls

Target: no component over 400 lines.

### 8. Add Accessibility Foundations (Medium — Inclusion)
**Effort:** Medium | **Impact:** Medium

1. Add focus trapping to all modals (use a library like `focus-trap-react`)
2. Add `role="button"` and `onKeyDown` to all clickable `<div>` elements
3. Add `aria-label` to icon-only buttons
4. Add skip navigation link
5. Install `@axe-core/react` in development for automated a11y warnings

### 9. Self-Host Fonts (Low — Performance/Privacy)
**Effort:** Low | **Impact:** Medium

Replace Google Fonts CDN imports with locally bundled font files:
```css
/* Instead of @import url('https://fonts.googleapis.com/...') */
@font-face {
  font-family: 'JetBrains Mono';
  src: url('./fonts/JetBrainsMono-Regular.woff2') format('woff2');
}
```
This eliminates a render-blocking external request, improves privacy, and ensures offline functionality.

### 10. Set Up CI/CD Pipeline (Medium — Reliability)
**Effort:** Medium | **Impact:** Medium

Create a GitHub Actions workflow that runs:
1. `tsc --noEmit` (type checking)
2. `eslint .` (linting)
3. `vitest run` (tests)
4. `vite build` (build verification)
5. Optional: bundle size check, a11y audit

---

## Positive Highlights

These aspects of the codebase are done well and should be preserved:

1. **Zustand store architecture** — Clean, focused stores with good naming. The thin-shell App pattern is sound.
2. **Custom hooks library** — 55 hooks is impressive extraction of reusable logic. Naming is consistent (`use` prefix) and hooks are well-organized.
3. **Memoization discipline** — 444 useMemo/useCallback usages show awareness of React performance patterns.
4. **README quality** — One of the best READMEs in the project. Comprehensive, well-structured, with demo GIF.
5. **Security awareness** — Mermaid strict mode, optional encryption, no hardcoded secrets, env prefix guarding.
6. **Feature richness** — The application has impressive functionality: terminals, SSH, file explorer, Monaco editor, Excalidraw, drag & drop, command palette, multi-project boards.
7. **Type infrastructure** — Dedicated types directory with proper domain modeling, strict mode enabled.
8. **Event listener cleanup** — Excellent discipline across ~25 files; all `addEventListener` calls are properly paired with cleanup in `useEffect` returns.
9. **Key prop discipline** — 174 `key=` usages across 77 files with no obvious missing-key patterns.
10. **processEffects.ts** — Exemplary code quality: clean, pure, well-typed, handles cross-platform path normalization.
11. **MaestroClient.ts** — Well-organized API client with section dividers, JSDoc, consistent generics, and proper `encodeURIComponent` on all query parameters.
12. **Tauri v2 choice** — Modern, secure, performant native app framework with good DX.

---

## Codebase Statistics

| Metric | Value |
|--------|-------|
| Total source files | 321 |
| TSX components | 132 |
| TypeScript files | 134 |
| CSS files | 52 |
| Custom hooks | 55 |
| Zustand stores | 18 |
| Total CSS lines | 26,316 |
| Total TSX lines | ~29,540 |
| `: any` usages | 69 |
| `as any` usages | 32 |
| `dangerouslySetInnerHTML` | 1 file (2 usages) |
| Error boundaries | 0 |
| Test files | 0 |
| `useMemo`/`useCallback` usages | 444 |
| a11y attributes (aria/role/etc.) | 199 across 37 files |
| console.log/warn/error | 8 |
| TODO/FIXME/HACK | 3 |
| Largest component | FileExplorerPanel.tsx (1,298 lines) |
| Largest CSS file | styles-inline-priority-picker.css (2,387 lines) |
| Largest store | useSessionStore.ts (1,266 lines) |
| Dependencies | 17 runtime, 6 dev |

---

## Appendix A: Hook Quality Samples

| Hook | Lines | Quality | Notes |
|------|-------|---------|-------|
| `useSessionLifecycle.ts` | 173 | High | Clean interfaces, good timer cleanup, defensive checks. Minor: inner functions not wrapped in `useCallback`. |
| `useMaestroWebSocket.ts` | 252 | Mixed | Good reconnection with exponential backoff, proper listener cleanup. Issues: global module-level singletons (fragile with strict mode), silent `ws.onerror = () => {}`, empty `catch {}` on JSON parse. |
| `useKeyboardShortcuts.ts` | 441 | Moderate | Readable logic, proper cleanup. Issues: uses deprecated `navigator.platform`, massive 22-item useEffect dependency array causes constant re-registration. |
| `useOptimistic.ts` | 55 | High | Well-documented with JSDoc and example, correct rollback pattern, proper generic typing. |
| `useTasks.ts` | 40 | High | Simple, focused, correct `useMemo` and `useEffect` usage. |

## Appendix B: Notable File-Level Issues

| File | Issue |
|------|-------|
| `hooks/useAppInit.ts` (657 lines) | Likely dead code — superseded by `stores/initApp.ts` but not removed |
| `stores/useSessionStore.ts:1202-1213` | Debug `console.log` with emoji markers (`[handleSpawnTerminalSession] ✓`) left in production code |
| `stores/useMaestroStore.ts:1008` | Debug trace `console.log('[useMaestroStore.initWebSocket] Called')` |
| `utils/claudeCliBuilder.ts:160` | Incomplete implementation: `// ... parse other arguments` placeholder |
| `utils/claudeCliBuilder.ts:147-148` | Acknowledged tech debt: `// Simple parsing (in production, use a proper CLI parser)` |
| `app/types/maestro.ts:325` | Confusing type alias: `MaestroSubtask = MaestroTask` |
| `app/types/maestro.ts:244-248` | Mixed concerns: `MaestroProject` contains both server and UI-specific fields with "legacy compat" comments |
| `MaestroClient.ts` | No request timeout/AbortController support; no retry logic for transient failures |
| `initApp.ts:77-88` | Accesses xterm.js private internals (`_core`, `_renderService`) via `as any` |
| `contexts/MaestroContext.tsx` (484 lines) | Entirely dead code — `MaestroProvider` is never mounted, superseded by `useMaestroStore` |
| `CreateTaskModal.tsx:111` | `JSON.stringify(task?.referenceTaskIds)` in `useEffect` dependency array — anti-pattern, should use stable primitive or ref-based comparison |
| `styles-startup.css`, `task-lists.css` | Not imported via `styles.css` aggregator — inconsistent import pattern (imported directly in `main.tsx`) |
| `hooks/useTeamActions.ts`, `hooks/useTeamMemberActions.ts` | Multiple function signatures use `any` for callback types — bypasses type safety in team management flows |

---

*Report generated by AI Code Quality Auditor. For questions or follow-up analysis, re-run the review task.*
