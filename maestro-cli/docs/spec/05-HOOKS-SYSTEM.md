# Hooks System

**Status**: ✅ **Implemented** — Hooks are live via Claude Code plugin hooks.json files
**Since**: v1.0

---

## Overview

Maestro uses Claude Code's **plugin hook system** for lifecycle events. Hooks are defined in `hooks.json` files within plugin directories and executed by Claude Code's hook runtime — not by the Maestro CLI directly.

### Architecture

Hooks are **NOT** built into the CLI. Instead:
- Each role has a plugin directory: `plugins/maestro-worker/` and `plugins/maestro-orchestrator/`
- Plugin directories contain `hooks/hooks.json` defining hook handlers
- Plugins are loaded via `--plugin-dir` argument to Claude
- Claude Code's plugin system executes hooks at lifecycle points

### Implemented Hooks

#### Worker Hooks (`plugins/maestro-worker/hooks/hooks.json`)

| Hook | Trigger | Command | Timeout |
|------|---------|---------|---------|
| `SessionStart` | Session begins | `maestro session register` | 5s |
| `SessionEnd` | Session ends | `maestro session complete` | 3s |
| `PostToolUse` | After Write or Edit | `${CLAUDE_PLUGIN_ROOT}/bin/track-file` | 2s |

#### Orchestrator Hooks (`plugins/maestro-orchestrator/hooks/hooks.json`)

| Hook | Trigger | Command | Timeout |
|------|---------|---------|---------|
| `SessionStart` | Session begins | `maestro session register` | 5s |
| `SessionEnd` | Session ends | `maestro session complete` | 3s |

**Note**: Orchestrator does NOT have PostToolUse hooks (no file tracking).

### track-file Utility

The worker plugin includes `bin/track-file`, a bash script that:
1. Reads hook input JSON (from stdin or `$HOOK_INPUT`)
2. Extracts `tool_input.file_path` using `jq`
3. Calls `maestro track-file "$FILE_PATH"` to record the modification
4. Exits 0 regardless of errors (non-blocking)

### HookExecutor Service

The CLI also includes `src/services/hook-executor.ts` — a general-purpose shell command executor used internally:

```typescript
class HookExecutor {
  async executeHook(command: string, options?: HookOptions): Promise<HookResult>;
  async executeHooks(commands: string[], options?: HookOptions): Promise<HookResult[]>;
  hasFailures(results: HookResult[]): boolean;
  getFailures(results: HookResult[]): HookResult[];
}
```

This is used for executing arbitrary hook commands with timeout and error handling support.

## Philosophy

### What Hooks Are NOT

- ❌ Not user-extensible (no custom hook files)
- ❌ Not skill-specific (same for all sessions)
- ❌ Not complex (simple server API calls)
- ❌ Not required (gracefully degrade without server)

### What Hooks ARE

- ✅ Built-in lifecycle events
- ✅ Server integration points
- ✅ Session state synchronization
- ✅ Simple and predictable

## Hook Types

### 1. SessionStart Hook

**When**: Immediately after manifest is read, before Claude spawns

**Purpose**: Report session creation to server

**Implementation**:

```typescript
// src/services/hook-executor.ts

export class HookExecutor {
  constructor(private serverClient: ServerClient) {}

  async sessionStart(manifest: MaestroManifest): Promise<void> {
    const sessionId = process.env.MAESTRO_SESSION_ID;
    const projectId = process.env.MAESTRO_PROJECT_ID;

    // Skip if no session/project ID
    if (!sessionId || !projectId) {
      console.log('ℹ️  No session ID - skipping server report');
      return;
    }

    try {
      // Report to server
      await this.serverClient.createSession({
        id: sessionId,
        projectId,
        taskIds: manifest.tasks.map(t => t.id),
        role: manifest.role,
        status: 'running',
        model: manifest.session.model,
        startedAt: new Date().toISOString(),
        manifest: manifest  // Optional: store full manifest
      });

      console.log(`✅ Session ${sessionId} reported to server`);
    } catch (error) {
      // Don't fail - server might be offline
      console.warn(`⚠️  Failed to report session start: ${error.message}`);
      console.warn('ℹ️  Continuing without server connection...');
    }
  }
}
```

**What It Does**:
1. Reads session ID and project ID from env vars
2. Calls `POST /api/sessions` on the server
3. Sends session metadata (ID, task IDs, role, status)
4. Logs success or warning
5. **Never fails the session** - continues even if server is down

### 2. SessionEnd Hook

**When**: After Claude process exits

**Purpose**: Report session completion to server

**Implementation**:

```typescript
// src/services/hook-executor.ts

export class HookExecutor {
  async sessionEnd(exitCode: number | null): Promise<void> {
    const sessionId = process.env.MAESTRO_SESSION_ID;

    if (!sessionId) {
      return;
    }

    try {
      // Determine final status
      const status = exitCode === 0 ? 'completed' : 'failed';

      // Report to server
      await this.serverClient.updateSession(sessionId, {
        status,
        exitCode: exitCode || 0,
        completedAt: new Date().toISOString()
      });

      console.log(`✅ Session ${sessionId} ${status}`);
    } catch (error) {
      console.warn(`⚠️  Failed to report session end: ${error.message}`);
      // Don't fail - session already completed
    }
  }
}
```

**What It Does**:
1. Waits for Claude to exit
2. Determines status (completed vs failed) from exit code
3. Calls `PATCH /api/sessions/{id}` on the server
4. Logs result
5. **Never fails** - session is already done

## Hook Flow

```
┌─────────────────────────────────────────────────────┐
│        maestro worker init                          │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Read Manifest       │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  SessionStart Hook   │
        │                      │
        │  POST /api/sessions  │
        │  {                   │
        │    id: "sess-123",   │
        │    status: "running" │
        │  }                   │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Generate Prompt     │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Load Skills         │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Spawn Claude        │
        │                      │
        │  (User works here)   │
        │                      │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Claude Exits        │
        │  Exit Code: 0        │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  SessionEnd Hook     │
        │                      │
        │  PATCH /api/sessions │
        │  {                   │
        │    status:           │
        │      "completed",    │
        │    exitCode: 0       │
        │  }                   │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  CLI Exits           │
        └──────────────────────┘
```

## Server API Contract

### Create Session (SessionStart)

**Endpoint**: `POST /api/sessions`

**Request Body**:
```typescript
{
  id: string;              // Session ID from env
  projectId: string;       // Project ID from env
  taskIds: string[];       // manifest.tasks.map(t => t.id)
  role: 'worker' | 'orchestrator';
  status: 'running';
  model: string;           // manifest.session.model
  startedAt: string;       // ISO 8601 timestamp
  manifest?: object;       // Optional: full manifest
}
```

**Response**: `200 OK` or `201 Created`

**Error Handling**:
- Network error: Log warning, continue
- Server error (5xx): Log warning, continue
- Client error (4xx): Log warning, continue
- Timeout: Log warning, continue

### Update Session (SessionEnd)

**Endpoint**: `PATCH /api/sessions/{sessionId}`

**Request Body**:
```typescript
{
  status: 'completed' | 'failed';
  exitCode: number;
  completedAt: string;  // ISO 8601 timestamp
}
```

**Response**: `200 OK`

**Error Handling**:
- Any error: Log warning, exit normally
- Session already over - errors don't matter

## Implementation

### Hook Executor

```typescript
// src/services/hook-executor.ts

import { ServerClient } from './server-client';
import { MaestroManifest } from '../types/manifest';
import { Logger } from '../utils/logger';

export class HookExecutor {
  constructor(
    private serverClient: ServerClient,
    private logger: Logger
  ) {}

  async sessionStart(manifest: MaestroManifest): Promise<void> {
    const sessionId = process.env.MAESTRO_SESSION_ID;
    const projectId = process.env.MAESTRO_PROJECT_ID;

    // Skip if offline mode
    if (!sessionId || !projectId) {
      this.logger.info('Offline mode - skipping session report');
      return;
    }

    // Skip if no API URL
    if (!process.env.MAESTRO_API_URL) {
      this.logger.info('No API URL - skipping session report');
      return;
    }

    try {
      const sessionData = {
        id: sessionId,
        projectId,
        taskIds: manifest.tasks.map(t => t.id),
        role: manifest.role,
        status: 'running' as const,
        model: manifest.session.model,
        startedAt: new Date().toISOString(),
        // Optionally include manifest
        ...(this.shouldIncludeManifest() && { manifest })
      };

      await this.serverClient.createSession(sessionData);
      this.logger.success(`Session ${sessionId} created on server`);
    } catch (error) {
      this.handleHookError('SessionStart', error);
    }
  }

  async sessionEnd(exitCode: number | null): Promise<void> {
    const sessionId = process.env.MAESTRO_SESSION_ID;

    if (!sessionId || !process.env.MAESTRO_API_URL) {
      return;
    }

    try {
      const status = exitCode === 0 ? 'completed' : 'failed';

      await this.serverClient.updateSession(sessionId, {
        status,
        exitCode: exitCode || 0,
        completedAt: new Date().toISOString()
      });

      this.logger.success(`Session ${sessionId} marked as ${status}`);
    } catch (error) {
      this.handleHookError('SessionEnd', error);
    }
  }

  private handleHookError(hookName: string, error: any): void {
    this.logger.warn(`${hookName} hook failed: ${error.message}`);
    this.logger.info('Continuing without server connection...');
    // Never throw - hooks are optional
  }

  private shouldIncludeManifest(): boolean {
    return process.env.MAESTRO_INCLUDE_MANIFEST === 'true';
  }
}
```

### Server Client

```typescript
// src/services/server-client.ts

export class ServerClient {
  private baseUrl: string;
  private timeout: number = 5000;  // 5 second timeout

  constructor() {
    this.baseUrl = process.env.MAESTRO_API_URL || 'http://localhost:3000';
  }

  async createSession(data: SessionCreateData): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async updateSession(sessionId: string, data: SessionUpdateData): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

### Integration in Worker Init

```typescript
// src/commands/worker.ts

export async function workerInit() {
  // ... read manifest ...

  // Create hook executor
  const serverClient = new ServerClient();
  const hookExecutor = new HookExecutor(serverClient, logger);

  // Execute SessionStart hook
  logger.info('Reporting session start...');
  await hookExecutor.sessionStart(manifest);

  // ... generate prompt, load skills ...

  // Spawn Claude
  const claudeProcess = await spawner.spawn(config);

  // Handle exit
  claudeProcess.on('exit', async (code) => {
    logger.info(`Claude exited with code ${code || 0}`);

    // Execute SessionEnd hook
    await hookExecutor.sessionEnd(code);

    // Exit CLI
    process.exit(code || 0);
  });
}
```

## Offline Mode

### Working Without Server

The CLI works completely offline if:
- `MAESTRO_API_URL` is not set
- `MAESTRO_SESSION_ID` is not set
- Server is unreachable

```bash
# Offline mode - minimal manifest
cat > /tmp/manifest.json << 'EOF'
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "local-1",
      "title": "Fix bug",
      "description": "Fix login bug",
      "acceptanceCriteria": ["Bug is fixed"],
      "projectId": "local",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
EOF

# Run without server
export MAESTRO_MANIFEST_PATH=/tmp/manifest.json
maestro worker init

# Output:
📄 Reading manifest...
✅ Manifest loaded: Fix bug
📝 Generating system prompt...
✅ System prompt generated
ℹ️  No session ID - skipping server report
🤖 Spawning Claude Code session...
```

## Environment Variables for Hooks

### Required for Hooks

```bash
MAESTRO_SESSION_ID=sess-123     # Session identifier
MAESTRO_PROJECT_ID=proj-1       # Project identifier
MAESTRO_API_URL=http://localhost:3000  # Server URL
```

### Optional

```bash
MAESTRO_INCLUDE_MANIFEST=true   # Include full manifest in SessionStart
MAESTRO_HOOK_TIMEOUT=5000       # Hook timeout in ms (default 5000)
```

### Validation

```typescript
// Hooks are optional - no strict validation
function shouldExecuteHooks(): boolean {
  return !!(
    process.env.MAESTRO_SESSION_ID &&
    process.env.MAESTRO_PROJECT_ID &&
    process.env.MAESTRO_API_URL
  );
}
```

## Logging

### Success

```
✅ Session sess-123 created on server
```

### Warning (Server Unreachable)

```
⚠️  SessionStart hook failed: Network error
ℹ️  Continuing without server connection...
```

### Info (Offline Mode)

```
ℹ️  No API URL - skipping session report
```

## Testing Hooks

### Unit Tests

```typescript
// tests/hook-executor.test.ts

describe('HookExecutor', () => {
  it('should report session start to server', async () => {
    const mockClient = {
      createSession: jest.fn().mockResolvedValue(undefined)
    };

    const executor = new HookExecutor(mockClient, logger);
    await executor.sessionStart(mockManifest);

    expect(mockClient.createSession).toHaveBeenCalledWith({
      id: 'sess-123',
      projectId: 'proj-1',
      taskIds: ['task-1'],
      role: 'worker',
      status: 'running',
      // ...
    });
  });

  it('should not fail if server is unreachable', async () => {
    const mockClient = {
      createSession: jest.fn().mockRejectedValue(new Error('Network error'))
    };

    const executor = new HookExecutor(mockClient, logger);

    // Should not throw
    await expect(
      executor.sessionStart(mockManifest)
    ).resolves.toBeUndefined();
  });

  it('should skip hooks in offline mode', async () => {
    delete process.env.MAESTRO_SESSION_ID;

    const mockClient = {
      createSession: jest.fn()
    };

    const executor = new HookExecutor(mockClient, logger);
    await executor.sessionStart(mockManifest);

    // Should not call server
    expect(mockClient.createSession).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

```bash
# Test with real server
export MAESTRO_SESSION_ID=test-session
export MAESTRO_PROJECT_ID=test-project
export MAESTRO_API_URL=http://localhost:3000

# Start test server
node test-server.js &

# Run worker init
maestro worker init

# Verify server received SessionStart call
curl http://localhost:3000/api/sessions/test-session
```

## Comparison with Old Architecture

### Old: Complex Extensible Hooks

```
❌ User-defined hook files in skill directories
❌ Multiple hook types (Pre/Post for every tool)
❌ Hook execution framework
❌ Custom hook logic
❌ Complex error handling
```

### Current: Plugin-Based Hooks

```
✅ Three hook types (SessionStart, SessionEnd, PostToolUse)
✅ Defined in plugin hooks.json files
✅ Executed by Claude Code's plugin runtime
✅ Server integration via CLI commands
✅ Graceful degradation (non-blocking)
✅ File tracking via PostToolUse
```

## Summary

Hooks system:
- ✅ Three hook types: SessionStart, SessionEnd, PostToolUse
- ✅ Defined in plugin hooks.json files (not hardcoded in CLI)
- ✅ Executed by Claude Code's plugin runtime
- ✅ Worker-specific file tracking via track-file utility
- ✅ Non-blocking — hooks don't fail the session

Next: [06-CLI-COMMANDS.md](./06-CLI-COMMANDS.md) - Complete CLI command reference
