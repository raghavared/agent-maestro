import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import type {
  GitStatusResponse,
  GitDiffResponse,
  GitPrInfoResponse,
  GitMergeResponse,
} from '../types/api-responses.js';

function requireSessionId(isJson: boolean): string {
  const sessionId = config.sessionId;
  if (!sessionId) {
    const msg = 'No session context. Set MAESTRO_SESSION_ID env var.';
    if (isJson) {
      console.error(JSON.stringify({ success: false, error: 'no_session', message: msg }));
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  }
  return sessionId;
}

export function registerGitCommands(program: Command) {
  const git = program.command('git').description('Git operations for the current session worktree');

  // ── status ────────────────────────────────────────────────────────────────
  git
    .command('status')
    .description('Show git status for the current session worktree')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      const sessionId = requireSessionId(isJson);

      try {
        const result = await api.get<GitStatusResponse>(`/api/sessions/${sessionId}/git`);

        if (isJson) {
          outputJSON(result);
          return;
        }

        if (!result.hasWorktree) {
          console.log('No worktree associated with this session.');
          return;
        }

        const s = result.summary;
        if (!s) {
          console.log('Worktree exists but no diff summary available.');
          return;
        }

        outputKeyValue('Branch', s.branch);
        outputKeyValue('Base', `${s.baseBranch} (${s.baseCommit.slice(0, 8)})`);
        outputKeyValue('Ahead / Behind', `+${s.ahead} / -${s.behind}`);
        outputKeyValue('Dirty', s.dirty ? 'yes' : 'no');
        outputKeyValue('Files changed', String(s.filesChanged));
        outputKeyValue('Insertions', `+${s.insertions}`);
        outputKeyValue('Deletions', `-${s.deletions}`);
        outputKeyValue('Commits', String(s.commitCount));

        if (result.pr) {
          outputKeyValue('PR', `#${result.pr.number} ${result.pr.url} [${result.pr.state}]`);
        }

        if (s.files && s.files.length > 0) {
          console.log('\nChanged files:');
          for (const f of s.files) {
            const ins = f.insertions > 0 ? `+${f.insertions}` : '';
            const del = f.deletions > 0 ? `-${f.deletions}` : '';
            console.log(`  ${f.status} ${f.path}  ${[ins, del].filter(Boolean).join(' ')}`);
          }
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // ── diff ──────────────────────────────────────────────────────────────────
  git
    .command('diff')
    .description('Show full diff for the current session worktree')
    .option('--file <path>', 'Limit diff to a single file')
    .action(async (cmdOpts: { file?: string }) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      const sessionId = requireSessionId(isJson);

      const qs = cmdOpts.file ? `?file=${encodeURIComponent(cmdOpts.file)}` : '';

      try {
        const result = await api.get<GitDiffResponse>(`/api/sessions/${sessionId}/git/diff${qs}`);

        if (isJson) {
          outputJSON(result);
        } else {
          process.stdout.write(result.diff || '');
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // ── pr ────────────────────────────────────────────────────────────────────
  git
    .command('pr')
    .description('Show or create a pull request for the current session worktree')
    .option('--title <title>', 'PR title (creates a new PR when provided)')
    .option('--body <body>', 'PR body / description')
    .option('--base <branch>', 'Base branch for the PR (defaults to repo default)')
    .action(async (cmdOpts: { title?: string; body?: string; base?: string }) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      const sessionId = requireSessionId(isJson);

      try {
        if (cmdOpts.title) {
          // Create PR
          const payload: Record<string, string> = {
            title: cmdOpts.title,
            body: cmdOpts.body ?? '',
          };
          if (cmdOpts.base) payload.baseBranch = cmdOpts.base;

          const pr = await api.post<GitPrInfoResponse>(`/api/sessions/${sessionId}/git/pr`, payload);

          if (isJson) {
            outputJSON(pr);
          } else {
            outputKeyValue('PR', `#${pr.number}`);
            outputKeyValue('URL', pr.url);
            outputKeyValue('State', pr.state);
          }
        } else {
          // Show existing PR
          const result = await api.get<{ pr: GitPrInfoResponse | null }>(`/api/sessions/${sessionId}/git/pr`);
          const pr = result.pr;

          if (isJson) {
            outputJSON(result);
          } else if (!pr) {
            console.log('No pull request found for this session.');
          } else {
            outputKeyValue('PR', `#${pr.number}`);
            outputKeyValue('URL', pr.url);
            outputKeyValue('State', pr.state);
            if (pr.checks) outputKeyValue('Checks', pr.checks);
            if (pr.reviewDecision) outputKeyValue('Review', pr.reviewDecision);
          }
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });

  // ── merge ─────────────────────────────────────────────────────────────────
  git
    .command('merge')
    .description('Merge the session worktree branch into a target branch')
    .option('--target <branch>', 'Target branch to merge into (defaults to repo default)')
    .action(async (cmdOpts: { target?: string }) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      const sessionId = requireSessionId(isJson);

      const payload: Record<string, string> = {};
      if (cmdOpts.target) payload.targetBranch = cmdOpts.target;

      try {
        const result = await api.post<GitMergeResponse>(
          `/api/sessions/${sessionId}/git/merge`,
          payload,
        );

        if (isJson) {
          outputJSON(result);
          return;
        }

        if (result.success) {
          console.log(`Merged successfully: ${result.message}`);
        } else {
          console.error(`Merge failed: ${result.message}`);
          if (result.conflicts && result.conflicts.length > 0) {
            console.error('Conflicts:');
            for (const c of result.conflicts) {
              console.error(`  ${c}`);
            }
          }
          process.exit(1);
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });
}
