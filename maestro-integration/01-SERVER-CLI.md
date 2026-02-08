# Server → CLI Integration

The server invokes the CLI as a child process for specific operations. This is a **one-way dependency** where the server depends on the CLI binary being available.

## Integration Point

| Aspect | Value |
|--------|-------|
| **File** | `maestro-server/src/api/sessionRoutes.ts` |
| **Function** | `generateManifestViaCLI()` |
| **Lines** | 17-80 |
| **Mechanism** | Node.js `child_process.spawn()` |

## When Server Uses CLI

The server invokes the CLI only during **session spawning** (`POST /sessions/spawn`):

1. User requests a new session via REST API
2. Server creates session record with status `spawning`
3. **Server calls CLI** to generate manifest
4. Server emits `session:spawn` WebSocket event with manifest
5. UI receives event and spawns terminal

## CLI Command Invoked

```bash
maestro manifest generate \
  --role <worker|orchestrator> \
  --project-id <projectId> \
  --task-ids <taskId1,taskId2,...> \
  --skills <skill1,skill2,...> \
  --output <~/.maestro/sessions/{sessionId}/manifest.json>
```

## Input Parameters

```typescript
interface ManifestGenerationInput {
  role: 'worker' | 'orchestrator';
  projectId: string;
  taskIds: string[];
  skills: string[];
  sessionId: string;
}
```

## Output

```typescript
interface ManifestGenerationOutput {
  manifestPath: string;     // Path to generated manifest.json
  manifest: any;            // Parsed JSON manifest object
}
```

## Process Spawning

```typescript
const process = spawnProcess('maestro', args, {
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

- **stdin**: ignored (no input needed)
- **stdout**: captured for success messages
- **stderr**: captured for error handling

## Environment Variables

The CLI process inherits these environment variables:

| Variable | Description |
|----------|-------------|
| `MAESTRO_SESSION_ID` | Current session ID |
| `MAESTRO_MANIFEST_PATH` | Output path for manifest |
| `MAESTRO_SERVER_URL` | Server URL for callbacks |

## Error Handling

| Exit Code | Action |
|-----------|--------|
| 0 | Success - read manifest from disk |
| Non-zero | Check if "not found" error → suggest CLI installation |
| Non-zero | Return error message with exit code |

## Configuration

| Config Key | Environment Variable | Default |
|------------|---------------------|---------|
| `manifestGenerator.type` | `MANIFEST_GENERATOR` | `'cli'` |
| `manifestGenerator.cliPath` | `MAESTRO_CLI_PATH` | `'maestro'` |

## Data Flow Diagram

```
┌─────────────┐     POST /sessions/spawn     ┌─────────────┐
│   Client    │ ───────────────────────────► │   Server    │
│  (UI/CLI)   │                              │             │
└─────────────┘                              └──────┬──────┘
                                                    │
                                                    ▼
                                            Create Session
                                            status: 'spawning'
                                                    │
                                                    ▼
                                         ┌──────────────────┐
                                         │  spawn('maestro  │
                                         │  manifest        │
                                         │  generate ...')  │
                                         └────────┬─────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │   CLI Process    │
                                         │  (child_process) │
                                         └────────┬─────────┘
                                                  │
                                                  ▼
                                         Write manifest.json
                                         to ~/.maestro/sessions/
                                                  │
                                                  ▼
                                         Return manifestPath
                                         + parsed manifest
```

## Contract

The server expects the CLI to:

1. Accept the documented arguments
2. Write a valid JSON manifest to the output path
3. Exit with code 0 on success
4. Write errors to stderr on failure
5. Be available in PATH (or at configured path)

The CLI guarantees:

1. Idempotent manifest generation (same inputs = same output)
2. Creates output directory if needed
3. Overwrites existing manifest if present
4. Valid JSON output conforming to manifest schema
