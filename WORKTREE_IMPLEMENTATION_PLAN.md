# Git Worktree Integration — Implementation Plan (Phases 1–3)

> Phase 4 (Worktree Setup Hooks) is tracked separately.

---

## Current State Summary

Worktree support is **~80% wired** end-to-end. Here's what already exists:

| Layer | What Exists | Key Files |
|-------|-------------|-----------|
| **Types** | `Task.useWorktree`, `SpawnSessionPayload.useWorktree`, `Session.metadata.worktreePath/worktreeBranch` | `maestro-server/src/types.ts:277,470,493,561` / `maestro-ui/src/app/types/maestro.ts:331,427,537,555` |
| **Server Service** | `GitWorktreeService` with `createWorktree()`, `removeWorktree()`, `isGitRepo()` | `maestro-server/src/application/services/GitWorktreeService.ts` (61 lines) |
| **Spawn Endpoint** | Validates git repo, creates worktree, stores metadata on session, sets `cwd` to worktree path, injects env vars | `maestro-server/src/api/sessionRoutes.ts:953-957,1105-1185,1274,1312-1315` |
| **Resume Endpoint** | Uses worktree path as `cwd`, passes env vars | `maestro-server/src/api/sessionRoutes.ts:1428,1523-1528` |
| **Cleanup** | `SessionService.deleteSession()` removes worktree + branch | `maestro-server/src/application/services/SessionService.ts:218-233` |
| **Validation** | `useWorktree` accepted in create task, update task, and spawn session schemas | `maestro-server/src/api/validation.ts:102,123,322` |
| **Repository** | `useWorktree` stored on task creation (line 269) and update (line 438) | `maestro-server/src/infrastructure/repositories/FileSystemTaskRepository.ts` |
| **UI Toggle** | Toggle button on `TaskListItem` (post-creation) | `maestro-ui/src/components/maestro/TaskListItem.tsx:746-756` |
| **UI Styles** | `.terminalWorktreeToggle` / `--on` classes | `maestro-ui/src/styles-task-list-redesign.css:316-342` |
| **Session Spawn** | `MaestroPanel.handleWorkOnTask` passes `useWorktree` to `createMaestroSession` | `maestro-ui/src/components/maestro/MaestroPanel.tsx:411` |
| **Service Layer** | `createMaestroSession()` spreads `useWorktree` into spawn payload | `maestro-ui/src/services/maestroService.ts:35,37,89` |

### What's Missing

1. **CreateTaskModal** has zero worktree awareness — no toggle in create or edit flow
2. **No worktree visibility** — sessions don't show branch name, worktree path, or any indicator
3. **No post-session worktree management** — no diff view, no PR creation, no merge, no discard UI
4. **Session metadata is immutable after creation** — `updateSessionSchema` and `FileSystemSessionRepository.update()` don't handle `metadata` field updates

---

## Phase 1: CreateTaskModal Worktree Toggle

**Goal**: Let users enable worktree isolation when creating or editing a task, directly from the modal.

### 1.1 Add `useWorktree` state to `useTaskForm` hook

**File**: `maestro-ui/src/hooks/useTaskForm.ts`

**Changes**:
- Add state: `const [useWorktree, setUseWorktree] = useState(false);` (after line 16)
- Pre-fill in edit mode effect (after line 48): `setUseWorktree(task.useWorktree || false);`
- Reset in create mode effect (after line 78): `setUseWorktree(false);`
- Add to `hasUnsavedContent` check for edit mode (around line 88): compare `useWorktree !== (task.useWorktree || false)`
- Add to `resetForm()` (after line 164): `setUseWorktree(false);`
- Add to `getCreatePayload()` return (after line 183): `useWorktree: useWorktree || undefined,`
- Add to `getUpdateDiff()` (after line 209): `if (useWorktree !== (task.useWorktree || false)) updates.useWorktree = useWorktree;`
- Export from hook return (after line 217): `useWorktree, setUseWorktree,`

### 1.2 Add worktree toggle to `DetailsTab`

**File**: `maestro-ui/src/components/maestro/task-modal/DetailsTab.tsx`

**Changes**:
- Add props: `useWorktree: boolean`, `onUseWorktreeChange: (val: boolean) => void`
- Add a new row after the Due Date row (after line 70), before the edit-mode status display:

```tsx
<div className="themedFormRow" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
    <div className="themedFormLabel" style={{ marginBottom: 0, flexShrink: 0 }}>Isolation</div>
    <button
        type="button"
        className={`terminalWorktreeToggle ${useWorktree ? 'terminalWorktreeToggle--on' : ''}`}
        onClick={() => onUseWorktreeChange(!useWorktree)}
        title={useWorktree ? 'Worktree isolation ON' : 'Enable git worktree isolation'}
    >
        {useWorktree ? '\uD83C\uDF3F worktree' : 'off'}
    </button>
    <span style={{ fontSize: '10px', color: 'var(--theme-text-secondary)', opacity: 0.6 }}>
        {useWorktree ? 'Session runs in an isolated git worktree branch' : 'Session runs in main working directory'}
    </span>
</div>
```

This reuses the existing `.terminalWorktreeToggle` CSS classes from `styles-task-list-redesign.css:316-342`.

### 1.3 Wire DetailsTab in CreateTaskModal

**File**: `maestro-ui/src/components/maestro/CreateTaskModal.tsx`

**Change** at line 360-368 (DetailsTab rendering):
```tsx
<DetailsTab
    priority={form.priority}
    onPriorityChange={form.setPriority}
    dueDate={form.dueDate}
    onDueDateChange={form.setDueDate}
    useWorktree={form.useWorktree}
    onUseWorktreeChange={form.setUseWorktree}
    isEditMode={isEditMode}
    task={task}
/>
```

### 1.4 Add `useWorktree` to `onCreate` callback type

**File**: `maestro-ui/src/components/maestro/CreateTaskModal.tsx`

**Change** at lines 32-43 — add to the `onCreate` parameter type:
```typescript
onCreate: (task: {
    title: string;
    description: string;
    priority: string;
    startImmediately?: boolean;
    skillIds?: string[];
    referenceTaskIds?: string[];
    parentId?: string;
    teamMemberId?: string;
    teamMemberIds?: string[];
    memberOverrides?: Record<string, MemberLaunchOverride>;
    useWorktree?: boolean;       // <-- ADD
}) => Promise<void> | void;
```

### 1.5 Propagate in MaestroPanel's `handleCreateTask`

**File**: `maestro-ui/src/components/maestro/MaestroPanel.tsx`

Wherever the `onCreate` callback is implemented (the function that calls `createTask`), ensure `useWorktree` from the payload is included in the task creation API call. Search for where `createTask` is called with the modal's output and add `useWorktree: taskData.useWorktree` to the create call.

### Files touched (Phase 1)
1. `maestro-ui/src/hooks/useTaskForm.ts` — add state + logic
2. `maestro-ui/src/components/maestro/task-modal/DetailsTab.tsx` — add toggle UI
3. `maestro-ui/src/components/maestro/CreateTaskModal.tsx` — wire props + update type
4. `maestro-ui/src/components/maestro/MaestroPanel.tsx` — propagate to createTask

---

## Phase 2: Worktree Status Visibility

**Goal**: Show users which sessions are running in worktrees, what branch they're on, and the worktree path.

### 2.1 Add worktree metadata to `MaestroSession` type

**File**: `maestro-ui/src/app/types/maestro.ts`

The `metadata?: Record<string, any>` field on `MaestroSession` (line 359) already exists. No type change needed — we access `session.metadata?.worktreePath` and `session.metadata?.worktreeBranch` directly. But for type safety and discoverability, add typed accessors or a helper:

```typescript
// Add near the MaestroSession interface (or in a utils file)
export function getWorktreeInfo(session: MaestroSession): { path: string; branch: string } | null {
    if (!session.metadata?.worktreePath) return null;
    return {
        path: session.metadata.worktreePath,
        branch: session.metadata.worktreeBranch || '',
    };
}
```

### 2.2 Add worktree badge to `SessionInTaskView`

**File**: `maestro-ui/src/components/maestro/SessionInTaskView.tsx`

After the session name and strategy badge display, add a worktree indicator:

```tsx
{session.metadata?.worktreePath && (
    <span
        className="terminalWorktreeToggle terminalWorktreeToggle--on"
        style={{ cursor: 'default', pointerEvents: 'none' }}
        title={`Branch: ${session.metadata.worktreeBranch}\nPath: ${session.metadata.worktreePath}`}
    >
        {'\uD83C\uDF3F'} {session.metadata.worktreeBranch?.replace('maestro/', '') || 'worktree'}
    </span>
)}
```

This reuses the existing `.terminalWorktreeToggle--on` styling.

### 2.3 Add worktree info to `SessionDetailsSection`

**File**: `maestro-ui/src/components/maestro/SessionDetailsSection.tsx`

In the "Core Info" grid (after the existing rows like Started, Last Activity, Duration), add:

```tsx
{session.metadata?.worktreePath && (
    <>
        <div className="sessionDetailsRow">
            <span className="sessionDetailsLabel">Worktree Branch</span>
            <span className="sessionDetailsValue" style={{ color: '#4caf50' }}>
                {session.metadata.worktreeBranch}
            </span>
        </div>
        <div className="sessionDetailsRow">
            <span className="sessionDetailsLabel">Worktree Path</span>
            <span className="sessionDetailsValue" style={{ fontSize: '10px', wordBreak: 'break-all' }}>
                {session.metadata.worktreePath}
            </span>
        </div>
    </>
)}
```

### 2.4 Add worktree info to `SessionDetailModal`

**File**: `maestro-ui/src/components/maestro/SessionDetailModal.tsx`

In the info grid section (where it shows Started, Last Activity, Agent ID, etc.), add worktree rows:

```tsx
{session.metadata?.worktreePath && (
    <>
        <div className="sessionDetailModalInfoRow">
            <span className="sessionDetailModalInfoLabel">Worktree Branch</span>
            <span className="sessionDetailModalInfoValue" style={{ color: '#4caf50' }}>
                {session.metadata.worktreeBranch}
            </span>
        </div>
        <div className="sessionDetailModalInfoRow">
            <span className="sessionDetailModalInfoLabel">Worktree Path</span>
            <span className="sessionDetailModalInfoValue">
                {session.metadata.worktreePath}
            </span>
        </div>
    </>
)}
```

### 2.5 Add worktree indicator to `TeamSessionGroup`

**File**: `maestro-ui/src/components/maestro/TeamSessionGroup.tsx`

In the member chips or session items, show a small leaf icon next to sessions that have worktree metadata:

```tsx
{session.metadata?.worktreePath && (
    <span title="Running in isolated worktree" style={{ fontSize: '10px' }}>{'\uD83C\uDF3F'}</span>
)}
```

### 2.6 Ensure session metadata is returned from server

**Verify**: The session object returned from the API includes `metadata`. Check:
- `FileSystemSessionRepository.create()` stores `metadata: input.metadata` (line 416)
- But the spawn endpoint sets metadata via direct mutation (`(session as any).metadata = {}`) at line 1172, then stores worktree info
- The session env vars are updated via `sessionService.updateSession()` at line 1163, but metadata is NOT persisted through this call

**Problem**: The metadata is set in-memory on the session object at lines 1172-1174 but NOT persisted to disk. The `updateSession` call at line 1163 only updates `env`, not `metadata`. The `FileSystemSessionRepository.update()` method (line 498-534) doesn't handle metadata updates.

**Fix Required in Server**:

**File**: `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts`

Add metadata handling to the `update()` method (around line 530, before the save):
```typescript
if (updates.metadata) {
    session.metadata = { ...session.metadata, ...updates.metadata };
}
```

**File**: `maestro-server/src/types.ts`

Add `metadata` to `UpdateSessionPayload` (around line 470):
```typescript
metadata?: Record<string, any>;
```

**File**: `maestro-server/src/api/validation.ts`

Add `metadata` to `updateSessionSchema` (around line 245-270):
```typescript
metadata: z.record(z.any()).optional(),
```

**File**: `maestro-server/src/api/sessionRoutes.ts`

Change the spawn endpoint worktree section (lines 1161-1174) to properly persist metadata via the update call instead of direct mutation:
```typescript
worktreeResult = await gitWorktreeService.createWorktree(project.workingDir, session.id);
await sessionService.updateSession(session.id, {
    env: {
        ...session.env,
        MAESTRO_WORKTREE_PATH: worktreeResult.worktreePath,
        MAESTRO_WORKTREE_BRANCH: worktreeResult.branchName,
        MAESTRO_PROJECT_DIR: project.workingDir,
    },
    metadata: {
        ...session.metadata,
        worktreePath: worktreeResult.worktreePath,
        worktreeBranch: worktreeResult.branchName,
    },
});
```

### Files touched (Phase 2)
1. `maestro-ui/src/app/types/maestro.ts` — add `getWorktreeInfo` helper
2. `maestro-ui/src/components/maestro/SessionInTaskView.tsx` — add worktree badge
3. `maestro-ui/src/components/maestro/SessionDetailsSection.tsx` — add worktree rows
4. `maestro-ui/src/components/maestro/SessionDetailModal.tsx` — add worktree rows
5. `maestro-ui/src/components/maestro/TeamSessionGroup.tsx` — add leaf indicator
6. `maestro-server/src/infrastructure/repositories/FileSystemSessionRepository.ts` — handle metadata in update()
7. `maestro-server/src/types.ts` — add metadata to UpdateSessionPayload
8. `maestro-server/src/api/validation.ts` — add metadata to updateSessionSchema
9. `maestro-server/src/api/sessionRoutes.ts` — persist metadata properly in spawn

---

## Phase 3: Post-Session Worktree Management

**Goal**: When a worktree session completes, let users view changes, create PRs, merge back, or discard.

### 3.1 Extend `GitWorktreeService` with diff/PR/merge operations

**File**: `maestro-server/src/application/services/GitWorktreeService.ts`

Add these methods:

```typescript
/**
 * Get a summary of changes in the worktree compared to its parent branch.
 */
async getWorktreeDiff(worktreePath: string): Promise<{
    filesChanged: number;
    insertions: number;
    deletions: number;
    files: Array<{ path: string; status: string; insertions: number; deletions: number }>;
    hasPushedBranch: boolean;
    branchName: string;
    commitCount: number;
}> {
    // 1. Get branch name
    const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: worktreePath });

    // 2. Get merge-base with the original HEAD
    const { stdout: mergeBase } = await execFileAsync('git', ['merge-base', 'HEAD', 'HEAD~0'], { cwd: worktreePath });
    // Alternatively, diff against the commit the worktree was created from

    // 3. Get diff stat
    const { stdout: diffStat } = await execFileAsync(
        'git', ['diff', '--stat', '--numstat', 'HEAD@{upstream}..HEAD'],
        { cwd: worktreePath }
    ).catch(() => ({ stdout: '' }));

    // 4. Check for uncommitted changes
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: worktreePath });

    // 5. Count commits on worktree branch not on the base
    const { stdout: commitLog } = await execFileAsync(
        'git', ['log', '--oneline', `${mergeBase.trim()}..HEAD`],
        { cwd: worktreePath }
    ).catch(() => ({ stdout: '' }));

    // Parse and return structured diff info
    // ... (parsing logic)
}

/**
 * Get the full diff output for display.
 */
async getWorktreeFullDiff(worktreePath: string): Promise<string> {
    // Get all changes (committed + uncommitted) relative to the base
    const { stdout: baseCommit } = await execFileAsync(
        'git', ['rev-list', '--max-parents=0', 'HEAD'],
        { cwd: worktreePath }
    );
    // Use the worktree's initial commit as base
    const { stdout } = await execFileAsync(
        'git', ['diff', 'HEAD~1', '--', '.'],
        { cwd: worktreePath }
    ).catch(() => ({ stdout: 'No changes detected' }));
    return stdout;
}

/**
 * Push the worktree branch to remote and create a PR via gh CLI.
 */
async createPullRequest(
    worktreePath: string,
    branchName: string,
    title: string,
    body: string,
    baseBranch?: string,
): Promise<{ prUrl: string; prNumber: number }> {
    // 1. Push branch to remote
    await execFileAsync('git', ['push', '-u', 'origin', branchName], { cwd: worktreePath });

    // 2. Create PR using gh CLI
    const args = ['pr', 'create', '--title', title, '--body', body];
    if (baseBranch) args.push('--base', baseBranch);
    const { stdout } = await execFileAsync('gh', args, { cwd: worktreePath });

    // Parse PR URL from stdout
    const prUrl = stdout.trim();
    const prNumber = parseInt(prUrl.split('/').pop() || '0');
    return { prUrl, prNumber };
}

/**
 * Merge the worktree branch back into a target branch.
 */
async mergeBranch(
    projectDir: string,
    branchName: string,
    targetBranch?: string,
): Promise<{ success: boolean; message: string }> {
    const target = targetBranch || 'main';
    try {
        // Merge in the main worktree
        await execFileAsync('git', ['merge', branchName, '--no-edit'], { cwd: projectDir });
        return { success: true, message: `Merged ${branchName} into ${target}` };
    } catch (err: any) {
        return { success: false, message: err.message || 'Merge failed — conflicts detected' };
    }
}

/**
 * Check if the worktree directory still exists on disk.
 */
async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
        await fs.access(worktreePath);
        return true;
    } catch {
        return false;
    }
}
```

### 3.2 Add new API endpoints for worktree management

**File**: `maestro-server/src/api/sessionRoutes.ts`

Add these endpoints after the existing session routes:

```typescript
// GET /sessions/:id/worktree — Get worktree status and diff summary
router.get('/sessions/:id/worktree', validateParams(idParamSchema), async (req, res) => {
    const session = await sessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const worktreePath = session.metadata?.worktreePath;
    const branchName = session.metadata?.worktreeBranch;
    if (!worktreePath || !branchName) {
        return res.json({ hasWorktree: false });
    }

    const exists = await gitWorktreeService.worktreeExists(worktreePath);
    if (!exists) {
        return res.json({ hasWorktree: false, cleaned: true });
    }

    const diff = await gitWorktreeService.getWorktreeDiff(worktreePath);
    return res.json({
        hasWorktree: true,
        worktreePath,
        branchName,
        sessionStatus: session.status,
        diff,
    });
});

// GET /sessions/:id/worktree/diff — Get full diff output
router.get('/sessions/:id/worktree/diff', validateParams(idParamSchema), async (req, res) => {
    const session = await sessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const worktreePath = session.metadata?.worktreePath;
    if (!worktreePath) return res.status(400).json({ error: 'No worktree for this session' });

    const fullDiff = await gitWorktreeService.getWorktreeFullDiff(worktreePath);
    return res.json({ diff: fullDiff });
});

// POST /sessions/:id/worktree/pr — Create a PR from worktree branch
router.post('/sessions/:id/worktree/pr', validateParams(idParamSchema), async (req, res) => {
    const { title, body, baseBranch } = req.body;
    const session = await sessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const worktreePath = session.metadata?.worktreePath;
    const branchName = session.metadata?.worktreeBranch;
    if (!worktreePath || !branchName) {
        return res.status(400).json({ error: 'No worktree for this session' });
    }

    const result = await gitWorktreeService.createPullRequest(
        worktreePath, branchName, title, body, baseBranch
    );
    return res.json(result);
});

// POST /sessions/:id/worktree/merge — Merge worktree branch into target
router.post('/sessions/:id/worktree/merge', validateParams(idParamSchema), async (req, res) => {
    const { targetBranch } = req.body;
    const session = await sessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const branchName = session.metadata?.worktreeBranch;
    if (!branchName) return res.status(400).json({ error: 'No worktree for this session' });

    const project = await projectRepo.findById(session.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const result = await gitWorktreeService.mergeBranch(
        project.workingDir, branchName, targetBranch
    );
    return res.json(result);
});

// DELETE /sessions/:id/worktree — Discard/remove worktree and branch
router.delete('/sessions/:id/worktree', validateParams(idParamSchema), async (req, res) => {
    const session = await sessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const worktreePath = session.metadata?.worktreePath;
    const branchName = session.metadata?.worktreeBranch;
    if (!worktreePath || !branchName) {
        return res.status(400).json({ error: 'No worktree for this session' });
    }

    const project = await projectRepo.findById(session.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await gitWorktreeService.removeWorktree(project.workingDir, worktreePath, branchName);

    // Clear metadata on session
    await sessionService.updateSession(session.id, {
        metadata: { worktreePath: null, worktreeBranch: null },
    });

    return res.json({ success: true });
});
```

### 3.3 Add API client methods

**File**: `maestro-ui/src/utils/MaestroClient.ts`

Add methods to the MaestroClient class:

```typescript
// Worktree management
async getWorktreeStatus(sessionId: string): Promise<WorktreeStatus> {
    return this.fetch<WorktreeStatus>(`/sessions/${sessionId}/worktree`);
}

async getWorktreeDiff(sessionId: string): Promise<{ diff: string }> {
    return this.fetch<{ diff: string }>(`/sessions/${sessionId}/worktree/diff`);
}

async createWorktreePR(sessionId: string, data: { title: string; body: string; baseBranch?: string }): Promise<{ prUrl: string; prNumber: number }> {
    return this.fetch(`/sessions/${sessionId}/worktree/pr`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

async mergeWorktree(sessionId: string, targetBranch?: string): Promise<{ success: boolean; message: string }> {
    return this.fetch(`/sessions/${sessionId}/worktree/merge`, {
        method: 'POST',
        body: JSON.stringify({ targetBranch }),
    });
}

async discardWorktree(sessionId: string): Promise<{ success: boolean }> {
    return this.fetch(`/sessions/${sessionId}/worktree`, {
        method: 'DELETE',
    });
}
```

### 3.4 Add `WorktreeStatus` type

**File**: `maestro-ui/src/app/types/maestro.ts`

```typescript
export interface WorktreeDiffSummary {
    filesChanged: number;
    insertions: number;
    deletions: number;
    files: Array<{ path: string; status: string; insertions: number; deletions: number }>;
    hasPushedBranch: boolean;
    branchName: string;
    commitCount: number;
}

export interface WorktreeStatus {
    hasWorktree: boolean;
    cleaned?: boolean;
    worktreePath?: string;
    branchName?: string;
    sessionStatus?: MaestroSessionStatus;
    diff?: WorktreeDiffSummary;
}
```

### 3.5 Create `WorktreeManagementPanel` component

**File**: `maestro-ui/src/components/maestro/WorktreeManagementPanel.tsx` (NEW)

This is the main UI component shown when a worktree session completes. It displays:

1. **Diff summary header**: `3 files changed, +45 -12, 2 commits`
2. **File list**: Table of changed files with status (M/A/D) and +/- counts
3. **Action buttons**:
   - **Create PR** — opens a mini-form (title, body, base branch) then calls the API
   - **Merge to main** — with confirmation dialog, calls merge API
   - **Keep** — just closes the panel, worktree stays
   - **Discard** — with confirmation dialog, calls delete API
4. **Full diff viewer** — expandable section showing the raw diff output

```tsx
interface WorktreeManagementPanelProps {
    sessionId: string;
    onClose: () => void;
    onAction?: (action: 'pr-created' | 'merged' | 'discarded') => void;
}
```

**State management**:
- Fetch worktree status on mount via `maestroClient.getWorktreeStatus(sessionId)`
- Show loading state while fetching
- Show "No worktree" or "Already cleaned up" if applicable
- Track action-in-progress state for button loading indicators

**PR Creation Sub-form**:
```tsx
{showPRForm && (
    <div className="worktreePRForm">
        <input placeholder="PR Title" value={prTitle} onChange={...} />
        <textarea placeholder="PR Description" value={prBody} onChange={...} />
        <button onClick={handleCreatePR}>Create PR</button>
        <button onClick={() => setShowPRForm(false)}>Cancel</button>
    </div>
)}
```

### 3.6 Integrate panel into session views

**Option A: Inline in `SessionInTaskView`**

**File**: `maestro-ui/src/components/maestro/SessionInTaskView.tsx`

When a session has worktree metadata and status is `completed` or `stopped`, show the management panel:

```tsx
{session.metadata?.worktreePath &&
 ['completed', 'stopped'].includes(session.status) && (
    <WorktreeManagementPanel
        sessionId={session.id}
        onClose={() => {}}
        onAction={(action) => {
            // Optionally refresh session data
        }}
    />
)}
```

**Option B: As a modal from SessionDetailModal**

Add a "Manage Worktree" button in `SessionDetailModal` that opens the panel as a sub-modal or inline section.

**Recommendation**: Use **both** — show a compact summary inline in `SessionInTaskView` and a full panel accessible from `SessionDetailModal`.

### 3.7 Auto-notify on worktree session completion

**File**: `maestro-server/src/application/services/SessionService.ts`

In the `updateSession` method, when a session transitions to `completed` and has worktree metadata, add a timeline event prompting worktree management:

```typescript
// After status transition check (around line 180)
if (session.metadata?.worktreePath && session.status === 'completed' && oldStatus !== 'completed') {
    await this.sessionRepo.addTimelineEvent(id, {
        id: this.idGenerator.generate('evt'),
        type: 'milestone',
        timestamp: Date.now(),
        message: `Worktree session completed. Branch: ${session.metadata.worktreeBranch}. Review changes and create a PR, merge, or discard.`,
        metadata: { worktreeAction: 'review_needed' },
    });
}
```

### 3.8 Add CSS styles for worktree management

**File**: `maestro-ui/src/styles-task-list-redesign.css` (or a new `styles-worktree.css`)

```css
/* Worktree management panel */
.worktreePanel {
    border: 1px solid rgba(76, 175, 80, 0.3);
    border-radius: 6px;
    padding: 10px;
    margin-top: 8px;
    background: rgba(76, 175, 80, 0.05);
}

.worktreePanelHeader {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #4caf50;
    margin-bottom: 8px;
}

.worktreeFileList {
    font-size: 11px;
    font-family: var(--font-mono);
    max-height: 150px;
    overflow-y: auto;
}

.worktreeFileRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
}

.worktreeFileStatus--M { color: #ffab00; }
.worktreeFileStatus--A { color: #4caf50; }
.worktreeFileStatus--D { color: #f44336; }

.worktreeActions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    flex-wrap: wrap;
}

.worktreeBtn {
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: var(--theme-text-secondary);
    cursor: pointer;
    font-family: inherit;
}

.worktreeBtn--pr {
    border-color: rgba(76, 175, 80, 0.5);
    color: #4caf50;
}

.worktreeBtn--merge {
    border-color: rgba(33, 150, 243, 0.5);
    color: #2196f3;
}

.worktreeBtn--discard {
    border-color: rgba(244, 67, 54, 0.3);
    color: #f44336;
}

.worktreeDiffViewer {
    font-family: var(--font-mono);
    font-size: 11px;
    max-height: 300px;
    overflow: auto;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
    white-space: pre;
    line-height: 1.4;
}

.worktreeDiffLine--add { color: #4caf50; }
.worktreeDiffLine--remove { color: #f44336; }
.worktreeDiffLine--header { color: #2196f3; font-weight: bold; }
```

### Files touched (Phase 3)
1. `maestro-server/src/application/services/GitWorktreeService.ts` — add diff/PR/merge/discard methods
2. `maestro-server/src/api/sessionRoutes.ts` — add 5 new endpoints
3. `maestro-ui/src/utils/MaestroClient.ts` — add 5 new API methods
4. `maestro-ui/src/app/types/maestro.ts` — add WorktreeStatus, WorktreeDiffSummary types
5. `maestro-ui/src/components/maestro/WorktreeManagementPanel.tsx` — NEW component
6. `maestro-ui/src/components/maestro/SessionInTaskView.tsx` — integrate panel
7. `maestro-ui/src/components/maestro/SessionDetailModal.tsx` — integrate panel
8. `maestro-server/src/application/services/SessionService.ts` — auto-notify on completion
9. `maestro-ui/src/styles-task-list-redesign.css` (or new CSS file) — worktree panel styles

---

## Implementation Order

```
Phase 1 (CreateTaskModal toggle)
  1.1  useTaskForm — add useWorktree state           ~15 min
  1.2  DetailsTab — add toggle UI                    ~10 min
  1.3  CreateTaskModal — wire props                  ~5 min
  1.4  CreateTaskModal — update onCreate type        ~5 min
  1.5  MaestroPanel — propagate to createTask        ~10 min

Phase 2 (Worktree visibility)
  2.6  Server: fix metadata persistence (BLOCKER)    ~20 min
  2.1  Types: add getWorktreeInfo helper             ~5 min
  2.2  SessionInTaskView — add badge                 ~10 min
  2.3  SessionDetailsSection — add rows              ~10 min
  2.4  SessionDetailModal — add rows                 ~10 min
  2.5  TeamSessionGroup — add indicator              ~5 min

Phase 3 (Post-session management)
  3.1  GitWorktreeService — extend with methods      ~45 min
  3.2  Session routes — add 5 endpoints              ~30 min
  3.3  MaestroClient — add API methods               ~10 min
  3.4  Types — add WorktreeStatus types              ~5 min
  3.5  WorktreeManagementPanel — NEW component       ~60 min
  3.6  Integrate panel into session views            ~20 min
  3.7  Auto-notify on completion                     ~10 min
  3.8  CSS styles                                    ~15 min
```

**Critical path**: Phase 2 step 2.6 (server metadata persistence fix) must be done before any Phase 2 UI work, since without it the metadata won't survive server restarts.

---

## Risk Notes

1. **`gh` CLI dependency**: Phase 3 PR creation requires `gh` CLI installed. Should check for availability and show a clear error if missing.

2. **Merge conflicts**: The merge endpoint is simple (`git merge --no-edit`). If conflicts occur, it returns failure. We may want a future enhancement to show conflict details, but for v1 directing users to resolve manually is fine.

3. **Worktree disk space**: Worktrees of large repos can consume significant disk. Consider adding a cleanup reminder or auto-cleanup after N days.

4. **Concurrent access**: If a session is still running and the user tries to manage the worktree (merge/discard), bad things happen. The UI must check `session.status` and only show management actions for `completed`/`stopped`/`failed` sessions.

5. **Branch naming collisions**: If a session ID is reused (unlikely with UUID generation), the branch `maestro/{sessionId}` could conflict. Current implementation should be safe since session IDs are unique.
