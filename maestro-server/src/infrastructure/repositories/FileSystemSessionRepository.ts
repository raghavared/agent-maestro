import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Session, SessionStatus, CreateSessionPayload, UpdateSessionPayload, SessionTimelineEvent, DocEntry } from '../../types';
import { ISessionRepository, SessionFilter } from '../../domain/repositories/ISessionRepository';
import { IIdGenerator } from '../../domain/common/IIdGenerator';
import { ILogger } from '../../domain/common/ILogger';
import { NotFoundError } from '../../domain/common/Errors';

/**
 * File system based implementation of ISessionRepository.
 * Stores sessions as individual JSON files.
 */
export class FileSystemSessionRepository implements ISessionRepository {
  private sessionsDir: string;
  private sessions: Map<string, Session>;
  private initialized: boolean = false;

  constructor(
    private dataDir: string,
    private idGenerator: IIdGenerator,
    private logger: ILogger
  ) {
    this.sessionsDir = path.join(dataDir, 'sessions');
    this.sessions = new Map();
  }

  /**
   * Initialize the repository by loading existing data.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });

      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));

      for (const file of sessionFiles) {
        try {
          const data = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
          const session = JSON.parse(data) as any;

          // MIGRATION: Convert old taskId to taskIds array
          if (session.taskId && !session.taskIds) {
            session.taskIds = [session.taskId];
            delete session.taskId;
          }

          // Initialize Phase IV-A fields if missing
          let needsSave = false;

          if (!session.taskIds) { session.taskIds = []; needsSave = true; }
          if (!session.name) { session.name = `Session ${session.id}`; needsSave = true; }
          if (!session.env) { session.env = {}; needsSave = true; }
          if (!session.events) { session.events = []; needsSave = true; }
          if (!session.timeline) { session.timeline = []; needsSave = true; }
          if (!session.docs) { session.docs = []; needsSave = true; }
          if (!session.rootSessionId) { session.rootSessionId = session.id; needsSave = true; }
          // Remove deprecated strategy field if present
          if (session.strategy) { delete session.strategy; needsSave = true; }

          this.sessions.set(session.id, session as Session);

          // Persist migrated session
          if (needsSave) {
            await this.saveSession(session as Session);
          }
        } catch (err) {
          this.logger.warn(`Failed to load session file: ${file}`, { error: (err as Error).message });
        }
      }

      this.logger.info(`Loaded ${this.sessions.size} sessions`);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize session repository:', err as Error);
      throw err;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveSession(session: Session): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  private async deleteSessionFile(id: string): Promise<void> {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  }

  async create(input: CreateSessionPayload): Promise<Session> {
    await this.ensureInitialized();

    const now = Date.now();
    const sessionId = input.id || this.idGenerator.generate('sess');

    const session: Session = {
      id: sessionId,
      projectId: input.projectId,
      taskIds: input.taskIds || [],
      name: input.name || 'Unnamed Session',
      agentId: input.agentId,
      env: input.env || {},
      status: input.status || 'idle',
      startedAt: now,
      lastActivity: now,
      completedAt: null,
      hostname: os.hostname(),
      platform: os.platform(),
      events: [],
      timeline: [
        {
          id: this.idGenerator.generate('evt'),
          type: 'session_started',
          timestamp: now,
          message: 'Session created',
        }
      ],
      docs: [],
      metadata: input.metadata,
      parentSessionId: input.parentSessionId || null,
      rootSessionId: input.rootSessionId || sessionId,
      teamSessionId: input.teamSessionId || null,
      teamId: input.teamId || null,
    };

    this.sessions.set(session.id, session);
    await this.saveSession(session);

    this.logger.debug(`Created session: ${session.id}`);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    await this.ensureInitialized();
    return this.sessions.get(id) || null;
  }

  async findByProjectId(projectId: string): Promise<Session[]> {
    await this.ensureInitialized();
    return Array.from(this.sessions.values()).filter(s => s.projectId === projectId);
  }

  async findByTaskId(taskId: string): Promise<Session[]> {
    await this.ensureInitialized();
    return Array.from(this.sessions.values()).filter(s => s.taskIds.includes(taskId));
  }

  async findByStatus(status: SessionStatus): Promise<Session[]> {
    await this.ensureInitialized();
    return Array.from(this.sessions.values()).filter(s => s.status === status);
  }

  async findAll(filter?: SessionFilter): Promise<Session[]> {
    await this.ensureInitialized();
    let sessions = Array.from(this.sessions.values());

    if (filter) {
      if (filter.projectId) {
        sessions = sessions.filter(s => s.projectId === filter.projectId);
      }
      if (filter.taskId) {
        sessions = sessions.filter(s => s.taskIds.includes(filter.taskId!));
      }
      if (filter.status) {
        sessions = sessions.filter(s => s.status === filter.status);
      }
      if (filter.parentSessionId) {
        sessions = sessions.filter(s => (s as any).parentSessionId === filter.parentSessionId);
      }
      if (filter.rootSessionId) {
        sessions = sessions.filter(s => (s as any).rootSessionId === filter.rootSessionId);
      }
      if (filter.teamSessionId) {
        sessions = sessions.filter(s => s.teamSessionId === filter.teamSessionId);
      }
    }

    return sessions;
  }

  async findByTeamSessionId(teamSessionId: string): Promise<Session[]> {
    await this.ensureInitialized();
    return Array.from(this.sessions.values()).filter(s => s.teamSessionId === teamSessionId);
  }

  async update(id: string, updates: UpdateSessionPayload): Promise<Session> {
    await this.ensureInitialized();

    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundError('Session', id);
    }

    // Apply updates
    if (updates.taskIds !== undefined) session.taskIds = updates.taskIds;
    if (updates.status !== undefined) {
      session.status = updates.status;
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'stopped') {
        session.completedAt = Date.now();
      }
    }
    if (updates.agentId !== undefined) session.agentId = updates.agentId;
    if (updates.env !== undefined) session.env = { ...session.env, ...updates.env };
    if (updates.events !== undefined) session.events = [...session.events, ...updates.events];
    if (updates.timeline !== undefined) session.timeline = [...session.timeline, ...updates.timeline];
    if (updates.needsInput !== undefined) {
      session.needsInput = updates.needsInput;
    }
    if (updates.rootSessionId !== undefined) {
      session.rootSessionId = updates.rootSessionId;
    }
    if (updates.teamSessionId !== undefined) {
      session.teamSessionId = updates.teamSessionId;
    }
    if (updates.teamId !== undefined) {
      session.teamId = updates.teamId;
    }

    session.lastActivity = Date.now();

    this.sessions.set(id, session);
    await this.saveSession(session);

    this.logger.debug(`Updated session: ${id}`);
    return session;
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundError('Session', id);
    }

    this.sessions.delete(id);
    await this.deleteSessionFile(id);

    this.logger.debug(`Deleted session: ${id}`);
  }

  async addTask(sessionId: string, taskId: string): Promise<void> {
    await this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    if (!session.taskIds.includes(taskId)) {
      session.taskIds.push(taskId);
      session.lastActivity = Date.now();
      this.sessions.set(sessionId, session);
      await this.saveSession(session);
    }
  }

  async removeTask(sessionId: string, taskId: string): Promise<void> {
    await this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    session.taskIds = session.taskIds.filter(id => id !== taskId);
    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);
    await this.saveSession(session);
  }

  async existsByProjectId(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    return Array.from(this.sessions.values()).some(s => s.projectId === projectId);
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.sessions.size;
  }

  async countByStatus(status: SessionStatus): Promise<number> {
    await this.ensureInitialized();
    return Array.from(this.sessions.values()).filter(s => s.status === status).length;
  }

  async addEvent(sessionId: string, event: { type: string; data?: any }): Promise<Session> {
    await this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    const fullEvent = {
      id: this.idGenerator.generate('evt'),
      timestamp: Date.now(),
      type: event.type,
      data: event.data
    };

    session.events.push(fullEvent);
    session.lastActivity = Date.now();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    this.logger.debug(`Added event to session: ${sessionId}, type: ${event.type}`);
    return session;
  }

  async addTimelineEvent(sessionId: string, event: SessionTimelineEvent): Promise<Session> {
    await this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    session.timeline.push(event);
    session.lastActivity = Date.now();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    this.logger.debug(`Added timeline event to session: ${sessionId}, type: ${event.type}`);
    return session;
  }

  async addDoc(sessionId: string, doc: DocEntry): Promise<Session> {
    await this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    if (!session.docs) { session.docs = []; }
    session.docs.push(doc);
    session.lastActivity = Date.now();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    this.logger.debug(`Added doc to session: ${sessionId}, title: ${doc.title}`);
    return session;
  }
}
