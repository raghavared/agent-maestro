import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// --- Reusable patterns ---

// Safe ID: alphanumeric, hyphens, underscores (prevents command injection)
const safeId = z.string().regex(/^[a-zA-Z0-9_-]+$/, 'ID must be alphanumeric with hyphens/underscores only');

// String with reasonable length limits
const shortString = z.string().min(1).max(500);
const longString = z.string().min(1).max(10000);

// --- Enums ---

const taskStatusSchema = z.enum(['todo', 'in_progress', 'in_review', 'completed', 'cancelled', 'blocked']);
const taskSessionStatusSchema = z.enum(['working', 'blocked', 'completed', 'failed', 'skipped']);
const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
const sessionStatusSchema = z.enum(['spawning', 'idle', 'working', 'completed', 'failed', 'stopped']);
const workerStrategySchema = z.enum(['simple', 'tree']);
const orchestratorStrategySchema = z.enum(['default', 'intelligent-batching', 'dag']);
const agentModeSchema = z.enum(['execute', 'coordinate']);
const templateModeSchema = z.enum(['execute', 'coordinate']);
const modelSchema = z.enum(['haiku', 'sonnet', 'opus']);
const updateSourceSchema = z.enum(['user', 'session']);

const timelineEventTypeSchema = z.enum([
  'session_started', 'session_stopped',
  'task_started', 'task_completed', 'task_failed', 'task_skipped', 'task_blocked',
  'needs_input', 'progress', 'error', 'milestone'
]);

// --- Param schemas ---

export const idParamSchema = z.object({
  id: safeId,
});

export const idAndTaskIdParamSchema = z.object({
  id: safeId,
  taskId: safeId,
});

export const modeParamSchema = z.object({
  mode: agentModeSchema,
});

// --- Project schemas ---

export const createProjectSchema = z.object({
  name: shortString,
  workingDir: z.string().min(1).max(1000),
  description: shortString.optional(),
}).strict();

export const updateProjectSchema = z.object({
  name: shortString.optional(),
  workingDir: z.string().min(1).max(1000).optional(),
  description: shortString.optional(),
}).strict();

// --- Task schemas ---

export const createTaskSchema = z.object({
  projectId: safeId,
  parentId: safeId.optional(),
  title: shortString,
  description: longString.optional(),
  priority: taskPrioritySchema.optional(),
  initialPrompt: longString.optional(),
  skillIds: z.array(safeId).optional(),
  model: modelSchema.optional(),
}).strict();

export const updateTaskSchema = z.object({
  title: shortString.optional(),
  description: longString.optional(),
  status: taskStatusSchema.optional(),
  sessionStatus: taskSessionStatusSchema.optional(),  // Backward compat for session-source updates
  taskSessionStatuses: z.record(safeId, taskSessionStatusSchema).optional(),
  priority: taskPrioritySchema.optional(),
  sessionIds: z.array(safeId).optional(),
  skillIds: z.array(safeId).optional(),
  agentIds: z.array(safeId).optional(),
  model: modelSchema.optional(),
  updateSource: updateSourceSchema.optional(),
  sessionId: safeId.optional(),
}).strict();

export const taskTimelineSchema = z.object({
  type: timelineEventTypeSchema.optional().default('progress'),
  message: shortString,
  sessionId: safeId,
}).strict();

export const listTasksQuerySchema = z.object({
  projectId: safeId.optional(),
  status: taskStatusSchema.optional(),
  parentId: z.union([safeId, z.literal('null')]).optional(),
}).strict();

// --- Session schemas ---

export const createSessionSchema = z.object({
  projectId: safeId,
  taskId: safeId.optional(),         // backward compat
  taskIds: z.array(safeId).optional(),
  name: shortString.optional(),
  agentId: safeId.optional(),
  strategy: z.union([workerStrategySchema, orchestratorStrategySchema]).optional(),
  status: sessionStatusSchema.optional(),
  env: z.record(z.string(), z.string().max(5000)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  _suppressCreatedEvent: z.boolean().optional(),
}).strict();

export const updateSessionSchema = z.object({
  taskIds: z.array(safeId).optional(),
  status: sessionStatusSchema.optional(),
  agentId: safeId.optional(),
  env: z.record(z.string(), z.string().max(5000)).optional(),
  events: z.array(z.object({
    id: safeId,
    timestamp: z.number(),
    type: z.string().max(100),
    data: z.unknown().optional(),
  })).optional(),
  timeline: z.array(z.object({
    id: safeId,
    type: timelineEventTypeSchema,
    timestamp: z.number(),
    message: shortString.optional(),
    taskId: safeId.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
  needsInput: z.object({
    active: z.boolean(),
    message: z.string().max(1000).optional(),
    since: z.number().optional(),
  }).optional(),
}).strict();

export const sessionEventSchema = z.object({
  type: z.string().min(1).max(100),
  data: z.unknown().optional(),
}).strict();

export const sessionTimelineSchema = z.object({
  type: timelineEventTypeSchema.optional().default('progress'),
  message: shortString,
  taskId: safeId.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const listSessionsQuerySchema = z.object({
  projectId: safeId.optional(),
  taskId: safeId.optional(),
  status: sessionStatusSchema.optional(),
  active: z.enum(['true', 'false']).optional(),
}).strict();

// --- Spawn session schema ---

const allStrategySchema = z.enum(['simple', 'tree', 'default', 'intelligent-batching', 'dag']);

export const spawnSessionSchema = z.object({
  projectId: safeId,
  taskIds: z.array(safeId).min(1),
  sessionName: shortString.optional(),
  skills: z.array(z.string().max(200)).optional(),
  sessionId: safeId.optional(),
  spawnSource: z.enum(['ui', 'session']).optional().default('ui'),
  mode: agentModeSchema.optional().default('execute'),
  strategy: allStrategySchema.optional().default('simple'),
  context: z.record(z.string(), z.unknown()).optional(),
  model: modelSchema.optional(),
}).strict();

// --- Template schemas ---

export const createTemplateSchema = z.object({
  name: shortString,
  mode: templateModeSchema,
  content: longString,
}).strict();

export const updateTemplateSchema = z.object({
  name: shortString.optional(),
  content: longString.optional(),
}).strict();

// --- Mail schemas ---

const mailMessageTypeSchema = z.enum(['assignment', 'status_update', 'query', 'response', 'directive', 'notification']);

export const sendMailSchema = z.object({
  projectId: safeId,
  fromSessionId: safeId,
  toSessionId: safeId.optional().nullable(),
  replyToMailId: safeId.optional().nullable(),
  type: mailMessageTypeSchema,
  subject: shortString,
  body: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const mailInboxQuerySchema = z.object({
  type: mailMessageTypeSchema.optional(),
  since: z.coerce.number().optional(),
  projectId: safeId.optional(),
}).strict();

export const mailWaitQuerySchema = z.object({
  timeout: z.coerce.number().min(1000).max(120000).optional(),
  since: z.coerce.number().optional(),
  projectId: safeId.optional(),
}).strict();

// --- Middleware factories ---

/**
 * Validate request body against a Zod schema.
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate request params against a Zod schema.
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Invalid URL parameters',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    next();
  };
}

/**
 * Validate request query against a Zod schema.
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    next();
  };
}
