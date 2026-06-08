import { ILogger } from '../../domain/common/ILogger';

export interface VoiceMonkeyResult {
  success: boolean;
  status: number;
  body: unknown;
}

export interface VoiceMonkeyClientOptions {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  logger?: ILogger;
}

/**
 * Thin fetch wrapper around the Voice Monkey announcement API.
 * Holds the VM token; never expose it to callers or sessions.
 *
 * GET https://api-v2.voicemonkey.io/announcement?token=&device=&text=
 *   → { "success": true, ... }
 */
export class VoiceMonkeyClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger?: ILogger;

  constructor(options: VoiceMonkeyClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl || 'https://api-v2.voicemonkey.io/announcement';
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchImpl = options.fetchImpl || fetch;
    this.logger = options.logger;
  }

  /**
   * Speak `text` on `device` via Voice Monkey.
   * Throws on network/timeout failure; resolves with the parsed response otherwise.
   */
  async announce(text: string, device: string): Promise<VoiceMonkeyResult> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('token', this.token);
    url.searchParams.set('device', device);
    url.searchParams.set('text', text);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      });

      let body: unknown = null;
      const raw = await res.text();
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }

      const success = res.ok && (body == null || (typeof body === 'object' && (body as any).success !== false));

      if (!success) {
        this.logger?.warn('Voice Monkey announcement returned non-success', {
          status: res.status,
          body,
        });
      }

      return { success, status: res.status, body };
    } finally {
      clearTimeout(timer);
    }
  }
}
