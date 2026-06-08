import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GitService, parsePullRequestUrl, rollupChecks } from '../src/application/services/GitService';
import { buildSuggestedPr } from '../src/api/gitRoutes';
import { GitDiffSummary } from '../src/application/services/GitService';
import { ValidationError } from '../src/domain/common/Errors';

const execFileAsync = promisify(execFile);

describe('parsePullRequestUrl', () => {
  it('extracts the url + number from a bare url line', () => {
    expect(parsePullRequestUrl('https://github.com/owner/repo/pull/42\n')).toEqual({
      url: 'https://github.com/owner/repo/pull/42',
      number: 42,
    });
  });

  it('ignores leading status chatter and picks the pull url', () => {
    const out = [
      'Warning: 3 uncommitted changes',
      'Creating pull request for maestro/foo into main in owner/repo',
      '',
      'https://github.com/owner/repo/pull/108',
    ].join('\n');
    expect(parsePullRequestUrl(out)).toEqual({
      url: 'https://github.com/owner/repo/pull/108',
      number: 108,
    });
  });

  it('returns number 0 when no pull url is present', () => {
    const { url, number } = parsePullRequestUrl('something went sideways');
    expect(number).toBe(0);
    expect(url).toBe('something went sideways');
  });
});

describe('rollupChecks', () => {
  it('returns "none" for an empty or non-array rollup', () => {
    expect(rollupChecks([])).toBe('none');
    expect(rollupChecks(undefined)).toBe('none');
    expect(rollupChecks(null)).toBe('none');
  });

  it('returns "passing" when all check runs succeeded', () => {
    expect(rollupChecks([
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { __typename: 'StatusContext', state: 'SUCCESS' },
    ])).toBe('passing');
  });

  it('returns "pending" when a check run is still in progress', () => {
    expect(rollupChecks([
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' },
    ])).toBe('pending');
  });

  it('returns "pending" for a pending commit status', () => {
    expect(rollupChecks([{ __typename: 'StatusContext', state: 'PENDING' }])).toBe('pending');
  });

  it('returns "failing" when any check run failed, even amid pending', () => {
    expect(rollupChecks([
      { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' },
      { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' },
    ])).toBe('failing');
  });

  it('treats a failing commit status (state ERROR) as failing', () => {
    expect(rollupChecks([{ __typename: 'StatusContext', state: 'ERROR' }])).toBe('failing');
  });
});

describe('buildSuggestedPr', () => {
  const summary: GitDiffSummary = {
    branch: 'maestro/foo-ab12',
    baseBranch: 'main',
    baseCommit: 'abc',
    ahead: 2,
    behind: 0,
    dirty: false,
    filesChanged: 2,
    insertions: 10,
    deletions: 3,
    commitCount: 2,
    files: [
      { path: 'src/a.ts', status: 'M', insertions: 8, deletions: 3 },
      { path: 'src/b.ts', status: 'A', insertions: 2, deletions: 0 },
    ],
  };

  it('uses the task title and embeds description + changed files', () => {
    const { title, body } = buildSuggestedPr('Add widget', 'Implements the widget feature.', summary, 'Session 1');
    expect(title).toBe('Add widget');
    expect(body).toContain('Implements the widget feature.');
    expect(body).toContain('## Changes');
    expect(body).toContain('src/a.ts');
    expect(body).toContain('2 files changed, +10 / −3 across 2 commits.');
  });

  it('falls back to the session name when no task title', () => {
    const { title } = buildSuggestedPr(undefined, undefined, summary, 'My Session');
    expect(title).toBe('My Session');
  });

  it('truncates very long titles', () => {
    const { title } = buildSuggestedPr('x'.repeat(200), undefined, undefined, 'Session');
    expect(title.length).toBe(120);
  });
});

describe('GitService.createPullRequest', () => {
  let repoDir: string;
  let svc: GitService;

  const run = (...args: string[]) => execFileAsync('git', args, { cwd: repoDir });

  beforeEach(async () => {
    repoDir = path.join(os.tmpdir(), `git-pr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(repoDir, { recursive: true });
    await run('init', '-q', '-b', 'main');
    await run('config', 'user.email', 'test@example.com');
    await run('config', 'user.name', 'Test');
    await run('config', 'commit.gpgsign', 'false');
    await fs.writeFile(path.join(repoDir, 'a.txt'), 'hello\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'initial');
    await run('checkout', '-q', '-b', 'maestro/foo-ab12');
    svc = new GitService();
  });

  afterEach(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });

  it('throws a ValidationError when the branch cannot be pushed (no origin)', async () => {
    await expect(
      svc.createPullRequest(repoDir, 'maestro/foo-ab12', 'Title', 'Body', 'main'),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
