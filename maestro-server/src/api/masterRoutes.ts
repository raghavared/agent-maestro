import express, { Request, Response, NextFunction } from 'express';
import { ProjectService } from '../application/services/ProjectService';
import { TaskService } from '../application/services/TaskService';
import { SessionService } from '../application/services/SessionService';
import { AppError } from '../domain/common/Errors';

/**
 * Authorization middleware for master-only endpoints.
 * Checks X-Session-Id header or sessionId query param.
 * Verifies the session has isMasterSession === true.
 */
function createMasterAuthMiddleware(sessionService: SessionService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId =
      (req.headers['x-session-id'] as string) ||
      (req.query.sessionId as string);

    if (!sessionId) {
      return res.status(403).json({
        error: true,
        message: 'Master session context required. Provide X-Session-Id header or sessionId query param.',
        code: 'FORBIDDEN'
      });
    }

    try {
      const session = await sessionService.getSession(sessionId);
      if (!session.isMasterSession) {
        return res.status(403).json({
          error: true,
          message: 'Access denied. This endpoint requires a master session.',
          code: 'FORBIDDEN'
        });
      }
      next();
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 404) {
        return res.status(403).json({
          error: true,
          message: 'Invalid session ID.',
          code: 'FORBIDDEN'
        });
      }
      return res.status(500).json({
        error: true,
        message: err.message,
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Create master routes for cross-project queries.
 * All routes require a valid master session via X-Session-Id header or sessionId query param.
 */
export function createMasterRoutes(
  projectService: ProjectService,
  taskService: TaskService,
  sessionService: SessionService
) {
  const router = express.Router();

  const handleError = (err: any, res: Response) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    return res.status(500).json({
      error: true,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  };

  const authMiddleware = createMasterAuthMiddleware(sessionService);

  // Apply master auth to all routes in this router
  router.use(authMiddleware);

  // GET /master/projects — List all projects
  router.get('/master/projects', async (req: Request, res: Response) => {
    try {
      const projects = await projectService.listProjects();
      res.json(projects);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // GET /master/tasks?projectId=<optional> — List tasks across all or specific project
  router.get('/master/tasks', async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const filter: any = {};

      if (projectId) {
        filter.projectId = projectId;
      }

      if (req.query.status) {
        filter.status = req.query.status as string;
      }

      const tasks = await taskService.listTasks(filter);
      res.json(tasks);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // GET /master/sessions?projectId=<optional> — List sessions across all or specific project
  router.get('/master/sessions', async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      let sessions;

      if (projectId) {
        sessions = await sessionService.listSessionsByProject(projectId);
      } else {
        sessions = await sessionService.listSessions();
      }

      res.json(sessions);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // GET /master/context — Full workspace summary
  router.get('/master/context', async (req: Request, res: Response) => {
    try {
      const projects = await projectService.listProjects();

      // Build task and session counts per project in parallel
      const [allTasks, allSessions] = await Promise.all([
        taskService.listTasks({}),
        sessionService.listSessions(),
      ]);

      const taskCounts: Record<string, number> = {};
      const sessionCounts: Record<string, number> = {};

      for (const project of projects) {
        taskCounts[project.id] = 0;
        sessionCounts[project.id] = 0;
      }

      for (const task of allTasks) {
        if (task.projectId && taskCounts[task.projectId] !== undefined) {
          taskCounts[task.projectId]++;
        }
      }

      for (const session of allSessions) {
        if (session.projectId && sessionCounts[session.projectId] !== undefined) {
          sessionCounts[session.projectId]++;
        }
      }

      res.json({
        projects,
        taskCounts,
        sessionCounts,
      });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  return router;
}
