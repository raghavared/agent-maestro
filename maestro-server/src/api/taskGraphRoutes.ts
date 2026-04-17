import express, { Request, Response } from 'express';
import { TaskGraphService } from '../application/services/TaskGraphService';
import { handleRouteError } from './middleware/errorHandler';
import {
  validateBody,
  validateParams,
  validateQuery,
  createTaskGraphSchema,
  updateTaskGraphSchema,
  listTaskGraphsQuerySchema,
  idParamSchema,
  paginationQuerySchema,
  extractPagination,
  paginate,
} from './validation';

/**
 * Create task graph routes using TaskGraphService.
 */
export function createTaskGraphRoutes(taskGraphService: TaskGraphService) {
  const router = express.Router();

  // List task graphs (optionally by projectId/status)
  router.get('/task-graphs', validateQuery(listTaskGraphsQuerySchema.merge(paginationQuerySchema)), async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const status = req.query.status as string | undefined;
      const filter: { projectId?: string; status?: string } = {};
      if (projectId) filter.projectId = projectId;
      if (status) filter.status = status;
      const graphs = await taskGraphService.listGraphs(Object.keys(filter).length > 0 ? filter : undefined);
      if (req.query.limit || req.query.offset) {
        res.json(paginate(graphs, extractPagination(req.query)));
      } else {
        res.json(graphs);
      }
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Create task graph
  router.post('/task-graphs', validateBody(createTaskGraphSchema), async (req: Request, res: Response) => {
    try {
      const graph = await taskGraphService.createGraph(req.body);
      res.status(201).json(graph);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Get task graph by ID
  router.get('/task-graphs/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const graph = await taskGraphService.getGraph(req.params.id as string);
      res.json(graph);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Update task graph
  router.patch('/task-graphs/:id', validateParams(idParamSchema), validateBody(updateTaskGraphSchema), async (req: Request, res: Response) => {
    try {
      const graph = await taskGraphService.updateGraph(req.params.id as string, req.body);
      res.json(graph);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Validate task graph (DAG check, return topological order + parallel layers)
  router.post('/task-graphs/:id/validate', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const result = await taskGraphService.validateGraph(req.params.id as string);
      res.json(result);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Delete task graph
  router.delete('/task-graphs/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await taskGraphService.deleteGraph(id);
      res.json({ success: true, id });
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  return router;
}
