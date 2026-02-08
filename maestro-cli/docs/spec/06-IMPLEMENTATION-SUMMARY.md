# Implementation Summary

## Quick Reference

This document provides a quick overview of the finalized Maestro CLI architecture for implementation teams.

## Core Concepts (5-Minute Read)

### 1. Manifest-Based Architecture

**Everything is in the manifest**:
```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [ /* array of task data */ ],
  "skills": [ /* optional standard skills */ ],
  "session": { /* Claude configuration */ }
}
```

**Location**: `~/.maestro/sessions/{SESSION_ID}/manifest.json`

### 2. Simple Environment Variables

**Only 4 required**:
```bash
MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess-123/manifest.json
MAESTRO_PROJECT_ID=proj-1
MAESTRO_SESSION_ID=sess-123
MAESTRO_API_URL=http://localhost:3000
```

### 3. Worker/Orchestrator as System Prompts

**Not skills** - just system prompt templates:
- `maestro-cli/templates/worker-prompt.md`
- `maestro-cli/templates/orchestrator-prompt.md`

Variables like `${TASK_TITLE}` are replaced with manifest data.

### 4. Standard Skills Only

Optional skills from `~/.skills/`:
- `code-visualizer`
- `frontend-design`
- `skill-creator`
- User's custom skills

Listed in `manifest.skills[]`, loaded as `--plugin-dir` arguments.

### 5. Minimal Hooks

Two built-in hooks:
- `SessionStart`: Report to server when session starts
- `SessionEnd`: Report to server when session ends

**Graceful degradation**: Works offline if server is unavailable.

## Architecture Diagram

```
┌───────────────────────────────────────────────────────┐
│                    Any UI/System                      │
│                                                       │
│  1. Create manifest.json with task data              │
│  2. Save to ~/.maestro/sessions/{SESSION_ID}/        │
│  3. Set environment variables                        │
│  4. Spawn: maestro worker init                       │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────┐
│                  Maestro CLI                          │
│                                                       │
│  maestro worker init:                                │
│  1. Read manifest                                    │
│  2. Validate schema                                  │
│  3. Load worker-prompt.md template                   │
│  4. Replace ${VARIABLES} with manifest data          │
│  5. Load standard skills (if any)                    │
│  6. Execute SessionStart hook                        │
│  7. Spawn Claude:                                    │
│     claude --model sonnet \                          │
│            --permission-mode acceptEdits \           │
│            --plugin-dir ~/.skills/skill1 \           │
│            --append-system-prompt prompt.md          │
│  8. Monitor process                                  │
│  9. Execute SessionEnd hook on exit                  │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────┐
│              Maestro Server (Optional)                │
│                                                       │
│  • POST /api/sessions (SessionStart)                 │
│  • PATCH /api/sessions/{id} (SessionEnd)             │
│  • GET/POST/PATCH /api/tasks                         │
└───────────────────────────────────────────────────────┘
```

## Data Flow

```
Manifest → CLI → System Prompt → Claude Code → Server
```

1. **Manifest** contains all task data
2. **CLI** reads manifest and generates system prompt
3. **System Prompt** injected into Claude
4. **Claude Code** runs with Maestro context
5. **Server** (optional) tracks session state

## Directory Structure

```
maestro-cli/
├── bin/
│   └── maestro.js                  # Executable
│
├── src/
│   ├── commands/
│   │   ├── worker.ts               # maestro worker init
│   │   ├── orchestrator.ts        # maestro orchestrator init
│   │   ├── task.ts                # Task commands
│   │   ├── subtask.ts             # Subtask commands
│   │   └── context.ts             # Context commands
│   │
│   ├── services/
│   │   ├── manifest-reader.ts      # Read/validate manifests
│   │   ├── prompt-generator.ts     # Generate system prompts
│   │   ├── skill-loader.ts         # Load standard skills
│   │   ├── claude-spawner.ts       # Spawn Claude Code
│   │   ├── hook-executor.ts        # Execute hooks
│   │   └── server-client.ts        # HTTP client
│   │
│   ├── templates/
│   │   ├── worker-prompt.md        # Worker system prompt
│   │   └── orchestrator-prompt.md # Orchestrator system prompt
│   │
│   ├── types/
│   │   ├── manifest.ts             # TypeScript types
│   │   └── config.ts
│   │
│   └── utils/
│       ├── config.ts               # Environment loading
│       ├── logger.ts               # Logging
│       ├── errors.ts               # Error classes
│       └── validator.ts            # Schema validation
│
└── templates/                       # System prompt templates
    ├── worker-prompt.md
    └── orchestrator-prompt.md
```

## Key Components

### 1. ManifestReader

```typescript
class ManifestReader {
  async read(path: string): Promise<MaestroManifest> {
    const content = await readFile(path, 'utf-8');
    const manifest = JSON.parse(content);
    validateManifest(manifest);  // Ajv schema validation
    return manifest;
  }
}
```

### 2. PromptGenerator

```typescript
class PromptGenerator {
  async generate(manifest: MaestroManifest): Promise<string> {
    const template = await readTemplate(manifest.role);
    return replaceVariables(template, manifest);
  }
}
```

### 3. SkillLoader

```typescript
class SkillLoader {
  async load(skillNames: string[]): Promise<string[]> {
    const paths: string[] = [];
    for (const name of skillNames) {
      const path = join(homedir(), '.skills', name);
      if (existsSync(join(path, 'skill.md'))) {
        paths.push(path);
      }
    }
    return paths;
  }
}
```

### 4. ClaudeSpawner

```typescript
class ClaudeSpawner {
  spawn(config: SpawnConfig): ChildProcess {
    const args = [
      '--model', config.model,
      '--permission-mode', config.permissionMode,
      '--append-system-prompt', promptFile
    ];

    // Add skills
    for (const skillPath of config.skillPaths) {
      args.push('--plugin-dir', skillPath);
    }

    return spawn('claude', args);
  }
}
```

### 5. HookExecutor

```typescript
class HookExecutor {
  async sessionStart(manifest: MaestroManifest): Promise<void> {
    try {
      await this.serverClient.createSession({
        id: sessionId,
        taskIds: manifest.tasks.map(t => t.id),
        status: 'running'
      });
    } catch (error) {
      console.warn('Failed to report session start');
      // Continue anyway
    }
  }
}
```

## Implementation Checklist

### Phase 1: Core Infrastructure ✓

- [ ] Define TypeScript types for manifest
- [ ] Implement manifest schema validation (Ajv)
- [ ] Create ManifestReader service
- [ ] Create PromptGenerator service
- [ ] Write worker-prompt.md template
- [ ] Write orchestrator-prompt.md template
- [ ] Add unit tests

### Phase 2: CLI Commands ✓

- [ ] Implement `maestro worker init`
- [ ] Implement `maestro orchestrator init`
- [ ] Implement `maestro task` commands
- [ ] Implement `maestro subtask` commands
- [ ] Implement `maestro context` commands
- [ ] Implement `maestro whoami`
- [ ] Add integration tests

### Phase 3: Skills Integration ✓

- [ ] Implement SkillLoader service
- [ ] Discover skills in ~/.skills/
- [ ] Validate skill directories
- [ ] Pass skills to Claude spawner
- [ ] Handle missing/invalid skills gracefully
- [ ] Add skill-related tests

### Phase 4: Server Integration ✓

- [ ] Implement ServerClient with HTTP requests
- [ ] Implement HookExecutor
- [ ] Add SessionStart hook
- [ ] Add SessionEnd hook
- [ ] Handle offline mode gracefully
- [ ] Add timeout handling
- [ ] Add server integration tests

### Phase 5: Testing ✓

- [ ] Unit tests for all services (80%+ coverage)
- [ ] Integration tests for commands
- [ ] End-to-end tests with real manifests
- [ ] Test offline mode
- [ ] Test error scenarios
- [ ] Performance testing

### Phase 6: Documentation ✓

- [ ] API documentation
- [ ] User guide
- [ ] UI integration guide
- [ ] Server integration guide
- [ ] Migration guide (from old architecture)

## Testing Strategy

### Unit Tests

```typescript
describe('ManifestReader', () => {
  it('should read and validate manifest', async () => {
    const reader = new ManifestReader();
    const manifest = await reader.read('/path/to/manifest.json');
    expect(manifest.role).toBe('worker');
  });

  it('should throw on invalid manifest', async () => {
    const reader = new ManifestReader();
    await expect(
      reader.read('/path/to/invalid.json')
    ).rejects.toThrow('Invalid manifest');
  });
});
```

### Integration Tests

```bash
# Create test manifest
cat > /tmp/test-manifest.json << 'EOF'
{ "manifestVersion": "1.0", "role": "worker", ... }
EOF

# Set env vars
export MAESTRO_MANIFEST_PATH=/tmp/test-manifest.json
export MAESTRO_SESSION_ID=test-123
export MAESTRO_PROJECT_ID=test-proj

# Run worker init
maestro worker init

# Verify Claude was spawned correctly
```

### End-to-End Tests

```typescript
test('complete worker session flow', async () => {
  // 1. Generate manifest
  const manifest = generateTestManifest();
  await saveManifest(manifest);

  // 2. Spawn worker
  const worker = spawnWorker();

  // 3. Wait for session start
  await waitForSessionStart();

  // 4. Simulate Claude work
  await simulateWork();

  // 5. Exit Claude
  worker.kill();

  // 6. Verify session end reported
  await waitForSessionEnd();
});
```

## Performance Targets

- **Manifest read**: < 10ms
- **Prompt generation**: < 50ms
- **Skill loading**: < 100ms (per skill)
- **SessionStart hook**: < 200ms
- **Total startup**: < 500ms (before Claude spawns)

## Error Handling

### Fail-Fast Errors (Exit Immediately)

- Invalid manifest schema
- Missing required environment variables
- Manifest file not found
- Claude binary not found

### Soft Errors (Log Warning, Continue)

- Server unreachable (hooks fail)
- Skills not found (skip that skill)
- Invalid skill directory (skip that skill)

### Error Messages

```
❌ Fatal: Manifest validation failed
   - Missing required field: task.title
   - Exiting...

⚠️  Warning: Skill not found: code-visualizer
   Available skills: frontend-design, skill-creator
   Continuing without this skill...

ℹ️  Info: No API URL configured
   Running in offline mode
```

## Success Criteria

### Must Have ✓

- [x] Read and validate manifests
- [x] Generate system prompts from templates
- [x] Load standard skills
- [x] Spawn Claude Code with correct arguments
- [x] Execute SessionStart/SessionEnd hooks
- [x] Work offline (no server required)
- [x] Comprehensive error handling
- [x] 80%+ test coverage

### Nice to Have

- [ ] Manifest migration for version changes
- [ ] Skill recommendations based on task
- [ ] Session recovery after crash
- [ ] Debug mode with verbose logging
- [ ] CLI autocompletion

## Migration from Old Architecture

### What Changed

**Old**:
- Complex skill system with custom manifests
- Many environment variables
- Extensible hooks in skill directories
- Server generates prompts

**New**:
- Simple manifests with all data
- Minimal environment variables (4 total)
- Built-in hooks only
- CLI generates prompts locally

### Migration Steps

1. Remove old skill directories (`maestro-skills/`)
2. Update manifest generation in UI
3. Update environment variable passing
4. Remove server prompt generation endpoint
5. Test with new CLI

### Breaking Changes

- Manifest format changed (new schema)
- Environment variables reduced
- Custom hooks no longer supported
- Skills are now from `.skills/` only

## Common Issues & Solutions

### Issue: Manifest not found

```
Error: ENOENT: no such file or directory

Solution: Verify MAESTRO_MANIFEST_PATH points to valid file
Check: ls -la $MAESTRO_MANIFEST_PATH
```

### Issue: Skill not loading

```
Warning: Skill not found: my-skill

Solution: Check skill exists in ~/.skills/my-skill/skill.md
Install: Put skill in ~/.skills/ directory
```

### Issue: Server unreachable

```
Warning: SessionStart hook failed: Network error

Solution: This is OK - CLI works offline
Optional: Check server is running at MAESTRO_API_URL
```

### Issue: Claude not spawning

```
Error: spawn claude ENOENT

Solution: Install Claude Code CLI
Check: which claude
Install: Follow Claude Code installation guide
```

## Resources

- **Manifest Schema**: See [01-MANIFEST-SCHEMA.md](./01-MANIFEST-SCHEMA.md)
- **CLI Architecture**: See [02-CLI-ARCHITECTURE.md](./02-CLI-ARCHITECTURE.md)
- **System Prompts**: See [03-SYSTEM-PROMPTS.md](./03-SYSTEM-PROMPTS.md)
- **Standard Skills**: See [04-STANDARD-SKILLS.md](./04-STANDARD-SKILLS.md)
- **Hooks System**: See [05-HOOKS-SYSTEM.md](./05-HOOKS-SYSTEM.md)

## Quick Start for Developers

```bash
# 1. Clone repo
git clone <repo>
cd maestro-cli

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Link for local testing
npm link

# 5. Create test manifest
cat > /tmp/test.json << 'EOF'
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "test-1",
      "title": "Test task",
      "description": "Testing Maestro CLI",
      "acceptanceCriteria": ["Works correctly"],
      "projectId": "test",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
EOF

# 6. Test
export MAESTRO_MANIFEST_PATH=/tmp/test.json
export MAESTRO_SESSION_ID=test-123
export MAESTRO_PROJECT_ID=test
maestro worker init
```

## Summary

The finalized Maestro CLI is:

✅ **Simple**: Manifests + env vars + templates
✅ **Portable**: Works anywhere with Claude Code
✅ **Robust**: Comprehensive error handling
✅ **Testable**: High test coverage
✅ **Flexible**: Works with any UI/server
✅ **Offline-capable**: No server required

Ready for implementation! 🚀
