# CLI Enhancements

## Overview

The Maestro CLI currently has basic functionality but needs production-grade enhancements for reliability, error handling, and completeness.

**Goal:** Transform the CLI from a functional prototype into a robust, LLM-friendly tool with comprehensive error handling and missing commands.

**Estimated Effort:** 6-8 hours

---

## Current State Analysis

### ✅ What's Implemented
- Basic task commands (list, get, create, update)
- Session commands (info, list)
- Subtask commands (create, list, complete)
- Context awareness (env vars)
- JSON output flag

### ⚠️ What's Missing
- `maestro task block` command
- Retry logic for network failures
- Comprehensive error handling
- Structured error JSON format
- Command validation
- Help text improvements
- Config file support

---

## Implementation Plan

### 1. Add Missing Commands

#### `maestro task block`

**File:** `maestro-cli/src/commands/task.ts`

Add to `registerTaskCommands()`:

```typescript
taskCommand
  .command('block <id>')
  .description('Mark a task as blocked')
  .requiredOption('--reason <reason>', 'Reason for blocking')
  .action(async (id, options) => {
    const globalOpts = program.opts();

    try {
      // Update task status to blocked
      await api.patch(`/api/tasks/${id}`, {
        status: 'blocked'
      });

      // Add timeline event with reason
      await api.post(`/api/tasks/${id}/timeline`, {
        type: 'blocked',
        message: options.reason,
        sessionId: config.sessionId
      });

      if (globalOpts.json) {
        outputJSON({ success: true, taskId: id, status: 'blocked', reason: options.reason });
      } else {
        console.log(`🚫 Task ${id} marked as blocked`);
        console.log(`   Reason: ${options.reason}`);
      }
    } catch (err) {
      handleError(err, globalOpts.json);
    }
  });
```

#### `maestro status`

**File:** `maestro-cli/src/index.ts`

Add a new top-level command:

```typescript
program
  .command('status')
  .description('Show summary of current project state')
  .action(async () => {
    const globalOpts = program.opts();
    const projectId = globalOpts.project || config.projectId;

    if (!projectId) {
      console.error('Error: No project context. Use --project <id> or set MAESTRO_PROJECT_ID');
      process.exit(1);
    }

    try {
      // Fetch all tasks for the project
      const tasks = await api.get(`/api/tasks?projectId=${projectId}`);

      // Count by status
      const statusCounts = tasks.reduce((acc: any, task: any) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      // Count by priority
      const priorityCounts = tasks.reduce((acc: any, task: any) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {});

      // Fetch active sessions
      const sessions = await api.get(`/api/sessions?projectId=${projectId}&active=true`);

      const summary = {
        project: projectId,
        tasks: {
          total: tasks.length,
          byStatus: statusCounts,
          byPriority: priorityCounts
        },
        sessions: {
          active: sessions.length
        }
      };

      if (globalOpts.json) {
        outputJSON(summary);
      } else {
        console.log('\n📊 Project Status\n');
        console.log(`Project ID: ${projectId}`);
        console.log(`\nTasks: ${tasks.length} total`);
        console.log(`  ⏳ Pending: ${statusCounts.pending || 0}`);
        console.log(`  🔄 In Progress: ${statusCounts.in_progress || 0}`);
        console.log(`  🚫 Blocked: ${statusCounts.blocked || 0}`);
        console.log(`  ✅ Completed: ${statusCounts.completed || 0}`);
        console.log(`\nActive Sessions: ${sessions.length}`);
        console.log('');
      }
    } catch (err) {
      handleError(err, globalOpts.json);
    }
  });
```

---

### 2. Structured Error Handling

**File:** `maestro-cli/src/utils/errors.ts` (create this file)

```typescript
export interface CLIError {
  success: false;
  error: string;
  message: string;
  details?: Record<string, any>;
  suggestion?: string;
}

export function createError(
  code: string,
  message: string,
  details?: Record<string, any>,
  suggestion?: string
): CLIError {
  return {
    success: false,
    error: code,
    message,
    details,
    suggestion
  };
}

export function handleError(err: any, json: boolean): never {
  let cliError: CLIError;

  if (err.response) {
    // HTTP error from server
    const status = err.response.status;
    const data = err.response.data;

    switch (status) {
      case 404:
        cliError = createError(
          'resource_not_found',
          data.message || 'Resource not found',
          { status, url: err.config?.url },
          'Use list commands to see available resources'
        );
        break;

      case 400:
        cliError = createError(
          'invalid_request',
          data.message || 'Invalid request',
          { status, errors: data.errors },
          'Check command arguments and try again'
        );
        break;

      case 500:
        cliError = createError(
          'server_error',
          data.message || 'Internal server error',
          { status },
          'Check server logs or try again later'
        );
        break;

      default:
        cliError = createError(
          'http_error',
          data.message || `HTTP ${status} error`,
          { status }
        );
    }
  } else if (err.code === 'ECONNREFUSED') {
    // Connection refused
    cliError = createError(
      'connection_refused',
      'Cannot connect to Maestro Server',
      {
        server: err.config?.baseURL || config.apiUrl,
        errno: err.code
      },
      'Is the Maestro Server running? Try: cd maestro-server && npm run dev'
    );
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    // Network timeout or DNS failure
    cliError = createError(
      'network_error',
      'Network connection failed',
      { errno: err.code, server: err.config?.baseURL },
      'Check your network connection and server URL'
    );
  } else {
    // Unknown error
    cliError = createError(
      'unknown_error',
      err.message || 'An unexpected error occurred',
      { originalError: err.toString() }
    );
  }

  if (json) {
    console.log(JSON.stringify(cliError, null, 2));
  } else {
    console.error(`\n❌ Error: ${cliError.message}`);
    if (cliError.details) {
      console.error(`   Details: ${JSON.stringify(cliError.details, null, 2)}`);
    }
    if (cliError.suggestion) {
      console.error(`   💡 ${cliError.suggestion}`);
    }
    console.error('');
  }

  process.exit(1);
}
```

Update all commands to use `handleError`:

```typescript
import { handleError } from '../utils/errors.js';

// In any command action:
try {
  // ... command logic
} catch (err) {
  handleError(err, globalOpts.json);
}
```

---

### 3. Add Retry Logic

**File:** `maestro-cli/src/api.ts`

Update the API client with automatic retries:

```typescript
import fetch from 'node-fetch';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  retries?: number;
  retryDelay?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  async request(path: string, options: RequestOptions): Promise<any> {
    const { method, body, retries = 3, retryDelay = 1000 } = options;

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          const error: any = new Error(`HTTP ${response.status}`);
          error.response = {
            status: response.status,
            data: await response.json().catch(() => ({ message: response.statusText }))
          };
          throw error;
        }

        // Success
        return await response.json();

      } catch (err: any) {
        lastError = err;

        // Don't retry on 4xx errors (client errors - these won't succeed on retry)
        if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
          throw err;
        }

        // Don't retry on the last attempt
        if (attempt === retries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = retryDelay * Math.pow(2, attempt);
        if (process.env.MAESTRO_DEBUG) {
          console.error(`Request failed (attempt ${attempt + 1}/${retries + 1}). Retrying in ${delay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    throw lastError;
  }

  async get(path: string): Promise<any> {
    return this.request(path, { method: 'GET' });
  }

  async post(path: string, body: any): Promise<any> {
    return this.request(path, { method: 'POST', body });
  }

  async patch(path: string, body: any): Promise<any> {
    return this.request(path, { method: 'PATCH', body });
  }

  async delete(path: string): Promise<any> {
    return this.request(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient(config.apiUrl);
```

**Configuration:**

Add environment variable support for retry behavior:

```typescript
// In config.ts
export const config = {
  apiUrl: process.env.MAESTRO_API_URL || 'http://localhost:3000',
  projectId: process.env.MAESTRO_PROJECT_ID,
  sessionId: process.env.MAESTRO_SESSION_ID,
  taskIds: (process.env.MAESTRO_TASK_IDS || '').split(',').filter(Boolean),

  // Retry configuration
  retries: parseInt(process.env.MAESTRO_RETRIES || '3'),
  retryDelay: parseInt(process.env.MAESTRO_RETRY_DELAY || '1000'),
  debug: process.env.MAESTRO_DEBUG === 'true'
};
```

---

### 4. Input Validation

**File:** `maestro-cli/src/utils/validation.ts` (create this file)

```typescript
import { createError } from './errors.js';

export function validateTaskId(id: string | undefined, context: string[] = []): string {
  if (!id) {
    // Try to use context
    if (context.length === 0) {
      throw createError(
        'missing_task_id',
        'No task ID provided and no task context available',
        {},
        'Provide a task ID or ensure MAESTRO_TASK_IDS is set'
      );
    }
    return context[0];
  }

  // Validate format (simple check)
  if (!id.match(/^[a-zA-Z0-9_-]+$/)) {
    throw createError(
      'invalid_task_id',
      `Invalid task ID format: ${id}`,
      { taskId: id },
      'Task IDs should contain only letters, numbers, hyphens, and underscores'
    );
  }

  return id;
}

export function validateStatus(status: string): 'pending' | 'in_progress' | 'blocked' | 'completed' {
  const validStatuses = ['pending', 'in_progress', 'blocked', 'completed'];
  if (!validStatuses.includes(status)) {
    throw createError(
      'invalid_status',
      `Invalid status: ${status}`,
      { status, validStatuses },
      `Use one of: ${validStatuses.join(', ')}`
    );
  }
  return status as any;
}

export function validatePriority(priority: string): 'high' | 'medium' | 'low' {
  const validPriorities = ['high', 'medium', 'low'];
  if (!validPriorities.includes(priority)) {
    throw createError(
      'invalid_priority',
      `Invalid priority: ${priority}`,
      { priority, validPriorities },
      `Use one of: ${validPriorities.join(', ')}`
    );
  }
  return priority as any;
}

export function validateRequired(value: string | undefined, fieldName: string): string {
  if (!value || value.trim() === '') {
    throw createError(
      'missing_required_field',
      `Missing required field: ${fieldName}`,
      { field: fieldName }
    );
  }
  return value;
}
```

Use validation in commands:

```typescript
import { validateTaskId, validateStatus, validateRequired } from '../utils/validation.js';

// Example: maestro task update
taskCommand
  .command('update <id>')
  .option('--status <status>', 'Update status')
  .option('--priority <priority>', 'Update priority')
  .action(async (id, options) => {
    const globalOpts = program.opts();

    try {
      const taskId = validateTaskId(id, config.taskIds);
      const updates: any = {};

      if (options.status) {
        updates.status = validateStatus(options.status);
      }
      if (options.priority) {
        updates.priority = validatePriority(options.priority);
      }

      if (Object.keys(updates).length === 0) {
        throw createError(
          'no_updates',
          'No updates provided',
          {},
          'Specify at least one option (--status, --priority, etc.)'
        );
      }

      const result = await api.patch(`/api/tasks/${taskId}`, updates);

      if (globalOpts.json) {
        outputJSON({ success: true, task: result });
      } else {
        console.log(`✅ Task ${taskId} updated`);
      }
    } catch (err) {
      handleError(err, globalOpts.json);
    }
  });
```

---

### 5. Improved Help Text

Update command descriptions to be more helpful:

```typescript
// Before:
taskCommand.command('list').description('List tasks');

// After:
taskCommand
  .command('list')
  .description('List tasks in the current project')
  .addHelpText('after', `
Examples:
  $ maestro task list
  $ maestro task list --status pending
  $ maestro task list --priority high --json
  `)
  .option('--status <status>', 'Filter by status (pending, in_progress, blocked, completed)')
  .option('--priority <priority>', 'Filter by priority (high, medium, low)');
```

Add help examples to all commands:

```typescript
program
  .addHelpText('after', `
Common Workflows:

  Start working on a task:
    $ maestro whoami                    # Check your context
    $ maestro task list --status pending
    $ maestro task start t1
    $ maestro update "Started implementation"

  Report progress:
    $ maestro update "Completed middleware"
    $ maestro subtask complete t1 st1
    $ maestro task complete t1

  Spawn a worker:
    $ maestro session spawn --task t1 --skill maestro-worker

Environment Variables:
  MAESTRO_API_URL      Maestro Server URL (default: http://localhost:3000)
  MAESTRO_PROJECT_ID   Current project ID
  MAESTRO_SESSION_ID   Current session ID
  MAESTRO_TASK_IDS     Comma-separated task IDs
  MAESTRO_RETRIES      Number of retry attempts (default: 3)
  MAESTRO_DEBUG        Enable debug logging (true/false)

For more info: https://github.com/your-repo/maestro-cli
  `);
```

---

### 6. Config File Support

**File:** `maestro-cli/src/config.ts`

Add support for `~/.maestro/config.json`:

```typescript
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.maestro');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface UserConfig {
  apiUrl?: string;
  defaultProject?: string;
  retries?: number;
  retryDelay?: number;
  outputMode?: 'human' | 'json';
}

function loadUserConfig(): UserConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (err) {
    console.warn('Failed to load config file, using defaults');
    return {};
  }
}

export function saveUserConfig(updates: UserConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });

  const current = loadUserConfig();
  const updated = { ...current, ...updates };

  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
  console.log(`✅ Config saved to ${CONFIG_FILE}`);
}

const userConfig = loadUserConfig();

export const config = {
  // Precedence: Env Var > User Config > Default
  apiUrl: process.env.MAESTRO_API_URL || userConfig.apiUrl || 'http://localhost:3000',
  projectId: process.env.MAESTRO_PROJECT_ID || userConfig.defaultProject,
  sessionId: process.env.MAESTRO_SESSION_ID,
  taskIds: (process.env.MAESTRO_TASK_IDS || '').split(',').filter(Boolean),

  retries: parseInt(process.env.MAESTRO_RETRIES || String(userConfig.retries || 3)),
  retryDelay: parseInt(process.env.MAESTRO_RETRY_DELAY || String(userConfig.retryDelay || 1000)),
  debug: process.env.MAESTRO_DEBUG === 'true'
};
```

Add a config command:

```typescript
program
  .command('config')
  .description('Manage CLI configuration')
  .option('--set <key=value>', 'Set a config value')
  .option('--get <key>', 'Get a config value')
  .option('--list', 'List all config values')
  .action((options) => {
    if (options.set) {
      const [key, value] = options.set.split('=');
      saveUserConfig({ [key]: value });
    } else if (options.get) {
      const userConfig = loadUserConfig();
      console.log(userConfig[options.get] || 'Not set');
    } else if (options.list) {
      const userConfig = loadUserConfig();
      console.log(JSON.stringify(userConfig, null, 2));
    } else {
      console.log('Usage: maestro config --set apiUrl=http://example.com');
      console.log('       maestro config --get apiUrl');
      console.log('       maestro config --list');
    }
  });
```

---

### 7. JSON Output Validation

Ensure all JSON output conforms to a schema:

**File:** `maestro-cli/src/utils/formatter.ts`

```typescript
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

export function outputJSON<T>(data: T): void {
  const response: SuccessResponse<T> = {
    success: true,
    data
  };
  console.log(JSON.stringify(response, null, 2));
}

export function outputKeyValue(key: string, value: string): void {
  const maxKeyLength = 15;
  const paddedKey = key.padEnd(maxKeyLength);
  console.log(`${paddedKey}: ${value}`);
}

export function outputTable(data: any[], columns: string[]): void {
  // Use cli-table3 for nice formatting
  const Table = require('cli-table3');
  const table = new Table({
    head: columns,
    style: { head: ['cyan'] }
  });

  data.forEach(row => {
    table.push(columns.map(col => row[col] || 'N/A'));
  });

  console.log(table.toString());
}
```

Update commands to use consistent output:

```typescript
if (globalOpts.json) {
  outputJSON(tasks); // Always returns { success: true, data: ... }
} else {
  outputTable(tasks, ['id', 'title', 'status', 'priority']);
}
```

---

## Testing

### Unit Tests

**File:** `maestro-cli/tests/commands.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { validateTaskId, validateStatus } from '../src/utils/validation';

describe('Validation', () => {
  it('should validate task IDs', () => {
    expect(validateTaskId('t123', [])).toBe('t123');
    expect(() => validateTaskId('invalid id!', [])).toThrow('invalid_task_id');
  });

  it('should use context when ID not provided', () => {
    expect(validateTaskId(undefined, ['t1', 't2'])).toBe('t1');
    expect(() => validateTaskId(undefined, [])).toThrow('missing_task_id');
  });

  it('should validate status values', () => {
    expect(validateStatus('pending')).toBe('pending');
    expect(() => validateStatus('invalid')).toThrow('invalid_status');
  });
});
```

### Integration Tests

**File:** `maestro-cli/tests/integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI Integration', () => {
  beforeAll(async () => {
    // Start test server
    // await startTestServer();
  });

  afterAll(async () => {
    // Stop test server
    // await stopTestServer();
  });

  it('should return valid JSON with --json flag', async () => {
    const { stdout } = await execAsync('maestro whoami --json');
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('data');
  });

  it('should handle connection errors gracefully', async () => {
    try {
      await execAsync('maestro task list --server http://localhost:9999 --json');
    } catch (err: any) {
      const result = JSON.parse(err.stdout);
      expect(result.success).toBe(false);
      expect(result.error).toBe('connection_refused');
    }
  });
});
```

---

## Deployment

### NPM Publishing

Update `maestro-cli/package.json`:

```json
{
  "name": "@maestro/cli",
  "version": "1.0.0",
  "bin": {
    "maestro": "./bin/maestro.js"
  },
  "files": [
    "dist/**/*",
    "bin/**/*"
  ],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

Build and publish:

```bash
cd maestro-cli
npm run build
npm test
npm publish --access public
```

### Global Installation

Users can install globally:

```bash
npm install -g @maestro/cli
maestro --version
```

---

## Checklist

- [ ] Add `maestro task block` command
- [ ] Add `maestro status` command
- [ ] Implement structured error handling (`errors.ts`)
- [ ] Add retry logic to API client
- [ ] Add input validation (`validation.ts`)
- [ ] Improve help text with examples
- [ ] Add config file support (`~/.maestro/config.json`)
- [ ] Ensure all --json output is valid and schema-compliant
- [ ] Write unit tests for validation and error handling
- [ ] Write integration tests for CLI commands
- [ ] Update README with full command reference
- [ ] Publish to npm

---

## Next Steps

After completing CLI enhancements:

1. ✅ CLI is production-ready
2. ➡️ Implement session spawning (see [03-SESSION-SPAWNING.md](./03-SESSION-SPAWNING.md))
3. ➡️ Add subtask persistence (see [04-SUBTASK-PERSISTENCE.md](./04-SUBTASK-PERSISTENCE.md))

---

**Implementation Status:** 📋 Ready to Implement
**Dependencies:** None
**Enables:** Reliable agent workflows, Better error recovery
