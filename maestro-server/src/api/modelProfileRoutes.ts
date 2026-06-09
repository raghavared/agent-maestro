import express, { Request, Response } from 'express';
import { ModelProfileService } from '../application/services/ModelProfileService';
import { handleRouteError } from './middleware/errorHandler';
import { validateBody, validateParams, idParamSchema, createModelProfileSchema, updateModelProfileSchema } from './validation';

/**
 * Routes for workspace-global model profiles.
 */
export function createModelProfileRoutes(modelProfileService: ModelProfileService) {
  const router = express.Router();

  // GET /model-profiles — list all profiles
  router.get('/model-profiles', async (_req: Request, res: Response) => {
    try {
      const profiles = await modelProfileService.listModelProfiles();
      res.json(profiles);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // POST /model-profiles — create a profile
  router.post('/model-profiles', validateBody(createModelProfileSchema), async (req: Request, res: Response) => {
    try {
      const profile = await modelProfileService.createModelProfile(req.body);
      res.status(201).json(profile);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // GET /model-profiles/:id — fetch one profile
  router.get('/model-profiles/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      const profile = await modelProfileService.getModelProfile(req.params.id as string);
      if (!profile) {
        return res.status(404).json({ error: true, code: 'not_found', message: `Model profile ${req.params.id} not found` });
      }
      res.json(profile);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // PUT /model-profiles/:id — update a profile
  router.put('/model-profiles/:id', validateParams(idParamSchema), validateBody(updateModelProfileSchema), async (req: Request, res: Response) => {
    try {
      const profile = await modelProfileService.updateModelProfile(req.params.id as string, req.body);
      res.json(profile);
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  // DELETE /model-profiles/:id — delete a profile
  router.delete('/model-profiles/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      await modelProfileService.deleteModelProfile(req.params.id as string);
      res.json({ success: true, id: req.params.id });
    } catch (err: unknown) {
      handleRouteError(err, res);
    }
  });

  return router;
}
