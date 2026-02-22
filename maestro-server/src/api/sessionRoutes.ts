import express, { Request, Response } from 'express';
import { spawn as spawnProcess } from 'child_process';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { join, resolve as resolvePath, delimiter as pathDelimiter } from 'path';
import { homedir } from 'os';
import { SessionService } from '../application/services/SessionService';
import { LogDigestService } from '../application/services/LogDigestService';
import { IProjectRepository } from '../domain/repositories/IProjectRepository';
import { ITaskRepository } from '../domain/repositories/ITaskRepository';
import { IEventBus } from '../domain/events/IEventBus';
import { Config } from '../infrastructure/config';
import { AppError } from '../domain/common/Errors';
import { SessionStatus, AgentTool, AgentMode, TeamMember, TeamMemberSnapshot, MemberLaunchOverride, isCoordinatorMode, normalizeMode } from '../types';
import { ITeamMemberRepository } from '../domain/repositories/ITeamMemberRepository';
import { MailService } from '../application/services/MailService';

function resolveMaestroCliRuntime(): { maestroBin: string; monorepoRoot: string | null } {
  const isPkg = __dirname.startsWith('/snapshot');
  if (process.env.MAESTRO_CLI_PATH) {
    return { maestroBin: process.env.MAESTRO_CLI_PATH, monorepoRoot: null };
  }
  if (!isPkg) {
    const monorepoRoot = resolvePath(__dirname, '..', '..', '..');
    return {
      maestroBin: join(monorepoRoot, 'node_modules', '.bin', 'maestro'),
      monorepoRoot,
    };
  }
  return { maestroBin: 'maestro', monorepoRoot: null };
}

function prependNodeModulesBin(pathValue: string | undefined, monorepoRoot: string | null): string | undefined {
  if (!monorepoRoot) {
    return pathValue;
  }
  const nodeModulesBin = join(monorepoRoot, 'node_modules', '.bin');
  return `${nodeModulesBin}${pathDelimiter}${pathValue || ''}`;
}

/**
 * Generate manifest via CLI command
 */
async function generateManifestViaCLI(options: {
  mode: AgentMode;
  projectId: string;
  taskIds: string[];
  skills: string[];
  sessionId: string;
  model?: string;
  agentTool?: AgentTool;
  referenceTaskIds?: string[];
  teamMemberIds?: string[];
  teamMemberId?: string;
  serverUrl?: string;
  initialDirective?: { subject: string; message: string; fromSessionId?: string };
  coordinatorSessionId?: string;
  isMaster?: boolean;
  memberOverrides?: Record<string, MemberLaunchOverride>;
}): Promise<{ manifestPath: string; manifest: any }> {
  const { mode, projectId, taskIds, skills, sessionId, model, agentTool, referenceTaskIds, teamMemberIds, teamMemberId, serverUrl, initialDirective, memberOverrides } = options;

  const sessionDir = process.env.SESSION_DIR
    ? (process.env.SESSION_DIR.startsWith('~') ? join(homedir(), process.env.SESSION_DIR.slice(1)) : process.env.SESSION_DIR)
    : join(homedir(), '.maestro', 'sessions');
  const maestroDir = join(sessionDir, sessionId);
  await mkdir(maestroDir, { recursive: true });

  const manifestPath = join(maestroDir, 'manifest.json');

  const args = [
    'manifest', 'generate',
    '--mode', mode,
    '--project-id', projectId,
    '--task-ids', taskIds.join(','),
    '--skills', skills.join(','),
    '--output', manifestPath,
    ...(model ? ['--model', model] : []),
    ...(agentTool && agentTool !== 'claude-code' ? ['--agent-tool', agentTool] : []),
    ...(referenceTaskIds && referenceTaskIds.length > 0 ? ['--reference-task-ids', referenceTaskIds.join(',')] : []),
    ...(teamMemberIds && teamMemberIds.length > 0 ? ['--team-member-ids', teamMemberIds.join(',')] : []),
    ...(teamMemberId ? ['--team-member-id', teamMemberId] : []),
  ];

  const { maestroBin, monorepoRoot } = resolveMaestroCliRuntime();

  const spawnEnv: Record<string, string | undefined> = { ...process.env };
  // Ensure CLI subprocess can reach the server API (CLI reads MAESTRO_SERVER_URL, not SERVER_URL)
  if (serverUrl) {
    spawnEnv.MAESTRO_SERVER_URL = serverUrl;
  }
  const runtimePath = prependNodeModulesBin(spawnEnv.PATH, monorepoRoot);
  if (runtimePath) {
    spawnEnv.PATH = runtimePath;
  }

  // Pass initial directive as env var for manifest generation
  if (initialDirective) {
    spawnEnv.MAESTRO_INITIAL_DIRECTIVE = JSON.stringify(initialDirective);
  }

  if (options.coordinatorSessionId) {
    spawnEnv.MAESTRO_COORDINATOR_SESSION_ID = options.coordinatorSessionId;
  }

  if (options.isMaster) {
    spawnEnv.MAESTRO_IS_MASTER = 'true';
  }

  if (memberOverrides && Object.keys(memberOverrides).length > 0) {
    spawnEnv.MAESTRO_MEMBER_OVERRIDES = JSON.stringify(memberOverrides);
  }

  return new Promise((resolve, reject) => {
    const child = spawnProcess(maestroBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('exit', async (code) => {
      if (code === 0) {
        try {
          const manifestContent = await readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);
          resolve({ manifestPath, manifest });
        } catch (error: any) {
          reject(new Error(`Failed to read manifest: ${error.message}`));
        }
      } else {
        if (stderr.includes('command not found') || stderr.includes('ENOENT')) {
          reject(new Error(`maestro CLI not found. Please install maestro: npm install -g maestro-cli`));
        } else {
          reject(new Error(`Manifest generation failed (exit code ${code}): ${stderr}`));
        }
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn maestro CLI: ${error.message}`));
    });
  });
}

interface SessionRouteDependencies {
  sessionService: SessionService;
  logDigestService: LogDigestService;
  projectRepo: IProjectRepository;
  taskRepo: ITaskRepository;
  teamMemberRepo: ITeamMemberRepository;
  mailService: MailService;
  eventBus: IEventBus;
  config: Config;
}

/**
 * Create session routes using the SessionService.
 */
export function createSessionRoutes(deps: SessionRouteDependencies) {
  const { sessionService, logDigestService, projectRepo, taskRepo, teamMemberRepo, mailService, eventBus, config } = deps;
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

  const resolveSessionMode = (session: any): string => {
    const metadataMode = session?.metadata?.mode;
    const envMode = session?.env?.MAESTRO_MODE;
    return String(metadataMode || envMode || '').trim();
  };

  const canCommunicateWithinTeamBoundary = (sender: any, target: any): boolean => {
    if (!sender || !target) return false;
    if (sender.id === target.id) return false;

    // Spawned sessions can message their parent coordinator and siblings (same parent).
    if (sender.parentSessionId) {
      if (target.id === sender.parentSessionId) {
        return true;
      }
      return Boolean(target.parentSessionId && target.parentSessionId === sender.parentSessionId);
    }

    // Root coordinators can message their direct team sessions.
    return Boolean(target.parentSessionId && target.parentSessionId === sender.id);
  };

  const resolveSenderName = (session: any): string => {
    const fromPrimarySnapshot = session?.teamMemberSnapshot?.name;
    const fromMultiSnapshot = Array.isArray(session?.teamMemberSnapshots) ? session.teamMemberSnapshots[0]?.name : undefined;
    const fromMetadataSnapshot = session?.metadata?.teamMemberSnapshot?.name;
    const fromMetadata = session?.metadata?.teamMemberName;
    const fromSessionName = session?.name;
    return String(
      fromPrimarySnapshot ||
      fromMultiSnapshot ||
      fromMetadataSnapshot ||
      fromMetadata ||
      fromSessionName ||
      'Unknown'
    ).trim();
  };

  const prependSenderIdentity = (content: string, senderName: string, senderSessionId: string): string => {
    const prefix = `[From: ${senderName} (${senderSessionId})]`;
    const trimmedLeading = content.trimStart();
    if (trimmedLeading.startsWith(prefix)) {
      return content;
    }
    return `${prefix} ${content}`;
  };

  // Create session
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      // Backward compatibility: convert taskId to taskIds
      if (req.body.taskId && !req.body.taskIds) {
        req.body.taskIds = [req.body.taskId];
      }

      if (!req.body.taskIds) {
        return res.status(400).json({
          error: true,
          message: 'taskIds is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const session = await sessionService.createSession(req.body);
      res.status(201).json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // List sessions
  // Helper: enrich session with team member snapshots if missing
  async function enrichSessionWithSnapshots(session: any): Promise<void> {
    if (session.teamMemberSnapshots?.length > 0 || session.teamMemberSnapshot) return;
    const meta = session.metadata;
    if (!meta) return;
    const tmIds: string[] = meta.teamMemberIds?.length > 0
      ? meta.teamMemberIds
      : (meta.teamMemberId ? [meta.teamMemberId] : []);
    if (tmIds.length === 0) return;
    const snapshots: TeamMemberSnapshot[] = [];
    for (const tmId of tmIds) {
      try {
        const tm = await teamMemberRepo.findById(session.projectId, tmId);
        if (tm) {
          snapshots.push({ name: tm.name, avatar: tm.avatar, role: tm.role, model: tm.model, agentTool: tm.agentTool });
        }
      } catch { /* skip */ }
    }
    if (snapshots.length > 0) {
      session.teamMemberIds = tmIds;
      session.teamMemberSnapshots = snapshots;
      if (tmIds.length === 1) {
        session.teamMemberId = tmIds[0];
        session.teamMemberSnapshot = snapshots[0];
      }
    }
  }

  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const filter: any = {};

      if (req.query.projectId) {
        filter.projectId = req.query.projectId as string;
      }
      if (req.query.taskId) {
        filter.taskId = req.query.taskId as string;
      }
      if (req.query.status) {
        filter.status = req.query.status as SessionStatus;
      }
      if (req.query.parentSessionId) {
        filter.parentSessionId = req.query.parentSessionId as string;
      }
      if (req.query.rootSessionId) {
        filter.rootSessionId = req.query.rootSessionId as string;
      }
      if (req.query.teamSessionId) {
        filter.teamSessionId = req.query.teamSessionId as string;
      }

      let sessions = await sessionService.listSessions(filter);

      if (req.query.active === 'true') {
        sessions = sessions.filter(s => s.status !== 'completed');
      }

      // Enrich sessions with team member snapshots
      await Promise.all(sessions.map(s => enrichSessionWithSnapshots(s)));

      res.json(sessions);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Log digests — multi-session (coordinator reads all worker logs)
  router.get('/sessions/log-digests', async (req: Request, res: Response) => {
    try {
      const parentSessionId = req.query.parentSessionId as string | undefined;
      const sessionIds = req.query.sessionIds as string | undefined;
      const last = parseInt(req.query.last as string || '5', 10);
      const maxLength = req.query.maxLength !== undefined ? parseInt(req.query.maxLength as string, 10) : undefined;

      if (parentSessionId) {
        const digests = await logDigestService.getWorkerDigests(parentSessionId, { last, maxLength });
        return res.json(digests);
      }

      if (sessionIds) {
        const ids = sessionIds.split(',').map(s => s.trim()).filter(Boolean);
        const digests = await logDigestService.getDigests(ids, { last, maxLength });
        return res.json(digests);
      }

      return res.json([]);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Log digest — single session
  router.get('/sessions/:id/log-digest', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const last = parseInt(req.query.last as string || '5', 10);
      const maxLength = req.query.maxLength !== undefined ? parseInt(req.query.maxLength as string, 10) : undefined;
      const digest = await logDigestService.getDigest(sessionId, { last, maxLength });
      res.json(digest);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get session by ID
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const session = await sessionService.getSession(id);
      await enrichSessionWithSnapshots(session);
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Update session
  router.patch('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const session = await sessionService.updateSession(id, req.body);
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Delete session
  router.delete('/sessions/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await sessionService.deleteSession(id);
      res.json({ success: true, id });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add event to session
  router.post('/sessions/:id/events', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const { type, data } = req.body;

      if (!type) {
        return res.status(400).json({
          error: true,
          message: 'type is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const session = await sessionService.addEventToSession(sessionId, { type, data });
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add timeline event to session
  router.post('/sessions/:id/timeline', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const { type = 'progress', message, taskId, metadata } = req.body;

      if (!message) {
        return res.status(400).json({
          error: true,
          message: 'message is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const session = await sessionService.addTimelineEvent(
        sessionId,
        type,
        message,
        taskId,
        metadata
      );
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add doc to session
  router.post('/sessions/:id/docs', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const { title, filePath, content, taskId } = req.body;

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

      const session = await sessionService.addDoc(
        sessionId,
        title,
        filePath,
        content,
        taskId,
      );
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Get docs for a session
  router.get('/sessions/:id/docs', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const session = await sessionService.getSession(sessionId);
      res.json(session.docs || []);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Add task to session
  router.post('/sessions/:id/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const taskId = req.params.taskId as string;
      await sessionService.addTaskToSession(sessionId, taskId);
      const session = await sessionService.getSession(sessionId);
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Remove task from session
  router.delete('/sessions/:id/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const taskId = req.params.taskId as string;
      await sessionService.removeTaskFromSession(sessionId, taskId);
      const session = await sessionService.getSession(sessionId);
      res.json(session);
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Show modal in UI (agent-generated HTML content)
  router.post('/sessions/:id/modal', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const { modalId, title, html, filePath } = req.body;

      if (!modalId) {
        return res.status(400).json({
          error: true,
          message: 'modalId is required',
          code: 'VALIDATION_ERROR'
        });
      }

      if (!html) {
        return res.status(400).json({
          error: true,
          message: 'html content is required',
          code: 'VALIDATION_ERROR'
        });
      }

      // Verify session exists
      await sessionService.getSession(sessionId);

      // Store modal reference in modals directory
      const modalsDir = join(config.dataDir, 'modals');
      await mkdir(modalsDir, { recursive: true });
      const modalFilePath = join(modalsDir, `${modalId}.html`);
      await writeFile(modalFilePath, html, 'utf-8');

      // Emit WebSocket event to UI
      const modalEvent = {
        sessionId,
        modalId,
        title: title || 'Agent Modal',
        html,
        filePath: filePath || modalFilePath,
        timestamp: Date.now(),
      };

      await eventBus.emit('session:modal', modalEvent);

      res.json({
        success: true,
        modalId,
        sessionId,
        message: 'Modal sent to UI',
      });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Receive user action from a modal (forwarded by UI)
  router.post('/sessions/:id/modal/:modalId/actions', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const modalId = req.params.modalId as string;
      const { action, data } = req.body;

      if (!action) {
        return res.status(400).json({
          error: true,
          message: 'action is required',
          code: 'VALIDATION_ERROR'
        });
      }

      // Emit WebSocket event so the agent CLI can receive it
      const actionEvent = {
        sessionId,
        modalId,
        action,
        data: data || {},
        timestamp: Date.now(),
      };

      await eventBus.emit('session:modal_action', actionEvent);

      res.json({ success: true, modalId, action });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Modal closed by user (forwarded by UI)
  router.post('/sessions/:id/modal/:modalId/close', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.id as string;
      const modalId = req.params.modalId as string;

      await eventBus.emit('session:modal_closed', {
        sessionId,
        modalId,
        timestamp: Date.now(),
      });

      res.json({ success: true, modalId });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // Send a prompt to a session's terminal
  router.post('/sessions/:id/prompt', async (req: Request, res: Response) => {
    try {
      const { content, mode = 'send', senderSessionId } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'content is required and must be a string' });
      }
      if (!['send', 'paste'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be "send" or "paste"' });
      }
      if (!senderSessionId || typeof senderSessionId !== 'string') {
        return res.status(400).json({ error: 'senderSessionId is required and must be a string' });
      }

      const sessionId = req.params.id as string;
      const session = await sessionService.getSession(sessionId);
      const senderSession = await sessionService.getSession(senderSessionId);

      if (!canCommunicateWithinTeamBoundary(senderSession, session)) {
        return res.status(403).json({
          error: true,
          code: 'prompt_scope_violation',
          message: 'Session prompt is limited to parent/sibling sessions (or direct team sessions for a root coordinator).',
          details: {
            senderSessionId,
            targetSessionId: sessionId,
          },
        });
      }

      const senderName = resolveSenderName(senderSession);
      const contentWithSender = prependSenderIdentity(content, senderName, senderSessionId);

      await eventBus.emit('session:prompt_send', {
        sessionId,
        content: contentWithSender,
        mode,
        senderSessionId,
        timestamp: Date.now(),
      });

      await sessionService.addTimelineEvent(
        sessionId,
        'prompt_received',
        `Received prompt from session ${senderSessionId}: "${contentWithSender.substring(0, 100)}${contentWithSender.length > 100 ? '...' : ''}"`,
        undefined,
        { senderSessionId, mode }
      );

      res.json({ success: true });
    } catch (err: any) {
      handleError(err, res);
    }
  });

  // POST /api/sessions/:id/mail — notify a session (store mail + PTY inject)
  router.post('/sessions/:id/mail', async (req: Request, res: Response) => {
    try {
      const toSessionId = req.params.id as string;
      const { fromSessionId, message, detail } = req.body;
      if (!fromSessionId || !message) {
        return res.status(400).json({ error: true, message: 'fromSessionId and message are required' });
      }
      const toSession = await sessionService.getSession(toSessionId);
      const fromSession = await sessionService.getSession(fromSessionId);
      const fromName = resolveSenderName(fromSession);
      if (!canCommunicateWithinTeamBoundary(fromSession, toSession)) {
        return res.status(403).json({
          error: true,
          code: 'mail_scope_violation',
          message: 'Session notify/mail is limited to parent/sibling sessions (or direct team sessions for a root coordinator).',
          details: {
            fromSessionId,
            toSessionId,
          },
        });
      }
      const mail = await mailService.notify({ fromSessionId, fromName, toSessionId, message, detail });
      res.json({ success: true, mailId: mail.id });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return res.status(404).json({ error: true, message: err.message });
      handleError(err, res);
    }
  });

  // GET /api/sessions/:id/mail — read unread mail for session :id
  router.get('/sessions/:id/mail', async (req: Request, res: Response) => {
    try {
      const toSessionId = req.params.id as string;
      const targetSession = await sessionService.getSession(toSessionId);
      const parentSessionId = targetSession.parentSessionId || toSessionId;
      const messages = await mailService.readMail(toSessionId, parentSessionId);
      res.json(messages);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return res.status(404).json({ error: true, message: err.message });
      handleError(err, res);
    }
  });

  // Spawn session (complex endpoint - uses CLI for manifest generation)
  router.post('/sessions/spawn', async (req: Request, res: Response) => {
    try {
      const {
        projectId,
        taskIds,
        sessionName,
        skills,
        sessionId,              // Parent session ID when spawnSource === 'session'
        spawnSource = 'ui',     // 'ui' or 'session'
        mode: requestedMode,    // Four-mode model: worker, coordinator, coordinated-worker, coordinated-coordinator
        context,
        teamMemberIds,          // Multiple team member identities for this session
        delegateTeamMemberIds,  // Team member IDs for coordination delegation pool
        teamMemberId,           // Single team member assigned to this task (backward compat)
        agentTool: requestedAgentTool,   // Override agent tool for this run
        model: requestedModel,           // Override model for this run
        initialDirective,                // { subject, message, fromSessionId } for guaranteed delivery
        memberOverrides,                 // Per-member launch overrides: Record<string, MemberLaunchOverride>
      } = req.body;

      const normalizedMemberOverrides: Record<string, MemberLaunchOverride> | undefined =
        memberOverrides && typeof memberOverrides === 'object' && !Array.isArray(memberOverrides)
          ? memberOverrides
          : undefined;

      const requestedModeInput = String(requestedMode || 'worker');
      const requestedCoordinatorMode =
        requestedModeInput === 'coordinator' ||
        requestedModeInput === 'coordinated-coordinator' ||
        requestedModeInput === 'coordinate';

      // Resolve identity/self + delegation as separate concepts for coordinator modes.
      let effectiveTeamMemberIds: string[] = [];
      let effectiveDelegateTeamMemberIds: string[] = [];

      if (requestedCoordinatorMode) {
        if (teamMemberId) {
          effectiveTeamMemberIds = [teamMemberId];
        } else if (teamMemberIds && teamMemberIds.length > 0) {
          // Backward compat: old payloads overloaded teamMemberIds; deterministic first is self.
          effectiveTeamMemberIds = [teamMemberIds[0]];
        }

        if (delegateTeamMemberIds && delegateTeamMemberIds.length > 0) {
          effectiveDelegateTeamMemberIds = delegateTeamMemberIds;
        } else if (teamMemberIds && teamMemberIds.length > 0) {
          // Backward compat:
          // - if explicit self exists, treat teamMemberIds as delegate roster
          // - otherwise, consume remainder after deterministic self
          effectiveDelegateTeamMemberIds = teamMemberId ? teamMemberIds : teamMemberIds.slice(1);
        }
      } else {
        effectiveTeamMemberIds = teamMemberIds && teamMemberIds.length > 0
          ? teamMemberIds
          : (teamMemberId ? [teamMemberId] : []);
      }

      // Validation
      if (!projectId) {
        return res.status(400).json({
          error: true,
          code: 'missing_project_id',
          message: 'projectId is required'
        });
      }

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({
          error: true,
          code: 'invalid_task_ids',
          message: 'taskIds must be a non-empty array'
        });
      }

      if (spawnSource !== 'ui' && spawnSource !== 'session') {
        return res.status(400).json({
          error: true,
          code: 'invalid_spawn_source',
          message: 'spawnSource must be "ui" or "session"'
        });
      }

      let parentSession: any | null = null;

      // Validate sessionId when spawnSource === 'session'
      if (spawnSource === 'session') {
        if (!sessionId) {
          return res.status(400).json({
            error: true,
            code: 'missing_session_id',
            message: 'sessionId is required when spawnSource is "session"'
          });
        }

        // Verify parent session exists
        try {
          parentSession = await sessionService.getSession(sessionId);
          if (!parentSession) {
            return res.status(404).json({
              error: true,
              code: 'parent_session_not_found',
              message: `Parent session ${sessionId} not found`
            });
          }
        } catch (err: any) {
          return res.status(404).json({
            error: true,
            code: 'parent_session_not_found',
            message: `Parent session ${sessionId} not found`
          });
        }
      }

      const resolvedParentSessionId = spawnSource === 'session' && parentSession
        ? parentSession.id
        : null;
      const resolvedRootSessionId = resolvedParentSessionId
        ? (parentSession?.rootSessionId || parentSession?.id)
        : null;

      if (resolvedParentSessionId) {
        const parentMode = resolveSessionMode(parentSession);
        if (parentMode === 'coordinated-coordinator') {
          return res.status(403).json({
            error: true,
            code: 'spawn_forbidden_for_mode',
            message: 'coordinated-coordinator sessions cannot spawn new sessions. Coordinate only with existing team members.',
            details: {
              parentSessionId: resolvedParentSessionId,
              parentMode,
            },
          });
        }
      }

      // Verify all tasks exist and collect task-level team member IDs as fallback
      const verifiedTasks: any[] = [];
      for (const taskId of taskIds) {
        const task = await taskRepo.findById(taskId);
        if (!task) {
          return res.status(404).json({
            error: true,
            code: 'task_not_found',
            message: `Task ${taskId} not found`,
            details: { taskId }
          });
        }
        verifiedTasks.push(task);
      }

      // Fall back to task-level teamMemberId/teamMemberIds if none provided in request
      if (effectiveTeamMemberIds.length === 0) {
        const taskTeamMemberIds: string[] = [];
        for (const task of verifiedTasks) {
          if (task.teamMemberIds && task.teamMemberIds.length > 0) {
            for (const tmId of task.teamMemberIds) {
              if (!taskTeamMemberIds.includes(tmId)) {
                taskTeamMemberIds.push(tmId);
              }
            }
          } else if (task.teamMemberId && !taskTeamMemberIds.includes(task.teamMemberId)) {
            taskTeamMemberIds.push(task.teamMemberId);
          }
        }
        if (taskTeamMemberIds.length > 0) {
          if (requestedCoordinatorMode) {
            effectiveTeamMemberIds = [taskTeamMemberIds[0]];
            if (effectiveDelegateTeamMemberIds.length === 0 && taskTeamMemberIds.length > 1) {
              effectiveDelegateTeamMemberIds = taskTeamMemberIds.slice(1);
            }
          } else {
            effectiveTeamMemberIds = taskTeamMemberIds;
          }
        }
      }

      if (requestedCoordinatorMode && effectiveTeamMemberIds.length > 0 && effectiveDelegateTeamMemberIds.length > 0) {
        const selfId = effectiveTeamMemberIds[0];
        effectiveDelegateTeamMemberIds = effectiveDelegateTeamMemberIds.filter((id) => id !== selfId);
      }

      // Coordinator modes must include exactly one self identity profile for prompt normalization.
      // If none was provided/resolved, pick a deterministic active coordinator member from the project.
      if (requestedCoordinatorMode && effectiveTeamMemberIds.length === 0) {
        const projectTeamMembers = await teamMemberRepo.findByProjectId(projectId);
        const activeTeamMembers = projectTeamMembers.filter((member) => member.status !== 'archived');
        const coordinatorSelf =
          activeTeamMembers.find((member) => isCoordinatorMode(String(member.mode || ''))) ||
          activeTeamMembers.find((member) => member.capabilities?.can_spawn_sessions) ||
          activeTeamMembers[0];

        if (!coordinatorSelf) {
          return res.status(400).json({
            error: true,
            code: 'missing_coordinator_self_identity',
            message: 'Coordinator mode requires one self team member profile. Provide teamMemberId or create an active coordinator team member.',
          });
        }

        effectiveTeamMemberIds = [coordinatorSelf.id];
      }

      // Fetch team member defaults from the effective members (after task-level fallback)
      const MODEL_POWER: Record<string, number> = { 'opus': 3, 'sonnet': 2, 'haiku': 1 };
      let teamMemberDefaults: { mode?: AgentMode; model?: string; agentTool?: AgentTool; permissionMode?: string } = {};
      const teamMemberSnapshots: TeamMemberSnapshot[] = [];

      if (effectiveTeamMemberIds.length > 0 && projectId) {
        let highestModelPower = 0;
        for (const tmId of effectiveTeamMemberIds) {
          try {
            const teamMember = await teamMemberRepo.findById(projectId, tmId);
            if (teamMember && teamMember.status !== 'archived') {
              // Apply per-member overrides if provided
              const override = normalizedMemberOverrides && normalizedMemberOverrides[tmId];
              const effectiveModel = override?.model || teamMember.model;
              const effectiveAgentTool = override?.agentTool || teamMember.agentTool;
              const effectivePermissionMode = override?.permissionMode || teamMember.permissionMode;
              const effectiveSkillIds = override?.skillIds || teamMember.skillIds;
              const effectiveCommandPermissions = override?.commandPermissions
                ? { ...teamMember.commandPermissions, ...override.commandPermissions }
                : teamMember.commandPermissions;

              // Mode: use first member's mode (or most capable)
              if (!teamMemberDefaults.mode && teamMember.mode) {
                teamMemberDefaults.mode = teamMember.mode as AgentMode;
              }
              // Model: most powerful wins (using overridden model)
              const power = MODEL_POWER[effectiveModel || ''] || 0;
              if (power > highestModelPower) {
                highestModelPower = power;
                teamMemberDefaults.model = effectiveModel;
              }
              // AgentTool: first non-default wins (using overridden tool)
              if (!teamMemberDefaults.agentTool && effectiveAgentTool) {
                teamMemberDefaults.agentTool = effectiveAgentTool;
              }
              // PermissionMode: first non-null wins (using overridden permission)
              if (!teamMemberDefaults.permissionMode && effectivePermissionMode) {
                teamMemberDefaults.permissionMode = effectivePermissionMode;
              }
              // Build snapshot for UI display (with overrides applied)
              teamMemberSnapshots.push({
                name: teamMember.name,
                avatar: teamMember.avatar,
                role: teamMember.role,
                model: effectiveModel,
                agentTool: effectiveAgentTool,
                permissionMode: effectivePermissionMode,
              });
            }
          } catch (err) {
          }
        }
      }

      // Resolve mode with four-mode normalization
      const rawMode = (requestedMode as string) || teamMemberDefaults.mode || 'worker';
      const validModes = ['worker', 'coordinator', 'coordinated-worker', 'coordinated-coordinator', 'execute', 'coordinate'];
      if (!validModes.includes(rawMode)) {
        return res.status(400).json({
          error: true,
          code: 'invalid_mode',
          message: `mode must be one of: ${validModes.join(', ')}`
        });
      }
      // Auto-derive coordinated modes when spawned by a session
      const hasCoordinator = !!resolvedParentSessionId;
      const resolvedMode: AgentMode = normalizeMode(rawMode, hasCoordinator);

      // Resolve model and agentTool: request overrides > team member defaults
      const resolvedModel = requestedModel || teamMemberDefaults.model;
      const resolvedAgentToolFromMember = requestedAgentTool || teamMemberDefaults.agentTool;

      // Get project
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return res.status(404).json({
          error: true,
          code: 'project_not_found',
          message: `Project ${projectId} not found`
        });
      }

      const skillsToUse = skills && Array.isArray(skills) ? skills : [];

      // Create session with suppressed created event
      const modeLabel = isCoordinatorMode(resolvedMode) ? 'Coordinate' : 'Execute';

      // Determine teamSessionId:
      // Workers inherit the coordinator's session ID as teamSessionId.
      // Coordinator gets teamSessionId = its own ID (set after creation).
      const isSessionSpawned = !!resolvedParentSessionId;

      const session = await sessionService.createSession({
        projectId,
        taskIds,
        name: sessionName || `${modeLabel} for ${taskIds[0]}`,
        status: 'spawning',
        env: {},
        metadata: {
          skills: skillsToUse,
          spawnedBy: resolvedParentSessionId,
          spawnSource,
          mode: resolvedMode,
          agentTool: resolvedAgentToolFromMember || 'claude-code',
          model: resolvedModel || null,
          teamMemberId: effectiveTeamMemberIds.length === 1 ? effectiveTeamMemberIds[0] : null,
          teamMemberIds: effectiveTeamMemberIds.length > 0 ? effectiveTeamMemberIds : null,
          context: context || {},
          ...(normalizedMemberOverrides && Object.keys(normalizedMemberOverrides).length > 0 ? { memberOverrides: normalizedMemberOverrides } : {}),
        },
        parentSessionId: resolvedParentSessionId,
        rootSessionId: resolvedRootSessionId,
        teamSessionId: isSessionSpawned ? resolvedParentSessionId! : null,
        _suppressCreatedEvent: true
      });

      // Ensure coordinator session has teamSessionId = its own ID on first spawn
      if (isSessionSpawned) {
        try {
          const coordinatorSession = await sessionService.getSession(resolvedParentSessionId!);
          if (coordinatorSession && !coordinatorSession.teamSessionId) {
            await sessionService.updateSession(coordinatorSession.id, { teamSessionId: coordinatorSession.id });
          }
        } catch { /* coordinator update failed, non-critical */ }
      }

      // Set team member fields directly on session for UI display
      if (effectiveTeamMemberIds.length > 0) {
        (session as any).teamMemberIds = effectiveTeamMemberIds;
        (session as any).teamMemberSnapshots = teamMemberSnapshots;
        if (effectiveTeamMemberIds.length === 1) {
          (session as any).teamMemberId = effectiveTeamMemberIds[0];
          (session as any).teamMemberSnapshot = teamMemberSnapshots[0] || undefined;
        }
      }

      // Collect referenceTaskIds from all tasks being spawned
      const allReferenceTaskIds: string[] = [];
      for (const taskId of taskIds) {
        const task = await taskRepo.findById(taskId);
        if (task?.referenceTaskIds && task.referenceTaskIds.length > 0) {
          for (const refId of task.referenceTaskIds) {
            if (!allReferenceTaskIds.includes(refId)) {
              allReferenceTaskIds.push(refId);
            }
          }
        }
      }

      // Generate manifest
      let manifestPath: string;
      let manifest: any;

      try {
        const result = await generateManifestViaCLI({
          mode: resolvedMode,
          projectId,
          taskIds,
          skills: skillsToUse,
          sessionId: session.id,
          model: resolvedModel,
          agentTool: resolvedAgentToolFromMember,
          referenceTaskIds: allReferenceTaskIds.length > 0 ? allReferenceTaskIds : undefined,
          // Multi-identity: pass teamMemberIds for multi-member sessions
          teamMemberIds: effectiveTeamMemberIds.length > 1
            ? effectiveTeamMemberIds
            : (effectiveDelegateTeamMemberIds.length > 0 ? effectiveDelegateTeamMemberIds : undefined),
          // Single identity: backward compat
          teamMemberId: effectiveTeamMemberIds.length === 1 ? effectiveTeamMemberIds[0] : undefined,
          // Pass server URL so CLI subprocess can reach the API
          serverUrl: config.serverUrl,
          // Pass initial directive for guaranteed delivery in manifest
          initialDirective: initialDirective || undefined,
          coordinatorSessionId: resolvedParentSessionId || undefined,
          // Pass master flag so CLI includes cross-project data in manifest
          isMaster: project.isMaster === true,
          // Pass per-member launch overrides so CLI manifest reflects effective identity config
          memberOverrides: normalizedMemberOverrides && Object.keys(normalizedMemberOverrides).length > 0
            ? normalizedMemberOverrides
            : undefined,
        });
        manifestPath = result.manifestPath;
        manifest = result.manifest;

      } catch (manifestError: any) {
        return res.status(500).json({
          error: true,
          code: 'manifest_generation_failed',
          message: `Failed to generate manifest: ${manifestError.message}`
        });
      }

      // Prepare spawn data
      const resolvedAgentTool = resolvedAgentToolFromMember || 'claude-code';
      const initCommand = isCoordinatorMode(resolvedMode) ? 'orchestrator' : 'worker';
      const command = `maestro ${initCommand} init`;
      const cwd = project.workingDir;
      const { maestroBin, monorepoRoot } = resolveMaestroCliRuntime();

      // Pass through auth-related API keys from server environment
      const authEnvKeys = [
        'GEMINI_API_KEY',
        'GOOGLE_API_KEY',
        'GOOGLE_GENAI_USE_VERTEXAI',
        'GOOGLE_GENAI_USE_GCA',
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
      ];
      const authEnvVars: Record<string, string> = {};
      for (const key of authEnvKeys) {
        if (process.env[key]) {
          authEnvVars[key] = process.env[key]!;
        }
      }
      // Always enable GCA auth for Gemini CLI
      if (!authEnvVars['GOOGLE_GENAI_USE_GCA']) {
        authEnvVars['GOOGLE_GENAI_USE_GCA'] = 'true';
      }

      const finalEnvVars: Record<string, string> = {
        MAESTRO_SESSION_ID: session.id,
        MAESTRO_MANIFEST_PATH: manifestPath,
        MAESTRO_SERVER_URL: config.serverUrl,
        MAESTRO_MODE: resolvedMode,
        MAESTRO_COORDINATOR_SESSION_ID: resolvedParentSessionId || '',
        MAESTRO_ROOT_SESSION_ID: session.rootSessionId || '',
        // Pass storage paths so CLI reads/writes to the correct environment directories
        DATA_DIR: config.dataDir,
        SESSION_DIR: config.sessionDir,
        // Pass through auth API keys so spawned agents can authenticate
        ...authEnvVars,
      };

      // Ensure the init command resolves to the same CLI runtime used for manifest generation.
      const runtimePathForInit = prependNodeModulesBin(process.env.PATH, monorepoRoot);
      if (runtimePathForInit) {
        finalEnvVars.PATH = runtimePathForInit;
      }
      finalEnvVars.MAESTRO_CLI_PATH = maestroBin;

      // Propagate master session flag to spawned agent environment
      if (project.isMaster === true) {
        finalEnvVars.MAESTRO_IS_MASTER = 'true';
      }

      // Update session env
      await sessionService.updateSession(session.id, { env: finalEnvVars });

      // Emit session:spawn event (ALWAYS - for both UI and session spawns)
      const spawnEvent = {
        session: { ...session, env: finalEnvVars },
        command,
        cwd,
        envVars: finalEnvVars,
        manifest,
        projectId,
        taskIds,
        spawnSource,                        // NEW: 'ui' or 'session'
        parentSessionId: resolvedParentSessionId || null, // NEW: parent session ID if session-initiated
        rootSessionId: session.rootSessionId || undefined, // NEW: root session ID for nested spawn chains
        _isSpawnCreated: true               // Keep for backward compatibility
      };

      await eventBus.emit('session:spawn', spawnEvent);

      // Emit task:session_added events
      for (const taskId of taskIds) {
        await eventBus.emit('task:session_added', { taskId, sessionId: session.id });
      }

      res.status(201).json({
        success: true,
        sessionId: session.id,
        manifestPath,
        message: 'Spawn request sent to Agent Maestro',
        session: { ...session, env: finalEnvVars }
      });
    } catch (err: any) {
      res.status(500).json({
        error: true,
        code: 'spawn_error',
        message: err.message
      });
    }
  });

  return router;
}
