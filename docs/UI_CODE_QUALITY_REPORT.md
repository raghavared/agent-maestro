# Maestro UI - Code Quality Report

**Date:** 2026-02-27
**Scope:** `maestro-ui/src/` (273 TS/TSX files, 53 CSS files, ~50K lines of code)
**Overall Score: 5.5 / 10**

---

## Executive Summary

The maestro-ui codebase is functional and feature-rich but has significant code quality issues that would be noticed by open-source contributors. The main concerns are: pervasive use of `any` types (60+ instances), excessive CSS file fragmentation (53 separate files, 27K+ lines), several oversized components (1000+ lines), inconsistent error handling patterns, and minimal test coverage (only 4 test files for 273 source files). The architecture is sound at a high level (Zustand stores, custom hooks, service layer), but execution is inconsistent.

---

## Critical Issues (Must Fix Before Open-Source Launch)

### 1. Pervasive `any` Type Usage (60+ instances)

**Impact:** Makes the codebase look untyped; defeats the purpose of TypeScript.

| File | Lines | Description |
|------|-------|-------------|
| `stores/persistence.ts` | 25, 41-42, 57, 61, 74 | Module-level ref typed as `any`; filter/map callbacks cast to `any`; `persistedProjects as any` with comment "Cast to bypass TS type mismatch" |
| `stores/useMaestroStore.ts` | 127 | `normalizeSession(session: any): any` - core function with no types |
| `stores/useMaestroStore.ts` | 175, 181, 187, 195, 202, 263, 269, 293, 295, 314, 326, 349, 358 | 13x `playEventSound(message.event as any)` - systematic type mismatch |
| `stores/initApp.ts` | 79, 298, 309, 314, 469, 507, 513 | Multiple `as any` casts for Rust/TS interop |
| `stores/usePersistentSessionStore.ts` | 62, 65 | `(s: any)` casts in session filtering |
| `stores/useSecureStorageStore.ts` | 49-50, 63 | `(s: any)` and `(a: any, b: any)` casts |
| `hooks/useTeamActions.ts` | 5, 29, 51 | Function params `(input: any) => Promise<any>` |
| `hooks/useTeamMemberActions.ts` | 5, 48, 64 | Same pattern as useTeamActions |
| `hooks/useExecutionMode.ts` | 4, 12, 54, 77, 91 | `CreateSessionFn = (input: any) => Promise<any>` |
| `hooks/useMaestroWebSocket.ts` | 17, 25, 44, 52-53 | WebSocket event data typed as `any` |
| `components/maestro/Dashboard.tsx` | 43, 48 | `ChartTooltip({ active, payload, label }: any)` |
| `components/maestro/DocViewer.tsx` | 49 | `code({ className, children, ...props }: any)` |
| `components/maestro/panels/TeamsPanel.tsx` | 9-10, 23 | Team callbacks typed as `any` |
| `components/maestro/panels/TeamMembersPanel.tsx` | 10, 14, 30 | Member callbacks typed as `any` |
| `utils/promptTemplate.ts` | 4, 15 | `MAESTRO_TASK_DATA?: any` and `[key: string]: any` |
| `utils/claude-log/parseJsonl.ts` | 18, 127, 151, 153, 191, 193 | Parser functions accept `any` with eslint-disable comments |
| `services/maestroService.ts` | 50, 94 | `'coordinate' as any`; `catch (error: any)` |
| `utils/claudeCliBuilder.ts` | 141, 154, 156 | CLI config values cast `as any` |

**Recommendation:** Create proper interfaces for session creation payloads, WebSocket messages, and Rust interop types. Replace `catch (err: any)` with `catch (err: unknown)` and use type guards.

### 2. Minimal Test Coverage

**Impact:** No confidence in refactoring; contributors can't verify changes.

- **Only 4 test files** exist for 273 source files (~1.5% coverage)
- Located in `src/__tests__/` - only `formatters.test.ts` found with real tests
- No component tests, no store tests, no hook tests, no integration tests

**Recommendation:** Add tests for critical paths: stores (useMaestroStore, useSessionStore), key hooks (useExecutionMode, useTeamActions), and utility functions.

### 3. Console Statements in Production Code

**Impact:** Looks unprofessional; leaks debug info.

| File | Line | Statement |
|------|------|-----------|
| `stores/useSessionStore.ts` | 1207 | `console.error('[handleSpawnTerminalSession]...')` |
| `stores/useMaestroStore.ts` | 1003 | `console.error('[useMaestroStore] Failed to fetch...')` |
| `components/ExcalidrawBoard.tsx` | 114 | `console.error("Failed to export Excalidraw...")` |
| `components/ExportToTaskPicker.tsx` | 55, 77 | `console.error("Export to task failed:...")` |
| `components/maestro/task-modal/ImagesTab.tsx` | 31, 45, 65 | Multiple `console.error` calls |
| `components/ErrorBoundary.tsx` | 26 | `console.error` - acceptable for error boundary but should use error service |

**Recommendation:** Replace with a centralized error reporting service or use the existing `reportError` store method consistently.

---

## Important Issues (Should Fix)

### 4. Silent Error Swallowing (10+ instances)

Empty catch blocks that silently ignore errors make debugging impossible.

| File | Line | Pattern |
|------|------|---------|
| `stores/useMaestroStore.ts` | 254, 362-363 | `catch { }` - completely empty |
| `stores/useMaestroStore.ts` | 293, 735 | `.catch(() => {})` |
| `stores/useSessionStore.ts` | 397, 560 | `.catch(() => { })` |
| `stores/useSshStore.ts` | 101-102 | `catch { // best-effort }` |
| `components/FileExplorerPanel.tsx` | 742-743, 908-914, 1124 | Empty catch blocks and `.catch(() => {})` |
| `components/CodeEditorPanel.tsx` | 79-81, 109-113 | Empty catch blocks |

### 5. Oversized Components

Components exceeding 500 lines are hard to maintain and review.

| File | Lines | Recommendation |
|------|-------|----------------|
| `components/FileExplorerPanel.tsx` | 1268 | Extract FileList, ContextMenu, DragHandler into sub-components |
| `stores/useSessionStore.ts` | 1261 | Split into session lifecycle, terminal management, and persistence |
| `components/CodeEditorPanel.tsx` | 1058 | Extract TabBar, EditorView, Controls |
| `components/maestro/TeamMemberModal.tsx` | 1039 | Extract form sections into sub-components |
| `stores/useMaestroStore.ts` | 1024 | Split WebSocket handling from state management |
| `services/soundManager.ts` | 1012 | Extract audio context management and template loading |
| `components/SessionsSection.tsx` | 932 | Extract session list rendering and filtering |
| `components/maestro/TaskListItem.tsx` | 820 | Extract context menu and inline editors |
| `stores/initApp.ts` | 813 | Split initialization phases into separate modules |

### 6. CSS Architecture (53 files, 27K+ lines)

**Impact:** Extremely fragmented; hard to maintain; likely contains dead CSS.

- 53 separate CSS files at `src/` root level with `styles-*.css` naming
- Largest file: `styles-inline-priority-picker.css` at **2,418 lines** for a picker component
- No CSS modules, no CSS-in-JS, no utility framework
- Inline styles used extensively alongside CSS files (inconsistent approach)
- Many components use both CSS classes and inline styles simultaneously

**Top CSS files by size:**
| File | Lines |
|------|-------|
| `styles-inline-priority-picker.css` | 2,418 |
| `styles-maestro-sessions-v2.css` | 2,010 |
| `styles-spaces-panel.css` | 1,343 |
| `styles-terminal-theme.css` | 1,281 |
| `styles-sessions.css` | 1,261 |

**Recommendation:** Adopt CSS modules or a consistent styling approach. Audit for dead CSS.

### 7. Hardcoded Magic Values

| File | Line | Value | Issue |
|------|------|-------|-------|
| `stores/useProjectStore.ts` | 87, 147, 164, 224, 252 | `'piano'` | Hardcoded default instrument in 5 places |
| `stores/useSessionStore.ts` | 435-447 | `2000` | Hardcoded timeout values |
| `stores/useMaestroStore.ts` | 250-251 | `200` | Magic sleep: `setTimeout(r, 200)` |
| `stores/useMaestroStore.ts` | 405 | `1000`, `30000` | Retry limits without constants |
| `components/CodeEditorPanel.tsx` | 527, 992 | `150`, `12` | Scroll amount, font size |
| `components/CodeEditorPanel.tsx` | 615 | `1200` | Timeout duration |
| `components/FileExplorerPanel.tsx` | 627-677 | Multiple | Hardcoded colors in canvas drawing |
| `components/FileExplorerPanel.tsx` | 971-972 | `28`, `12` | Row height and overscan |
| `components/ExportToTaskPicker.tsx` | 53 | `1200` | Close delay |
| `components/maestro/MermaidDiagram.tsx` | 14 | `10` | Background RGB value |

### 8. Incomplete Features (TODOs in Code)

| File | Line | TODO |
|------|------|------|
| `stores/useSessionStore.ts` | 1150 | `// TODO: implement session selection modal` - function body is empty |
| `hooks/useMaestroSessions.ts` | 31 | `// TODO: Implement session selection modal` - same feature, duplicated TODO |
| `components/NewSpaceDropdown.tsx` | 101 | `onClick={() => { /* Document -- Phase 2 */ }}` - dead placeholder |

### 9. ESLint/TypeScript Suppressions

| File | Line | Suppression |
|------|------|-------------|
| `global.d.ts` | 1 | `/* eslint-disable @typescript-eslint/no-explicit-any */` |
| `hooks/useProjectManager.ts` | 123 | `// eslint-disable-next-line react-hooks/exhaustive-deps` |
| `utils/claude-log/parseJsonl.ts` | 17, 126, 150, 152, 190, 192 | 6x `// eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| `components/app/AppModals.tsx` | 245, 334 | 2x `// eslint-disable-next-line react-hooks/exhaustive-deps` |

---

## Minor Issues (Nice to Fix)

### 10. Accessibility (a11y)

- `components/ExportToTaskPicker.tsx:91,148` - Close buttons using `&times;` without `aria-label`
- `components/maestro/MermaidDiagram.tsx:195` - Button with text `X` missing `aria-label`
- `components/ExportToTaskPicker.tsx:234` - `+` icon span missing `aria-hidden`
- `components/ExportToTaskPicker.tsx:339-353` - Status color dots without semantic labels
- General: Many interactive `div`/`span` elements used as buttons without proper ARIA roles

### 11. React Anti-Patterns

- `components/ExportToTaskPicker.tsx:225-336` - Direct DOM manipulation via `e.currentTarget.style.background` in hover handlers
- `components/ProjectsSection.tsx:250-379` - 130-line inline `onPointerDown` handler
- `components/ProjectTabBar.tsx:420-548` - Complex inline drag-and-drop handler
- `components/ErrorBoundary.tsx:38-72` - Hardcoded inline styles in fallback UI (colors like `#ff4444`, `#e0e0e0`)

### 12. Naming Inconsistencies

- Store module-level variables mix patterns: `globalWs`, `pendingExitCodes`, `closingSessions`, `agentIdleTimersRef`, `lastResizeAtRef`
- `useMaestroStore.ts:28-32` - Global WebSocket state variables at module level (not in store)
- CSS file naming: `styles-maestro-sessions-v2.css` suggests v1 may still exist
- Some stores use `get()` for state access, others use `(prev) =>` callback pattern inconsistently

### 13. `dangerouslySetInnerHTML` Usage

- `components/maestro/MermaidDiagram.tsx:185,214` - Uses `dangerouslySetInnerHTML` with DOMPurify sanitization (properly sanitized, but worth noting for security review)

### 14. `as any` Casts for Rust Interop

Several `as any` casts exist specifically because Rust backend uses different field names than TypeScript types (e.g., `title` vs `name` for projects). This is a systemic issue that should be addressed by:
- Creating adapter/transformer functions at the API boundary
- Aligning field names between Rust and TypeScript

---

## Component Architecture Assessment

### Strengths
- **Zustand for state management** - Good choice; stores are reasonably scoped
- **Custom hooks pattern** - Business logic is extracted into hooks (`useTeamActions`, `useExecutionMode`, etc.)
- **Service layer** - `services/` directory separates API calls from UI
- **ErrorBoundary component** - Properly implemented with retry capability
- **Constants file** - `app/constants/defaults.ts` centralizes layout dimensions and storage keys
- **Type definitions** - `app/types/` directory has structured type definitions

### Weaknesses
- **No component composition pattern** - Large monolithic components instead of small, composable ones
- **Mixed styling approaches** - CSS files + inline styles + CSS variables used inconsistently
- **No lazy loading** - All components appear eagerly loaded
- **No memoization strategy** - `React.memo`, `useMemo`, `useCallback` used inconsistently; Zustand selectors don't use `shallow` comparison
- **No error boundary wrapping** - ErrorBoundary exists but unclear if used consistently around major sections

---

## Summary Statistics

| Category | Count | Severity |
|----------|-------|----------|
| `any` type usage | 60+ | Critical |
| Test files | 4 (of 273 source files) | Critical |
| Console statements | 9 | Critical |
| Silent error swallowing | 10+ | Important |
| Components > 500 lines | 9 | Important |
| CSS files | 53 (27K lines) | Important |
| Hardcoded magic values | 15+ | Important |
| TODO/incomplete features | 3 | Important |
| ESLint suppressions | 10 | Minor |
| Accessibility gaps | 5+ | Minor |
| React anti-patterns | 4 | Minor |

---

## Recommended Priority Order

1. **Replace `any` types** with proper interfaces (biggest contributor to unprofessional appearance)
2. **Add test coverage** for stores and critical hooks (minimum viable test suite)
3. **Remove console statements** and replace with error service
4. **Add error handling** to empty catch blocks (at minimum, log them)
5. **Split oversized components** (start with FileExplorerPanel, CodeEditorPanel)
6. **CSS consolidation** - Adopt CSS modules; audit for dead CSS
7. **Extract magic numbers** to constants
8. **Resolve TODOs** or remove dead feature placeholders
9. **Add ARIA labels** to interactive elements
10. **Create Rust-TS adapter layer** to eliminate interop `as any` casts
