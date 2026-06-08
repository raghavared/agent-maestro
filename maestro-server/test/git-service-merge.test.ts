import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GitService } from '../src/application/services/GitService';

const execFileAsync = promisify(execFile);

describe('GitService.mergeBranch', () => {
  let repoDir: string;
  let svc: GitService;

  const run = (...args: string[]) => execFileAsync('git', args, { cwd: repoDir });

  beforeEach(async () => {
    repoDir = path.join(os.tmpdir(), `git-merge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(repoDir, { recursive: true });
    await run('init', '-q', '-b', 'main');
    await run('config', 'user.email', 'test@example.com');
    await run('config', 'user.name', 'Test');
    await run('config', 'commit.gpgsign', 'false');

    await fs.writeFile(path.join(repoDir, 'a.txt'), 'line1\nline2\nline3\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'initial');

    svc = new GitService();
  });

  afterEach(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  it('merges a non-conflicting feature branch into target and restores original branch', async () => {
    await run('checkout', '-q', '-b', 'maestro/feature-abcd');
    await fs.writeFile(path.join(repoDir, 'b.txt'), 'new file\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'add b');
    await run('checkout', '-q', 'main');

    const result = await svc.mergeBranch(repoDir, 'maestro/feature-abcd', 'main');

    expect(result.success).toBe(true);
    expect(result.conflicts).toBeUndefined();

    // b.txt is now on main
    const { stdout: log } = await execFileAsync('git', ['log', '--oneline', 'main'], { cwd: repoDir });
    expect(log).toContain('add b');

    // original branch restored
    const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir });
    expect(branch.trim()).toBe('main');
  });

  it('detects conflicts, aborts the merge, and reports conflicting files', async () => {
    // Diverge main
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'line1\nMAIN-CHANGE\nline3\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'main edit');

    // Feature branch off the initial commit with a conflicting edit
    await run('checkout', '-q', '-b', 'maestro/feature-xyz', 'HEAD~1');
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'line1\nFEATURE-CHANGE\nline3\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'feature edit');
    await run('checkout', '-q', 'main');

    const result = await svc.mergeBranch(repoDir, 'maestro/feature-xyz', 'main');

    expect(result.success).toBe(false);
    expect(result.conflicts).toEqual(['a.txt']);

    // Tree is clean (merge aborted) and back on main
    const { stdout: porcelain } = await execFileAsync('git', ['status', '--porcelain'], { cwd: repoDir });
    expect(porcelain.trim()).toBe('');
    const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir });
    expect(branch.trim()).toBe('main');
  });

  it('refuses to merge when the target repository is dirty', async () => {
    await run('checkout', '-q', '-b', 'maestro/feature-dirty');
    await fs.writeFile(path.join(repoDir, 'b.txt'), 'new\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'add b');
    await run('checkout', '-q', 'main');

    // Make main dirty
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'line1\nDIRTY\nline3\n');

    const result = await svc.mergeBranch(repoDir, 'maestro/feature-dirty', 'main');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/uncommitted changes/i);
  });
});
