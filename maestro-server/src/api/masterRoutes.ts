import express, { Request, Response } from 'express';
import { ProjectService } from '../application/services/ProjectService';
import { TaskService } from '../application/services/TaskService';
import { SessionService } from '../application/services/SessionService';
import { SessionStatus } from '../types';
import { TaskFilter } from '../domain/repositories/ITaskRepository';
import { handleRouteError } from './middleware/errorHandler';
import { validateQuery, paginationQuerySchema, extractPagination, paginate } from './validation';

/**
 * Create master routes for cross-project queries.
 * All routes are open — no master-session auth required.
 * These remain as ergonomic aliases to the canonical /api/* endpoints.
 */
export function createMasterRoutes(
  projectService: ProjectService,
  taskService: TaskService,
  sessionService: SessionService
) {
  const router = express.Router();

  // GET /master/projects — List all projects
  router.get('/master/projects', validateQuery(paginationQuerySchema), async (req: Request, res: Response) => {
    try {
      const projects = await projectService.listProjects();
      if (req.query.limit || req.query.offset) {
        res.json(paginate(projects, extractPagination(req.query)));
      } else {
        res.json(projects);
      }
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // GET /master/tasks?projectId=<optional> — List tasks across all or specific project
  router.get('/master/tasks', validateQuery(paginationQuerySchema), async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const filter: TaskFilter = {};

      if (projectId) {
        filter.projectId = projectId;
      }

      if (req.query.status) {
        filter.status = req.query.status as TaskFilter['status'];
      }

      const tasks = await taskService.listTasks(filter);
      if (req.query.limit || req.query.offset) {
        res.json(paginate(tasks, extractPagination(req.query)));
      } else {
        res.json(tasks);
      }
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // GET /master/sessions?projectId=<optional>&active=true&status=<csv> — List sessions across all or specific project
  router.get('/master/sessions', validateQuery(paginationQuerySchema), async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      let sessions;

      if (projectId) {
        sessions = await sessionService.listSessionsByProject(projectId);
      } else {
        sessions = await sessionService.listSessions();
      }

      if (req.query.active === 'true') {
        sessions = sessions.filter(s => (['spawning', 'idle', 'working'] as SessionStatus[]).includes(s.status));
      }

      if (req.query.status) {
        const statuses = (req.query.status as string).split(',').map(s => s.trim()).filter(Boolean) as SessionStatus[];
        if (statuses.length > 0) {
          sessions = sessions.filter(s => statuses.includes(s.status));
        }
      }

      if (req.query.limit || req.query.offset) {
        res.json(paginate(sessions, extractPagination(req.query)));
      } else {
        res.json(sessions);
      }
    } catch (err: unknown) {
      handleRouteError(err, res);
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
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  return router;
}
