import { AppError } from '../../domain/common/Errors';
import { ILogger } from '../../domain/common/ILogger';
import { IEventBus } from '../../domain/events/IEventBus';
import { VoiceState } from '../../infrastructure/bootstrap/MasterProjectBootstrap';
import { SessionService } from './SessionService';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'stopped']);
const COORDINATOR_MODES = new Set(['coordinator', 'coordinated-coordinator', 'coordinate']);

/**
 * Debug routing override: when a live session owned by this team member exists,
 * voice utterances are forwarded to it instead of the system Alexa Coordinator.
 * Data-driven — the mere presence of an active debugger session activates it.
 */
const DEFAULT_DEBUGGER_TEAM_MEMBER_ID = 'tm_1780851408987_447ud5t51';

export interface AlexaUtterance {
  query: string;
  alexaSessionId?: string;
  deviceId?: string;
}

export interface AlexaUtteranceResult {
  sessionId: string;
  spawned: boolean;
}

/**
 * Spawns a fresh Alexa Coordinator session in the Master project.
 * Returns the new session ID. Injected so it can be mocked in tests.
 */
export type SpawnCoordinatorFn = (args: {
  projectId: string;
  taskId: string;
  teamMemberId: string;
  serverUrl: string;
  directive: { subject: string; message: string; fromSessionId: string };
}) => Promise<string>;

export interface AlexaIngressServiceDeps {
  logger: ILogger;
  eventBus: IEventBus;
  sessionService: SessionService;
  voiceState: VoiceState;
  alexaRootTeamMemberId: string;
  serverUrl: string;
  spawnFn?: SpawnCoordinatorFn;
  debuggerTeamMemberId?: string;
}

export class AlexaIngressNotReadyError extends AppError {
  constructor(message: string) {
    super(503, 'ALEXA_INGRESS_NOT_READY', message);
  }
}

/**
 * Receives a verified spoken phrase and delivers it to the Alexa Coordinator
 * session in the Master project, spawning one if none is alive.
 */
export class AlexaIngressService {
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;
  private readonly sessionService: SessionService;
  private readonly voiceState: VoiceState;
  private readonly alexaRootTeamMemberId: string;
  private readonly serverUrl: string;
  private readonly spawnFn: SpawnCoordinatorFn;
  private readonly debuggerTeamMemberId: string;

  constructor(deps: AlexaIngressServiceDeps) {
    this.logger = deps.logger;
    this.eventBus = deps.eventBus;
    this.sessionService = deps.sessionService;
    this.voiceState = deps.voiceState;
    this.alexaRootTeamMemberId = deps.alexaRootTeamMemberId;
    this.serverUrl = deps.serverUrl;
    this.spawnFn = deps.spawnFn || defaultHttpSpawn;
    this.debuggerTeamMemberId = deps.debuggerTeamMemberId || DEFAULT_DEBUGGER_TEAM_MEMBER_ID;
  }

  async handleUtterance(utterance: AlexaUtterance): Promise<AlexaUtteranceResult> {
    const masterProjectId = this.voiceState.masterProjectId;
    if (!masterProjectId) {
      throw new AlexaIngressNotReadyError('Master project is not initialized yet.');
    }

    // Debug routing override: if an active debugger session exists anywhere in
    // the workspace, forward the utterance to it instead of the system coordinator.
    const debuggerSession = await this.findActiveDebuggerSession();
    if (debuggerSession) {
      await this.injectPrompt(debuggerSession.id, utterance);
      this.logger.info(`utterance routed to ${debuggerSession.id} (debugger)`);
      return { sessionId: debuggerSession.id, spawned: false };
    }

    const existing = await this.findActiveCoordinator(masterProjectId);

    if (existing) {
      await this.injectPrompt(existing.id, utterance);
      this.logger.info(`utterance routed to ${existing.id} (system coordinator)`);
      return { sessionId: existing.id, spawned: false };
    }

    const taskId = this.voiceState.voiceDirectiveTaskId;
    if (!taskId) {
      throw new AlexaIngressNotReadyError('Voice directive task is not initialized yet.');
    }

    const sessionId = await this.spawnFn({
      projectId: masterProjectId,
      taskId,
      teamMemberId: this.alexaRootTeamMemberId,
      serverUrl: this.serverUrl,
      directive: {
        subject: 'Voice directive',
        message: utterance.query,
        fromSessionId: 'alexa-ingress',
      },
    });

    // Record on the freshly spawned session so it is visible in the timeline/logs
    // even though the spoken directive is delivered via the manifest.
    await this.recordTimeline(sessionId, utterance);
    this.logger.info(`utterance routed to ${sessionId} (system coordinator)`);

    return { sessionId, spawned: true };
  }

  /**
   * Finds the most-recently-active, non-terminal session owned by the debugger
   * team member, searched across all projects. Returns null when none exists.
   */
  private async findActiveDebuggerSession() {
    const sessions = await this.sessionService.listSessions();
    const candidates = sessions.filter(s => {
      const meta = (s.metadata || {}) as Record<string, any>;
      const ownedByDebugger =
        meta.teamMemberId === this.debuggerTeamMemberId ||
        (Array.isArray(meta.teamMemberIds) && meta.teamMemberIds.includes(this.debuggerTeamMemberId));
      if (!ownedByDebugger) return false;
      return !TERMINAL_STATUSES.has(String(s.status));
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.lastActivity || b.startedAt || 0) - (a.lastActivity || a.startedAt || 0));
    return candidates[0];
  }

  private async findActiveCoordinator(masterProjectId: string) {
    const sessions = await this.sessionService.listSessionsByProject(masterProjectId);
    const candidates = sessions.filter(s => {
      const meta = (s.metadata || {}) as Record<string, any>;
      const isAlexa =
        meta.teamMemberId === this.alexaRootTeamMemberId ||
        (Array.isArray(meta.teamMemberIds) && meta.teamMemberIds.includes(this.alexaRootTeamMemberId));
      if (!isAlexa) return false;
      const mode = String(meta.mode || '');
      if (mode && !COORDINATOR_MODES.has(mode)) return false;
      return !TERMINAL_STATUSES.has(String(s.status));
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    return candidates[0];
  }

  private async injectPrompt(sessionId: string, utterance: AlexaUtterance): Promise<void> {
    const content = utterance.query;
    await this.eventBus.emit('session:prompt_send', {
      sessionId,
      content,
      mode: 'send',
      senderSessionId: 'alexa-ingress',
      timestamp: Date.now(),
    });
    await this.recordTimeline(sessionId, utterance);
  }

  private async recordTimeline(sessionId: string, utterance: AlexaUtterance): Promise<void> {
    try {
      await this.sessionService.addTimelineEvent(
        sessionId,
        'prompt_received',
        `Voice directive: "${utterance.query}"`,
        undefined,
        {
          kind: 'alexa_utterance',
          alexaSessionId: utterance.alexaSessionId,
          deviceId: utterance.deviceId,
        },
      );
    } catch (err) {
      this.logger.warn('Failed to record Alexa utterance timeline event', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Default spawn implementation: internal HTTP call to the existing
 * POST /api/sessions/spawn endpoint, reusing all manifest/session logic.
 */
const defaultHttpSpawn: SpawnCoordinatorFn = async ({ projectId, taskId, teamMemberId, serverUrl, directive }) => {
  const res = await fetch(`${serverUrl}/api/sessions/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      taskIds: [taskId],
      teamMemberId,
      mode: 'coordinator',
      spawnSource: 'ui',
      sessionName: 'Alexa Coordinator',
      initialDirective: directive,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !body?.sessionId) {
    throw new AppError(
      502,
      'ALEXA_SPAWN_FAILED',
      `Failed to spawn Alexa Coordinator session: ${body?.message || res.status}`,
    );
  }
  return body.sessionId as string;
};
