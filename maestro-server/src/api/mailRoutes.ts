import { Router, Request, Response } from 'express';
import { MailService } from '../application/services/MailService';
import { AppError } from '../domain/common/Errors';
import {
  validateBody,
  validateParams,
  validateQuery,
  sendMailSchema,
  mailInboxQuerySchema,
  mailWaitQuerySchema,
  idParamSchema,
} from './validation';

interface MailRouteDependencies {
  mailService: MailService;
}

export function createMailRoutes(deps: MailRouteDependencies) {
  const { mailService } = deps;
  const router = Router();

  const handleError = (err: any, res: Response) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(err.toJSON());
    }
    return res.status(500).json({
      error: true,
      message: err.message,
      code: 'INTERNAL_ERROR',
    });
  };

  // POST /api/mail — Send a mail message
  router.post(
    '/mail',
    validateBody(sendMailSchema),
    async (req: Request, res: Response) => {
      try {
        const mail = await mailService.sendMail(req.body);
        res.status(201).json(mail);
      } catch (err: any) {
        handleError(err, res);
      }
    }
  );

  // GET /api/mail/inbox/:id — Get inbox for a session
  router.get(
    '/mail/inbox/:id',
    validateParams(idParamSchema),
    validateQuery(mailInboxQuerySchema),
    async (req: Request, res: Response) => {
      try {
        const sessionId = req.params.id as string;
        const projectId = (req.query.projectId as string) || '';
        const filter: any = {};
        if (req.query.type) filter.type = req.query.type as string;
        if (req.query.since) filter.since = Number(req.query.since);

        const messages = await mailService.getInbox(sessionId, projectId, filter);
        res.json(messages);
      } catch (err: any) {
        handleError(err, res);
      }
    }
  );

  // GET /api/mail/wait/:id — Long-poll wait for new mail
  router.get(
    '/mail/wait/:id',
    validateParams(idParamSchema),
    validateQuery(mailWaitQuerySchema),
    async (req: Request, res: Response) => {
      try {
        const sessionId = req.params.id as string;
        const projectId = (req.query.projectId as string) || '';
        const timeout = req.query.timeout ? Number(req.query.timeout) : undefined;
        const since = req.query.since ? Number(req.query.since) : undefined;

        const messages = await mailService.waitForMail(sessionId, projectId, { timeout, since });
        res.json(messages);
      } catch (err: any) {
        handleError(err, res);
      }
    }
  );

  // GET /api/mail/thread/:id — Get all messages in a thread
  router.get(
    '/mail/thread/:id',
    validateParams(idParamSchema),
    async (req: Request, res: Response) => {
      try {
        const threadId = req.params.id as string;
        const messages = await mailService.getThread(threadId);
        res.json(messages);
      } catch (err: any) {
        handleError(err, res);
      }
    }
  );

  // GET /api/mail/:id — Get a single mail message
  router.get(
    '/mail/:id',
    validateParams(idParamSchema),
    async (req: Request, res: Response) => {
      try {
        const mail = await mailService.getMail(req.params.id as string);
        res.json(mail);
      } catch (err: any) {
        handleError(err, res);
      }
    }
  );

  // DELETE /api/mail/:id — Delete a mail message
  router.delete(
    '/mail/:id',
    validateParams(idParamSchema),
    async (req: Request, res: Response) => {
      try {
        await mailService.deleteMail(req.params.id as string);
        res.json({ deleted: true, id: req.params.id });
      } catch (err: any) {
        handleError(err, res);
      }
    }
  );

  return router;
}
