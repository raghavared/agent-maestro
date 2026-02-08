# Claude Code Hooks Integration

## Overview

The maestro-cli integrates with Claude Code's native plugin system, providing:
- **Hooks** for automatic maestro-server integration throughout the session lifecycle
- **Skills** (future) for maestro-specific commands and workflows

## Architecture

### Plugin Directory Structure

```
maestro-cli/
├── plugins/
│   ├── maestro-worker/
│   │   ├── hooks/
│   │   │   └── hooks.json          # Hook definitions for workers
│   │   ├── skills/                  # Skills directory (future)
│   │   └── bin/
│   │       └── track-file          # Bash script for file tracking
│   └── maestro-orchestrator/
│       ├── hooks/
│       │   └── hooks.json          # Hook definitions for orchestrators
│       └── skills/                  # Skills directory (future)
```

**Note**: Skills and hooks are loaded together via the `--plugin-dir` flag. When Claude Code sees this flag, it automatically loads both `hooks/hooks.json` and any skills from the `skills/` directory.

### Hook Types Implemented

1. **SessionStart** - Registers session with maestro-server when Claude starts
2. **SessionEnd** - Marks session as completed when Claude exits
3. **PostToolUse** - Tracks file modifications after Write/Edit tool use (worker only)

## CLI Commands for Hooks

The hooks call these maestro CLI commands:

### `maestro session register`

Called by SessionStart hook to register the session with the server.

**Environment Variables Used:**
- `MAESTRO_SESSION_ID` - Current session ID
- `MAESTRO_PROJECT_ID` - Project context
- `MAESTRO_TASK_IDS` - Task assignments
- `MAESTRO_ROLE` - Agent role (worker/orchestrator)

**Example:**
```bash
maestro session register
```

### `maestro session complete`

Called by SessionEnd hook to mark session as completed.

**Example:**
```bash
maestro session complete
```

### `maestro track-file <path>`

Called by PostToolUse hook to track file modifications.

**Example:**
```bash
maestro track-file /path/to/modified/file.ts
```

## Plugin Loading

### Automatic Plugin Loading

ClaudeSpawner automatically adds the `--plugin-dir` flag when spawning Claude sessions. This loads the appropriate plugin based on the agent role:

- **Workers**: `--plugin-dir /path/to/maestro-cli/plugins/maestro-worker`
- **Orchestrators**: `--plugin-dir /path/to/maestro-cli/plugins/maestro-orchestrator`

No manifest configuration is needed - plugins are always loaded.

### What Gets Loaded

When `--plugin-dir` is provided, Claude Code automatically loads:

1. **Hooks** from `hooks/hooks.json`
2. **Skills** from `skills/` directory (any `SKILL.md` files)

### Environment Variables

ClaudeSpawner sets these environment variables for hooks to access:

- `MAESTRO_SESSION_ID` - Current session ID
- `MAESTRO_TASK_IDS` - Task ID assigned to this session
- `MAESTRO_PROJECT_ID` - Project context
- `MAESTRO_ROLE` - Agent role (worker/orchestrator)
- `MAESTRO_TASK_TITLE` - Task title
- `MAESTRO_TASK_PRIORITY` - Task priority
- `MAESTRO_TASK_ACCEPTANCE` - JSON array of acceptance criteria
- `MAESTRO_TASK_NOTES` - Technical notes (if present)
- `MAESTRO_TASK_DEPENDENCIES` - JSON array of dependencies (if present)

## Hook Definitions

### Worker Hooks (`plugins/maestro-worker/hooks/hooks.json`)

```json
{
  "description": "Maestro Worker hooks for server integration",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "maestro session register",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "maestro session complete",
            "timeout": 3
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/bin/track-file",
            "timeout": 2
          }
        ]
      }
    ]
  }
}
```

### Orchestrator Hooks (`plugins/maestro-orchestrator/hooks/hooks.json`)

Same as worker hooks but **without** PostToolUse (orchestrators don't typically modify files).

## File Tracking Implementation

The `track-file` script extracts file paths from hook input:

```bash
#!/bin/bash
set -euo pipefail

# Read hook input from stdin or environment
INPUT="${HOOK_INPUT:-$(cat)}"

# Extract file path from hook input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

# If we have a file path, track it
if [ -n "$FILE_PATH" ]; then
  maestro track-file "$FILE_PATH" 2>/dev/null || true
fi

exit 0
```

## Implementation Details

### ClaudeSpawner Changes

#### 1. Plugin Directory Detection

```typescript
getPluginDir(role: 'worker' | 'orchestrator'): string | null {
  const cliRoot = join(__dirname, '../..');
  const pluginName = role === 'worker' ? 'maestro-worker' : 'maestro-orchestrator';
  const pluginDir = join(cliRoot, 'plugins', pluginName);

  if (existsSync(pluginDir)) {
    return pluginDir;
  }

  return null;
}
```

#### 2. Claude Arguments with Plugin

```typescript
buildClaudeArgs(manifest: MaestroManifest): string[] {
  const args: string[] = [];

  // Add plugin directory (provides both hooks and skills)
  const pluginDir = this.getPluginDir(manifest.role);
  if (pluginDir) {
    args.push('--plugin-dir', pluginDir);
  }

  // Add model, thinking mode, max turns, etc.
  args.push('--model', manifest.session.model);
  // ...
}
```

**Note**: There is NO `--skill` flag in Claude Code. Skills are loaded automatically from the `skills/` directory within the plugin when `--plugin-dir` is provided.

#### 3. Environment Variables

```typescript
prepareEnvironment(manifest: MaestroManifest, sessionId: string): Record<string, string> {
  const env = {
    // Standard Maestro context
    MAESTRO_SESSION_ID: sessionId,
    MAESTRO_TASK_IDS: manifest.task.id,
    MAESTRO_PROJECT_ID: manifest.task.projectId,
    MAESTRO_ROLE: manifest.role,
    MAESTRO_TASK_TITLE: manifest.task.title,
    MAESTRO_TASK_PRIORITY: manifest.task.priority || 'medium',
  };

  // Add task metadata for hooks
  if (manifest.task.acceptanceCriteria) {
    env.MAESTRO_TASK_ACCEPTANCE = JSON.stringify(manifest.task.acceptanceCriteria);
  }
  if (manifest.task.technicalNotes) {
    env.MAESTRO_TASK_NOTES = manifest.task.technicalNotes;
  }
  if (manifest.task.dependencies) {
    env.MAESTRO_TASK_DEPENDENCIES = JSON.stringify(manifest.task.dependencies);
  }

  return env;
}
```

### Session Commands

All session commands implement graceful failure handling:

```typescript
session.command('register')
  .action(async () => {
    try {
      await api.post('/api/sessions', { ... });
      console.log(`✅ Session ${sessionId} registered`);
    } catch (err: any) {
      // Fail gracefully - don't crash Claude
      console.error('⚠️  Failed to register session:', err.message);
      process.exit(0); // Exit 0 so hook doesn't fail Claude session
    }
  });
```

## Testing

### Test Coverage

140 tests cover:
- Plugin directory detection (3 tests)
- Hook enablement in buildClaudeArgs (4 tests)
- Hook-related environment variables (3 tests)
- Integration tests verifying end-to-end flow

### Running Tests

```bash
npm test
```

### Manual Testing

```bash
npx tsx examples/test-hooks-integration.ts
```

## Example Usage

### Complete Manifest Example

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "task": {
    "id": "task-001",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "acceptanceCriteria": [
      "Users can register with email/password",
      "Users can login and receive JWT token",
      "Protected routes validate JWT tokens"
    ],
    "technicalNotes": "Use bcrypt for hashing, jsonwebtoken for JWT",
    "dependencies": ["task-database-setup"],
    "complexity": "medium",
    "priority": "high",
    "projectId": "proj-001",
    "createdAt": "2026-02-02T12:00:00Z"
  },
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits",
    "thinkingMode": "auto",
    "maxTurns": 50,
    "workingDirectory": "/path/to/project"
  }
}
```

**Note**: Hooks and skills are loaded automatically via `--plugin-dir`. No `skills` or `enableHooks` fields are needed in the manifest.

### Spawning with Hooks

```typescript
import { ClaudeSpawner } from '@maestro/cli';

const spawner = new ClaudeSpawner();
const sessionId = spawner.generateSessionId();

const result = await spawner.spawn(manifest, sessionId, {
  interactive: true,
  cwd: '/path/to/project'
});

// Claude will now:
// 1. Register session on start (SessionStart hook)
// 2. Track file modifications (PostToolUse hook)
// 3. Mark session complete on exit (SessionEnd hook)
```

## Benefits

1. **Automatic Session Tracking** - No manual registration needed
2. **File Change Monitoring** - Track what files agents modify
3. **Clean Separation** - Hooks → CLI → API → Server
4. **Graceful Degradation** - Hooks fail silently if server is unavailable
5. **Type Safety** - Full TypeScript support with 140 tests

## Future Enhancements

- PreToolUse hooks for validation
- Stop hooks for cleanup
- Custom hook configurations per project
- Hook-based workflow orchestration
