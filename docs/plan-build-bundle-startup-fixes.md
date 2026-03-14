# Fix Plan: Build Bundle & CLI Startup Optimization

## Reference: docs/build-bundle-startup-optimization.md

---

## 1. Add `manualChunks` to Vite Config (CRITICAL)

**File:** `maestro-ui/vite.config.ts`

**Current state:** Zero chunk splitting — all vendor deps go into a single bundle.

**Change:** Add `build.rollupOptions.output.manualChunks` to split heavy vendors into cacheable chunks:

```ts
build: {
  target: "es2021",
  sourcemap: Boolean(process.env.TAURI_DEBUG),
  minify: process.env.TAURI_DEBUG ? false : "esbuild",
  reportCompressedSize: false, // faster CI builds
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

**Impact:** Enables parallel loading, better HTTP caching (vendor chunks change less often).

---

## 2. Lazy-load Board/MultiProjectBoard in App.tsx (HIGH)

**File:** `maestro-ui/src/App.tsx`

**Current state (line 42):**
```ts
import { Board } from "./components/maestro/MultiProjectBoard";
```
Board is only shown when `showMultiProjectBoard === true` (Cmd+Shift+B toggle), but `Board` + `Dashboard` + `recharts` (~500KB) are statically imported.

**Change:**
```ts
// Remove static import
// Add lazy import:
const LazyBoard = React.lazy(() =>
  import("./components/maestro/MultiProjectBoard").then(m => ({ default: m.Board }))
);
```

Update usage (around line 592-600):
```tsx
{showMultiProjectBoard && (
  <React.Suspense fallback={null}>
    <LazyBoard
      onClose={() => setShowMultiProjectBoard(false)}
      onSelectTask={handleBoardSelectTask}
      onUpdateTaskStatus={handleBoardUpdateTaskStatus}
      onWorkOnTask={handleBoardWorkOnTask}
      onCreateMaestroSession={createMaestroSession}
    />
  </React.Suspense>
)}
```

**Impact:** Saves ~500KB+ from initial bundle.

---

## 3. Lazy-load MermaidDiagram inside DocViewer (HIGH)

**File:** `maestro-ui/src/components/maestro/DocViewer.tsx`

**Current state (line 5):**
```ts
import { MermaidDiagram } from "./MermaidDiagram";
```
Eagerly pulls mermaid (~2.5MB) into DocViewer chunk even for non-diagram docs.

**Change:**
Replace static import with lazy loading only when mermaid content is detected:

```ts
const LazyMermaidDiagram = React.lazy(() =>
  import("./MermaidDiagram").then(m => ({ default: m.MermaidDiagram }))
);
```

In `markdownComponents.code`, wrap `<MermaidDiagram>` usages with `<Suspense>`:
```tsx
if (isDiagramLanguage(lang)) {
  return (
    <React.Suspense fallback={<pre><code>{codeString}</code></pre>}>
      <LazyMermaidDiagram chart={codeString} />
    </React.Suspense>
  );
}
```

Same for the auto-detect block.

Note: `markdownComponents` is defined at module level. Since `React.lazy` returns a component (not a hook), this is fine — the lazy component can be used inside module-level object literals. The `<Suspense>` boundary handles the loading state.

**Impact:** Saves ~2.5MB from DocViewer chunk for non-diagram docs.

---

## 4. Lazy-load TeamView in App.tsx (MEDIUM)

**File:** `maestro-ui/src/App.tsx`

**Current state (line 43):**
```ts
import { TeamView } from "./components/maestro/TeamView";
```
TeamView is only shown when `teamViewGroup` is truthy.

**Change:**
```ts
const LazyTeamView = React.lazy(() =>
  import("./components/maestro/TeamView").then(m => ({ default: m.TeamView }))
);
```

Update usage (around line 603-610):
```tsx
{teamViewGroup && (
  <React.Suspense fallback={null}>
    <LazyTeamView
      group={teamViewGroup}
      registry={registry}
      onClose={() => setTeamViewGroupId(null)}
      onSelectSession={handleSelectSession}
    />
  </React.Suspense>
)}
```

---

## 5. Lazy-load CommandPalette in App.tsx (MEDIUM)

**File:** `maestro-ui/src/App.tsx`

**Current state (line 33):**
```ts
import { CommandPalette } from "./CommandPalette";
```
CommandPalette is an overlay triggered by keyboard shortcut, not needed at startup.

**Change:**
```ts
const LazyCommandPalette = React.lazy(() =>
  import("./CommandPalette").then(m => ({ default: m.CommandPalette }))
);
```

Update usage (line 613):
```tsx
<React.Suspense fallback={null}>
  <LazyCommandPalette />
</React.Suspense>
```

---

## 6. Parallelize Repository Initialization (MEDIUM)

**File:** `maestro-server/src/container.ts`

**Current state (lines 177-183):** 7 repositories initialized sequentially:
```ts
await projectRepo.initialize();
await taskRepo.initialize();
await taskListRepo.initialize();
await sessionRepo.initialize();
await orderingRepo.initialize();
await teamMemberRepo.initialize();
await teamRepo.initialize();
```

**Change:**
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

**Impact:** With many stored entities, startup could go from 1-5s sequential to <1s parallel.

---

## 7. Fix Triple Manifest Normalization (MEDIUM)

**Files:**
- `maestro-cli/src/commands/manifest-generator.ts`
- `maestro-cli/src/prompting/manifest-normalizer.ts`
- `maestro-cli/src/prompting/prompt-composer.ts`

**Current state:** `normalizeMode()` is called up to 3 times on the same manifest:
1. `manifest-generator.ts:607` — `normalizeMode(mode, false)` during `generateManifest()`
2. `manifest-generator.ts:311` — `normalizeMode(manifest.mode, true)` when adding coordinator session ID
3. `manifest-normalizer.ts:139` (via `toCanonicalMode`) — during `normalizeManifest()` called from `prompt-composer.ts:36`

While `normalizeMode` is idempotent (so correctness is fine), the deep-clone + full re-normalization in `normalizeManifest()` is wasteful when the manifest was already normalized by the generator.

**Change:**
- Add a `__normalized: true` flag or `manifestVersion` check in `normalizeManifest()` to short-circuit if already normalized.
- Alternatively, just accept the triple normalization as idempotent and low-cost (JSON.parse/stringify clone is the main cost). Given this is a CLI that runs once per session spawn, the perf impact is negligible.

**Recommendation:** Skip this fix — it's idempotent and costs <1ms. Document it as "accepted technical debt" rather than adding complexity.

---

## 8. Parallelize Worker-Init API Calls (MEDIUM)

**File:** `maestro-cli/src/commands/worker-init.ts`

**Current state (lines 109-148):** `autoUpdateSessionStatus` makes API calls sequentially:
1. PATCH `/api/sessions/{id}` (session status → working)
2. For each task:
   - PATCH `/api/tasks/{id}` (task status → in_progress)
   - PATCH `/api/tasks/{id}` (session status → working)

With N tasks, this is 1 + 2N sequential HTTP calls.

**Change:**
```ts
private async autoUpdateSessionStatus(manifest: MaestroManifest, sessionId: string): Promise<void> {
  try {
    // Fire all API calls in parallel
    const promises: Promise<void>[] = [
      api.patch(`/api/sessions/${sessionId}`, { status: 'working' }).catch(() => {}),
    ];

    for (const task of manifest.tasks) {
      promises.push(
        api.patch(`/api/tasks/${task.id}`, { status: 'in_progress' }).catch(ignoreDebug),
        api.patch(`/api/tasks/${task.id}`, {
          sessionStatus: 'working',
          updateSource: 'session',
          sessionId,
        }).catch(ignoreDebug),
      );
    }

    await Promise.all(promises);
  } catch { /* ... */ }
}
```

**Impact:** With 3 tasks, goes from 7 sequential HTTP calls to 1 parallel batch.

---

## 9. Cache Prompt Composition (LOW)

**File:** `maestro-cli/src/prompting/prompt-composer.ts`

**Current state:** `compose()` is called once per session spawn. The prompt builder does string concatenation and XML injection — there's no caching issue because it's a one-shot operation.

**Recommendation:** Skip this fix — prompt composition is a one-shot operation during CLI init. No caching needed.

---

## 10. Lazy Spawner Init (LOW)

**File:** `maestro-cli/src/services/agent-spawner.ts`

**Current state:** `AgentSpawner` constructor eagerly creates all 3 spawner instances (Claude, Codex, Gemini), but only one is ever used per session.

**Change:** Lazy-init spawners on first use:
```ts
export class AgentSpawner implements IAgentSpawner {
  private _claudeSpawner?: ClaudeSpawner;
  private _codexSpawner?: CodexSpawner;
  private _geminiSpawner?: GeminiSpawner;

  private getSpawner(manifest: MaestroManifest): IAgentSpawner {
    const agentTool = manifest.agentTool || 'claude-code';
    switch (agentTool) {
      case 'codex':
        return (this._codexSpawner ??= new CodexSpawner());
      case 'gemini':
        return (this._geminiSpawner ??= new GeminiSpawner());
      default:
        return (this._claudeSpawner ??= new ClaudeSpawner());
    }
  }
  // ...
}
```

**Impact:** Minor — avoids constructing 2 unused spawner instances. Constructor overhead is small, but it's a clean improvement.

---

## 11. Cache Skill Discovery (LOW)

**File:** `maestro-cli/src/services/skill-loader.ts`

**Current state:** `discover()` scans up to 4 filesystem directories every time it's called. `load()` calls `discover()` internally. `getSkillInfo()` also calls `discover()`.

**Change:** Add a simple in-memory cache with optional invalidation:
```ts
export class SkillLoader {
  private _cachedSkills?: SkillInfo[];

  async discover(): Promise<SkillInfo[]> {
    if (this._cachedSkills) return this._cachedSkills;
    // ... existing scan logic ...
    this._cachedSkills = result;
    return result;
  }

  invalidateCache(): void {
    this._cachedSkills = undefined;
  }
}
```

**Impact:** Avoids redundant filesystem scans when `load()` and `getSkillInfo()` are called after `discover()`.

---

## 12. Add Migration Sentinel File (LOW)

**File:** `maestro-server/src/container.ts`

**Current state (line 186):** `migrateTeamMemberTasks()` runs every startup, scanning all tasks.

**Change:**
```ts
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

async function migrateTeamMemberTasks(taskRepo, logger, dataDir): Promise<void> {
  const sentinelPath = join(dataDir, '.migrated-team-member-tasks');
  if (existsSync(sentinelPath)) {
    logger.info('Team member task migration already completed, skipping.');
    return;
  }
  // ... existing migration logic ...
  writeFileSync(sentinelPath, new Date().toISOString());
}
```

**Impact:** Skips full task scan on every startup after first migration.

---

## Summary: Implementation Order

| # | Fix | Priority | Impact | Risk |
|---|-----|----------|--------|------|
| 1 | manualChunks in vite.config.ts | Critical | High | Low |
| 2 | Lazy-load Board in App.tsx | High | ~500KB saved | Low |
| 3 | Lazy-load MermaidDiagram in DocViewer | High | ~2.5MB saved | Low |
| 4 | Lazy-load TeamView in App.tsx | Medium | Moderate | Low |
| 5 | Lazy-load CommandPalette in App.tsx | Medium | Moderate | Low |
| 6 | Parallelize repo init in container.ts | Medium | 1-5s→<1s startup | Low |
| 7 | Triple normalization | Skip | Negligible | N/A |
| 8 | Parallelize worker-init API calls | Medium | Faster session start | Low |
| 9 | Cache prompts | Skip | None needed | N/A |
| 10 | Lazy spawner init | Low | Minor | Low |
| 11 | Cache skill discovery | Low | Avoids FS scans | Low |
| 12 | Migration sentinel file | Low | Skips scan on startup | Low |

**Skipped items (7, 9):** Triple normalization is idempotent and <1ms cost. Prompt caching is unnecessary since compose() is one-shot.

**Total estimated initial bundle savings: ~3MB+ (recharts + mermaid + board tree + team view + command palette)**
