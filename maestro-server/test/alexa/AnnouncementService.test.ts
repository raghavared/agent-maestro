import { AnnouncementService } from '../../src/application/services/AnnouncementService';
import { VoiceMonkeyClient } from '../../src/infrastructure/voicemonkey/VoiceMonkeyClient';
import { silentLogger } from '../helpers';

function makeService(opts: {
  vmResult?: { success: boolean; status: number; body: unknown };
  vmThrows?: Error;
  defaultDevice?: string;
  addTimelineEvent?: jest.Mock;
}) {
  const announce = jest.fn(async () => {
    if (opts.vmThrows) throw opts.vmThrows;
    return opts.vmResult ?? { success: true, status: 200, body: { success: true } };
  });
  const vmClient = { announce } as unknown as VoiceMonkeyClient;

  const addTimelineEvent = opts.addTimelineEvent ?? jest.fn(async () => ({} as any));
  const sessionService = { addTimelineEvent } as any;

  const service = new AnnouncementService({
    vmClient,
    defaultDevice: opts.defaultDevice ?? 'yolo',
    sessionService,
    logger: silentLogger,
  });

  return { service, announce, addTimelineEvent };
}

describe('AnnouncementService', () => {
  it('speaks via the VM client and resolves success', async () => {
    const { service, announce } = makeService({});
    const result = await service.announce({ text: 'hello', sessionId: 'sess_1' });

    expect(result.success).toBe(true);
    expect(result.device).toBe('yolo');
    expect(announce).toHaveBeenCalledWith('hello', 'yolo');
  });

  it('uses an explicit device over the default', async () => {
    const { service, announce } = makeService({});
    await service.announce({ text: 'hi', device: 'kitchen' });
    expect(announce).toHaveBeenCalledWith('hi', 'kitchen');
  });

  it('records an announcement timeline event on the calling session', async () => {
    const { service, addTimelineEvent } = makeService({});
    await service.announce({ text: 'done', sessionId: 'sess_42' });
    expect(addTimelineEvent).toHaveBeenCalledWith(
      'sess_42',
      'milestone',
      expect.stringContaining('done'),
      undefined,
      expect.objectContaining({ kind: 'announcement_sent', device: 'yolo' }),
    );
  });

  it('throws ANNOUNCE_NOT_CONFIGURED when no VM client is configured', async () => {
    const service = new AnnouncementService({
      vmClient: null,
      defaultDevice: 'yolo',
      sessionService: { addTimelineEvent: jest.fn() } as any,
      logger: silentLogger,
    });
    await expect(service.announce({ text: 'x' })).rejects.toMatchObject({ code: 'ANNOUNCE_NOT_CONFIGURED' });
  });

  it('throws ANNOUNCE_FAILED when VM reports non-success', async () => {
    const { service } = makeService({ vmResult: { success: false, status: 500, body: { success: false } } });
    await expect(service.announce({ text: 'x', sessionId: 's' })).rejects.toMatchObject({ code: 'ANNOUNCE_FAILED' });
  });

  it('enforces the per-session rate limit (6/min)', async () => {
    const { service } = makeService({});
    for (let i = 0; i < 6; i++) {
      await service.announce({ text: `msg ${i}`, sessionId: 'spammer' });
    }
    await expect(service.announce({ text: 'one too many', sessionId: 'spammer' }))
      .rejects.toMatchObject({ code: 'ANNOUNCE_RATE_LIMITED' });
  });

  it('rate-limits per session independently', async () => {
    const { service } = makeService({});
    for (let i = 0; i < 6; i++) {
      await service.announce({ text: `a ${i}`, sessionId: 'sessionA' });
    }
    // A different session is unaffected.
    await expect(service.announce({ text: 'fresh', sessionId: 'sessionB' })).resolves.toMatchObject({ success: true });
  });
});
