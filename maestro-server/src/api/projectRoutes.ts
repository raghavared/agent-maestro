import express, { Request, Response } from 'express';
import { ProjectService } from '../application/services/ProjectService';
import { SessionService } from '../application/services/SessionService';
import { handleRouteError } from './middleware/errorHandler';
import { cacheControl } from './middleware/cacheControl';
import {
  validateBody,
  validateParams,
  validateQuery,
  createProjectSchema,
  updateProjectSchema,
  masterToggleSchema,
  idParamSchema,
  paginationQuerySchema,
  projectDocsQuerySchema,
  extractPagination,
  paginate,
} from './validation';

/**
 * Create project routes using the ProjectService.
 */
export function createProjectRoutes(projectService: ProjectService, sessionService?: SessionService) {
  const router = express.Router();

  // List projects
  router.get('/projects', cacheControl(30), validateQuery(paginationQuerySchema), async (req: Request, res: Response) => {
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

  // Create project
  router.post('/projects', validateBody(createProjectSchema), async (req: Request, res: Response) => {
    try {
      const project = await projectService.createProject(req.body);
      res.status(201).json(project);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Set master status (must be before /projects/:id to avoid route shadowing)
  router.put('/projects/:id/master', validateParams(idParamSchema), validateBody(masterToggleSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { isMaster } = req.body;
      const project = await projectService.setMasterStatus(id, isMaster);
      res.json(project);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Get project by ID
  router.get('/projects/:id', validateParams(idParamSchema), cacheControl(30), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const project = await projectService.getProject(id);
      res.json(project);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Update project
  router.put('/projects/:id', validateParams(idParamSchema), validateBody(updateProjectSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const project = await projectService.updateProject(id, req.body);
      res.json(project);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Delete project
  router.delete('/projects/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await projectService.deleteProject(id);
      res.json({ success: true, id });
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // Aggregate all docs across every session in the project, deduped by docId
  router.get('/projects/:id/docs', validateParams(idParamSchema), validateQuery(projectDocsQuerySchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Verify project exists
      await projectService.getProject(id);

      if (!sessionService) {
        return res.json([]);
      }

      const docs = await sessionService.getProjectDocsWithContent(id);
      const kind = req.query.kind as 'markdown' | 'diagram' | undefined;
      const inferKind = (d: { kind?: string; filePath?: string }): 'markdown' | 'diagram' =>
        d.kind === 'diagram' || d.filePath?.endsWith('.excalidraw') ? 'diagram' : 'markdown';
      const filtered = kind ? docs.filter(d => inferKind(d) === kind) : docs;
      if (req.query.limit || req.query.offset) {
        res.json(paginate(filtered, extractPagination(req.query)));
      } else {
        res.json(filtered);
      }
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  return router;
}
