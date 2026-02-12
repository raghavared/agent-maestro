import { Config } from './infrastructure/config';
import { ConsoleLogger } from './infrastructure/common/ConsoleLogger';
import { TimestampIdGenerator } from './infrastructure/common/TimestampIdGenerator';
import { InMemoryEventBus } from './infrastructure/events/InMemoryEventBus';
import { FileSystemProjectRepository } from './infrastructure/repositories/FileSystemProjectRepository';
import { FileSystemTaskRepository } from './infrastructure/repositories/FileSystemTaskRepository';
import { FileSystemSessionRepository } from './infrastructure/repositories/FileSystemSessionRepository';
import { FileSystemTemplateRepository } from './infrastructure/repositories/FileSystemTemplateRepository';
import { FileSystemQueueRepository } from './infrastructure/repositories/FileSystemQueueRepository';
import { ClaudeCodeSkillLoader } from './infrastructure/skills/ClaudeCodeSkillLoader';
import { ProjectService } from './application/services/ProjectService';
import { TaskService } from './application/services/TaskService';
import { SessionService } from './application/services/SessionService';
import { TemplateService } from './application/services/TemplateService';
import { QueueService } from './application/services/QueueService';
import { ILogger } from './domain/common/ILogger';
import { IIdGenerator } from './domain/common/IIdGenerator';
import { IEventBus } from './domain/events/IEventBus';
import { IProjectRepository } from './domain/repositories/IProjectRepository';
import { ITaskRepository } from './domain/repositories/ITaskRepository';
import { ISessionRepository } from './domain/repositories/ISessionRepository';
import { ITemplateRepository } from './domain/repositories/ITemplateRepository';
import { IQueueRepository } from './domain/repositories/IQueueRepository';
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
  templateRepo: ITemplateRepository;
  queueRepo: IQueueRepository;

  // Loaders
  skillLoader: ISkillLoader;

  // Services
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  templateService: TemplateService;
  queueService: QueueService;

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
  const templateRepo = new FileSystemTemplateRepository(config.dataDir, idGenerator, logger);
  const queueRepo = new FileSystemQueueRepository(config.dataDir, logger);

  // 4. Loaders
  const skillLoader = new ClaudeCodeSkillLoader(config.skillsDir, logger);

  // 5. Services
  const projectService = new ProjectService(projectRepo, eventBus);
  const taskService = new TaskService(taskRepo, projectRepo, eventBus, idGenerator);
  const sessionService = new SessionService(sessionRepo, taskRepo, projectRepo, eventBus, idGenerator);
  const templateService = new TemplateService(templateRepo, eventBus);
  const queueService = new QueueService(queueRepo, taskRepo, sessionRepo, eventBus);

  const container: Container = {
    config,
    logger,
    idGenerator,
    eventBus,
    projectRepo,
    taskRepo,
    sessionRepo,
    templateRepo,
    queueRepo,
    skillLoader,
    projectService,
    taskService,
    sessionService,
    templateService,
    queueService,

    async initialize() {
      logger.info('Initializing container...');

      // Initialize repositories
      await projectRepo.initialize();
      await taskRepo.initialize();
      await sessionRepo.initialize();
      await templateRepo.initialize();
      await queueRepo.initialize();

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
