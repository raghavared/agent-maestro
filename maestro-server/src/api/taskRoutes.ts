import express, { Request, Response } from 'express';
import { TaskService } from '../application/services/TaskService';
import { SessionService } from '../application/services/SessionService';
import { TaskFilter } from '../domain/repositories/ITaskRepository';
import { handleRouteError } from './middleware/errorHandler';
import {
  validateBody,
  validateParams,
  validateQuery,
  createTaskSchema,
  updateTaskSchema,
  taskTimelineSchema,
  listTasksQuerySchema,
  idParamSchema,
  idAndTaskIdParamSchema,
} from './validation';

/**
 * Create task routes using the TaskService.
 */
export function createTaskRoutes(taskService: TaskService, sessionService?: SessionService) {
  const router = express.Router();

  // List tasks
  router.get('/tasks', validateQuery(listTasksQuerySchema), async (req: Request, res: Response) => {
    try {
      const filter: TaskFilter = {};

      if (req.query.projectId) {
        filter.projectId = req.query.projectId as string;
      }

      if (req.query.status) {
        filter.status = req.query.status as TaskFilter['status'];
      }

      if (req.query.parentId !== undefined) {
        filter.parentId = req.query.parentId === 'null' ? null : req.query.parentId as string;
      }

      const tasks = await taskService.listTasks(filter);
      res.json(tasks);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Create task
  router.post('/tasks', validateBody(createTaskSchema), async (req: Request, res: Response) => {
    try {
      const task = await taskService.createTask(req.body);
      res.status(201).json(task);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Get task by ID
  router.get('/tasks/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const task = await taskService.getTask(id);
      res.json(task);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Update task
  router.patch('/tasks/:id', validateParams(idParamSchema), validateBody(updateTaskSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // If a session reports status for a task it is not yet linked to,
      // auto-associate it so UI/session queries remain consistent.
      if (sessionService && req.body?.updateSource === 'session' && req.body?.sessionId) {
        const sessionId = req.body.sessionId as string;
        const session = await sessionService.getSession(sessionId);
        if (!session.taskIds.includes(id)) {
          await sessionService.addTaskToSession(sessionId, id);
        }
      }

      const task = await taskService.updateTask(id, req.body);
      res.json(task);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Add timeline event to task (proxies to session timeline)
  router.post('/tasks/:id/timeline', validateParams(idParamSchema), validateBody(taskTimelineSchema), async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const { type = 'progress', message, sessionId } = req.body;

      // Verify task exists
      await taskService.getTask(taskId);

      // Forward to session timeline if sessionService is available
      if (sessionService) {
        const session = await sessionService.addTimelineEvent(
          sessionId,
          type,
          message,
          taskId
        );
        res.json({ success: true, taskId, sessionId, message, type });
      } else {
        // No session service available, return success without persisting
        res.json({ success: true, taskId, message, type });
      }
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Get docs for a task (aggregated from all sessions working on this task)
  router.get('/tasks/:id/docs', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;

      // Verify task exists
      await taskService.getTask(taskId);

      // Get all sessions for this task and aggregate docs
      const docs: Array<Record<string, unknown>> = [];
      if (sessionService) {
        const sessions = await sessionService.listSessionsByTask(taskId);
        for (const session of sessions) {
          if (session.docs) {
            for (const doc of session.docs) {
              if (!doc.taskId || doc.taskId === taskId) {
                docs.push({ ...doc, sessionId: session.id, sessionName: session.name });
              }
            }
          }
        }
      }

      // Sort by addedAt
      docs.sort((a, b) => (a.addedAt as number) - (b.addedAt as number));
      res.json(docs);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Add doc to a task (validates task exists, stores in session, links session to task)
  router.post('/tasks/:id/docs', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const { title, filePath, content, sessionId } = req.body;

      if (!title) {
        return res.status(400).json({
          error: true,
          message: 'title is required',
          code: 'VALIDATION_ERROR'
        });
      }

      if (!filePath) {
        return res.status(400).json({
          error: true,
          message: 'filePath is required',
          code: 'VALIDATION_ERROR'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          error: true,
          message: 'sessionId is required',
          code: 'VALIDATION_ERROR'
        });
      }

      // Validate task exists first — returns 404 if taskId is invalid (fixes BUG-3)
      await taskService.getTask(taskId);

      if (!sessionService) {
        return res.status(500).json({
          error: true,
          message: 'Session service unavailable',
          code: 'INTERNAL_ERROR'
        });
      }

      // Store doc in session tagged with taskId
      await sessionService.addDoc(sessionId, title, filePath, content, taskId);

      // Ensure session is linked to this task so GET /tasks/:id/docs can find the doc
      const session = await sessionService.getSession(sessionId);
      if (!session.taskIds.includes(taskId)) {
        await sessionService.addTaskToSession(sessionId, taskId);
      }

      res.status(201).json({
        success: true,
        taskId,
        sessionId,
        title,
        filePath,
        addedAt: Date.now(),
      });
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Delete task
  router.delete('/tasks/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await taskService.deleteTask(id);
      res.json({ success: true, id });
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Get child tasks
  router.get('/tasks/:id/children', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      // First verify parent exists
      await taskService.getTask(id);

      const childTasks = await taskService.listChildTasks(id);
      res.json(childTasks);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  return router;
}
