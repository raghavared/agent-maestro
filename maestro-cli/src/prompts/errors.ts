/**
 * Error Message Prompts
 *
 * All user-facing error messages, suggestions, and error templates
 * used across the CLI.
 */

// ── Init command errors ─────────────────────────────────────

export const MANIFEST_PATH_NOT_SET =
  'MAESTRO_MANIFEST_PATH environment variable not set. ' +
  'This variable should point to the manifest JSON file.';

export const MANIFEST_NOT_FOUND_PREFIX = 'Manifest file not found: ';
export const MANIFEST_NOT_FOUND_HINT =
  'Please ensure the MAESTRO_MANIFEST_PATH environment variable ' +
  'points to a valid manifest file.';

export const INVALID_MANIFEST_PREFIX = 'Invalid manifest: ';
export const INVALID_MANIFEST_HINT =
  'Please check that the manifest file follows the correct schema.';

export const WRONG_MODE_WORKER_PREFIX = 'Wrong mode for worker init: ';
export const WRONG_MODE_WORKER_HINT =
  'This command requires a manifest with mode="execute". ' +
  'For coordinate sessions, use the orchestrator init command.';

export const WRONG_MODE_ORCHESTRATOR_PREFIX = 'Wrong mode for orchestrator init: ';
export const WRONG_MODE_ORCHESTRATOR_HINT =
  'This command requires a manifest with mode="coordinate". ' +
  'For execute sessions, use the worker init command.';

// ── API / Network errors ────────────────────────────────────

export const CONNECTION_REFUSED_MESSAGE = 'Cannot connect to Maestro Server';
export const CONNECTION_REFUSED_SUGGESTION =
  'Is the Maestro Server running? Try: cd maestro-server && npm run dev';

export const NETWORK_ERROR_MESSAGE = 'Network connection failed';
export const NETWORK_ERROR_SUGGESTION =
  'Check your network connection and server URL';

// ── HTTP error suggestions ──────────────────────────────────

export const NOT_FOUND_SUGGESTION = 'Use list commands to see available resources';
export const PERMISSION_DENIED_SUGGESTION = 'Check your access permissions';
export const INVALID_REQUEST_SUGGESTION = 'Check command arguments and try again';
export const SERVER_ERROR_SUGGESTION = 'Check server logs or try again later';
export const SPAWN_FAILED_SUGGESTION = 'Check Claude Code installation and configuration';

// ── Manifest generator errors ───────────────────────────────

export const TASK_NOT_FOUND_IN_STORAGE_PREFIX = 'Task ';
export const TASK_NOT_FOUND_IN_STORAGE_SUFFIX = ' not found in local storage (~/.maestro/data/tasks/)';

export const PROJECT_NOT_FOUND_IN_STORAGE_PREFIX = 'Project ';
export const PROJECT_NOT_FOUND_IN_STORAGE_SUFFIX = ' not found in local storage (~/.maestro/data/projects/)';

// ── Hook execution errors ───────────────────────────────────

export const HOOK_TIMEOUT_ERROR = 'Command execution timeout';
export const HOOK_EXECUTION_FAILED = 'Command execution failed';

// ── Validation errors ───────────────────────────────────────

export const MODE_VALIDATION_ERROR = 'Error: mode must be "execute" or "coordinate"';
export const AGENT_TOOL_VALIDATION_PREFIX = 'Error: agent-tool must be one of: ';
