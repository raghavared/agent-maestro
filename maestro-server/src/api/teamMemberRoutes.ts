import express, { Request, Response } from 'express';
import { TeamMemberService } from '../application/services/TeamMemberService';
import { AppError } from '../domain/common/Errors';

/**
 * Create team member routes using the TeamMemberService.
 */
export function createTeamMemberRoutes(teamMemberService: TeamMemberService) {
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

  /**
   * GET /team-members?projectId=X
   * List all team members (defaults merged + custom)
   */
  router.get('/team-members', async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId query parameter is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const members = await teamMemberService.getProjectTeamMembers(projectId);
      res.json(members);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * POST /team-members
   * Create a custom team member
   */
  router.post('/team-members', async (req: Request, res: Response) => {
    try {
      const member = await teamMemberService.createTeamMember(req.body);
      res.status(201).json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * GET /team-members/:id?projectId=X
   * Get team member by ID
   */
  router.get('/team-members/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const projectId = req.query.projectId as string;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId query parameter is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const member = await teamMemberService.getTeamMember(projectId, id);
      res.json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * PATCH /team-members/:id
   * Update team member (custom or default override)
   */
  router.patch('/team-members/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { projectId, ...updates } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId is required in request body',
          code: 'VALIDATION_ERROR'
        });
      }

      const member = await teamMemberService.updateTeamMember(projectId, id, updates);
      res.json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * DELETE /team-members/:id
   * Delete team member (403 if default, 400 if not archived)
   */
  router.delete('/team-members/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const projectId = req.query.projectId as string;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId query parameter is required',
          code: 'VALIDATION_ERROR'
        });
      }

      await teamMemberService.deleteTeamMember(projectId, id);
      res.json({ success: true, id });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * POST /team-members/:id/archive
   * Archive a team member
   */
  router.post('/team-members/:id/archive', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId is required in request body',
          code: 'VALIDATION_ERROR'
        });
      }

      const member = await teamMemberService.archiveTeamMember(projectId, id);
      res.json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * POST /team-members/:id/unarchive
   * Unarchive a team member
   */
  router.post('/team-members/:id/unarchive', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId is required in request body',
          code: 'VALIDATION_ERROR'
        });
      }

      const member = await teamMemberService.unarchiveTeamMember(projectId, id);
      res.json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * POST /team-members/:id/memory
   * Append entries to a team member's memory
   */
  router.post('/team-members/:id/memory', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { projectId, entries } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId is required in request body',
          code: 'VALIDATION_ERROR'
        });
      }

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          error: true,
          message: 'entries (string array) is required in request body',
          code: 'VALIDATION_ERROR'
        });
      }

      // Get current member, append to memory, then update
      const current = await teamMemberService.getTeamMember(projectId, id);
      const existingMemory = (current as any).memory || [];
      const newMemory = [...existingMemory, ...entries];

      const member = await teamMemberService.updateTeamMember(projectId, id, { memory: newMemory });
      res.json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  /**
   * POST /team-members/:id/reset
   * Reset default team member to code values (404 if not default)
   */
  router.post('/team-members/:id/reset', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({
          error: true,
          message: 'projectId is required in request body',
          code: 'VALIDATION_ERROR'
        });
      }

      const member = await teamMemberService.resetDefault(projectId, id);
      res.json(member);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  return router;
}
