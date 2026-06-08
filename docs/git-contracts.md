# Git Integration — Shared Contracts (authoritative)

Every git feature worker MUST conform to these contracts so the 15 features compose without redesign. The **Foundation worker** creates all of this as stubs + the A1 real logic. **Feature workers** fill in stubs and add their UI/tests — they do NOT change signatures without coordinator approval.

Worktree (do ALL work here): `/Users/subhang/Desktop/Projects/maestro/agent-maestro-gitfeat`
Branch: `feature/git-integration` (off `origin/staging`).

---

## 1. Server — `GitService`

Location: `maestro-server/src/application/services/GitService.ts` (rename/extend the existing `GitWorktreeService`; keep `GitWorktreeService` as a re-export alias if anything imports it).

```ts
export interface GitFileChange { path: string; status: 'A'|'M'|'D'|'R'|'?'; insertions: number; deletions: number; }
export interface GitDiffSummary {
  branch: string; baseBranch: string; baseCommit: string;
  ahead: number; behind: number; dirty: boolean;
  filesChanged: number; insertions: number; deletions: number;
  commitCount: number; files: GitFileChange[];
}
export interface GitPrInfo { url: string; number: number; state: 'OPEN'|'MERGED'|'CLOSED'|'DRAFT';
  checks?: 'passing'|'failing'|'pending'|'none'; reviewDecision?: 'APPROVED'|'CHANGES_REQUESTED'|'REVIEW_REQUIRED'|null; }
export interface GitCapabilities { hasGit: boolean; hasGh: boolean; ghAuthed: boolean; }

export class GitService {
  // repo  (G1, D1)
  isGitRepo(dir: string): Promise<boolean>;
  capabilities(dir: string): Promise<GitCapabilities>;
  defaultBaseBranch(dir: string): Promise<string>;            // origin/HEAD -> e.g. "main"/"staging"
  currentBranch(dir: string): Promise<string>;
  headCommit(dir: string): Promise<string>;

  // worktree  (A1, B, E, F)
  createWorktree(projectDir: string, sessionId: string, slug?: string):
    Promise<{ worktreePath: string; branchName: string; baseCommit: string }>;  // branch = maestro/<slug>-<shortid>
  removeWorktree(projectDir: string, worktreePath: string, branchName: string): Promise<void>;
  worktreeExists(worktreePath: string): Promise<boolean>;

  // diff  (C1, C2, D1)
  diffSummary(worktreePath: string, baseCommit: string): Promise<GitDiffSummary>;
  fullDiff(worktreePath: string, baseCommit: string, file?: string): Promise<string>; // committed + uncommitted

  // branch  (D2)
  renameBranch(worktreePath: string, newName: string): Promise<{ branchName: string }>;

  // merge  (E1)
  mergeBranch(projectDir: string, branchName: string, targetBranch: string):
    Promise<{ success: boolean; message: string; conflicts?: string[] }>;

  // pr  (F1, F2)
  createPullRequest(worktreePath: string, branchName: string, title: string, body: string, baseBranch: string):
    Promise<GitPrInfo>;                                       // git push -u origin <branch> && gh pr create ...
  getPullRequest(worktreePath: string, branchOrNumber: string): Promise<GitPrInfo | null>; // gh pr view --json
}
```

Rules: all shell calls via `execFile('git'|'gh', [...args])`, never string-interpolated. Branch slug from task title: lowercase, non-alphanumeric→`-`, trimmed, max ~30 chars, suffixed with 4-char id. `baseCommit` is captured at worktree creation and stored on session metadata — all diffs are `baseCommit..worktreeHEAD` plus uncommitted (`git status --porcelain`).

## 2. Server — session metadata additions
On `Session.metadata`: `worktreePath`, `worktreeBranch`, `worktreeBaseCommit`, `prUrl?`, `prNumber?`.
- A1: `FileSystemSessionRepository.update()` must merge generic `updates.metadata` (`{ ...session.metadata, ...updates.metadata }`). Persist worktree fields at spawn via `updateSession({ metadata })`.

## 3. Server — routes
New file `maestro-server/src/api/gitRoutes.ts`, registered in `container.ts`/app like other route modules. All Zod-validated.
```
GET    /git/capabilities                       -> GitCapabilities (uses ?projectId= or active project dir)
GET    /sessions/:id/git                        -> { hasWorktree, summary?: GitDiffSummary, pr?: GitPrInfo }
GET    /sessions/:id/git/diff?file=             -> { diff: string }
POST   /sessions/:id/git/branch  {name}         -> { branchName }
POST   /sessions/:id/git/merge   {targetBranch?}-> { success, message, conflicts? }
POST   /sessions/:id/git/pr      {title,body,baseBranch?} -> GitPrInfo
GET    /sessions/:id/git/pr                      -> GitPrInfo | { pr: null }
DELETE /sessions/:id/git/worktree               -> { success }
```
Mutating routes (branch/merge/pr/DELETE) reject unless `session.status ∈ {completed, stopped, failed}` (409). After any mutation emit WS `session:git_changed` `{ sessionId }`.

## 4. UI — `MaestroClient` (`maestro-ui/src/utils/MaestroClient.ts`)
```ts
getGitCapabilities(projectId?: string): Promise<GitCapabilities>;
getSessionGit(sessionId: string): Promise<{ hasWorktree: boolean; summary?: GitDiffSummary; pr?: GitPrInfo }>;
getSessionGitDiff(sessionId: string, file?: string): Promise<{ diff: string }>;
renameSessionBranch(sessionId: string, name: string): Promise<{ branchName: string }>;
mergeSessionWorktree(sessionId: string, targetBranch?: string): Promise<{ success: boolean; message: string; conflicts?: string[] }>;
createSessionPr(sessionId: string, data: { title: string; body: string; baseBranch?: string }): Promise<GitPrInfo>;
getSessionPr(sessionId: string): Promise<GitPrInfo | null>;
discardSessionWorktree(sessionId: string): Promise<{ success: boolean }>;
```
Mirror the types in `maestro-ui/src/app/types/maestro.ts` (`GitDiffSummary`, `GitFileChange`, `GitPrInfo`, `GitCapabilities`).

## 5. UI — `GitPanel`
Location: `maestro-ui/src/components/maestro/GitPanel.tsx` (Foundation creates the skeleton + sections + props).
```ts
interface GitPanelProps { sessionId: string; compact?: boolean; onAction?: (a:'merged'|'pr-created'|'discarded'|'renamed')=>void; }
```
Sections (each feature fills its own, Foundation stubs them): Header (branch+base+ahead/dirty — D1), Changes summary+file list (C1), Diff viewer (C2), Branch rename (D2), Merge action (E1), PR form + PR chip (F1/F2), Discard (B3). Subscribe to `session:git_changed` to refetch. Integrated into `SessionDetailModal` by Foundation; badges (B2) added by B2 worker.
Styles: `maestro-ui/src/styles-git.css` (Foundation creates + imports it).

## 6. Conventions for every feature worker
- `cd` into the worktree path above; never edit the main checkout.
- Build must pass: `bun run build:server` / `build:ui` for files you touched. Run the package's tests.
- Conform to contracts; if a signature is wrong, message the coordinator instead of diverging.
- Commit on green with a clear message; report via `maestro task report complete`.
