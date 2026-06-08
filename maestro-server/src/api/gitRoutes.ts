import express, { Request, Response } from 'express';
import { z } from 'zod';
import { SessionService } from '../application/services/SessionService';
import { GitService, GitDiffSummary, GitPrInfo } from '../application/services/GitService';
import { IProjectRepository } from '../domain/repositories/IProjectRepository';
import { ITaskRepository } from '../domain/repositories/ITaskRepository';
import { IEventBus } from '../domain/events/IEventBus';
import { handleRouteError } from './middleware/errorHandler';
import { validateBody, validateParams, validateQuery, idParamSchema } from './validation';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const capabilitiesQuerySchema = z.object({
  projectId: z.string().optional(),
});

const branchBodySchema = z.object({
  name: z.string().min(1).max(200),
});

const mergeBodySchema = z.object({
  targetBranch: z.string().optional(),
});

const prBodySchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string(),
  baseBranch: z.string().optional(),
});

const gitDiffQuerySchema = z.object({
  file: z.string().optional(),
});

// Sessions that have finished (mutation is only allowed on terminal sessions)
const TERMINAL_STATUSES = new Set(['completed', 'stopped', 'failed']);

interface GitRouteDependencies {
  sessionService: SessionService;
  projectRepo: IProjectRepository;
  taskRepo: ITaskRepository;
  eventBus: IEventBus;
}

async function emitGitChanged(eventBus: IEventBus, sessionId: string): Promise<void> {
  await eventBus.emit('session:git_changed', { sessionId, timestamp: Date.now() });
}

/**
 * Compose a suggested PR title + body from the session's primary task and its
 * diff summary — no LLM call, just existing data. Title comes from the task
 * title (or session name); the body restates the task description and lists the
 * changed files so the form is pre-filled and editable.
 */
export function buildSuggestedPr(
  taskTitle: string | undefined,
  taskDescription: string | undefined,
  summary: GitDiffSummary | undefined,
  sessionName: string,
): { title: string; body: string } {
  const title = (taskTitle?.trim() || sessionName?.trim() || 'Maestro changes').slice(0, 120);

  const lines: string[] = [];
  const desc = taskDescription?.trim();
  if (desc) {
    lines.push('## Summary', '', desc, '');
  }
  if (summary && summary.files.length > 0) {
    lines.push('## Changes', '');
    lines.push(
      `${summary.filesChanged} file${summary.filesChanged === 1 ? '' : 's'} changed, ` +
      `+${summary.insertions} / −${summary.deletions} across ` +
      `${summary.commitCount} commit${summary.commitCount === 1 ? '' : 's'}.`,
      '',
    );
    for (const f of summary.files.slice(0, 50)) {
      lines.push(`- \`${f.status}\` ${f.path} (+${f.insertions}/−${f.deletions})`);
    }
    if (summary.files.length > 50) {
      lines.push(`- …and ${summary.files.length - 50} more`);
    }
  }

  return { title, body: lines.join('\n').trim() };
}

export function createGitRoutes(deps: GitRouteDependencies) {
  const { sessionService, projectRepo, taskRepo, eventBus } = deps;
  const gitService = new GitService();
  const router = express.Router();

  // GET /git/capabilities
  router.get('/git/capabilities', validateQuery(capabilitiesQuerySchema), async (req: Request, res: Response) => {
    try {
      let dir = process.cwd();

      if (req.query.projectId) {
        const project = await projectRepo.findById(req.query.projectId as string);
        if (project) dir = project.workingDir;
      }

      const caps = await gitService.capabilities(dir);
      res.json(caps);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // GET /sessions/:id/git
  router.get('/sessions/:id/git', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const session = await sessionService.getSession(req.params.id as string);
      const worktreePath: string | undefined = session.metadata?.worktreePath;

      if (!worktreePath) {
        return res.json({ hasWorktree: false });
      }

      const exists = await gitService.worktreeExists(worktreePath);
      if (!exists) {
        return res.json({ hasWorktree: false });
      }

      const baseCommit: string | undefined = session.metadata?.worktreeBaseCommit;
      let summary: GitDiffSummary | undefined;
      if (baseCommit) {
        try {
          summary = await gitService.diffSummary(worktreePath, baseCommit);
        } catch (err) {
          console.warn('[gitRoutes] diffSummary failed:', err);
        }
      }

      // Surface an already-opened PR from session metadata (F2 enriches with live
      // state via `gh pr view`; F1 stores url/number at creation time).
      let pr: GitPrInfo | undefined;
      const prUrl: string | undefined = session.metadata?.prUrl;
      const prNumber: number | undefined = session.metadata?.prNumber;
      if (prUrl && typeof prNumber === 'number') {
        pr = { url: prUrl, number: prNumber, state: 'OPEN' };
      }

      // Pre-fill suggestion for the PR form (no LLM — task + diff summary).
      let suggestedPr: { title: string; body: string } | undefined;
      if (!pr) {
        const primaryTaskId = session.taskIds?.[0];
        const task = primaryTaskId ? await taskRepo.findById(primaryTaskId).catch(() => null) : null;
        suggestedPr = buildSuggestedPr(task?.title, task?.description, summary, session.name);
      }

      res.json({ hasWorktree: true, summary, pr, suggestedPr });
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // GET /sessions/:id/git/diff
  router.get('/sessions/:id/git/diff', validateParams(idParamSchema), validateQuery(gitDiffQuerySchema), async (req: Request, res: Response) => {
    try {
      const session = await sessionService.getSession(req.params.id as string);
      const worktreePath: string | undefined = session.metadata?.worktreePath;
      const baseCommit: string | undefined = session.metadata?.worktreeBaseCommit;

      if (!worktreePath || !baseCommit) {
        return res.status(404).json({
          error: true,
          code: 'no_worktree',
          message: 'Session has no associated worktree',
        });
      }

      const file = req.query.file as string | undefined;
      const diff = await gitService.fullDiff(worktreePath, baseCommit, file);
      res.json({ diff });
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // POST /sessions/:id/git/branch
  router.post('/sessions/:id/git/branch', validateParams(idParamSchema), validateBody(branchBodySchema), async (req: Request, res: Response) => {
    try {
      const session = await sessionService.getSession(req.params.id as string);

      if (!TERMINAL_STATUSES.has(session.status)) {
        return res.status(409).json({
          error: true,
          code: 'session_not_terminal',
          message: 'Branch rename is only allowed after session has completed, stopped, or failed',
        });
      }

      const worktreePath: string | undefined = session.metadata?.worktreePath;
      if (!worktreePath) {
        return res.status(404).json({
          error: true,
          code: 'no_worktree',
          message: 'Session has no associated worktree',
        });
      }

      const { branchName } = await gitService.renameBranch(worktreePath, req.body.name as string);

      await sessionService.updateSession(session.id, {
        metadata: { worktreeBranch: branchName },
      });

      await emitGitChanged(eventBus, session.id);
      res.json({ branchName });
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // POST /sessions/:id/git/merge
  router.post('/sessions/:id/git/merge', validateParams(idParamSchema), validateBody(mergeBodySchema), async (req: Request, res: Response) => {
    try {
      const session = await sessionService.getSession(req.params.id as string);

      if (!TERMINAL_STATUSES.has(session.status)) {
        return res.status(409).json({
          error: true,
          code: 'session_not_terminal',
          message: 'Merge is only allowed after session has completed, stopped, or failed',
        });
      }

      const worktreeBranch: string | undefined = session.metadata?.worktreeBranch;
      if (!worktreeBranch) {
        return res.status(404).json({
          error: true,
          code: 'no_worktree',
          message: 'Session has no associated worktree branch to merge',
        });
      }

      const project = await projectRepo.findById(session.projectId);
      if (!project) {
        return res.status(404).json({ error: true, code: 'project_not_found', message: 'Project not found' });
      }

      const targetBranch =
        (req.body.targetBranch as string | undefined)?.trim() ||
        (await gitService.defaultBaseBranch(project.workingDir));

      const result = await gitService.mergeBranch(project.workingDir, worktreeBranch, targetBranch);

      await emitGitChanged(eventBus, session.id);
      res.json(result);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // POST /sessions/:id/git/pr
  router.post('/sessions/:id/git/pr', validateParams(idParamSchema), validateBody(prBodySchema), async (req: Request, res: Response) => {
    try {
      const session = await sessionService.getSession(req.params.id as string);

      if (!TERMINAL_STATUSES.has(session.status)) {
        return res.status(409).json({
          error: true,
          code: 'session_not_terminal',
          message: 'PR creation is only allowed after session has completed, stopped, or failed',
        });
      }

      const worktreePath: string | undefined = session.metadata?.worktreePath;
      const worktreeBranch: string | undefined = session.metadata?.worktreeBranch;
      if (!worktreePath || !worktreeBranch) {
        return res.status(404).json({
          error: true,
          code: 'no_worktree',
          message: 'Session has no associated worktree branch to open a PR for',
        });
      }

      // Require gh — give an actionable error rather than a raw exec failure.
      const caps = await gitService.capabilities(worktreePath);
      if (!caps.hasGh) {
        return res.status(422).json({
          error: true,
          code: 'gh_missing',
          message: 'GitHub CLI (gh) is not installed. Install it from https://cli.github.com to open pull requests.',
        });
      }
      if (!caps.ghAuthed) {
        return res.status(422).json({
          error: true,
          code: 'gh_unauthenticated',
          message: 'GitHub CLI is not authenticated. Run `gh auth login` and try again.',
        });
      }

      const baseBranch =
        (req.body.baseBranch as string | undefined)?.trim() ||
        (await gitService.defaultBaseBranch(worktreePath));

      const pr = await gitService.createPullRequest(
        worktreePath,
        worktreeBranch,
        req.body.title as string,
        req.body.body as string,
        baseBranch,
      );

      // Persist PR identity on the session so the chip survives reloads.
      await sessionService.updateSession(session.id, {
        metadata: { prUrl: pr.url, prNumber: pr.number },
      });

      // Milestone so the PR shows up on the session timeline.
      await sessionService.addTimelineEvent(
        session.id,
        'milestone',
        `Opened pull request #${pr.number}`,
        session.taskIds?.[0],
        { kind: 'pr_opened', prUrl: pr.url, prNumber: pr.number, baseBranch },
      );

      await emitGitChanged(eventBus, session.id);
      res.json(pr);
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // GET /sessions/:id/git/pr
  router.get('/sessions/:id/git/pr', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      await sessionService.getSession(req.params.id as string);
      // Filled by F2 feature worker
      res.json({ pr: null });
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  // DELETE /sessions/:id/git/worktree
  router.delete('/sessions/:id/git/worktree', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const session = await sessionService.getSession(req.params.id as string);

      if (!TERMINAL_STATUSES.has(session.status)) {
        return res.status(409).json({
          error: true,
          code: 'session_not_terminal',
          message: 'Worktree removal is only allowed after session has completed, stopped, or failed',
        });
      }

      const worktreePath: string | undefined = session.metadata?.worktreePath;
      const worktreeBranch: string | undefined = session.metadata?.worktreeBranch;

      if (!worktreePath) {
        return res.json({ success: true });
      }

      const project = await projectRepo.findById(session.projectId);
      if (!project) {
        return res.status(404).json({ error: true, code: 'project_not_found', message: 'Project not found' });
      }

      await gitService.removeWorktree(project.workingDir, worktreePath, worktreeBranch || '');
      await sessionService.updateSession(session.id, {
        metadata: { worktreePath: null, worktreeBranch: null, worktreeBaseCommit: null },
      });

      await emitGitChanged(eventBus, session.id);
      res.json({ success: true });
    } catch (err) {
      handleRouteError(err, res);
    }
  });

  return router;
}
