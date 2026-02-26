/**
 * Integration tests — placeholder.
 *
 * The original tests imported removed modules (../src/storage, ../src/websocket).
 * These need to be rewritten using the new DI container + WebSocketBridge architecture.
 * Unit-level service tests now live in projects.test.ts, tasks.test.ts, sessions.test.ts.
 */

describe('Integration Tests', () => {
  it.todo('should complete full project → task → session workflow');
  it.todo('should handle multi-session task coordination');
  it.todo('should handle orchestrator spawning workers');
  it.todo('should prevent deletion of project with active tasks');
});
