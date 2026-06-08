import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GitService } from '../src/application/services/GitService';

const execFileAsync = promisify(execFile);

describe('GitService.fullDiff', () => {
  let repoDir: string;
  let svc: GitService;
  let baseCommit: string;

  beforeAll(async () => {
    repoDir = path.join(os.tmpdir(), `git-fulldiff-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(repoDir, { recursive: true });

    const run = (...args: string[]) => execFileAsync('git', args, { cwd: repoDir });
    await run('init', '-q');
    await run('config', 'user.email', 'test@example.com');
    await run('config', 'user.name', 'Test');
    await run('config', 'commit.gpgsign', 'false');

    // Initial commit (baseline)
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'line1\nline2\nline3\n');
    await fs.writeFile(path.join(repoDir, 'b.txt'), 'hello\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'initial');

    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoDir });
    baseCommit = stdout.trim();

    // Committed change after baseCommit: modify a.txt
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'line1\nline2-modified\nline3\n');
    await run('add', 'a.txt');
    await run('commit', '-q', '-m', 'modify a');

    // Uncommitted change: modify b.txt (unstaged)
    await fs.writeFile(path.join(repoDir, 'b.txt'), 'hello\nworld\n');

    svc = new GitService();
  });

  afterAll(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  it('returns unified diff including committed and uncommitted changes', async () => {
    const diff = await svc.fullDiff(repoDir, baseCommit);
    expect(diff).toContain('a.txt');
    expect(diff).toContain('b.txt');
    expect(diff).toMatch(/^diff --git/m);
    expect(diff).toContain('+line2-modified');
    expect(diff).toContain('+world');
  });

  it('filters by file when file argument is provided', async () => {
    const diff = await svc.fullDiff(repoDir, baseCommit, 'a.txt');
    expect(diff).toContain('a.txt');
    expect(diff).not.toContain('b.txt');
    expect(diff).toContain('+line2-modified');
  });

  it('returns empty string when no changes exist', async () => {
    const cleanDir = path.join(os.tmpdir(), `git-fulldiff-clean-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(cleanDir, { recursive: true });
    const run = (...args: string[]) => execFileAsync('git', args, { cwd: cleanDir });
    await run('init', '-q');
    await run('config', 'user.email', 'test@example.com');
    await run('config', 'user.name', 'Test');
    await run('config', 'commit.gpgsign', 'false');
    await fs.writeFile(path.join(cleanDir, 'x.txt'), 'x\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'initial');
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: cleanDir });
    const base = stdout.trim();

    const diff = await svc.fullDiff(cleanDir, base);
    expect(diff).toBe('');

    await fs.rm(cleanDir, { recursive: true, force: true });
  });
});
