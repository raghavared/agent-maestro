import { spawn, type ChildProcess, type StdioOptions } from 'child_process';
import { homedir } from 'os';

/**
 * Spawn a process with a raised file descriptor limit.
 *
 * Claude Code (and other agent CLIs) require a high open-file limit and will
 * error with "possibly due to low max file descriptors" when the macOS default
 * soft limit (2560) is too low.
 *
 * This helper wraps the spawn in `/bin/sh -c` that:
 *   1. Raises `ulimit -n` to 2 147 483 646
 *   2. `cd`s into the requested working directory via an env var
 *   3. `exec`s the target binary so there is no extra wrapper process
 *
 * The shell is started with `cwd` set to `$HOME` (always accessible) to avoid
 * `shell-init: getcwd: Operation not permitted` errors that occur when the
 * parent process's cwd is inaccessible (deleted, sandboxed, or restricted by
 * macOS TCC).  The actual target working directory is passed via env var and
 * applied with `cd` inside the script before exec.
 *
 * Arguments are passed as positional params (`"$@"`) so no shell-escaping
 * is needed — each arg stays a separate element in the spawn array.
 */
export function spawnWithUlimit(
  binary: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    stdio?: StdioOptions;
  } = {},
): ChildProcess {
  const targetCwd = options.cwd || process.cwd();

  // Pass the target cwd via env var so the shell script can cd into it.
  const env: Record<string, string | undefined> = {
    ...options.env,
    __MAESTRO_SPAWN_CWD: targetCwd,
  };

  return spawn(
    '/bin/sh',
    [
      '-c',
      'ulimit -n 2147483646 2>/dev/null; cd "$__MAESTRO_SPAWN_CWD"; unset __MAESTRO_SPAWN_CWD; exec "$@"',
      'sh',
      binary,
      ...args,
    ],
    {
      // Start the shell in $HOME — a directory that is always accessible —
      // to prevent getcwd failures during shell-init when the parent's cwd
      // is inaccessible.
      cwd: homedir(),
      env,
      stdio: options.stdio ?? 'pipe',
    },
  );
}
