import { Config } from './infrastructure/config';
import { ConsoleLogger } from './infrastructure/common/ConsoleLogger';
import { TimestampIdGenerator } from './infrastructure/common/TimestampIdGenerator';
import { InMemoryEventBus } from './infrastructure/events/InMemoryEventBus';
import { FileSystemProjectRepository } from './infrastructure/repositories/FileSystemProjectRepository';
import { FileSystemTaskRepository } from './infrastructure/repositories/FileSystemTaskRepository';
import { FileSystemSessionRepository } from './infrastructure/repositories/FileSystemSessionRepository';
import { FileSystemTaskListRepository } from './infrastructure/repositories/FileSystemTaskListRepository';

import { FileSystemOrderingRepository } from './infrastructure/repositories/FileSystemOrderingRepository';
import { FileSystemTeamMemberRepository } from './infrastructure/repositories/FileSystemTeamMemberRepository';
import { FileSystemTeamRepository } from './infrastructure/repositories/FileSystemTeamRepository';
import { FileSystemMailRepository } from './infrastructure/repositories/FileSystemMailRepository';
import { MultiScopeSkillLoader } from './infrastructure/skills/MultiScopeSkillLoader';
import { ProjectService } from './application/services/ProjectService';
import { TaskService } from './application/services/TaskService';
import { SessionService } from './application/services/SessionService';
import { TaskListService } from './application/services/TaskListService';
import { LogDigestService } from './application/services/LogDigestService';
import { MailService } from './application/services/MailService';

import { OrderingService } from './application/services/OrderingService';
import { TeamMemberService } from './application/services/TeamMemberService';
import { TeamService } from './application/services/TeamService';
import { ILogger } from './domain/common/ILogger';
import { IIdGenerator } from './domain/common/IIdGenerator';
import { IEventBus } from './domain/events/IEventBus';
import { IProjectRepository } from './domain/repositories/IProjectRepository';
import { ITaskRepository } from './domain/repositories/ITaskRepository';
import { ITaskListRepository } from './domain/repositories/ITaskListRepository';
import { ISessionRepository } from './domain/repositories/ISessionRepository';

import { IOrderingRepository } from './domain/repositories/IOrderingRepository';
import { ITeamMemberRepository } from './domain/repositories/ITeamMemberRepository';
import { ITeamRepository } from './domain/repositories/ITeamRepository';
import { IMailRepository } from './domain/repositories/IMailRepository';
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
  taskListRepo: ITaskListRepository;
  sessionRepo: ISessionRepository;
  orderingRepo: IOrderingRepository;
  teamMemberRepo: ITeamMemberRepository;
  teamRepo: ITeamRepository;
  mailRepo: IMailRepository;

  // Loaders
  skillLoader: ISkillLoader;

  // Services
  projectService: ProjectService;
  taskService: TaskService;
  taskListService: TaskListService;
  sessionService: SessionService;
  logDigestService: LogDigestService;
  orderingService: OrderingService;
  teamMemberService: TeamMemberService;
  teamService: TeamService;
  mailService: MailService;

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
  const taskListRepo = new FileSystemTaskListRepository(config.dataDir, idGenerator, logger);
  const projectRepo = new FileSystemProjectRepository(
    config.dataDir,
    idGenerator,
    logger,
    // Cross-repository checks
    (projectId) => taskRepo.existsByProjectId(projectId),
    (projectId) => sessionRepo.existsByProjectId(projectId)
  );
  const orderingRepo = new FileSystemOrderingRepository(config.dataDir, logger);
  const teamMemberRepo = new FileSystemTeamMemberRepository(config.dataDir, idGenerator, logger);
  const teamRepo = new FileSystemTeamRepository(config.dataDir, idGenerator, logger);

  // 4. Loaders
  const skillLoader = new MultiScopeSkillLoader(logger);

  // 5. Services
  const projectService = new ProjectService(projectRepo, eventBus);
  const taskService = new TaskService(taskRepo, projectRepo, eventBus, idGenerator, taskListRepo);
  const taskListService = new TaskListService(taskListRepo, projectRepo, taskRepo, eventBus);
  const sessionService = new SessionService(sessionRepo, taskRepo, projectRepo, eventBus, idGenerator);
  const logDigestService = new LogDigestService(sessionService, projectRepo);
  const orderingService = new OrderingService(orderingRepo);
  const teamMemberService = new TeamMemberService(teamMemberRepo, eventBus, idGenerator);
  const teamService = new TeamService(teamRepo, teamMemberRepo, eventBus, idGenerator);
  const mailRepo = new FileSystemMailRepository(config.dataDir, idGenerator, logger);
  const mailService = new MailService(mailRepo, sessionRepo, eventBus);

  const container: Container = {
    config,
    logger,
    idGenerator,
    eventBus,
    projectRepo,
    taskRepo,
    taskListRepo,
    sessionRepo,
    orderingRepo,
    teamMemberRepo,
    teamRepo,
    mailRepo,
    skillLoader,
    projectService,
    taskService,
    taskListService,
    sessionService,
    logDigestService,
    orderingService,
    teamMemberService,
    teamService,
    mailService,

    async initialize() {
      logger.info('Initializing container...');

      // Initialize repositories
      await projectRepo.initialize();
      await taskRepo.initialize();
      await taskListRepo.initialize();
      await sessionRepo.initialize();
      await orderingRepo.initialize();
      await teamMemberRepo.initialize();
      await teamRepo.initialize();
      await mailRepo.initialize();

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
