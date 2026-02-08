import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createContainer, Container } from './container';
import { createProjectRoutes } from './api/projectRoutes';
import { createTaskRoutes } from './api/taskRoutes';
import { createSessionRoutes } from './api/sessionRoutes';
import { createQueueRoutes } from './api/queueRoutes';
import { createSkillRoutes } from './api/skillRoutes';
import { createTemplateRoutes } from './api/templateRoutes';
import { WebSocketBridge } from './infrastructure/websocket/WebSocketBridge';
import { AppError } from './domain/common/Errors';

async function startServer() {
  // Create and initialize dependency container
  const container = await createContainer();
  await container.initialize();

  const { config, logger, eventBus, projectService, taskService, sessionService, templateService, queueService, projectRepo, taskRepo, skillLoader } = container;

  console.log('📋 Configuration loaded:');
  console.log(`   Port: ${config.port}`);
  console.log(`   Data dir: ${config.dataDir}`);
  console.log(`   Session dir: ${config.sessionDir}`);
  console.log(`   Skills dir: ${config.skillsDir}`);
  console.log(`   Debug: ${config.debug}`);

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

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
  const taskRoutes = createTaskRoutes(taskService, sessionService);
  const sessionRoutes = createSessionRoutes({
    sessionService,
    templateService,
    queueService,
    projectRepo,
    taskRepo,
    eventBus,
    config
  });

  // Queue routes
  const queueRoutes = createQueueRoutes({
    queueService,
    sessionService
  });

  // Skills route using async FileSystemSkillLoader
  const skillRoutes = createSkillRoutes(skillLoader);

  // Template routes
  const templateRoutes = createTemplateRoutes({ templateService });

  // API request logging
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const statusIcon = status >= 400 ? '❌' : '✅';
      console.log(`${statusIcon} ${method} ${originalUrl} → ${status} (${duration}ms)`);
    });

    next();
  });

  app.use('/api', projectRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', sessionRoutes);
  app.use('/api', queueRoutes);
  app.use('/api', skillRoutes);
  app.use('/api', templateRoutes);

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Server error:', err);

    if (err instanceof AppError) {
      return res.status(err.statusCode).json(err.toJSON());
    }

    res.status(500).json({
      error: true,
      message: err.message,
      code: 'INTERNAL_ERROR'
    });
  });

  // Start HTTP server
  const server = app.listen(config.port, () => {
    console.log(`🚀 Maestro Server running on http://localhost:${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
    console.log(`   WebSocket status: http://localhost:${config.port}/ws-status`);
  });

  // Start WebSocket server with event bus bridge
  const wss = new WebSocketServer({ server });
  wsBridge = new WebSocketBridge(wss, eventBus, logger);
  console.log('✅ WebSocket server started with event bus bridge');

  // Graceful shutdown
  let isShuttingDown = false;
  process.on('SIGINT', async () => {
    if (isShuttingDown) {
      console.log('⚠️  Force shutting down...');
      process.exit(1);
    }

    isShuttingDown = true;
    console.log('\n⏹️  Shutting down...');

    const forceExitTimeout = setTimeout(() => {
      console.log('⚠️  Graceful shutdown timed out, forcing exit...');
      process.exit(1);
    }, 5000);

    try {
      // Close WebSocket connections
      wss.clients.forEach(client => {
        client.close();
      });

      wss.close(() => {
        console.log('✅ WebSocket server stopped');
      });

      // Shutdown container (cleans up event bus)
      await container.shutdown();

      // Close HTTP server
      server.close(() => {
        console.log('✅ Server stopped');
        clearTimeout(forceExitTimeout);
        process.exit(0);
      });
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  });

  return { app, server, container };
}

// Start server
startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
