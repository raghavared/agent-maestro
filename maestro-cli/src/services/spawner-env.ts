/**
 * Shared environment variable preparation for all agent spawners.
 * Extracted to avoid circular dependencies between spawner modules.
 */

import type { MaestroManifest } from '../types/manifest.js';

// Claude Code sets these env vars to detect nested invocations and block them.
// We must remove them so that maestro can spawn Claude from within a Claude session.
const CLAUDE_NESTED_DETECTION_VARS = [
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDECODE',
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
];

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
    // Server URL - explicitly forward so child processes connect to the correct server
    MAESTRO_SERVER_URL: process.env.MAESTRO_SERVER_URL || process.env.MAESTRO_API_URL || '',
    // Primary task metadata (for backward compatibility)
    MAESTRO_TASK_TITLE: primaryTask.title,
    MAESTRO_TASK_PRIORITY: primaryTask.priority || 'medium',
    // All tasks as JSON (for multi-task sessions)
    MAESTRO_ALL_TASKS: JSON.stringify(manifest.tasks),
  };

  // Forward MAESTRO_MANIFEST_PATH only if it's a non-empty value
  // (avoids propagating empty string which would cause "not set" errors in child hooks)
  if (process.env.MAESTRO_MANIFEST_PATH) {
    env.MAESTRO_MANIFEST_PATH = process.env.MAESTRO_MANIFEST_PATH;
  }

  // Remove Claude Code nested-invocation detection vars so the spawned Claude
  // process is not blocked with "Claude Code cannot be opened inside Claude Code".
  for (const key of CLAUDE_NESTED_DETECTION_VARS) {
    delete env[key];
  }

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
