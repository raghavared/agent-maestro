import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerGitCommands } from '../../src/commands/git.js';

const { getMock, postMock, configMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  configMock: { sessionId: 'sess-test-123' as string | undefined },
}));

vi.mock('../../src/api.js', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

vi.mock('../../src/config.js', () => ({ config: configMock }));

vi.mock('ora', () => ({
  default: () => ({ start: () => ({ succeed: vi.fn(), stop: vi.fn(), fail: vi.fn() }) }),
}));

function buildProgram() {
  const program = new Command();
  program.exitOverride();
  program.option('--json', 'JSON output');
  registerGitCommands(program);
  return program;
}

const DIFF_SUMMARY = {
  branch: 'maestro/fix-bug-ab12',
  baseBranch: 'main',
  baseCommit: 'abc12345def',
  ahead: 3,
  behind: 0,
  dirty: false,
  filesChanged: 2,
  insertions: 10,
  deletions: 4,
  commitCount: 3,
  files: [
    { path: 'src/foo.ts', status: 'M', insertions: 7, deletions: 2 },
    { path: 'src/bar.ts', status: 'A', insertions: 3, deletions: 2 },
  ],
};

describe('maestro git status', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    configMock.sessionId = 'sess-test-123';
  });

  it('fetches GET /api/sessions/:id/git', async () => {
    getMock.mockResolvedValue({ hasWorktree: true, summary: DIFF_SUMMARY });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', 'git', 'status']);

    expect(getMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git');
    logSpy.mockRestore();
  });

  it('prints "No worktree" when hasWorktree is false', async () => {
    getMock.mockResolvedValue({ hasWorktree: false });
    const messages: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      messages.push(msg);
    });

    await buildProgram().parseAsync(['node', 'cli', 'git', 'status']);

    expect(messages.some((m) => m.includes('No worktree'))).toBe(true);
    logSpy.mockRestore();
  });

  it('outputs JSON when --json is passed', async () => {
    const payload = { hasWorktree: true, summary: DIFF_SUMMARY };
    getMock.mockResolvedValue(payload);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', '--json', 'git', 'status']);

    const out = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(out);
    expect(parsed.success).toBe(true);
    expect(parsed.data.hasWorktree).toBe(true);
    logSpy.mockRestore();
  });

  it('exits when no session ID is set', async () => {
    configMock.sessionId = undefined;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('exit');
    }) as never);

    await expect(
      buildProgram().parseAsync(['node', 'cli', 'git', 'status']),
    ).rejects.toThrow();

    exitSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe('maestro git diff', () => {
  beforeEach(() => {
    getMock.mockReset();
    configMock.sessionId = 'sess-test-123';
  });

  it('fetches GET /api/sessions/:id/git/diff without file flag', async () => {
    getMock.mockResolvedValue({ diff: 'diff --git a/foo.ts ...' });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await buildProgram().parseAsync(['node', 'cli', 'git', 'diff']);

    expect(getMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/diff');
    writeSpy.mockRestore();
  });

  it('appends ?file= query param when --file is specified', async () => {
    getMock.mockResolvedValue({ diff: '' });
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await buildProgram().parseAsync(['node', 'cli', 'git', 'diff', '--file', 'src/foo.ts']);

    expect(getMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/diff?file=src%2Ffoo.ts');
    writeSpy.mockRestore();
  });

  it('outputs JSON with diff when --json is passed', async () => {
    getMock.mockResolvedValue({ diff: 'some diff text' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', '--json', 'git', 'diff']);

    const out = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(out);
    expect(parsed.data.diff).toBe('some diff text');
    logSpy.mockRestore();
  });
});

describe('maestro git pr (show)', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    configMock.sessionId = 'sess-test-123';
  });

  it('fetches GET /api/sessions/:id/git/pr and shows PR info', async () => {
    const pr = { url: 'https://github.com/org/repo/pull/42', number: 42, state: 'OPEN' };
    getMock.mockResolvedValue({ pr });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', 'git', 'pr']);

    expect(getMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/pr');
    logSpy.mockRestore();
  });

  it('prints "No pull request found" when pr is null', async () => {
    getMock.mockResolvedValue({ pr: null });
    const messages: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      messages.push(msg);
    });

    await buildProgram().parseAsync(['node', 'cli', 'git', 'pr']);

    expect(messages.some((m) => m.includes('No pull request found'))).toBe(true);
    logSpy.mockRestore();
  });
});

describe('maestro git pr (create)', () => {
  beforeEach(() => {
    postMock.mockReset();
    configMock.sessionId = 'sess-test-123';
  });

  it('POSTs to /api/sessions/:id/git/pr with title and body', async () => {
    const pr = { url: 'https://github.com/org/repo/pull/99', number: 99, state: 'OPEN' };
    postMock.mockResolvedValue(pr);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', 'git', 'pr',
      '--title', 'My PR',
      '--body', 'Description',
    ]);

    expect(postMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/pr', {
      title: 'My PR',
      body: 'Description',
    });
    logSpy.mockRestore();
  });

  it('includes baseBranch when --base is provided', async () => {
    const pr = { url: 'https://github.com/org/repo/pull/100', number: 100, state: 'OPEN' };
    postMock.mockResolvedValue(pr);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', 'git', 'pr',
      '--title', 'My PR',
      '--body', 'Desc',
      '--base', 'staging',
    ]);

    expect(postMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/pr', {
      title: 'My PR',
      body: 'Desc',
      baseBranch: 'staging',
    });
    logSpy.mockRestore();
  });

  it('defaults body to empty string when --body is omitted', async () => {
    const pr = { url: 'https://github.com/org/repo/pull/7', number: 7, state: 'OPEN' };
    postMock.mockResolvedValue(pr);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', 'git', 'pr', '--title', 'No body PR']);

    expect(postMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/pr', {
      title: 'No body PR',
      body: '',
    });
    logSpy.mockRestore();
  });

  it('outputs JSON when --json is passed', async () => {
    const pr = { url: 'https://github.com/org/repo/pull/5', number: 5, state: 'DRAFT' };
    postMock.mockResolvedValue(pr);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', '--json', 'git', 'pr',
      '--title', 'Draft PR',
      '--body', '',
    ]);

    const out = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(out);
    expect(parsed.data.number).toBe(5);
    logSpy.mockRestore();
  });
});

describe('maestro git merge', () => {
  beforeEach(() => {
    postMock.mockReset();
    configMock.sessionId = 'sess-test-123';
  });

  it('POSTs to /api/sessions/:id/git/merge without targetBranch by default', async () => {
    postMock.mockResolvedValue({ success: true, message: 'Merged.' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', 'git', 'merge']);

    expect(postMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/merge', {});
    logSpy.mockRestore();
  });

  it('includes targetBranch when --target is provided', async () => {
    postMock.mockResolvedValue({ success: true, message: 'Merged into staging.' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', 'git', 'merge', '--target', 'staging']);

    expect(postMock).toHaveBeenCalledWith('/api/sessions/sess-test-123/git/merge', {
      targetBranch: 'staging',
    });
    logSpy.mockRestore();
  });

  it('exits non-zero on merge conflict', async () => {
    postMock.mockResolvedValue({
      success: false,
      message: 'Merge conflict',
      conflicts: ['src/foo.ts'],
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('exit');
    }) as never);

    await expect(
      buildProgram().parseAsync(['node', 'cli', 'git', 'merge']),
    ).rejects.toThrow();

    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('outputs JSON on success when --json is passed', async () => {
    postMock.mockResolvedValue({ success: true, message: 'Merged.' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync(['node', 'cli', '--json', 'git', 'merge']);

    const out = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(out);
    expect(parsed.data.success).toBe(true);
    logSpy.mockRestore();
  });
});
