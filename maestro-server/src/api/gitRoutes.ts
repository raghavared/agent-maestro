import express, { Request, Response } from 'express';
import { z } from 'zod';
import { SessionService } from '../application/services/SessionService';
import { GitService } from '../application/services/GitService';
import { IProjectRepository } from '../domain/repositories/IProjectRepository';
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
  eventBus: IEventBus;
}

async function emitGitChanged(eventBus: IEventBus, sessionId: string): Promise<void> {
  await eventBus.emit('session:git_changed', { sessionId, timestamp: Date.now() });
}

export function createGitRoutes(deps: GitRouteDependencies) {
  const { sessionService, projectRepo, eventBus } = deps;
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
      let summary;
      if (baseCommit) {
        try {
          summary = await gitService.diffSummary(worktreePath, baseCommit);
        } catch (err) {
          console.warn('[gitRoutes] diffSummary failed:', err);
        }
      }

      // PR is filled by F2 feature worker
      res.json({ hasWorktree: true, summary });
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

      // Filled by C2 feature worker
      res.status(501).json({ error: true, code: 'not_implemented', message: 'diff not yet implemented' });
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

      // Filled by D2 feature worker
      res.status(501).json({ error: true, code: 'not_implemented', message: 'branch rename not yet implemented' });
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

      await emitGitChanged(eventBus, session.id);
      // Filled by E1 feature worker
      res.status(501).json({ error: true, code: 'not_implemented', message: 'merge not yet implemented' });
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

      await emitGitChanged(eventBus, session.id);
      // Filled by F1 feature worker
      res.status(501).json({ error: true, code: 'not_implemented', message: 'PR creation not yet implemented' });
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
