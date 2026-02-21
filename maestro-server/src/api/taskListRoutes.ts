import express, { Request, Response } from 'express';
import { TaskListService } from '../application/services/TaskListService';
import { AppError } from '../domain/common/Errors';

/**
 * Create task list routes using TaskListService.
 */
export function createTaskListRoutes(taskListService: TaskListService) {
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

  // List task lists (optionally by projectId)
  router.get('/task-lists', async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const lists = await taskListService.listTaskLists(projectId ? { projectId } : undefined);
      res.json(lists);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Create task list
  router.post('/task-lists', async (req: Request, res: Response) => {
    try {
      const { projectId, name, description, orderedTaskIds } = req.body ?? {};
      const list = await taskListService.createTaskList({ projectId, name, description, orderedTaskIds });
      res.status(201).json(list);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get task list by ID
  router.get('/task-lists/:id', async (req: Request, res: Response) => {
    try {
      const list = await taskListService.getTaskList(req.params.id as string);
      res.json(list);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Update task list
  router.patch('/task-lists/:id', async (req: Request, res: Response) => {
    try {
      const { name, description, orderedTaskIds } = req.body ?? {};
      const list = await taskListService.updateTaskList(req.params.id as string, { name, description, orderedTaskIds });
      res.json(list);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add a task to a list
  router.post('/task-lists/:id/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const list = await taskListService.addTaskToList(req.params.id as string, req.params.taskId as string);
      res.json(list);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Remove a task from a list
  router.delete('/task-lists/:id/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const list = await taskListService.removeTaskFromList(req.params.id as string, req.params.taskId as string);
      res.json(list);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Reorder task list (full array replacement)
  router.put('/task-lists/:id/reorder', async (req: Request, res: Response) => {
    try {
      const { orderedTaskIds } = req.body ?? {};
      if (!Array.isArray(orderedTaskIds)) {
        return res.status(400).json({
          error: true,
          message: 'orderedTaskIds must be an array',
          code: 'VALIDATION_ERROR'
        });
      }
      const list = await taskListService.reorderTaskList(req.params.id as string, orderedTaskIds);
      res.json(list);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Delete task list
  router.delete('/task-lists/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await taskListService.deleteTaskList(id);
      res.json({ success: true, id });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  return router;
}
