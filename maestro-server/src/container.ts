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
import { FileSystemTeamMemberRepository } from './infrastructure/repositories/FileSystemTeamMemberRepository';
import { ClaudeCodeSkillLoader } from './infrastructure/skills/ClaudeCodeSkillLoader';
import { ProjectService } from './application/services/ProjectService';
import { TaskService } from './application/services/TaskService';
import { SessionService } from './application/services/SessionService';
import { QueueService } from './application/services/QueueService';
import { MailService } from './application/services/MailService';
import { OrderingService } from './application/services/OrderingService';
import { TeamMemberService } from './application/services/TeamMemberService';
import { ILogger } from './domain/common/ILogger';
import { IIdGenerator } from './domain/common/IIdGenerator';
import { IEventBus } from './domain/events/IEventBus';
import { IProjectRepository } from './domain/repositories/IProjectRepository';
import { ITaskRepository } from './domain/repositories/ITaskRepository';
import { ISessionRepository } from './domain/repositories/ISessionRepository';
import { IQueueRepository } from './domain/repositories/IQueueRepository';
import { IMailRepository } from './domain/repositories/IMailRepository';
import { IOrderingRepository } from './domain/repositories/IOrderingRepository';
import { ITeamMemberRepository } from './domain/repositories/ITeamMemberRepository';
import { ISkillLoader } from './domain/services/ISkillLoader';

/**
 * Migration: Delete old team member tasks (one-time migration).
 * Scans all tasks and deletes any with taskType === 'team-member'.
 * This is safe to run multiple times (idempotent).
 */
async function migrateTeamMemberTasks(taskRepo: ITaskRepository, logger: ILogger): Promise<void> {
  try {
    logger.info('Running team member task migration...');

    // Get all tasks
    const allTasks = await taskRepo.findAll();
    let deletedCount = 0;

    for (const task of allTasks) {
      // Check if task has the old taskType field set to 'team-member'
      const taskAny = task as any;
      if (taskAny.taskType === 'team-member') {
        logger.info(`Deleting old team member task: ${task.id} (${task.title})`);
        await taskRepo.delete(task.id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Migration complete: deleted ${deletedCount} old team member task(s)`);
    } else {
      logger.info('Migration complete: no old team member tasks found');
    }
  } catch (err) {
    logger.error('Error during team member task migration:', err instanceof Error ? err : new Error(String(err)));
    // Don't throw - allow server to start even if migration fails
  }
}

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
  teamMemberRepo: ITeamMemberRepository;

  // Loaders
  skillLoader: ISkillLoader;

  // Services
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  queueService: QueueService;
  mailService: MailService;
  orderingService: OrderingService;
  teamMemberService: TeamMemberService;

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
  const teamMemberRepo = new FileSystemTeamMemberRepository(config.dataDir, idGenerator, logger);

  // 4. Loaders
  const skillLoader = new ClaudeCodeSkillLoader(config.skillsDir, logger);

  // 5. Services
  const projectService = new ProjectService(projectRepo, eventBus);
  const taskService = new TaskService(taskRepo, projectRepo, eventBus, idGenerator);
  const sessionService = new SessionService(sessionRepo, taskRepo, projectRepo, eventBus, idGenerator);
  const queueService = new QueueService(queueRepo, taskRepo, sessionRepo, eventBus);
  const mailService = new MailService(mailRepo, eventBus, idGenerator);
  const orderingService = new OrderingService(orderingRepo);
  const teamMemberService = new TeamMemberService(teamMemberRepo, eventBus, idGenerator);

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
    teamMemberRepo,
    skillLoader,
    projectService,
    taskService,
    sessionService,
    queueService,
    mailService,
    orderingService,
    teamMemberService,

    async initialize() {
      logger.info('Initializing container...');

      // Initialize repositories
      await projectRepo.initialize();
      await taskRepo.initialize();
      await sessionRepo.initialize();
      await queueRepo.initialize();
      await mailRepo.initialize();
      await orderingRepo.initialize();
      await teamMemberRepo.initialize();

      // Migration: Delete old team member tasks (one-time migration)
      await migrateTeamMemberTasks(taskRepo, logger);

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
