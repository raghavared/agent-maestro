import express, { Request, Response } from 'express';
import { TaskListService } from '../application/services/TaskListService';
import { handleRouteError } from './middleware/errorHandler';
import {
  validateBody,
  validateParams,
  validateQuery,
  createTaskListSchema,
  updateTaskListSchema,
  listTaskListsQuerySchema,
  reorderTaskListSchema,
  idParamSchema,
  idAndTaskIdParamSchema,
} from './validation';

/**
 * Create task list routes using TaskListService.
 */
export function createTaskListRoutes(taskListService: TaskListService) {
  const router = express.Router();

  // List task lists (optionally by projectId)
  router.get('/task-lists', validateQuery(listTaskListsQuerySchema), async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const lists = await taskListService.listTaskLists(projectId ? { projectId } : undefined);
      res.json(lists);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Create task list
  router.post('/task-lists', validateBody(createTaskListSchema), async (req: Request, res: Response) => {
    try {
      const { projectId, name, description, orderedTaskIds } = req.body ?? {};
      const list = await taskListService.createTaskList({ projectId, name, description, orderedTaskIds });
      res.status(201).json(list);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Get task list by ID
  router.get('/task-lists/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const list = await taskListService.getTaskList(req.params.id as string);
      res.json(list);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Update task list
  router.patch('/task-lists/:id', validateParams(idParamSchema), validateBody(updateTaskListSchema), async (req: Request, res: Response) => {
    try {
      const { name, description, orderedTaskIds } = req.body ?? {};
      const list = await taskListService.updateTaskList(req.params.id as string, { name, description, orderedTaskIds });
      res.json(list);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Add a task to a list
  router.post('/task-lists/:id/tasks/:taskId', validateParams(idAndTaskIdParamSchema), async (req: Request, res: Response) => {
    try {
      const list = await taskListService.addTaskToList(req.params.id as string, req.params.taskId as string);
      res.json(list);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Remove a task from a list
  router.delete('/task-lists/:id/tasks/:taskId', validateParams(idAndTaskIdParamSchema), async (req: Request, res: Response) => {
    try {
      const list = await taskListService.removeTaskFromList(req.params.id as string, req.params.taskId as string);
      res.json(list);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Reorder task list (full array replacement)
  router.put('/task-lists/:id/reorder', validateParams(idParamSchema), validateBody(reorderTaskListSchema), async (req: Request, res: Response) => {
    try {
      const { orderedTaskIds } = req.body;
      const list = await taskListService.reorderTaskList(req.params.id as string, orderedTaskIds);
      res.json(list);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Delete task list
  router.delete('/task-lists/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await taskListService.deleteTaskList(id);
      res.json({ success: true, id });
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  return router;
}
