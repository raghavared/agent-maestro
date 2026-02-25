import { Session, SessionStatus, CreateSessionPayload, UpdateSessionPayload, SessionTimelineEvent, DocEntry } from '../../types';

/**
 * Filter options for listing sessions.
 */
export interface SessionFilter {
  projectId?: string;
  taskId?: string;
  status?: SessionStatus;
  parentSessionId?: string;
  rootSessionId?: string;
  teamSessionId?: string;
}

/**
 * Repository interface for Session persistence operations.
 */
export interface ISessionRepository {
  /**
   * Create a new session.
   * @param session - Session data from CreateSessionPayload
   * @returns The created session with generated id and timestamps
   */
  create(session: CreateSessionPayload): Promise<Session>;

  /**
   * Find a session by ID.
   * @param id - Session ID
   * @returns The session if found, null otherwise
   */
  findById(id: string): Promise<Session | null>;

  /**
   * Find all sessions for a project.
   * @param projectId - Project ID
   * @returns Array of sessions, empty if none found
   */
  findByProjectId(projectId: string): Promise<Session[]>;

  /**
   * Find all sessions associated with a task.
   * @param taskId - Task ID
   * @returns Array of sessions, empty if none found
   */
  findByTaskId(taskId: string): Promise<Session[]>;

  /**
   * Find sessions by status.
   * @param status - Session status to filter by
   * @returns Array of sessions with the given status
   */
  findByStatus(status: SessionStatus): Promise<Session[]>;

  /**
   * Find sessions with optional filters.
   * @param filter - Filter options
   * @returns Array of sessions matching filter
   */
  findAll(filter?: SessionFilter): Promise<Session[]>;

  /**
   * Update an existing session.
   * @param id - Session ID
   * @param updates - Partial session updates
   * @returns The updated session
   * @throws {NotFoundError} if session not found
   */
  update(id: string, updates: UpdateSessionPayload): Promise<Session>;

  /**
   * Delete a session.
   * @param id - Session ID
   * @throws {NotFoundError} if session not found
   */
  delete(id: string): Promise<void>;

  /**
   * Add a task association to a session.
   * @param sessionId - Session ID
   * @param taskId - Task ID to add
   */
  addTask(sessionId: string, taskId: string): Promise<void>;

  /**
   * Remove a task association from a session.
   * @param sessionId - Session ID
   * @param taskId - Task ID to remove
   */
  removeTask(sessionId: string, taskId: string): Promise<void>;

  /**
   * Check if project has any sessions.
   * @param projectId - Project ID
   * @returns true if project has sessions
   */
  existsByProjectId(projectId: string): Promise<boolean>;

  /**
   * Count total sessions.
   * @returns Number of sessions
   */
  count(): Promise<number>;

  /**
   * Count sessions by status.
   * @param status - Session status
   * @returns Number of sessions with the given status
   */
  countByStatus(status: SessionStatus): Promise<number>;

  /**
   * Add an event to a session.
   * @param sessionId - Session ID
   * @param event - Event to add (without id, will be generated)
   * @returns The updated session
   */
  addEvent(sessionId: string, event: { type: string; data?: any }): Promise<Session>;

  /**
   * Add a timeline event to a session.
   * @param sessionId - Session ID
   * @param event - Timeline event to add
   * @returns The updated session
   */
  addTimelineEvent(sessionId: string, event: SessionTimelineEvent): Promise<Session>;

  /**
   * Add a document entry to a session.
   * @param sessionId - Session ID
   * @param doc - Document entry to add
   * @returns The updated session
   */
  addDoc(sessionId: string, doc: DocEntry): Promise<Session>;
}
