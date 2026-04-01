import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

const WORKTREE_BASE = path.join(os.homedir(), '.maestro', 'worktrees');

export class GitWorktreeService {
  async isGitRepo(dir: string): Promise<boolean> {
    try {
      await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: dir });
      return true;
    } catch {
      return false;
    }
  }

  async createWorktree(
    projectDir: string,
    sessionId: string
  ): Promise<{ worktreePath: string; branchName: string }> {
    const branchName = `maestro/${sessionId}`;
    const worktreePath = path.join(WORKTREE_BASE, sessionId);

    // Ensure base directory exists
    await fs.mkdir(WORKTREE_BASE, { recursive: true });

    await execFileAsync(
      'git',
      ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'],
      { cwd: projectDir }
    );

    return { worktreePath, branchName };
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
      console.warn(`[GitWorktreeService] Failed to remove worktree at ${worktreePath}:`, err);
    }

    try {
      await execFileAsync('git', ['branch', '-D', branchName], {
        cwd: projectDir,
      });
    } catch (err) {
      console.warn(`[GitWorktreeService] Failed to delete branch ${branchName}:`, err);
    }
  }
}
