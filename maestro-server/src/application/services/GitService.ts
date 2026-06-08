import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

const WORKTREE_BASE = path.join(os.homedir(), '.maestro', 'worktrees');

export interface GitFileChange {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | '?';
  insertions: number;
  deletions: number;
}

export interface GitDiffSummary {
  branch: string;
  baseBranch: string;
  baseCommit: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  filesChanged: number;
  insertions: number;
  deletions: number;
  commitCount: number;
  files: GitFileChange[];
}

export interface GitPrInfo {
  url: string;
  number: number;
  state: 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT';
  checks?: 'passing' | 'failing' | 'pending' | 'none';
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
}

export interface GitCapabilities {
  hasGit: boolean;
  hasGh: boolean;
  ghAuthed: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function shortId(len = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < len; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export class GitService {
  // ── repo ────────────────────────────────────────────────────────────────────

  async isGitRepo(dir: string): Promise<boolean> {
    try {
      await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: dir });
      return true;
    } catch {
      return false;
    }
  }

  async capabilities(dir: string): Promise<GitCapabilities> {
    const hasGit = await this.isGitRepo(dir);

    let hasGh = false;
    try {
      await execFileAsync('gh', ['--version']);
      hasGh = true;
    } catch { /* gh not installed */ }

    let ghAuthed = false;
    if (hasGh) {
      try {
        await execFileAsync('gh', ['auth', 'status']);
        ghAuthed = true;
      } catch { /* not authenticated */ }
    }

    return { hasGit, hasGh, ghAuthed };
  }

  async defaultBaseBranch(dir: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'],
        { cwd: dir }
      );
      // e.g. "origin/main" -> "main"
      return stdout.trim().replace(/^origin\//, '');
    } catch {
      // Fallback: try common branch names
      for (const name of ['main', 'master', 'staging', 'develop']) {
        try {
          await execFileAsync('git', ['rev-parse', '--verify', name], { cwd: dir });
          return name;
        } catch { /* try next */ }
      }
      return 'main';
    }
  }

  async currentBranch(dir: string): Promise<string> {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: dir }
    );
    return stdout.trim();
  }

  async headCommit(dir: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: dir });
    return stdout.trim();
  }

  // ── worktree ─────────────────────────────────────────────────────────────────

  async createWorktree(
    projectDir: string,
    sessionId: string,
    slug?: string
  ): Promise<{ worktreePath: string; branchName: string; baseCommit: string }> {
    // Capture base commit BEFORE creating worktree
    const baseCommit = await this.headCommit(projectDir);

    const taskSlug = slug ? slugify(slug) : slugify(sessionId.slice(0, 12));
    const branchName = `maestro/${taskSlug}-${shortId(4)}`;
    const worktreePath = path.join(WORKTREE_BASE, sessionId);

    await fs.mkdir(WORKTREE_BASE, { recursive: true });

    await execFileAsync(
      'git',
      ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'],
      { cwd: projectDir }
    );

    return { worktreePath, branchName, baseCommit };
  }

  async removeWorktree(
    projectDir: string,
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    try {
      await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
        cwd: projectDir,
      });
    } catch (err) {
      console.warn(`[GitService] Failed to remove worktree at ${worktreePath}:`, err);
    }

    try {
      await execFileAsync('git', ['branch', '-D', branchName], { cwd: projectDir });
    } catch (err) {
      console.warn(`[GitService] Failed to delete branch ${branchName}:`, err);
    }
  }

  async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
      await fs.access(worktreePath);
      return true;
    } catch {
      return false;
    }
  }

  // ── diff (stubs — filled by C1/C2 feature workers) ───────────────────────────

  async diffSummary(_worktreePath: string, _baseCommit: string): Promise<GitDiffSummary> {
    throw new Error('not implemented');
  }

  async fullDiff(_worktreePath: string, _baseCommit: string, _file?: string): Promise<string> {
    throw new Error('not implemented');
  }

  // ── branch (stub — filled by D2 feature worker) ───────────────────────────────

  async renameBranch(_worktreePath: string, _newName: string): Promise<{ branchName: string }> {
    throw new Error('not implemented');
  }

  // ── merge (stub — filled by E1 feature worker) ────────────────────────────────

  async mergeBranch(
    _projectDir: string,
    _branchName: string,
    _targetBranch: string
  ): Promise<{ success: boolean; message: string; conflicts?: string[] }> {
    throw new Error('not implemented');
  }

  // ── pr (stubs — filled by F1/F2 feature workers) ─────────────────────────────

  async createPullRequest(
    _worktreePath: string,
    _branchName: string,
    _title: string,
    _body: string,
    _baseBranch: string
  ): Promise<GitPrInfo> {
    throw new Error('not implemented');
  }

  async getPullRequest(
    _worktreePath: string,
    _branchOrNumber: string
  ): Promise<GitPrInfo | null> {
    throw new Error('not implemented');
  }
}

// Backward-compat alias
export { GitService as GitWorktreeService };
