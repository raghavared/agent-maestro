# Maestro CLI Architecture Review

**Reviewer:** CLI Architect
**Date:** 2026-02-09
**Component:** maestro-cli
**Version:** 0.1.0

---

## Executive Summary

The Maestro CLI is a well-structured command-line interface built on Commander.js that serves as the primary interaction layer between agents, the maestro-server, and Claude Code sessions. The architecture demonstrates strong design principles with clear separation of concerns, comprehensive error handling, and a sophisticated plugin system. However, there are opportunities for improvement in error recovery, configuration management, and command consistency.

**Overall Architecture Grade: B+**

**Key Strengths:**
- Excellent plugin and hook architecture
- Strong TypeScript typing with manifest schema
- Sophisticated command permissions system
- Clean API client with retry logic
- Good separation of concerns

**Key Weaknesses:**
- Inconsistent error handling patterns
- Limited offline/fallback capabilities
- Configuration management complexity
- Some command naming inconsistencies
- Limited testing infrastructure visible

---

## 1. CLI Architecture & Entry Point

### 1.1 Entry Point (`bin/maestro.js` + `src/index.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/bin/maestro.js:1-3`

**Strengths:**
- Clean shebang-based executable
- Simple forwarding to compiled TypeScript
- Proper npm bin configuration in `package.json:6-8`

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/index.ts:32-46`

**Strengths:**
- Well-organized Commander.js setup
- Version loading from package.json
- Global options (`--json`, `--server`, `--project`) properly configured
- `preAction` hook for server URL override is elegant

**Issues:**
- No validation that package.json exists before reading (line 30)
- Missing error handling for malformed package.json
- The `preAction` hook modifies global state without validation

**Recommendations:**
```typescript
// Add validation for package.json reading
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
} catch (error) {
  console.error('Failed to read package.json:', error.message);
  process.exit(1);
}

// Validate server URL before setting
.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.server) {
    try {
      new URL(opts.server); // Validate URL format
      api.setBaseUrl(opts.server);
    } catch (error) {
      console.error(`Invalid server URL: ${opts.server}`);
      process.exit(1);
    }
  }
});
```

### 1.2 Command Registration Pattern

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/index.ts:144-152`

**Strengths:**
- Clean separation of command groups into modules
- Consistent `register*Commands(program)` pattern
- All commands follow similar structure

**Commands Registered:**
- Project commands (orchestrator only)
- Task commands (worker + orchestrator)
- Session commands (worker + orchestrator)
- Worker commands (init)
- Orchestrator commands (init)
- Skill commands
- Manifest commands
- Queue commands (strategy-dependent)
- Report commands (replaces deprecated update commands)

**Issue - Deprecated Command Handling:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/index.ts:154-186`

The deprecated update commands show good backward compatibility but:
- Warning message goes to stdout instead of stderr
- No tracking of deprecation usage for eventual removal
- Could benefit from a deprecation date/version

**Recommendation:**
```typescript
function deprecatedUpdateAction(legacyName: string, reportSub: string) {
  return async (message: string) => {
    console.error(`⚠️  Warning: "maestro ${legacyName}" is deprecated and will be removed in v0.2.0.`);
    console.error(`   Please use "maestro report ${reportSub}" instead.`);

    // Track deprecation usage if analytics available
    if (process.env.MAESTRO_ANALYTICS) {
      // Log deprecation usage
    }

    await executeReport(reportSub, message, program.opts());
  };
}
```

---

## 2. Command Structure & Design

### 2.1 Task Commands (`src/commands/task.ts`)

**Strengths:**
- Comprehensive CRUD operations
- Good use of ora spinners for user feedback
- Proper server API integration
- Timeline event posting for audit trail (lines 186-195, 225-235)
- Recursive tree building for hierarchy (lines 383-394)

**Issues:**

**1. Inconsistent ID parameter handling:**
```typescript
// task.ts:129-137 - Defaults to first task from context
if (!id) {
  if (config.taskIds.length === 1) {
    id = config.taskIds[0];
  }
}

// vs task.ts:123 - Requires explicit ID
task.command('get [id]')
```

**Recommendation:** Make this behavior explicit and document when commands use context vs require explicit IDs.

**2. Silent failures in timeline posting:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/task.ts:192-195`

```typescript
try {
  await api.post(`/api/sessions/${sessionId}/timeline`, { ... });
} catch {
  // Don't fail the command if timeline post fails
}
```

While graceful degradation is good, completely silent failures hide issues. Should log to debug or track failures.

**3. Task tree command makes excessive API calls:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/task.ts:383-394`

The recursive `buildTree` function makes individual API calls for each task and its children. For large task hierarchies, this is inefficient.

**Recommendation:**
```typescript
// Fetch all tasks upfront, then build tree in memory
const allTasks = await api.get(`/api/tasks?projectId=${projectId}`);
const taskMap = new Map(allTasks.map(t => [t.id, t]));

function buildTreeFromMap(taskId: string, depth = 0) {
  const task = taskMap.get(taskId);
  if (!task || (cmdOpts.depth && depth >= cmdOpts.depth)) return null;

  const children = allTasks
    .filter(t => t.parentId === taskId)
    .map(child => buildTreeFromMap(child.id, depth + 1))
    .filter(Boolean);

  return { ...task, children };
}
```

### 2.2 Session Commands (`src/commands/session.ts`)

**Strengths:**
- Comprehensive session lifecycle management
- Excellent `buildSessionContext` function (lines 13-67) that enriches spawn requests
- Good session naming generation (lines 72-84)
- Hook-based commands (`register`, `complete`, `needs-input`, `resume-working`) are well-designed

**Outstanding Feature - Session Spawn Context:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/session.ts:192-216`

The spawn command builds comprehensive context including:
- Related tasks with dependency resolution
- Workflow steps tailored to role
- Initial commands for onboarding
- Reason tracking for audit trail
- Role-based session naming

This is excellent agent UX design.

**Issues:**

**1. Inconsistent logging verbosity:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/session.ts:254-260`

The `register` command has detailed logging in non-JSON mode, but other commands are less verbose. This inconsistency makes debugging harder.

**2. Exit code inconsistency:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/session.ts:265-312`

Some error paths use `process.exit(1)` while others use `process.exit(0)` (line 311). Hook commands should be consistent about failure handling.

**Recommendation:** All hook commands should:
- Exit with 0 on "acceptable failures" (missing session ID)
- Exit with 1 on actual errors (network failure, invalid data)
- Log all paths clearly

### 2.3 Report Commands (`src/commands/report.ts`)

**Strengths:**
- Clean replacement for deprecated update commands
- Unified handler with `executeReport` function (lines 32-104)
- Supports both task-specific and session-wide reporting
- Good session completion behavior (lines 81-85)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/report.ts:17-23`

The `REPORT_SUBCOMMANDS` mapping is clean and maintainable.

**Issue - Task ID parsing:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/report.ts:109-112`

```typescript
function parseTaskIds(taskOption?: string): string[] | undefined {
  if (!taskOption) return undefined;
  return taskOption.split(',').map(id => id.trim()).filter(Boolean);
}
```

No validation of task ID format. Could accept invalid IDs like "task-123, , ,invalid".

**Recommendation:**
```typescript
function parseTaskIds(taskOption?: string): string[] | undefined {
  if (!taskOption) return undefined;
  const ids = taskOption.split(',')
    .map(id => id.trim())
    .filter(Boolean);

  // Validate task ID format
  const invalidIds = ids.filter(id => !id.match(/^[a-zA-Z0-9_-]+$/));
  if (invalidIds.length > 0) {
    throw new Error(`Invalid task IDs: ${invalidIds.join(', ')}`);
  }

  return ids;
}
```

---

## 3. Init Commands & Session Lifecycle

### 3.1 Worker Init (`src/commands/worker-init.ts`)

**Strengths:**
- Excellent step-by-step logging with clear progress (lines 134-207)
- Comprehensive environment debugging (lines 127-130)
- Proper validation of role (lines 155-159)
- Session ID generation fallback (lines 44-53)
- Auto-updates session status on server (lines 89-116)

**Outstanding Design:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/worker-init.ts:122-208`

The 7-step initialization sequence with detailed logging is exemplary for debugging and user understanding:
1. Read manifest from environment
2. Parse manifest
3. Validate worker role
4. Load command permissions
5. Resolve session ID
6. Register session with server
7. Spawn Claude Code process

**Issues:**

**1. Silent failures in status updates:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/worker-init.ts:113-114`

```typescript
} catch (err: any) {
  console.warn(`[worker-init]    Failed to update session status: ${err.message}`);
}
```

Session initialization continues even if server registration fails. This could lead to orphaned sessions that the server doesn't know about.

**Recommendation:**
```typescript
// Make server registration critical
try {
  await this.autoUpdateSessionStatus(manifest, sessionId);
} catch (err: any) {
  console.error(`[worker-init] CRITICAL: Failed to register with server: ${err.message}`);
  console.error(`[worker-init] Session will be spawned but server won't track it.`);

  if (!process.env.MAESTRO_ALLOW_OFFLINE) {
    throw err; // Fail fast unless explicitly allowing offline mode
  }
}
```

**2. Duplicate code with orchestrator-init:**

The worker and orchestrator init commands share significant code (manifest reading, session ID generation, spawning). This violates DRY principles.

**Recommendation:** Extract common initialization logic into `BaseInitCommand` class.

### 3.2 Orchestrator Init (`src/commands/orchestrator-init.ts`)

**Similar structure to worker-init but:**
- Less detailed logging (compare lines 107-177 to worker-init's verbose output)
- Less robust error handling
- Commented-out cleanup code (lines 166-176) indicates incomplete implementation

**Recommendation:** Bring orchestrator-init to feature parity with worker-init's logging and error handling.

---

## 4. Plugin System & Hooks

### 4.1 Hook Architecture

**Files:**
- `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/plugins/maestro-worker/hooks/hooks.json`
- `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/plugins/maestro-orchestrator/hooks/hooks.json`

**Strengths:**
- Clean JSON-based hook configuration
- Supports multiple hook types: `SessionStart`, `SessionEnd`, `Stop`, `UserPromptSubmit`, `PostToolUse`
- Matcher patterns for selective hook execution
- Timeout configuration per hook
- Variable substitution (`${CLAUDE_PLUGIN_ROOT}`)

**Worker Hooks (5 types):**
```json
SessionStart → maestro session register
SessionEnd → maestro session complete
Stop → maestro session needs-input
UserPromptSubmit → maestro session resume-working
PostToolUse (Write|Edit) → ${CLAUDE_PLUGIN_ROOT}/bin/track-file
```

**Orchestrator Hooks (2 types):**
```json
SessionStart → maestro session register
SessionEnd → maestro session complete
```

**Outstanding Design:**
The hook system elegantly connects Claude Code lifecycle events to Maestro server state updates. This is a key architectural strength.

**Issue - Worker-specific PostToolUse hook:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/plugins/maestro-worker/hooks/hooks.json:52-63`

The file tracking hook only runs for workers. Orchestrators also modify files and should be tracked.

**Issue - track-file command implementation:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/index.ts:259-278`

```typescript
program.command('track-file <path>')
  .description('Track file modification (called by PostToolUse hook)')
  .action(async (filePath) => {
    const sessionId = config.sessionId;
    if (!sessionId) {
      process.exit(0); // Silent fail if no session
    }
    try {
      await api.post(`/api/sessions/${sessionId}/events`, {
        type: 'file_modified',
        data: { file: filePath, timestamp: new Date().toISOString() },
      });
    } catch {
      // Silent fail - don't spam Claude's output
    }
    process.exit(0);
  });
```

**Issues:**
- Always exits the process (line 277) - this kills the entire CLI
- Silent failures hide issues
- No rate limiting for rapid file changes

**Recommendation:**
```typescript
// Don't exit - let the hook runner handle process lifecycle
// Add rate limiting
const fileTrackCache = new Map<string, number>();
const TRACK_DEBOUNCE_MS = 1000;

program.command('track-file <path>')
  .action(async (filePath) => {
    const sessionId = config.sessionId;
    if (!sessionId) return;

    // Debounce tracking
    const lastTrack = fileTrackCache.get(filePath) || 0;
    const now = Date.now();
    if (now - lastTrack < TRACK_DEBOUNCE_MS) {
      return; // Skip - recently tracked
    }

    fileTrackCache.set(filePath, now);

    try {
      await api.post(`/api/sessions/${sessionId}/events`, {
        type: 'file_modified',
        data: { file: filePath, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      if (config.debug) {
        console.error(`[track-file] Failed: ${error.message}`);
      }
    }
  });
```

### 4.2 Plugin Discovery (`src/services/claude-spawner.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:128-148`

**Strengths:**
- Automatic plugin directory resolution based on role
- Checks for plugin directory existence before use
- Clean path construction

**Issue:**
If plugin directory is missing, it silently continues without hooks. For worker/orchestrator roles, hooks are critical for server integration.

**Recommendation:**
```typescript
getPluginDir(role: 'worker' | 'orchestrator'): string | null {
  // ... existing code ...

  if (existsSync(pluginDir)) {
    return pluginDir;
  }

  // Log warning for critical roles
  if (role === 'worker' || role === 'orchestrator') {
    console.warn(`Warning: Plugin directory not found: ${pluginDir}`);
    console.warn('Session will spawn without hooks - server integration may be incomplete.');
  }

  return null;
}
```

### 4.3 Skill Loading (`src/services/skill-loader.ts`)

**Strengths:**
- Clean skill discovery from `~/.skills/`
- Graceful error handling with categorized results (`loaded`, `missing`, `invalid`)
- No exceptions thrown - uses result objects
- Validates presence of `skill.md` file

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/skill-loader.ts:111-144`

**Outstanding Design:**
The `load` method categorizes results into three buckets, allowing callers to handle partial failures gracefully. This is excellent error handling design.

**Issue - No skill validation:**
The loader only checks for `skill.md` existence, not its validity. Invalid skill syntax could cause Claude Code to fail at spawn time.

**Recommendation:**
```typescript
async validateSkillMd(skillPath: string): Promise<{ valid: boolean; error?: string }> {
  const skillMdPath = join(skillPath, 'skill.md');

  try {
    const content = await readFile(skillMdPath, 'utf-8');

    // Basic validation: check for required sections
    if (!content.includes('# Skill:')) {
      return { valid: false, error: 'Missing "# Skill:" header' };
    }

    if (content.length === 0) {
      return { valid: false, error: 'Empty skill.md file' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

---

## 5. Command Permissions System

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/command-permissions.ts`

This is one of the most sophisticated parts of the CLI architecture.

### 5.1 Strengths

**1. Comprehensive Command Registry (lines 33-87):**
- Central registry with metadata (description, roles, strategies, core status)
- Clear role-based access control
- Strategy-based command augmentation (queue commands for queue strategy)

**2. Default Commands by Role (lines 92-141):**
- Sensible defaults for worker vs orchestrator
- Core commands always available (whoami, status, commands)
- Report commands available to both roles

**3. Guard Functions (lines 351-391):**
```typescript
export async function guardCommand(commandName: string): Promise<void>
```

Excellent pattern for declarative permission checking at command entry points.

**4. Manifest-based Override (lines 247-255):**
Allows explicit `allowedCommands` in manifest to override defaults while preserving core commands.

### 5.2 Issues

**1. Queue strategy commands only for workers:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/command-permissions.ts:66-73`

Queue commands are restricted to workers, but line 73 shows `queue:push` is allowed for both roles. This is inconsistent.

**Recommendation:** Document the design intent - orchestrators can push to queue but not consume from it.

**2. No audit logging:**
Permission denials are thrown as errors but not logged for security audit purposes.

**Recommendation:**
```typescript
export async function guardCommand(commandName: string): Promise<void> {
  const permissions = await getOrLoadPermissions();

  if (!permissions.loadedFromManifest) {
    return;
  }

  if (!isCommandAllowed(commandName, permissions)) {
    // Log permission denial
    if (config.sessionId) {
      try {
        await api.post(`/api/sessions/${config.sessionId}/events`, {
          type: 'permission_denied',
          data: {
            command: commandName,
            role: permissions.role,
            strategy: permissions.strategy
          }
        });
      } catch {
        // Don't fail on logging failure
      }
    }

    throw new Error(
      `Command '${commandName}' is not allowed for ${permissions.role} role with ${permissions.strategy} strategy.\n` +
        'Run "maestro commands" to see available commands.'
    );
  }
}
```

**3. Permission caching is global:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/command-permissions.ts:333-347`

Global cached permissions could cause issues if multiple commands run in sequence with different manifests (though unlikely in practice).

---

## 6. API Client & Server Integration

### 6.1 API Client (`src/api.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/api.ts`

**Strengths:**
- Clean REST client implementation using node-fetch
- Automatic retry with exponential backoff (lines 25-87)
- Smart retry logic: retry 5xx and network errors, not 4xx errors (lines 54-57)
- Configurable retries via config (lines 21-22)
- Proper error response parsing (lines 36-53)

**Outstanding Feature - Retry Logic:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/api.ts:60-68`

```typescript
// Retry on 5xx errors
lastError = error;
if (attempt < maxRetries) {
  const delay = retryDelay * Math.pow(2, attempt);
  if (config.debug) {
    console.error(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
  }
  await new Promise(resolve => setTimeout(resolve, delay));
  continue;
}
```

Exponential backoff with debug logging is production-ready.

**Issues:**

**1. No request timeout:**
Requests can hang indefinitely if server doesn't respond.

**Recommendation:**
```typescript
const response = await fetch(url, {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    ...options?.headers,
  },
  signal: AbortSignal.timeout(30000), // 30s timeout
});
```

**2. No request deduplication:**
Multiple identical requests could be in flight simultaneously.

**3. No response caching:**
Repeated GET requests for the same resource waste bandwidth.

### 6.2 Configuration (`src/config.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/config.ts`

**Strengths:**
- Multi-source configuration: `.env`, `~/.maestro/config`, `~/.maestro-staging/config`
- Automatic staging environment detection (lines 10-16)
- Clever server URL discovery from data dir (lines 22-35)
- Getter-based config values for dynamic resolution

**Issues:**

**1. Configuration precedence is unclear:**

Configuration sources:
1. Environment variables
2. CWD `.env` file (line 7)
3. Staging config file (line 14)
4. Production config file (line 16)
5. Discovered server URL from data dir (line 31)
6. Hardcoded defaults

Which takes precedence? The code shows environment > discovered > default, but staging detection affects which config file is loaded.

**Recommendation:** Document configuration precedence clearly in comments and README.

**2. Server URL discovery fallback is fragile:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/config.ts:37-40`

```typescript
get apiUrl() {
  return process.env.MAESTRO_SERVER_URL || process.env.MAESTRO_API_URL || discoverServerUrl() || 'http://localhost:3000';
}
```

Four fallback layers with two env var names creates confusion. Should consolidate.

**3. isOffline check is incorrect:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/config.ts:41-43`

```typescript
get isOffline() {
  return !process.env.MAESTRO_SERVER_URL && !process.env.MAESTRO_API_URL;
}
```

This only checks env vars, but `discoverServerUrl()` could provide a URL. The `isOffline` check is misleading.

**Recommendation:**
```typescript
get isOffline() {
  return this.apiUrl === 'http://localhost:3000'; // Default = offline
}
```

---

## 7. Error Handling & User Experience

### 7.1 Error Utilities (`src/utils/errors.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/utils/errors.ts`

**Strengths:**
- Structured error objects with `CLIError` interface (lines 1-7)
- Exit code mapping for different error types (lines 10-17)
- Rich error context with details and suggestions
- HTTP status code handling (lines 38-90)
- Network error handling (lines 91-102)

**Outstanding Feature - Error Suggestions:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/utils/errors.ts:45-50`

```typescript
case 404:
  cliError = createError(
    'resource_not_found',
    data.message || 'Resource not found',
    { status, url: err.config?.url },
    'Use list commands to see available resources' // ← Actionable suggestion
  );
```

Actionable error suggestions significantly improve UX.

**Issues:**

**1. Exit code 5 never used:**
`spawn_failed` error is defined (line 128) but never thrown in the codebase.

**2. Error handling is inconsistent across commands:**
Some commands use `handleError(err, isJson)`, others use custom error handling, some use silent `try/catch`.

**Recommendation:** Enforce consistent error handling pattern:
```typescript
// Standard command error handling pattern
try {
  // Command logic
} catch (err) {
  handleError(err, globalOpts.json);
}
```

### 7.2 User Output (`src/utils/formatter.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/utils/formatter.ts`

**Strengths:**
- Consistent JSON output format with `success` flag (line 5)
- Colored table output using `cli-table3` and `chalk`
- Task tree visualization with status icons (lines 30-47)
- Key-value output for details

**Issues:**

**1. Limited customization:**
No options for verbose/quiet modes, no progress bars for long operations.

**2. Status icon inconsistency:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/utils/formatter.ts:49-65`

Handles both `in-progress` (kebab-case) and `in_progress` (snake_case), showing inconsistent data formats from server.

**3. No output truncation:**
Large task trees or task lists could overwhelm terminal. No pagination or truncation.

---

## 8. Storage Layer

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/storage.ts`

**Strengths:**
- Read-only cache design is safe (line 3)
- Loads from `~/.maestro/data/` written by server
- Organized directory structure: `projects/`, `tasks/`, `sessions/`
- Graceful handling of corrupt files (lines 40, 58, 71)
- Efficient in-memory maps for lookups

**Issues:**

**1. Never actually used:**
The `LocalStorage` class is defined but never imported or used in any commands. All commands go directly to the API. This is dead code.

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/storage.ts:129`

The exported singleton `storage` is never imported elsewhere.

**2. No cache invalidation:**
The `reload()` method (lines 85-92) is never called. Stale cache could serve outdated data.

**Recommendation:**
- Either remove the storage layer entirely (it's unused)
- Or integrate it as an offline cache with fallback logic:

```typescript
// In api.ts
export async function getWithCache<T>(endpoint: string): Promise<T> {
  try {
    return await api.get<T>(endpoint);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      // Fall back to local cache
      console.warn('Server unavailable, using local cache...');
      return storage.getFromCache(endpoint);
    }
    throw error;
  }
}
```

---

## 9. Claude Code Spawning

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts`

### 9.1 Strengths

**1. Clean environment preparation:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:83-120`

Comprehensive environment variables setup:
- All Maestro context variables
- Server URL forwarding
- Task metadata
- Acceptance criteria as JSON
- All tasks for multi-task sessions

**2. Minimal prompt approach:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:221`

```typescript
const prompt = 'Run `maestro whoami` to understand your assignment and begin working.';
```

Brilliant design - offloads context to the CLI instead of baking it into prompt. This makes sessions more flexible and context-loading explicit.

**3. Excellent logging:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:239-244`

The command being run is printed with borders for easy copy-paste debugging.

**4. Async skill loading:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:156-189`

Skills are loaded asynchronously and failures are gracefully handled.

### 9.2 Issues

**1. No validation of Claude availability:**
Spawner assumes `claude` command exists. If it doesn't, spawn fails with a cryptic error.

**Recommendation:**
```typescript
async validateClaudeInstalled(): Promise<boolean> {
  try {
    const result = await execAsync('which claude');
    return !!result.stdout.trim();
  } catch {
    return false;
  }
}

async spawn(...) {
  // Validate Claude before spawning
  if (!await this.validateClaudeInstalled()) {
    throw new Error(
      'Claude Code not found. Please install Claude Code CLI:\n' +
      '  npm install -g @anthropic/claude-code'
    );
  }
  // ...
}
```

**2. Process error handling:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:247-251`

```typescript
const claudeProcess = spawn('claude', args, {
  cwd,
  env,
  stdio: options.interactive ? 'inherit' : 'pipe',
});
```

No error event listener on the spawned process. If Claude fails to start, error goes unhandled.

**Recommendation:**
```typescript
claudeProcess.on('error', (error) => {
  console.error('Failed to spawn Claude Code:', error.message);
  if (error.code === 'ENOENT') {
    console.error('Claude Code CLI not found. Install with: npm install -g @anthropic/claude-code');
  }
});
```

---

## 10. Manifest & Type System

### 10.1 Manifest Schema (`src/types/manifest.ts`)

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/types/manifest.ts`

**Strengths:**
- Comprehensive TypeScript types covering entire manifest spec
- Good documentation comments
- Unified `TaskStatus` type (lines 44-49)
- Support for multi-task sessions (line 26)
- Optional fields properly marked
- Type guards for role checking (lines 225-234)

**Outstanding Design - Rich Context Types:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/types/manifest.ts:143-220`

The `AdditionalContext`, `CodebaseContext`, `RelatedTask`, and `ProjectStandards` types show thoughtful design for agent onboarding.

**Issues:**

**1. Model type is too restrictive:**

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/types/manifest.ts:117`

```typescript
model: 'sonnet' | 'opus' | 'haiku';
```

This doesn't match actual Claude model names (`claude-sonnet-4`, etc.). Likely requires mapping logic elsewhere.

**2. Missing validation:**
Types exist but no runtime validation. Invalid manifests are only caught at spawn time.

**Recommendation:**
Use a JSON schema validator (AJV is already a dependency, line 23 in package.json):

```typescript
import Ajv from 'ajv';
import manifestSchema from '../schemas/manifest-schema.js';

export function validateManifest(manifest: any): { valid: boolean; errors?: string[] } {
  const ajv = new Ajv();
  const validate = ajv.compile(manifestSchema);
  const valid = validate(manifest);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors?.map(e => `${e.instancePath} ${e.message}`)
    };
  }

  return { valid: true };
}
```

### 10.2 Manifest Reader (`src/services/manifest-reader.ts`)

Not reviewed in detail, but should be examined for:
- Error handling when manifest file is malformed
- Validation of required fields
- Schema version checking

---

## 11. Queue Strategy Support

Queue strategy is mentioned in permissions and config but no queue command implementations were reviewed. Based on command registration:

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/queue.ts`

Commands registered: `top`, `start`, `complete`, `fail`, `skip`, `list`, `status`, `push`

**Recommendation for Follow-up Review:**
- Examine queue command implementation
- Verify FIFO ordering guarantees
- Check for race conditions in queue consumption
- Validate worker coordination

---

## 12. Testing & Documentation

### 12.1 Testing Infrastructure

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/package.json:12`

```json
"test": "vitest",
```

Vitest is configured, and `tests/` directory exists, but I wasn't able to review test coverage.

**Recommendation:**
- Add test coverage reporting
- Ensure critical paths are tested: API client, manifest validation, error handling
- Add integration tests for command execution

### 12.2 Documentation

**Files Reviewed:**
- `README.md` - Basic usage guide
- `docs/HOOKS-INTEGRATION.md` - Hook system docs
- `docs/spec/` - Specifications

**Strengths:**
- README covers basic installation and usage
- Hook integration is documented

**Gaps:**
- No command reference documentation
- Missing architecture diagrams
- No contribution guide
- Configuration precedence not documented
- Error code reference missing

**Recommendation:**
Generate command reference from code:
```bash
# Add to package.json scripts
"docs:commands": "node scripts/generate-command-docs.js"
```

---

## 13. Dependencies & Build

### 13.1 Package Dependencies

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/package.json:22-36`

**Production Dependencies:**
- `ajv` (8.17.1) - JSON schema validation (not currently used)
- `chalk` (4.1.2) - Terminal colors
- `cli-table3` (0.6.3) - Table formatting
- `commander` (11.1.0) - CLI framework
- `dotenv` (16.4.1) - Environment variables
- `node-fetch` (3.3.2) - HTTP client
- `ora` (5.4.1) - Spinners

**Analysis:**
- Minimal, well-chosen dependencies
- All dependencies are actively maintained
- `ajv` is included but unused - should be utilized for manifest validation
- Versions are pinned (good for reproducibility)

**Development Dependencies:**
- TypeScript 5.3.3
- Vitest 1.2.2
- Node types

**No security vulnerabilities detected in dependency choices.**

### 13.2 TypeScript Configuration

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/tsconfig.json`

**Strengths:**
- `strict: true` (line 8) - Excellent for type safety
- ES2020 target (line 3) - Modern JS features
- `NodeNext` module resolution (lines 4-5) - Proper ESM support
- `resolveJsonModule: true` (line 12) - Allows importing package.json

**Issues:**
- No `declaration: true` - Type declarations not generated for use as library
- No `sourceMap: true` - Makes debugging harder

**Recommendation:**
```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    // ... existing options
  }
}
```

---

## 14. Security Considerations

### 14.1 Command Injection Risks

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:247`

```typescript
const claudeProcess = spawn('claude', args, {
```

**Status:** ✅ SAFE - Uses `spawn` with argument array, not shell string concatenation.

### 14.2 Path Traversal Risks

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/storage.ts:11-13`

```typescript
const DATA_DIR = process.env.DATA_DIR
  ? (process.env.DATA_DIR.startsWith('~') ? join(homedir(), process.env.DATA_DIR.slice(1)) : process.env.DATA_DIR)
  : join(homedir(), '.maestro', 'data');
```

**Status:** ⚠️  RISKY - `DATA_DIR` from environment is not validated. Could point to arbitrary filesystem locations.

**Recommendation:**
```typescript
function sanitizeDataDir(dir: string): string {
  const resolved = dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir;
  const normalized = path.normalize(resolved);

  // Ensure it's within home directory or explicitly allowed paths
  const homeDir = homedir();
  if (!normalized.startsWith(homeDir) && !normalized.startsWith('/opt/maestro')) {
    throw new Error(`DATA_DIR must be within home directory: ${normalized}`);
  }

  return normalized;
}
```

### 14.3 Environment Variable Injection

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/services/claude-spawner.ts:91-107`

```typescript
const env: Record<string, string> = {
  ...process.env,  // ← Forwards entire environment
  // Maestro context
  MAESTRO_SESSION_ID: sessionId,
  // ...
};
```

**Status:** ⚠️  RISKY - Forwards all environment variables to spawned Claude process. Sensitive environment variables (AWS keys, tokens) could leak.

**Recommendation:**
```typescript
// Allowlist specific environment variables
const ALLOWED_ENV_VARS = [
  'PATH', 'HOME', 'USER', 'SHELL', 'TERM',
  'NODE_ENV', 'NPM_CONFIG_*',
  'MAESTRO_*',
];

function filterEnvironment(env: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (ALLOWED_ENV_VARS.some(pattern =>
      pattern.endsWith('*')
        ? key.startsWith(pattern.slice(0, -1))
        : key === pattern
    )) {
      filtered[key] = value;
    }
  }

  return filtered;
}
```

### 14.4 API Authentication

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/api.ts:29-32`

No authentication headers are set. This means:
- Server endpoints are unprotected
- Multi-user scenarios are not supported
- No audit trail of who made changes

**Recommendation:** Add API key support:
```typescript
private async request<T>(endpoint: string, options?: any): Promise<T> {
  const apiKey = process.env.MAESTRO_API_KEY || config.apiKey;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      ...options?.headers,
    },
  });
  // ...
}
```

---

## 15. Performance Considerations

### 15.1 Excessive API Calls

**Issue:** Task tree command makes O(n) API calls for n tasks (recursive fetching).

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/src/commands/task.ts:383-394`

**Impact:** High latency for large task trees.

**Recommendation:** Batch fetch all tasks, then build tree in memory (see Section 2.1).

### 15.2 No Response Caching

**Issue:** Repeated `maestro task get <id>` calls fetch fresh data every time.

**Impact:** Unnecessary server load, slower response times.

**Recommendation:** Implement short-lived cache (5-10 seconds) for GET requests.

### 15.3 Hook Execution Performance

**File:** `/Users/subhang/Desktop/Projects/maestro/agent-maestro/maestro-cli/plugins/maestro-worker/hooks/hooks.json`

Hooks are executed synchronously during Claude Code lifecycle events. If hooks are slow (network issues), they block Claude Code.

**Recommendation:**
- Add timeout handling (already present in JSON: `"timeout": 5`)
- Consider fire-and-forget for non-critical hooks
- Implement hook execution parallelization

---

## 16. Code Quality & Maintainability

### 16.1 Strengths

1. **Consistent TypeScript usage** - Strong typing throughout
2. **Clean module separation** - Commands, services, utils clearly separated
3. **Good function naming** - Names are descriptive and follow conventions
4. **DRY violations are minimal** - Most code is well-factored
5. **Error messages are helpful** - Include suggestions and context

### 16.2 Areas for Improvement

1. **Code duplication** - worker-init and orchestrator-init share significant code
2. **Magic strings** - Status values ('running', 'completed') should be constants
3. **Inconsistent async patterns** - Mix of async/await and promises
4. **Missing JSDoc** - Complex functions lack documentation
5. **No code comments** - Few explanatory comments for complex logic

### 16.3 Recommendations

**1. Define constants for status values:**
```typescript
// src/constants.ts
export const SessionStatus = {
  SPAWNING: 'spawning',
  RUNNING: 'running',
  WORKING: 'working',
  COMPLETED: 'completed',
  NEEDS_INPUT: 'needs_input',
  BLOCKED: 'blocked',
  FAILED: 'failed',
} as const;

export type SessionStatusType = typeof SessionStatus[keyof typeof SessionStatus];
```

**2. Add JSDoc for public APIs:**
```typescript
/**
 * Spawn a new Claude Code session with the given manifest.
 *
 * @param manifest - Maestro manifest configuration
 * @param sessionId - Unique session identifier
 * @param options - Spawn options (cwd, env, interactive)
 * @returns Spawn result with process handle and metadata
 * @throws {Error} If Claude Code is not installed or spawn fails
 *
 * @example
 * ```typescript
 * const result = await spawner.spawn(manifest, 'session-123', { interactive: true });
 * result.process.on('exit', (code) => {
 *   console.log(`Session exited with code ${code}`);
 * });
 * ```
 */
async spawn(
  manifest: MaestroManifest,
  sessionId: string,
  options: SpawnOptions = {}
): Promise<SpawnResult>
```

---

## 17. Recommendations Summary

### 17.1 Critical (Must Fix)

1. **Fix track-file process.exit bug** - Currently kills entire CLI process (Section 4.1)
2. **Add Claude availability check** - Validate before spawning (Section 9.2)
3. **Implement manifest validation** - Use AJV to validate manifests (Section 10.1)
4. **Add API request timeout** - Prevent hung requests (Section 6.1)
5. **Filter environment variables** - Prevent credential leaks (Section 14.3)

### 17.2 High Priority (Should Fix)

6. **Remove or integrate storage layer** - Currently dead code (Section 8)
7. **Fix task tree API performance** - Batch fetch instead of recursive calls (Section 15.1)
8. **Consolidate init commands** - Extract common logic to base class (Section 3.1)
9. **Add error audit logging** - Track permission denials and errors (Section 5.2)
10. **Improve configuration clarity** - Document precedence and consolidate env vars (Section 6.2)

### 17.3 Medium Priority (Nice to Have)

11. **Add response caching** - Reduce server load (Section 15.2)
12. **Generate command reference docs** - Auto-generate from code (Section 12.2)
13. **Add API authentication** - Support multi-user scenarios (Section 14.4)
14. **Define status constants** - Replace magic strings (Section 16.3)
15. **Add JSDoc comments** - Document public APIs (Section 16.3)

### 17.4 Low Priority (Future Enhancements)

16. **Add progress bars** - For long-running operations (Section 7.2)
17. **Implement output pagination** - For large result sets (Section 7.2)
18. **Add command aliases** - For common operations (Section 1.2)
19. **Support config profiles** - Multiple environment configurations (Section 6.2)
20. **Add request deduplication** - Prevent duplicate in-flight requests (Section 6.1)

---

## 18. Conclusion

The Maestro CLI is a well-designed, production-ready command-line interface with sophisticated features including a plugin system, command permissions, and comprehensive server integration. The architecture demonstrates strong engineering principles with clear separation of concerns, type safety, and error handling.

**Key Architectural Strengths:**
1. **Hook System** - Elegant lifecycle integration between Claude Code and Maestro server
2. **Command Permissions** - Sophisticated role-based access control
3. **Manifest System** - Rich configuration with strong typing
4. **API Client** - Production-ready with retry logic and error handling
5. **Modular Design** - Clean separation enables independent testing and maintenance

**Areas Requiring Attention:**
1. **Process Management** - track-file bug needs immediate fix
2. **Storage Layer** - Either integrate or remove unused code
3. **Performance** - Optimize API call patterns for large datasets
4. **Security** - Add environment variable filtering and API authentication
5. **Testing** - Expand test coverage (not visible in review)

**Overall Assessment:** The CLI provides a solid foundation for the Maestro agent orchestration system. With the critical and high-priority issues addressed, it will be robust and maintainable for production use.

**Recommended Next Steps:**
1. Address critical issues (track-file bug, Claude validation, manifest validation)
2. Review and expand test coverage
3. Complete documentation (command reference, architecture diagrams)
4. Performance optimization for large-scale usage
5. Security hardening (authentication, environment filtering)

---

**Review Completed:** 2026-02-09
**Confidence Level:** High (comprehensive code review with specific file and line references)
**Follow-up Required:** Queue command implementation review, test coverage analysis
