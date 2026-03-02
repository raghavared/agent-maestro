import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createContainer, Container } from './container';
import { createProjectRoutes } from './api/projectRoutes';
import { createTaskRoutes } from './api/taskRoutes';
import { createTaskListRoutes } from './api/taskListRoutes';
import { createSessionRoutes } from './api/sessionRoutes';

import { createSkillRoutes } from './api/skillRoutes';
import { createOrderingRoutes } from './api/orderingRoutes';
import { createTeamMemberRoutes } from './api/teamMemberRoutes';
import { createTeamRoutes } from './api/teamRoutes';
import { createWorkflowTemplateRoutes } from './api/workflowTemplateRoutes';
import { createMasterRoutes } from './api/masterRoutes';
import { WebSocketBridge } from './infrastructure/websocket/WebSocketBridge';
import { errorHandler } from './api/middleware/errorHandler';

async function startServer() {
  // Create and initialize dependency container
  const container = await createContainer();
  await container.initialize();

  const { config, logger, eventBus, projectService, taskService, taskListService, sessionService, logDigestService, orderingService, teamMemberService, teamService, mailService, projectRepo, taskRepo, teamMemberRepo, skillLoader } = container;

  // Create Express app
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration for Tauri app and web clients
  // NOTE: CORS must be registered before rate limiting so preflight OPTIONS
  // requests always get proper CORS headers and are not blocked by 429.
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'tauri://localhost',
        'http://localhost:1420',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:1420',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ];

      // Allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-Id'],
    exposedHeaders: ['Content-Length', 'X-Request-Id']
  }));
  // JSON body parser with size limit (50mb for image uploads)
  app.use(express.json({ limit: '50mb' }));

  // Rate limiting (applied after CORS so preflight OPTIONS always get CORS headers)
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req: Request) => req.method === 'OPTIONS',
  });
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req: Request) => req.method === 'OPTIONS',
  });
  app.use(generalLimiter);

  // Apply stricter rate limiting to write routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    next();
  });

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  });

  // WebSocket status endpoint (populated after wss is created)
  let wsBridge: WebSocketBridge;
  app.get('/ws-status', (req: Request, res: Response) => {
    if (!wsBridge) {
      return res.json({
        error: 'WebSocket server not initialized yet'
      });
    }
    res.json({
      connectedClients: wsBridge.getClientCount(),
      clients: wsBridge.getClientStatus()
    });
  });

  // API routes using services
  const projectRoutes = createProjectRoutes(projectService);
  const taskRoutes = createTaskRoutes(taskService, sessionService, config.dataDir);
  const taskListRoutes = createTaskListRoutes(taskListService);
  const sessionRoutes = createSessionRoutes({
    sessionService,
    logDigestService,
    projectRepo,
    taskRepo,
    teamMemberRepo,
    mailService,
    eventBus,
    config
  });

  // Ordering routes
  const orderingRoutes = createOrderingRoutes(orderingService);

  // Team member routes
  const teamMemberRoutes = createTeamMemberRoutes(teamMemberService);

  // Team routes
  const teamRoutes = createTeamRoutes(teamService);

  // Skills route using async FileSystemSkillLoader
  const skillRoutes = createSkillRoutes(skillLoader);

  app.use('/api', projectRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', taskListRoutes);
  app.use('/api', sessionRoutes);
  app.use('/api', skillRoutes);
  app.use('/api', orderingRoutes);
  app.use('/api', teamMemberRoutes);
  app.use('/api', teamRoutes);
  app.use('/api/workflow-templates', createWorkflowTemplateRoutes());

  // Master project cross-project routes
  const masterRoutes = createMasterRoutes(projectService, taskService, sessionService);
  app.use('/api', masterRoutes);

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Server error:', err);
    errorHandler(err, req, res, next);
  });

  // Start HTTP server
  const server = app.listen(config.port, () => {
    // Write server URL to data dir so CLI can auto-discover it
    try {
      const serverUrlFile = `${config.dataDir}/server-url`;
      mkdirSync(dirname(serverUrlFile), { recursive: true });
      writeFileSync(serverUrlFile, config.serverUrl, 'utf-8');
    } catch (err) {
      // Ignore write failures
    }
  });

  // Start WebSocket server with event bus bridge
  const wss = new WebSocketServer({ server });
  wsBridge = new WebSocketBridge(wss, eventBus, logger);

  // Graceful shutdown handler
  let isShuttingDown = false;
  const gracefulShutdown = async () => {
    if (isShuttingDown) {
      process.exit(1);
    }

    isShuttingDown = true;

    const forceExitTimeout = setTimeout(() => {
      process.exit(1);
    }, 5000);

    try {
      // Close WebSocket connections
      wss.clients.forEach(client => {
        client.close();
      });

      wss.close(() => {});

      // Shutdown container (cleans up event bus)
      await container.shutdown();

      // Close HTTP server
      server.close(() => {
        clearTimeout(forceExitTimeout);
        process.exit(0);
      });
    } catch (err) {
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  return { app, server, container };
}

// Start server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
