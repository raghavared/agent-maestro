import express, { Request, Response } from 'express';
import { OrderingService } from '../application/services/OrderingService';

/**
 * Create ordering routes.
 * GET  /ordering/:entityType/:projectId - Get ordering
 * PUT  /ordering/:entityType/:projectId - Save ordering
 */
export function createOrderingRoutes(orderingService: OrderingService) {
  const router = express.Router();

  // Get ordering for a project and entity type
  router.get('/ordering/:entityType/:projectId', async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType as string;
      const projectId = req.params.projectId as string;
      if (entityType !== 'task' && entityType !== 'session' && entityType !== 'task-list') {
        return res.status(400).json({ error: true, message: 'entityType must be "task", "session", or "task-list"' });
      }

      const ordering = await orderingService.getOrdering(projectId, entityType);
      if (!ordering) {
        return res.json({ projectId, entityType, orderedIds: [], updatedAt: 0 });
      }
      res.json(ordering);
    } catch (err: any) {
      res.status(500).json({ error: true, message: err.message });
    }
  });

  // Save ordering for a project and entity type
  router.put('/ordering/:entityType/:projectId', async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType as string;
      const projectId = req.params.projectId as string;
      if (entityType !== 'task' && entityType !== 'session' && entityType !== 'task-list') {
        return res.status(400).json({ error: true, message: 'entityType must be "task", "session", or "task-list"' });
      }

      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: true, message: 'orderedIds must be an array' });
      }

      const ordering = await orderingService.saveOrdering(projectId, entityType, orderedIds);
      res.json(ordering);
    } catch (err: any) {
      res.status(500).json({ error: true, message: err.message });
    }
  });

  return router;
}
