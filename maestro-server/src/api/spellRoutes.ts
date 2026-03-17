import express, { Request, Response } from 'express';
import { SpellService } from '../application/services/SpellService';
import { SpellEntityType } from '../types';
import {
  validateBody,
  validateParams,
  validateQuery,
  invokeSpellSchema,
  listSpellEntitiesQuerySchema,
  listSpellDefinitionsQuerySchema,
  createCustomPromptSchema,
  updateCustomPromptSchema,
  idParamSchema,
} from './validation';

export function createSpellRoutes(spellService: SpellService): express.Router {
  const router = express.Router();

  // GET /api/spells/definitions
  router.get('/spells/definitions', validateQuery(listSpellDefinitionsQuerySchema), async (req: Request, res: Response) => {
    try {
      const entityType = req.query.entityType as SpellEntityType | undefined;
      const definitions = spellService.getSpellDefinitions(entityType);
      res.json(definitions);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  // GET /api/spells/entities/:type
  router.get('/spells/entities/:type', validateQuery(listSpellEntitiesQuerySchema), async (req: Request, res: Response) => {
    try {
      const type = req.params.type as SpellEntityType;
      const projectId = req.query.projectId as string;
      const entities = await spellService.listEntities(type, projectId);
      res.json(entities);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  // POST /api/spells/invoke
  router.post('/spells/invoke', validateBody(invokeSpellSchema), async (req: Request, res: Response) => {
    try {
      const result = await spellService.invoke(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  // GET /api/spells/custom-prompts
  router.get('/spells/custom-prompts', async (_req: Request, res: Response) => {
    try {
      const prompts = await spellService.listCustomPrompts();
      res.json(prompts);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  // POST /api/spells/custom-prompts
  router.post('/spells/custom-prompts', validateBody(createCustomPromptSchema), async (req: Request, res: Response) => {
    try {
      const prompt = await spellService.createCustomPrompt(req.body);
      res.status(201).json(prompt);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  // PUT /api/spells/custom-prompts/:id
  router.put('/spells/custom-prompts/:id', validateParams(idParamSchema), validateBody(updateCustomPromptSchema), async (req: Request, res: Response) => {
    try {
      const prompt = await spellService.updateCustomPrompt(req.params.id as string, req.body);
      res.json(prompt);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  // DELETE /api/spells/custom-prompts/:id
  router.delete('/spells/custom-prompts/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
    try {
      await spellService.deleteCustomPrompt(req.params.id as string);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: true,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Unknown error',
      });
    }
  });

  return router;
}
