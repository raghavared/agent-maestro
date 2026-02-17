/**
 * Shared environment variable preparation for all agent spawners.
 * Extracted to avoid circular dependencies between spawner modules.
 */

import type { MaestroManifest } from '../types/manifest.js';

/**
 * Prepare MAESTRO_* environment variables for agent-server communication.
 * Used by all spawners (Claude, Codex, Gemini).
 */
export function prepareSpawnerEnvironment(
  manifest: MaestroManifest,
  sessionId: string
): Record<string, string> {
  const primaryTask = manifest.tasks[0];
  const allTaskIds = manifest.tasks.map(t => t.id).join(',');

  const env: Record<string, string> = {
    ...process.env,
    // Maestro context
    MAESTRO_SESSION_ID: sessionId,
    MAESTRO_TASK_IDS: allTaskIds,
    MAESTRO_PROJECT_ID: primaryTask.projectId,
    MAESTRO_MODE: manifest.mode,
    MAESTRO_MANIFEST_PATH: process.env.MAESTRO_MANIFEST_PATH || '',
    // Server URL - explicitly forward so child processes connect to the correct server
    MAESTRO_SERVER_URL: process.env.MAESTRO_SERVER_URL || process.env.MAESTRO_API_URL || '',
    // Primary task metadata (for backward compatibility)
    MAESTRO_TASK_TITLE: primaryTask.title,
    MAESTRO_TASK_PRIORITY: primaryTask.priority || 'medium',
    // All tasks as JSON (for multi-task sessions)
    MAESTRO_ALL_TASKS: JSON.stringify(manifest.tasks),
  };

  // Add acceptance criteria as JSON for hooks to access
  if (primaryTask.acceptanceCriteria && primaryTask.acceptanceCriteria.length > 0) {
    env.MAESTRO_TASK_ACCEPTANCE = JSON.stringify(primaryTask.acceptanceCriteria);
  }

  // Add dependencies if present
  if (primaryTask.dependencies && primaryTask.dependencies.length > 0) {
    env.MAESTRO_TASK_DEPENDENCIES = JSON.stringify(primaryTask.dependencies);
  }

  return env as Record<string, string>;
}
