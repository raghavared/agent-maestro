import express, { Request, Response } from 'express';
import { AppError } from '../domain/common/Errors';
import { ILogger } from '../domain/common/ILogger';
import { AnnouncementService } from '../application/services/AnnouncementService';
import { AlexaIngressService } from '../application/services/AlexaIngressService';
import { validateBody, announceSchema, alexaUtteranceSchema } from './validation';

export interface AlexaRoutesDeps {
  announcementService: AnnouncementService;
  alexaIngressService: AlexaIngressService;
  logger: ILogger;
}

function handleError(err: unknown, res: Response, logger: ILogger): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: true,
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Alexa route error', err instanceof Error ? err : new Error(message));
  res.status(500).json({ error: true, code: 'INTERNAL_ERROR', message });
}

/**
 * Voice / Alexa routes.
 *  POST /api/announce          — speak text via Voice Monkey (VM token held server-side)
 *  POST /api/alexa/utterance   — receive a verified spoken phrase and route it
 */
export function createAlexaRoutes(deps: AlexaRoutesDeps) {
  const { announcementService, alexaIngressService, logger } = deps;
  const router = express.Router();

  router.post('/announce', validateBody(announceSchema), async (req: Request, res: Response) => {
    try {
      const { text, device } = req.body as { text: string; device?: string };
      const sessionId = (req.headers['x-session-id'] as string | undefined) || undefined;

      const result = await announcementService.announce({ text, device, sessionId });
      res.json({ success: result.success, device: result.device, vmResponse: result.vmResponse });
    } catch (err) {
      handleError(err, res, logger);
    }
  });

  router.post('/alexa/utterance', validateBody(alexaUtteranceSchema), async (req: Request, res: Response) => {
    try {
      const { query, alexaSessionId, deviceId } = req.body as {
        query: string;
        alexaSessionId?: string;
        deviceId?: string;
      };

      const result = await alexaIngressService.handleUtterance({ query, alexaSessionId, deviceId });
      res.json({ success: true, sessionId: result.sessionId, spawned: result.spawned });
    } catch (err) {
      handleError(err, res, logger);
    }
  });

  return router;
}
