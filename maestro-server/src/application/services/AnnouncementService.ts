import { AppError } from '../../domain/common/Errors';
import { ILogger } from '../../domain/common/ILogger';
import { VoiceMonkeyClient, VoiceMonkeyResult } from '../../infrastructure/voicemonkey/VoiceMonkeyClient';
import { SessionService } from './SessionService';

/**
 * Voice announcement is not configured (no VM_TOKEN). 503.
 */
export class AnnouncementNotConfiguredError extends AppError {
  constructor() {
    super(503, 'ANNOUNCE_NOT_CONFIGURED', 'Voice announcements are not configured (VM_TOKEN missing).');
  }
}

/**
 * Per-session announcement rate limit exceeded. 429.
 */
export class AnnouncementRateLimitError extends AppError {
  constructor(limit: number, windowMs: number) {
    super(429, 'ANNOUNCE_RATE_LIMITED', `Announcement rate limit exceeded (${limit} per ${Math.round(windowMs / 1000)}s).`);
  }
}

/**
 * Voice Monkey rejected or failed the announcement. 502.
 */
export class AnnouncementFailedError extends AppError {
  constructor(details?: any) {
    super(502, 'ANNOUNCE_FAILED', 'Voice Monkey announcement failed.', details);
  }
}

export interface AnnounceParams {
  text: string;
  device?: string;
  sessionId?: string; // calling session for timeline + rate limiting
}

export interface AnnounceResult {
  success: boolean;
  device: string;
  vmResponse: unknown;
}

export interface AnnouncementServiceDeps {
  vmClient: VoiceMonkeyClient | null; // null when VM_TOKEN is not configured
  defaultDevice?: string;
  sessionService: SessionService;
  logger: ILogger;
  rateLimit?: { max: number; windowMs: number };
}

const ANON_KEY = '__anonymous__';

/**
 * Wraps Voice Monkey with a per-session rate limit and timeline recording.
 * The VM token lives only inside the injected VoiceMonkeyClient.
 */
export class AnnouncementService {
  private readonly vmClient: VoiceMonkeyClient | null;
  private readonly defaultDevice?: string;
  private readonly sessionService: SessionService;
  private readonly logger: ILogger;
  private readonly rateMax: number;
  private readonly rateWindowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(deps: AnnouncementServiceDeps) {
    this.vmClient = deps.vmClient;
    this.defaultDevice = deps.defaultDevice;
    this.sessionService = deps.sessionService;
    this.logger = deps.logger;
    this.rateMax = deps.rateLimit?.max ?? 6;
    this.rateWindowMs = deps.rateLimit?.windowMs ?? 60_000;
  }

  get isConfigured(): boolean {
    return this.vmClient !== null;
  }

  async announce(params: AnnounceParams): Promise<AnnounceResult> {
    if (!this.vmClient) {
      throw new AnnouncementNotConfiguredError();
    }

    const device = params.device || this.defaultDevice;
    if (!device) {
      throw new AppError(400, 'ANNOUNCE_NO_DEVICE', 'No announcement device specified and no default VM_DEVICE configured.');
    }

    this.enforceRateLimit(params.sessionId);

    let vmResult: VoiceMonkeyResult;
    try {
      vmResult = await this.vmClient.announce(params.text, device);
    } catch (err) {
      this.logger.error('Voice Monkey request failed', err instanceof Error ? err : new Error(String(err)));
      throw new AnnouncementFailedError({ reason: err instanceof Error ? err.message : String(err) });
    }

    if (!vmResult.success) {
      throw new AnnouncementFailedError({ status: vmResult.status, body: vmResult.body });
    }

    // Best-effort timeline record on the calling session.
    if (params.sessionId) {
      try {
        await this.sessionService.addTimelineEvent(
          params.sessionId,
          'milestone',
          `Announced: "${params.text}"`,
          undefined,
          { kind: 'announcement_sent', device }
        );
      } catch (err) {
        this.logger.warn('Failed to record announcement timeline event', {
          sessionId: params.sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success: true, device, vmResponse: vmResult.body };
  }

  private enforceRateLimit(sessionId?: string): void {
    const key = sessionId || ANON_KEY;
    const now = Date.now();
    const windowStart = now - this.rateWindowMs;
    const recent = (this.hits.get(key) || []).filter(t => t > windowStart);

    if (recent.length >= this.rateMax) {
      throw new AnnouncementRateLimitError(this.rateMax, this.rateWindowMs);
    }

    recent.push(now);
    this.hits.set(key, recent);
  }
}
