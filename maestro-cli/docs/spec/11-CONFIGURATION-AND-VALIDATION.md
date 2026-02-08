# Configuration and Validation

## Overview

This document describes how Maestro CLI loads configuration, validates inputs, and handles environment variables.

---

## Configuration Priority

The CLI reads configuration from multiple sources with the following priority (highest to lowest):

### Priority Order

```
1. Environment Variables       (Highest - set by UI or user)
2. ~/.maestro/config.json      (User-level configuration)
3. .maestro.json               (Project-level configuration)
4. Built-in Defaults           (Lowest - hardcoded in CLI)
```

### Example

```bash
# 1. Environment variable (HIGHEST PRIORITY)
export MAESTRO_API_URL='http://localhost:3000'

# 2. User config (~/.maestro/config.json)
{
  "apiUrl": "https://maestro.example.com"
}

# 3. Project config (.maestro.json in project root)
{
  "apiUrl": "http://project-server:3000"
}

# 4. Built-in default (LOWEST PRIORITY)
const DEFAULT_API_URL = 'http://localhost:3000';

# Result: Uses environment variable = 'http://localhost:3000'
```

---

## Environment Variables

### Required for Session Initialization

```bash
MAESTRO_MANIFEST_PATH=/path/to/manifest.json   # Required: Manifest location
MAESTRO_PROJECT_ID=proj-123                    # Required: Project identifier
MAESTRO_SESSION_ID=sess-456                    # Required: Session identifier
```

### Optional Configuration

```bash
MAESTRO_API_URL=http://localhost:3000          # Optional: Server URL (default: http://localhost:3000)
MAESTRO_DEBUG=true                             # Optional: Enable debug logging (default: false)
MAESTRO_LOG_FILE=/path/to/log                  # Optional: Log file location
MAESTRO_SHOW_BRIEF=false                       # Optional: Skip session brief display
MAESTRO_SKIP_INITIAL_COMMANDS=true             # Optional: Skip initial commands
```

### Validation

CLI validates environment variables on startup:

```typescript
// src/utils/config.ts

export function validateEnvironment(): void {
  const required = [
    'MAESTRO_MANIFEST_PATH',
    'MAESTRO_PROJECT_ID',
    'MAESTRO_SESSION_ID'
  ];

  const missing: string[] = [];

  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:\n');
    missing.forEach(varName => {
      console.error(`   • ${varName}`);
    });
    console.error('\nThese variables must be set before running maestro worker init');
    process.exit(1);
  }

  // Validate manifest path exists
  if (!existsSync(process.env.MAESTRO_MANIFEST_PATH!)) {
    console.error(`❌ Manifest file not found: ${process.env.MAESTRO_MANIFEST_PATH}`);
    console.error('\nVerify MAESTRO_MANIFEST_PATH points to a valid manifest file');
    process.exit(1);
  }
}
```

---

## Configuration Files

### User Configuration: `~/.maestro/config.json`

**Location**: `~/.maestro/config.json`

**Purpose**: User-level defaults that apply to all projects

**Format**:
```json
{
  "apiUrl": "http://localhost:3000",
  "defaultModel": "sonnet",
  "defaultPermissionMode": "acceptEdits",
  "debug": false,
  "logFile": "~/.maestro/logs/maestro-cli.log",
  "templatesDir": "~/.maestro/templates"
}
```

**Example**:
```json
{
  "apiUrl": "https://maestro.company.com",
  "defaultModel": "sonnet",
  "debug": false
}
```

**Loading**:
```typescript
// src/utils/config.ts

export function loadUserConfig(): UserConfig {
  const configPath = join(homedir(), '.maestro', 'config.json');

  if (!existsSync(configPath)) {
    return {}; // Use defaults
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Failed to load user config, using defaults');
    return {};
  }
}
```

---

### Project Configuration: `.maestro.json`

**Location**: `.maestro.json` in project root

**Purpose**: Project-specific configuration that overrides user config

**Format**:
```json
{
  "apiUrl": "http://localhost:8080",
  "defaultSkills": ["code-visualizer"],
  "workingDirectory": "./src",
  "projectId": "my-project"
}
```

**Example**:
```json
{
  "apiUrl": "http://localhost:8080",
  "projectId": "ecommerce-platform",
  "defaultSkills": ["frontend-design", "code-visualizer"]
}
```

**Loading**:
```typescript
// src/utils/config.ts

export function loadProjectConfig(cwd: string): ProjectConfig {
  const configPath = join(cwd, '.maestro.json');

  if (!existsSync(configPath)) {
    return {}; // Use user config or defaults
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Failed to load project config, using user config');
    return {};
  }
}
```

---

### Complete Configuration Loading

```typescript
// src/utils/config.ts

interface MaestroConfig {
  manifestPath: string;
  sessionId: string;
  projectId: string;
  apiUrl: string;
  debug: boolean;
  logFile: string;
  showBrief: boolean;
  skipInitialCommands: boolean;
}

export function loadConfig(): MaestroConfig {
  // 1. Load defaults
  const defaults = {
    apiUrl: 'http://localhost:3000',
    debug: false,
    logFile: join(homedir(), '.maestro', 'logs', 'maestro-cli.log'),
    showBrief: true,
    skipInitialCommands: false
  };

  // 2. Load project config
  const projectConfig = loadProjectConfig(process.cwd());

  // 3. Load user config
  const userConfig = loadUserConfig();

  // 4. Load environment variables (highest priority)
  const envConfig = {
    manifestPath: process.env.MAESTRO_MANIFEST_PATH,
    sessionId: process.env.MAESTRO_SESSION_ID,
    projectId: process.env.MAESTRO_PROJECT_ID,
    apiUrl: process.env.MAESTRO_API_URL,
    debug: process.env.MAESTRO_DEBUG === 'true',
    logFile: process.env.MAESTRO_LOG_FILE,
    showBrief: process.env.MAESTRO_SHOW_BRIEF !== 'false',
    skipInitialCommands: process.env.MAESTRO_SKIP_INITIAL_COMMANDS === 'true'
  };

  // 5. Merge with priority: env > user > project > defaults
  return {
    ...defaults,
    ...projectConfig,
    ...userConfig,
    ...Object.fromEntries(
      Object.entries(envConfig).filter(([_, v]) => v !== undefined)
    )
  };
}
```

---

## Manifest Validation

### Schema Validation

```typescript
// src/utils/validator.ts

import Ajv from 'ajv';

const manifestSchema = {
  type: 'object',
  required: ['manifestVersion', 'role', 'task', 'session'],
  properties: {
    manifestVersion: { type: 'string', const: '1.0' },
    role: { type: 'string', enum: ['worker', 'orchestrator'] },
    task: {
      type: 'object',
      required: ['id', 'title', 'description', 'subtasks', 'acceptanceCriteria', 'projectId', 'createdAt'],
      properties: {
        id: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', minLength: 1 },
        subtasks: { type: 'array' },
        acceptanceCriteria: { type: 'array', minItems: 1 },
        projectId: { type: 'string' },
        createdAt: { type: 'string' }
      }
    },
    skills: { type: 'array', items: { type: 'string' } },
    session: {
      type: 'object',
      required: ['model', 'permissionMode'],
      properties: {
        model: { type: 'string', enum: ['sonnet', 'opus', 'haiku'] },
        permissionMode: { type: 'string', enum: ['acceptEdits', 'interactive', 'readOnly'] }
      }
    }
  }
};

const ajv = new Ajv();
const validate = ajv.compile(manifestSchema);

export function validateManifest(manifest: unknown): manifest is MaestroManifest {
  const valid = validate(manifest);

  if (!valid) {
    const errors = validate.errors!;
    console.error('❌ Manifest validation failed:\n');

    errors.forEach(error => {
      const path = error.instancePath || 'root';
      console.error(`   • ${path}: ${error.message}`);
    });

    throw new Error('Invalid manifest structure');
  }

  return true;
}
```

### Validation on Init

```typescript
// src/commands/worker.ts

export async function workerInit() {
  // 1. Validate environment
  validateEnvironment();

  // 2. Load config
  const config = loadConfig();

  // 3. Read manifest
  const manifestReader = new ManifestReader();
  let manifest: MaestroManifest;

  try {
    manifest = await manifestReader.read(config.manifestPath);
  } catch (error) {
    console.error('❌ Failed to read manifest:', error.message);
    process.exit(1);
  }

  // 4. Validate manifest
  try {
    validateManifest(manifest);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  // Continue with initialization...
}
```

---

## Testing with Mock Data

### Testing Worker Init

```bash
#!/bin/bash
# test-worker-init.sh

# Create test manifest
mkdir -p ~/.maestro/sessions/test-session

cat > ~/.maestro/sessions/test-session/manifest.json << 'EOF'
{
  "manifestVersion": "1.0",
  "role": "worker",
  "task": {
    "id": "test-task",
    "title": "Test Task",
    "description": "Testing Maestro CLI",
    "subtasks": [],
    "acceptanceCriteria": ["Task completes successfully"],
    "projectId": "test-project",
    "createdAt": "2026-02-02T10:00:00Z"
  },
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
EOF

# Set environment variables
export MAESTRO_MANIFEST_PATH=~/.maestro/sessions/test-session/manifest.json
export MAESTRO_SESSION_ID=test-session
export MAESTRO_PROJECT_ID=test-project
export MAESTRO_DEBUG=true

# Run worker init
maestro worker init
```

### Testing Configuration Priority

```bash
#!/bin/bash
# test-config-priority.sh

# Set project config (priority 3)
cat > .maestro.json << 'EOF'
{
  "apiUrl": "http://project-server:3000"
}
EOF

# Set user config (priority 2)
cat > ~/.maestro/config.json << 'EOF'
{
  "apiUrl": "https://maestro.example.com"
}
EOF

# Set environment variable (priority 1 - highest)
export MAESTRO_API_URL='http://localhost:3000'

# Should use: http://localhost:3000 (from env var)
maestro whoami  # Will show which API URL is being used
```

---

## Security Considerations

### 1. Environment Variables

**Risk**: Environment variables are visible to all processes

**Mitigation**:
```bash
# ✅ Good: Only configuration in env vars
export MAESTRO_MANIFEST_PATH=/path/to/manifest.json
export MAESTRO_API_URL=http://localhost:3000

# ❌ Bad: Secrets in env vars
export MAESTRO_API_KEY=secret-key-here  # Don't do this!
```

**Best Practice**: Use separate credential management
```bash
# Store API keys in secure credential store
export API_KEY=$(security find-generic-password -s maestro-api-key -w)
```

---

### 2. Manifest Sanitization

**Risk**: Malicious content in manifest could cause injection

**Mitigation**:
```typescript
// Sanitize task data before display
function sanitizeTaskData(task: TaskData): TaskData {
  return {
    ...task,
    title: escapeHtml(task.title),
    description: escapeHtml(task.description),
    subtasks: task.subtasks.map(st => ({
      ...st,
      title: escapeHtml(st.title)
    }))
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

### 3. File System Access

**Risk**: Path traversal or unauthorized file access

**Mitigation**:
```typescript
// Validate manifest path is within ~/.maestro/sessions/
function validateManifestPath(manifestPath: string): void {
  const resolvedPath = resolve(manifestPath);
  const sessionsDir = join(homedir(), '.maestro', 'sessions');

  if (!resolvedPath.startsWith(sessionsDir)) {
    throw new Error('Manifest must be in ~/.maestro/sessions/ directory');
  }
}
```

---

### 4. Skill Loading

**Risk**: Loading malicious skills from untrusted locations

**Mitigation**:
```typescript
// Only load skills from trusted directories
function validateSkillPath(skillName: string): void {
  const skillPath = join(homedir(), '.skills', skillName);

  // Check for path traversal attempts
  if (skillName.includes('..') || skillName.includes('/')) {
    throw new Error('Invalid skill name');
  }

  // Verify skill directory exists
  if (!existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  // Verify skill.md exists (valid skill)
  if (!existsSync(join(skillPath, 'skill.md'))) {
    throw new Error(`Invalid skill: ${skillName} (missing skill.md)`);
  }
}
```

---

## Error Handling

### Clear Error Messages

```typescript
// ✅ Good: Clear, actionable error messages
console.error('❌ Manifest validation failed:\n');
console.error('   • task.title: must be a string');
console.error('   • task.acceptanceCriteria: must have at least 1 item');
console.error('\nFix these errors in the manifest file and try again.');
console.error(`File: ${manifestPath}`);

// ❌ Bad: Cryptic error messages
console.error('Error: Validation failed');
```

### Exit Codes

```typescript
// Use appropriate exit codes
if (manifestNotFound) {
  process.exit(1);  // General error
}

if (invalidManifest) {
  process.exit(1);  // Validation error
}

if (serverUnreachable) {
  // Don't exit - continue offline
  console.warn('⚠️  Server unreachable, continuing offline');
}

if (skillNotFound) {
  // Don't exit - continue without skill
  console.warn('⚠️  Skill not found, continuing without it');
}
```

---

## Debug Mode

### Enabling Debug Output

```bash
export MAESTRO_DEBUG=true
maestro worker init
```

### Debug Output Example

```
🚀 Maestro Worker Initialization

[DEBUG] Environment variables:
  MAESTRO_MANIFEST_PATH: /Users/dev/.maestro/sessions/sess-123/manifest.json
  MAESTRO_SESSION_ID: sess-123
  MAESTRO_PROJECT_ID: proj-1
  MAESTRO_API_URL: http://localhost:3000
  MAESTRO_DEBUG: true

[DEBUG] Configuration merged:
  Priority: env > user > project > defaults
  apiUrl: http://localhost:3000 (from env)
  debug: true (from env)
  logFile: ~/.maestro/logs/maestro-cli.log (from defaults)

[DEBUG] Manifest loaded:
  {
    "manifestVersion": "1.0",
    "role": "worker",
    "task": { "id": "task-1", ... }
  }

[DEBUG] Skills to load: []

[DEBUG] System prompt generated (1,245 characters)

[DEBUG] Claude arguments:
  ['--model', 'sonnet', '--permission-mode', 'acceptEdits', '--append-system-prompt', '/tmp/prompt.md']

✅ Starting Claude...
```

---

## Summary

Configuration and validation ensure:
- ✅ Clear priority order (env > user > project > defaults)
- ✅ Fail-fast validation with helpful errors
- ✅ Security considerations for file access
- ✅ Easy testing with mock data
- ✅ Debug mode for troubleshooting

Next: See [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md) for command usage.
