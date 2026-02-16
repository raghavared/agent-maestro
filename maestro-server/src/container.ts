import { Config } from './infrastructure/config';
import { ConsoleLogger } from './infrastructure/common/ConsoleLogger';
import { TimestampIdGenerator } from './infrastructure/common/TimestampIdGenerator';
import { InMemoryEventBus } from './infrastructure/events/InMemoryEventBus';
import { FileSystemProjectRepository } from './infrastructure/repositories/FileSystemProjectRepository';
import { FileSystemTaskRepository } from './infrastructure/repositories/FileSystemTaskRepository';
import { FileSystemSessionRepository } from './infrastructure/repositories/FileSystemSessionRepository';
import { FileSystemQueueRepository } from './infrastructure/repositories/FileSystemQueueRepository';
import { FileSystemMailRepository } from './infrastructure/repositories/FileSystemMailRepository';
import { FileSystemOrderingRepository } from './infrastructure/repositories/FileSystemOrderingRepository';
import { ClaudeCodeSkillLoader } from './infrastructure/skills/ClaudeCodeSkillLoader';
import { ProjectService } from './application/services/ProjectService';
import { TaskService } from './application/services/TaskService';
import { SessionService } from './application/services/SessionService';
import { QueueService } from './application/services/QueueService';
import { MailService } from './application/services/MailService';
import { OrderingService } from './application/services/OrderingService';
import { ILogger } from './domain/common/ILogger';
import { IIdGenerator } from './domain/common/IIdGenerator';
import { IEventBus } from './domain/events/IEventBus';
import { IProjectRepository } from './domain/repositories/IProjectRepository';
import { ITaskRepository } from './domain/repositories/ITaskRepository';
import { ISessionRepository } from './domain/repositories/ISessionRepository';
import { IQueueRepository } from './domain/repositories/IQueueRepository';
import { IMailRepository } from './domain/repositories/IMailRepository';
import { IOrderingRepository } from './domain/repositories/IOrderingRepository';
import { ISkillLoader } from './domain/services/ISkillLoader';

/**
 * Dependency injection container.
 * Wires together all application components.
 */
export interface Container {
  // Configuration
  config: Config;

  // Infrastructure
  logger: ILogger;
  idGenerator: IIdGenerator;
  eventBus: IEventBus;

  // Repositories
  projectRepo: IProjectRepository;
  taskRepo: ITaskRepository;
  sessionRepo: ISessionRepository;
  queueRepo: IQueueRepository;
  mailRepo: IMailRepository;
  orderingRepo: IOrderingRepository;

  // Loaders
  skillLoader: ISkillLoader;

  // Services
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  queueService: QueueService;
  mailService: MailService;
  orderingService: OrderingService;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Create and wire up all dependencies.
 */
export async function createContainer(): Promise<Container> {
  // 1. Configuration
  const config = new Config();

  // 2. Infrastructure - Core
  const logger = new ConsoleLogger(config.log.level);
  const idGenerator = new TimestampIdGenerator();
  const eventBus = new InMemoryEventBus(logger);

  // 3. Repositories
  const taskRepo = new FileSystemTaskRepository(config.dataDir, idGenerator, logger);
  const sessionRepo = new FileSystemSessionRepository(config.dataDir, idGenerator, logger);
  const projectRepo = new FileSystemProjectRepository(
    config.dataDir,
    idGenerator,
    logger,
    // Cross-repository checks
    (projectId) => taskRepo.existsByProjectId(projectId),
    (projectId) => sessionRepo.existsByProjectId(projectId)
  );
  const queueRepo = new FileSystemQueueRepository(config.dataDir, logger);
  const mailRepo = new FileSystemMailRepository(config.dataDir, logger);
  const orderingRepo = new FileSystemOrderingRepository(config.dataDir, logger);

  // 4. Loaders
  const skillLoader = new ClaudeCodeSkillLoader(config.skillsDir, logger);

  // 5. Services
  const projectService = new ProjectService(projectRepo, eventBus);
  const taskService = new TaskService(taskRepo, projectRepo, eventBus, idGenerator);
  const sessionService = new SessionService(sessionRepo, taskRepo, projectRepo, eventBus, idGenerator);
  const queueService = new QueueService(queueRepo, taskRepo, sessionRepo, eventBus);
  const mailService = new MailService(mailRepo, eventBus, idGenerator);
  const orderingService = new OrderingService(orderingRepo);

  const container: Container = {
    config,
    logger,
    idGenerator,
    eventBus,
    projectRepo,
    taskRepo,
    sessionRepo,
    queueRepo,
    mailRepo,
    orderingRepo,
    skillLoader,
    projectService,
    taskService,
    sessionService,
    queueService,
    mailService,
    orderingService,

    async initialize() {
      logger.info('Initializing container...');

      // Initialize repositories
      await projectRepo.initialize();
      await taskRepo.initialize();
      await sessionRepo.initialize();
      await queueRepo.initialize();
      await mailRepo.initialize();
      await orderingRepo.initialize();

      logger.info('Container initialized');
    },

    async shutdown() {
      logger.info('Shutting down container...');
      eventBus.removeAllListeners();
      logger.info('Container shutdown complete');
    }
  };

  return container;
}
