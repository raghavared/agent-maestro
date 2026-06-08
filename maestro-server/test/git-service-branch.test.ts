import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GitService } from '../src/application/services/GitService';
import { ValidationError } from '../src/domain/common/Errors';

const execFileAsync = promisify(execFile);

describe('GitService.renameBranch', () => {
  let repoDir: string;
  let svc: GitService;

  const run = (...args: string[]) => execFileAsync('git', args, { cwd: repoDir });
  const currentBranch = async () => {
    const { stdout } = await run('rev-parse', '--abbrev-ref', 'HEAD');
    return stdout.trim();
  };

  beforeEach(async () => {
    repoDir = path.join(os.tmpdir(), `git-branch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(repoDir, { recursive: true });
    await run('init', '-q', '-b', 'main');
    await run('config', 'user.email', 'test@example.com');
    await run('config', 'user.name', 'Test');
    await run('config', 'commit.gpgsign', 'false');

    await fs.writeFile(path.join(repoDir, 'a.txt'), 'hello\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'initial');

    await run('checkout', '-q', '-b', 'maestro/old-name-abcd');

    svc = new GitService();
  });

  afterEach(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  it('renames the current branch and returns the new name', async () => {
    const result = await svc.renameBranch(repoDir, 'maestro/new-name');

    expect(result).toEqual({ branchName: 'maestro/new-name' });
    expect(await currentBranch()).toBe('maestro/new-name');
  });

  it('trims surrounding whitespace from the new name', async () => {
    const result = await svc.renameBranch(repoDir, '  feature/trimmed  ');

    expect(result.branchName).toBe('feature/trimmed');
    expect(await currentBranch()).toBe('feature/trimmed');
  });

  it('rejects an empty name', async () => {
    await expect(svc.renameBranch(repoDir, '   ')).rejects.toBeInstanceOf(ValidationError);
    expect(await currentBranch()).toBe('maestro/old-name-abcd');
  });

  it('rejects names containing spaces', async () => {
    await expect(svc.renameBranch(repoDir, 'has spaces')).rejects.toBeInstanceOf(ValidationError);
    expect(await currentBranch()).toBe('maestro/old-name-abcd');
  });

  it('rejects names that are not valid git refs', async () => {
    for (const bad of ['foo..bar', '-leading', 'trailing/', 'with~tilde', 'caret^name']) {
      await expect(svc.renameBranch(repoDir, bad)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await currentBranch()).toBe('maestro/old-name-abcd');
  });
});
