import express, { Request, Response } from 'express';
import { ISkillLoader } from '../domain/services/ISkillLoader';
import { MultiScopeSkillLoader, SkillWithMeta } from '../infrastructure/skills/MultiScopeSkillLoader';
import { cacheControl } from './middleware/cacheControl';
import { validateQuery, paginationQuerySchema, extractPagination, paginate } from './validation';

/**
 * Create skill routes using the ISkillLoader.
 */
export function createSkillRoutes(skillLoader: ISkillLoader) {
  const router = express.Router();

  /**
   * GET /api/skills
   * Returns array of available skills with full metadata (Claude Code format).
   * Supports optional ?projectPath= query parameter for project-scoped skills.
   */
  router.get('/skills', cacheControl(300), validateQuery(paginationQuerySchema), async (req: Request, res: Response) => {
    try {
      const projectPath = req.query.projectPath as string | undefined;
      const includeContent = req.query.fields === 'full';

      // If the loader supports multi-scope and we can use it, prefer loadAllWithScope
      if (skillLoader instanceof MultiScopeSkillLoader) {
        const scopedSkills = await skillLoader.loadAllWithScope(projectPath);

        const skills = scopedSkills.map((skill: SkillWithMeta) => {
          const base: Record<string, any> = {
            id: skill.manifest.name,
            name: skill.manifest.name,
            description: skill.manifest.description || '',
            version: skill.manifest.version || '1.0.0',
            triggers: skill.manifest.config?.triggers,
            role: skill.manifest.config?.role,
            skillScope: skill.meta.scope,
            skillSource: skill.meta.source,
            skillPath: skill.meta.path,
            outputFormat: skill.manifest.config?.outputFormat,
            language: skill.manifest.config?.language,
            framework: skill.manifest.config?.framework,
            tags: skill.manifest.config?.tags,
            category: skill.manifest.config?.category,
            license: skill.manifest.license,
            hasReferences: false,
            referenceCount: 0,
          };
          if (includeContent) base.content = skill.instructions;
          return base;
        });

        if (req.query.limit || req.query.offset) {
          return res.json(paginate(skills, extractPagination(req.query)));
        }
        return res.json(skills);
      }

      // Fallback: use basic ISkillLoader interface
      const skillIds = await skillLoader.listAvailable();
      const skills = [];

      for (const id of skillIds) {
        try {
          const skill = await skillLoader.load(id);
          if (skill && skill.manifest) {
            const base: Record<string, any> = {
              id,
              name: skill.manifest.name || id,
              description: skill.manifest.description || '',
              version: skill.manifest.version || '1.0.0',
              triggers: skill.manifest.config?.triggers,
              role: skill.manifest.config?.role,
              scope: skill.manifest.config?.scope,
              outputFormat: skill.manifest.config?.outputFormat,
              language: skill.manifest.config?.language,
              framework: skill.manifest.config?.framework,
              tags: skill.manifest.config?.tags,
              category: skill.manifest.config?.category,
              license: skill.manifest.license,
              hasReferences: false,
              referenceCount: 0,
            };
            if (includeContent) base.content = skill.instructions;
            skills.push(base);
          }
        } catch (err) {
        }
      }

      if (req.query.limit || req.query.offset) {
        res.json(paginate(skills, extractPagination(req.query)));
      } else {
        res.json(skills);
      }
    } catch (err) {
      res.json([]);
    }
  });

  /**
   * GET /api/skills/:id
   * Returns a single skill by ID
   */
  router.get('/skills/:id', cacheControl(300), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const skill = await skillLoader.load(id);

      if (!skill) {
        return res.status(404).json({
          error: true,
          message: `Skill not found: ${id}`,
          code: 'NOT_FOUND'
        });
      }

      res.json({
        id,
        name: skill.manifest.name || id,
        description: skill.manifest.description || '',
        type: skill.manifest.type || 'system',
        version: skill.manifest.version || '1.0.0',
        instructions: skill.instructions
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({
        error: true,
        message,
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/skills/mode/:mode
   * Returns skills for a specific mode (execute or coordinate)
   */
  router.get('/skills/mode/:mode', cacheControl(300), async (req: Request, res: Response) => {
    try {
      const mode = req.params.mode as string;

      const validModes = ['worker', 'coordinator', 'coordinated-worker', 'coordinated-coordinator', 'execute', 'coordinate'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          error: true,
          message: `Mode must be one of: ${validModes.join(', ')}`,
          code: 'VALIDATION_ERROR'
        });
      }

      const skills = await skillLoader.loadForMode(mode);

      const result = skills.map(skill => ({
        id: skill.manifest.name,
        name: skill.manifest.name,
        description: skill.manifest.description || '',
        type: skill.manifest.type || 'system',
        version: skill.manifest.version || '1.0.0',
      }));

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({
        error: true,
        message,
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/skills/:id/reload
   * Reload a skill (clears cache and reloads from disk)
   */
  router.post('/skills/:id/reload', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      if (!skillLoader.reload) {
        return res.status(501).json({
          error: true,
          message: 'Reload not supported by this skill loader',
          code: 'NOT_IMPLEMENTED'
        });
      }

      const skill = await skillLoader.reload(id);

      if (!skill) {
        return res.status(404).json({
          error: true,
          message: `Skill not found: ${id}`,
          code: 'NOT_FOUND'
        });
      }

      res.json({
        id,
        name: skill.manifest.name || id,
        description: skill.manifest.description || '',
        type: skill.manifest.type || 'system',
        version: skill.manifest.version || '1.0.0',
        reloaded: true
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({
        error: true,
        message,
        code: 'INTERNAL_ERROR'
      });
    }
  });

  return router;
}
