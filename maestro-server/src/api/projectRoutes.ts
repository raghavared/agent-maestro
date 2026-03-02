import express, { Request, Response } from 'express';
import { ProjectService } from '../application/services/ProjectService';
import { handleRouteError } from './middleware/errorHandler';
import {
  validateBody,
  validateParams,
  createProjectSchema,
  updateProjectSchema,
  masterToggleSchema,
  idParamSchema,
} from './validation';

/**
 * Create project routes using the ProjectService.
 */
export function createProjectRoutes(projectService: ProjectService) {
  const router = express.Router();

  // List projects
  router.get('/projects', async (req: Request, res: Response) => {
    try {
      const projects = await projectService.listProjects();
      res.json(projects);
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
  router.get('/projects/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
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

  return router;
}
