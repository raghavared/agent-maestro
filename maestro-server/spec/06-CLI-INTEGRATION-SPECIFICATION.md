# CLI Integration Specification

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Status:** Stable

## Overview

The Maestro Server integrates with the Maestro CLI to generate session manifests. This specification defines the contract between the server and CLI, including command structure, environment variables, file locations, and error handling.

## Architecture

```
┌─────────────────────┐
│  Maestro Server     │
│  (src/api/          │
│   sessions.ts)      │
└──────────┬──────────┘
           │
           │ 1. Spawn maestro CLI process
           │    with args and options
           ▼
┌─────────────────────┐
│  Maestro CLI        │
│  (maestro manifest  │
│   generate)         │
└──────────┬──────────┘
           │
           │ 2. Generate manifest.json
           │    from API data
           ▼
┌─────────────────────┐
│  ~/.maestro/        │
│  sessions/          │
│  {sessionId}/       │
│  manifest.json      │
└─────────────────────┘
           │
           │ 3. Server reads manifest
           │    and validates structure
           ▼
┌─────────────────────┐
│  Session spawn data │
│  with manifest path │
│  and env vars       │
└─────────────────────┘
```

## CLI Contract

### Manifest Generation Command

The server invokes the CLI using the following command structure:

```bash
maestro manifest generate \
  --role <worker|orchestrator> \
  --project-id <project-id> \
  --task-ids <task-id-1,task-id-2,...> \
  --skills <skill-1,skill-2,...> \
  --api-url <server-url> \
  --output <manifest-path>
```

### Command Arguments

| Argument | Type | Required | Description | Example |
|----------|------|----------|-------------|---------|
| `--role` | string | Yes | Session role (worker or orchestrator) | `worker` |
| `--project-id` | string | Yes | Project identifier | `prj_abc123` |
| `--task-ids` | string | Yes | Comma-separated task IDs | `tsk_001,tsk_002` |
| `--skills` | string | No | Comma-separated skill names | `maestro-cli,custom-skill` |
| `--api-url` | string | Yes | Maestro Server API base URL | `http://localhost:3000` |
| `--output` | string | Yes | Absolute path to manifest output file | `/Users/user/.maestro/sessions/ses_123/manifest.json` |

### CLI Responsibilities

1. **Fetch data from API**: Query the server API to retrieve project, task, and skill data
2. **Validate data**: Ensure all required data is available and valid
3. **Generate manifest**: Create a properly formatted manifest JSON file
4. **Write to file**: Save the manifest to the specified output path
5. **Exit with status code**: Return 0 on success, non-zero on failure

### Server Responsibilities

1. **Validate inputs**: Check that all required parameters are provided
2. **Create session directory**: Create `~/.maestro/sessions/{sessionId}/` before invoking CLI
3. **Build CLI command**: Construct the command with proper arguments
4. **Spawn CLI process**: Execute maestro CLI as a child process
5. **Capture output**: Monitor stdout and stderr for logging
6. **Read manifest**: Parse and validate the generated manifest file
7. **Handle errors**: Detect and report CLI failures

## Implementation

### Server-Side Function

```typescript
async function generateManifestViaCLI(options: {
  role: 'worker' | 'orchestrator';
  projectId: string;
  taskIds: string[];
  skills: string[];
  sessionId: string;
  apiUrl: string;
}): Promise<{ manifestPath: string; manifest: any }>
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/sessions.ts` (lines 11-152)

### Process Flow

```
1. Log generation parameters
   ├─ Session ID
   ├─ Role
   ├─ Project ID
   ├─ Task IDs
   ├─ Skills
   └─ API URL

2. Create session directory
   └─ ~/.maestro/sessions/{sessionId}/

3. Build manifest path
   └─ ~/.maestro/sessions/{sessionId}/manifest.json

4. Build CLI arguments array
   ├─ manifest
   ├─ generate
   ├─ --role <value>
   ├─ --project-id <value>
   ├─ --task-ids <comma-separated>
   ├─ --skills <comma-separated>
   ├─ --api-url <value>
   └─ --output <path>

5. Spawn maestro process
   ├─ Command: 'maestro'
   ├─ Args: [arguments array]
   └─ Options: { stdio: ['ignore', 'pipe', 'pipe'] }

6. Monitor process output
   ├─ Capture stdout
   ├─ Capture stderr
   └─ Log all output for debugging

7. Handle process exit
   ├─ If exit code = 0: Success
   │  ├─ Read manifest file
   │  ├─ Parse JSON
   │  ├─ Validate structure
   │  └─ Return { manifestPath, manifest }
   └─ If exit code ≠ 0: Failure
      ├─ Log error details
      ├─ Check for CLI not found
      └─ Throw error with details

8. Handle process errors
   └─ Throw error if process fails to spawn
```

## Manifest File Structure

### File Location

```
~/.maestro/sessions/{sessionId}/manifest.json
```

**Example:**
```
/Users/user/.maestro/sessions/ses_abc123/manifest.json
```

### Required Manifest Fields

The CLI must generate a manifest with at least these fields:

```typescript
{
  manifestVersion: string;     // Required: Manifest format version
  role: string;                // Required: 'worker' or 'orchestrator'
  session: {                   // Required: Session configuration
    model: string;             // LLM model to use
    // ... other session fields
  };
  project: {                   // Required: Project data
    id: string;
    name: string;
    workingDir: string;
    // ... other project fields
  };
  tasks?: Array<{              // Optional: Array of tasks (multi-task)
    id: string;
    title: string;
    // ... other task fields
  }>;
  task?: {                     // Optional: Single task (legacy format)
    id: string;
    title: string;
    // ... other task fields
  };
  skills?: string[];           // Optional: Skill names
  // ... other fields
}
```

### Validation

The server validates the generated manifest:

```typescript
// Check required top-level fields
if (!manifest.manifestVersion) {
  throw new Error('Manifest missing manifestVersion');
}
if (!manifest.role) {
  throw new Error('Manifest missing role');
}

// Check task data (either tasks array or task object)
if (manifest.tasks && Array.isArray(manifest.tasks) && manifest.tasks.length > 0) {
  // Multi-task format
  console.log(`Tasks in manifest: ${manifest.tasks.map(t => t.id).join(', ')}`);
} else if (manifest.task?.id) {
  // Single-task legacy format
  console.log(`Task in manifest: ${manifest.task.id}`);
} else {
  console.log(`Warning: No tasks found in manifest`);
}

// Log skills if present
if (manifest.skills && manifest.skills.length > 0) {
  console.log(`Skills in manifest: [${manifest.skills.join(', ')}]`);
}
```

## Environment Variables Contract

When spawning a session, the server provides these environment variables to the CLI:

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `MAESTRO_SESSION_ID` | string | Unique session identifier | `ses_abc123` |
| `MAESTRO_MANIFEST_PATH` | string | Absolute path to manifest file | `/Users/user/.maestro/sessions/ses_abc123/manifest.json` |
| `MAESTRO_SERVER_URL` | string | Maestro Server API base URL | `http://localhost:3000` |

### Usage in Session Spawning

These variables are set on the session object and passed to the terminal when spawning:

```typescript
const envVars = {
  MAESTRO_SESSION_ID: session.id,
  MAESTRO_MANIFEST_PATH: manifestPath,
  MAESTRO_SERVER_URL: apiUrl
};

// Update session with env vars
session.env = envVars;
storage.updateSession(session.id, { env: envVars });

// Emit spawn event with env vars
storage.emit('session:created', {
  session,
  command: `maestro ${role} init`,
  cwd: project.workingDir,
  envVars,
  manifest,
  // ...
});
```

### CLI Access to Environment Variables

When the CLI runs `maestro worker init` or `maestro orchestrator init`, it can access these variables:

```typescript
const sessionId = process.env.MAESTRO_SESSION_ID;
const manifestPath = process.env.MAESTRO_MANIFEST_PATH;
const serverUrl = process.env.MAESTRO_SERVER_URL;
```

## CLI Dependency and Error Handling

### Checking CLI Availability

The server expects the `maestro` CLI to be installed and available in the system PATH.

**Installation Check:**
```bash
which maestro
# or
maestro --version
```

### Error Scenarios

#### 1. CLI Not Found

**Detection:**
```typescript
if (stderr.includes('not found') || stderr.includes('command not found')) {
  reject(new Error(`maestro CLI not found. Please install maestro: npm install -g maestro-cli`));
}
```

**Error Message:**
```
maestro CLI not found. Please install maestro: npm install -g maestro-cli
```

#### 2. Manifest Generation Failed

**Detection:**
```typescript
if (code !== 0) {
  reject(new Error(`Manifest generation failed (exit code ${code}):\nStderr: ${stderr}\nStdout: ${stdout}`));
}
```

**Error Message:**
```
Manifest generation failed (exit code 1):
Stderr: [CLI error output]
Stdout: [CLI stdout output]
```

#### 3. Manifest Read/Parse Error

**Detection:**
```typescript
try {
  const manifestContent = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
} catch (error) {
  reject(new Error(`Failed to read manifest: ${error.message}`));
}
```

**Error Message:**
```
Failed to read manifest: ENOENT: no such file or directory
```
or
```
Failed to read manifest: Unexpected token in JSON at position 0
```

#### 4. Process Spawn Error

**Detection:**
```typescript
process.on('error', (error) => {
  reject(new Error(`Failed to spawn maestro CLI: ${error.message}`));
});
```

**Error Message:**
```
Failed to spawn maestro CLI: spawn maestro ENOENT
```

## Exit Codes

### Success

| Code | Meaning | Description |
|------|---------|-------------|
| `0` | Success | Manifest generated and written successfully |

### Error Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| `1` | Generic Error | CLI encountered an error during manifest generation |
| `127` | Command Not Found | maestro CLI not installed or not in PATH |
| Other non-zero | CLI Error | Various CLI-specific errors |

## Logging and Debugging

### Server Logging

The server provides comprehensive logging during manifest generation:

```typescript
console.log('\n   📋 GENERATING MANIFEST VIA CLI:');
console.log(`      • Session ID: ${sessionId}`);
console.log(`      • Role: ${role}`);
console.log(`      • Project ID: ${projectId}`);
console.log(`      • Task IDs: ${taskIds.join(', ')}`);
console.log(`      • Skills: ${skills.length > 0 ? skills.join(', ') : '(none)'}`);
console.log(`      • API URL: ${apiUrl}`);

console.log(`\n   📂 CREATING SESSION DIRECTORY:`);
console.log(`      • Path: ${maestroDir}`);
console.log(`      ✓ Directory created successfully`);

console.log(`\n   📄 MANIFEST PATH:`);
console.log(`      • ${manifestPath}`);

console.log(`\n   🔧 CLI COMMAND:`);
console.log(`      maestro ${args.join(' ')}`);

console.log(`\n   🚀 SPAWNING MAESTRO PROCESS...`);
// ... stdout/stderr logging

console.log(`\n   ⏱️  PROCESS COMPLETED:`);
console.log(`      • Exit code: ${code}`);
console.log(`      • Duration: ${duration}ms`);

console.log(`\n   ✅ MANIFEST GENERATED SUCCESSFULLY:`);
console.log(`      • Path: ${manifestPath}`);
console.log(`      • Size: ${manifestContent.length} bytes`);
console.log(`      • Version: ${manifest.manifestVersion}`);
console.log(`      • Role in manifest: ${manifest.role}`);
```

### CLI Output Capture

Both stdout and stderr are captured and logged in real-time:

```typescript
process.stdout?.on('data', (data) => {
  const output = data.toString();
  stdout += output;
  console.log(`      [STDOUT] ${output.trim()}`);
});

process.stderr?.on('data', (data) => {
  const output = data.toString();
  stderr += output;
  console.log(`      [STDERR] ${output.trim()}`);
});
```

## Future: Server-Side Manifest Generation

In a future version, the server may generate manifests directly without invoking the CLI:

```typescript
// Future implementation
async function generateManifestServerSide(options: {
  role: 'worker' | 'orchestrator';
  projectId: string;
  taskIds: string[];
  skills: string[];
  sessionId: string;
}): Promise<{ manifestPath: string; manifest: any }> {
  // Fetch data from storage
  const project = storage.getProject(options.projectId);
  const tasks = options.taskIds.map(id => storage.getTask(id));
  const skillData = options.skills.map(name => loadSkill(name));

  // Build manifest directly
  const manifest = {
    manifestVersion: '1.0.0',
    role: options.role,
    session: { /* ... */ },
    project: { /* ... */ },
    tasks: tasks,
    skills: options.skills,
    // ...
  };

  // Write manifest
  const manifestPath = join(homedir(), '.maestro', 'sessions', options.sessionId, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return { manifestPath, manifest };
}
```

**Benefits:**
- Eliminates CLI dependency for manifest generation
- Faster manifest creation
- More direct error handling
- Easier to maintain manifest schema consistency

**Tradeoffs:**
- Server must maintain manifest generation logic
- Duplicated logic between server and CLI
- Migration path needed for existing implementations

## Related Specifications

- **[01-MANIFEST-SCHEMA.md](../maestro-cli/docs/spec/01-MANIFEST-SCHEMA.md)** - Manifest file format
- **[08-SESSION-SPAWNING-SPECIFICATION.md](./08-SESSION-SPAWNING-SPECIFICATION.md)** - Session spawning flow
- **[09-ERROR-HANDLING-SPECIFICATION.md](./09-ERROR-HANDLING-SPECIFICATION.md)** - Error codes and handling

## Implementation Reference

**Primary Implementation:**
- File: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/sessions.ts`
- Function: `generateManifestViaCLI` (lines 11-152)
- Endpoint: `POST /api/sessions/spawn` (lines 326-608)

**Dependencies:**
- Node.js `child_process.spawn` - Process spawning
- Node.js `fs/promises` - File system operations
- Maestro CLI - External dependency
