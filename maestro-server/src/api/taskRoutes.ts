import express, { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskService } from '../application/services/TaskService';
import { SessionService } from '../application/services/SessionService';
import { TaskStatus, TaskImage } from '../types';
import { AppError } from '../domain/common/Errors';

/**
 * Create task routes using the TaskService.
 */
export function createTaskRoutes(taskService: TaskService, sessionService?: SessionService, dataDir?: string) {
  const router = express.Router();

  // Error handler helper
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

  // List tasks
  router.get('/tasks', async (req: Request, res: Response) => {
    try {
      const filter: any = {};

      if (req.query.projectId) {
        filter.projectId = req.query.projectId as string;
      }

      if (req.query.status) {
        filter.status = req.query.status as TaskStatus;
      }

      if (req.query.parentId !== undefined) {
        filter.parentId = req.query.parentId === 'null' ? null : req.query.parentId as string;
      }

      const tasks = await taskService.listTasks(filter);
      res.json(tasks);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Create task
  router.post('/tasks', async (req: Request, res: Response) => {
    try {
      const task = await taskService.createTask(req.body);
      res.status(201).json(task);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get task by ID
  router.get('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const task = await taskService.getTask(id);
      res.json(task);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Update task
  router.patch('/tasks/:id', async (req: Request, res: Response) => {
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
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add timeline event to task (proxies to session timeline)
  router.post('/tasks/:id/timeline', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const { type = 'progress', message, sessionId } = req.body;

      if (!message) {
        return res.status(400).json({
          error: true,
          message: 'message is required',
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
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get docs for a task (aggregated from all sessions working on this task)
  router.get('/tasks/:id/docs', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;

      // Verify task exists
      await taskService.getTask(taskId);

      // Get all sessions for this task and aggregate docs
      const docs: any[] = [];
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
      docs.sort((a, b) => a.addedAt - b.addedAt);
      res.json(docs);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add doc to a task (validates task exists, stores in session, links session to task)
  router.post('/tasks/:id/docs', async (req: Request, res: Response) => {
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
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // ==================== TASK IMAGES ====================

  // Helper: get images directory for a task
  const getImagesDir = (projectId: string, taskId: string) => {
    if (!dataDir) throw new Error('dataDir not configured');
    return path.join(dataDir, 'images', projectId, taskId);
  };

  // Upload image to a task (base64 encoded in JSON body)
  router.post('/tasks/:id/images', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const { filename, data, mimeType } = req.body;

      if (!filename || !data || !mimeType) {
        return res.status(400).json({
          error: true,
          message: 'filename, data (base64), and mimeType are required',
          code: 'VALIDATION_ERROR'
        });
      }

      // Validate mime type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({
          error: true,
          message: `Unsupported image type: ${mimeType}. Allowed: ${allowedTypes.join(', ')}`,
          code: 'VALIDATION_ERROR'
        });
      }

      const task = await taskService.getTask(taskId);

      // Generate image ID
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const ext = filename.split('.').pop() || 'png';
      const storedFilename = `${imageId}.${ext}`;

      // Decode base64 and write to disk
      const buffer = Buffer.from(data, 'base64');
      const imagesDir = getImagesDir(task.projectId, taskId);
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.writeFile(path.join(imagesDir, storedFilename), buffer);

      // Add image metadata to task
      const imageEntry: TaskImage = {
        id: imageId,
        filename,
        mimeType,
        size: buffer.length,
        addedAt: Date.now(),
      };

      const currentImages = task.images || [];
      await taskService.updateTask(taskId, {
        ...({} as any),
        images: [...currentImages, imageEntry],
      } as any);

      res.status(201).json(imageEntry);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get (serve) an image file
  router.get('/tasks/:id/images/:imageId', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const imageId = req.params.imageId as string;

      const task = await taskService.getTask(taskId);
      const image = (task.images || []).find((img: TaskImage) => img.id === imageId);
      if (!image) {
        return res.status(404).json({ error: true, message: 'Image not found', code: 'NOT_FOUND' });
      }

      const ext = image.filename.split('.').pop() || 'png';
      const filePath = path.join(getImagesDir(task.projectId, taskId), `${imageId}.${ext}`);

      try {
        const fileBuffer = await fs.readFile(filePath);
        res.set('Content-Type', image.mimeType);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(fileBuffer);
      } catch {
        return res.status(404).json({ error: true, message: 'Image file not found on disk', code: 'NOT_FOUND' });
      }
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Delete an image from a task
  router.delete('/tasks/:id/images/:imageId', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id as string;
      const imageId = req.params.imageId as string;

      const task = await taskService.getTask(taskId);
      const image = (task.images || []).find((img: TaskImage) => img.id === imageId);
      if (!image) {
        return res.status(404).json({ error: true, message: 'Image not found', code: 'NOT_FOUND' });
      }

      // Remove file from disk
      const ext = image.filename.split('.').pop() || 'png';
      const filePath = path.join(getImagesDir(task.projectId, taskId), `${imageId}.${ext}`);
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore if file already gone
      }

      // Update task to remove image metadata
      const updatedImages = (task.images || []).filter((img: TaskImage) => img.id !== imageId);
      await taskService.updateTask(taskId, { ...({} as any), images: updatedImages } as any);

      res.json({ success: true, id: imageId });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Delete task
  router.delete('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await taskService.deleteTask(id);
      res.json({ success: true, id });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get child tasks
  router.get('/tasks/:id/children', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      // First verify parent exists
      await taskService.getTask(id);

      const childTasks = await taskService.listChildTasks(id);
      res.json(childTasks);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  return router;
}
