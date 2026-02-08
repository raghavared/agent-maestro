# Skills Specification

**Version:** 2.0.0
**Last Updated:** 2026-02-08
**Status:** Stable

## Overview

Skills are modular capabilities that can be assigned to Maestro sessions. Each skill consists of a manifest (metadata) and instructions (markdown documentation). Skills are loaded from the filesystem and can be assigned to worker, orchestrator, or all session types.

## Architecture

```
┌──────────────────────────────┐
│  ~/.agents-ui/               │
│  maestro-skills/             │
│                              │
│  ├── maestro-cli/            │
│  │   ├── manifest.json       │
│  │   └── skill.md            │
│  │                           │
│  ├── maestro-worker/         │
│  │   ├── manifest.json       │
│  │   └── skill.md            │
│  │                           │
│  ├── maestro-orchestrator/   │
│  │   ├── manifest.json       │
│  │   └── skill.md            │
│  │                           │
│  └── custom-skill/           │
│      ├── manifest.json       │
│      └── skill.md            │
└──────────────────────────────┘
          │
          │ loadSkill(name)
          ▼
┌──────────────────────────────┐
│  Skill Object                │
│  {                           │
│    manifest: {...},          │
│    instructions: "..."       │
│  }                           │
└──────────────────────────────┘
          │
          │ getSkillsForRole(role)
          ▼
┌──────────────────────────────┐
│  Skills Array for Role       │
│  [                           │
│    maestro-cli,              │
│    maestro-worker/           │
│    orchestrator              │
│  ]                           │
└──────────────────────────────┘
```

## Skills Directory Structure

### Base Directory

```
~/.agents-ui/maestro-skills/
```

**Full Path:**
- Linux/macOS: `/Users/{username}/.agents-ui/maestro-skills/`
- Windows: `C:\Users\{username}\.agents-ui\maestro-skills\`

### Skill Directory Structure

Each skill is a directory containing two files:

```
maestro-skills/
├── {skill-name}/
│   ├── manifest.json    # Required: Skill metadata
│   └── skill.md         # Required: Skill instructions
```

### Example Structure

```
~/.agents-ui/maestro-skills/
├── maestro-cli/
│   ├── manifest.json
│   └── skill.md
├── maestro-worker/
│   ├── manifest.json
│   └── skill.md
├── maestro-orchestrator/
│   ├── manifest.json
│   └── skill.md
└── custom-skill/
    ├── manifest.json
    └── skill.md
```

## Skill Manifest Format

### manifest.json Schema

```typescript
interface SkillManifest {
  name: string;                              // Required: Display name
  version: string;                           // Required: Semantic version
  description: string;                       // Required: Brief description
  type?: 'system' | 'role' | 'custom';      // Optional: Skill type (default: 'system')
  assignTo?: string[];                       // Optional: Roles (worker, orchestrator, all)
  capabilities?: string[];                   // Optional: Capability list
  dependencies?: string[];                   // Optional: Dependent skill names
  author?: string;                           // Optional: Skill author
  license?: string;                          // Optional: License identifier
  config?: Record<string, any>;              // Optional: Custom configuration
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable skill name |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `description` | string | Yes | Short description of skill purpose |
| `type` | enum | No | `system` (core), `role` (role-specific), or `custom` (user-created). Default: `system` |
| `assignTo` | string[] | No | Roles: `["worker"]`, `["orchestrator"]`, `["worker", "orchestrator"]`, or `["all"]` |
| `capabilities` | string[] | No | List of capabilities this skill provides |
| `dependencies` | string[] | No | Skill names this skill depends on |
| `author` | string | No | Author name or identifier |
| `license` | string | No | License identifier (e.g., "MIT") |
| `config` | object | No | Custom configuration data |

### Example Manifests

#### System Skill (maestro-cli)

```json
{
  "name": "Maestro CLI",
  "version": "1.0.0",
  "description": "Core CLI commands and capabilities for all Maestro sessions",
  "type": "system",
  "assignTo": ["all"],
  "capabilities": [
    "task-management",
    "session-tracking",
    "api-communication"
  ],
  "dependencies": []
}
```

#### Role Skill (maestro-worker)

```json
{
  "name": "Maestro Worker",
  "version": "1.0.0",
  "description": "Worker-specific capabilities for task execution",
  "type": "role",
  "assignTo": ["worker"],
  "capabilities": [
    "task-execution",
    "status-reporting",
    "subtask-creation"
  ],
  "dependencies": ["maestro-cli"],
  "config": {
    "maxConcurrentTasks": 1,
    "autoReportProgress": true
  }
}
```

#### Role Skill (maestro-orchestrator)

```json
{
  "name": "Maestro Orchestrator",
  "version": "1.0.0",
  "description": "Orchestrator-specific capabilities for task delegation",
  "type": "role",
  "assignTo": ["orchestrator"],
  "capabilities": [
    "task-planning",
    "worker-spawning",
    "progress-monitoring"
  ],
  "dependencies": ["maestro-cli"],
  "config": {
    "maxWorkers": 5,
    "parallelExecution": true
  }
}
```

## Skill Instructions File

### skill.md Format

The `skill.md` file contains markdown-formatted instructions that are injected into the LLM prompt. This file should provide:

1. **Overview** - What the skill enables
2. **Commands** - Available CLI commands
3. **Usage Examples** - Code examples and patterns
4. **Best Practices** - Guidelines for using the skill
5. **Error Handling** - Common errors and solutions

### Example skill.md

```markdown
# Maestro Worker Skill

## Overview

The Maestro Worker skill enables Claude to execute tasks assigned by orchestrators or users. Workers focus on completing individual tasks and reporting progress.

## Core Capabilities

### Task Execution

Workers receive task assignments with:
- Task ID and description
- Project context
- Acceptance criteria
- Available tools and resources

### Status Reporting

Report progress using:
```bash
maestro task update <task-id> --status <status>
```

Statuses:
- `in-progress` - Task is being worked on
- `completed` - Task is finished
- `blocked` - Task cannot proceed
- `failed` - Task encountered errors

### Subtask Creation

Break down complex tasks:
```bash
maestro task create --parent <parent-task-id> --title "Subtask title"
```

## Best Practices

1. Update task status immediately when starting work
2. Create subtasks for multi-step work
3. Report blockers as soon as identified
4. Mark tasks complete only when acceptance criteria met
5. Include evidence in completion messages

## Error Handling

### Task Not Found
If a task ID is invalid, verify with orchestrator:
```bash
maestro task get <task-id>
```

### Blocked Tasks
Report blockers with details:
```bash
maestro task update <task-id> --status blocked --message "Waiting for API credentials"
```
```

## API Endpoints

### GET /api/skills

Returns array of available skills with metadata.

**Request:**
```http
GET /api/skills HTTP/1.1
Host: localhost:3000
```

**Response:**
```json
[
  {
    "id": "maestro-cli",
    "name": "Maestro CLI",
    "description": "Core CLI commands and capabilities for all Maestro sessions",
    "type": "system",
    "version": "1.0.0"
  },
  {
    "id": "maestro-worker",
    "name": "Maestro Worker",
    "description": "Worker-specific capabilities for task execution",
    "type": "role",
    "version": "1.0.0"
  },
  {
    "id": "maestro-orchestrator",
    "name": "Maestro Orchestrator",
    "description": "Orchestrator-specific capabilities for task delegation",
    "type": "role",
    "version": "1.0.0"
  }
]
```

**Error Response:** Returns empty array `[]` if skills directory is missing or cannot be read (no error status).

---

### GET /api/skills/:id

Returns a single skill by ID, including its instructions content.

**Request:**
```http
GET /api/skills/maestro-worker HTTP/1.1
Host: localhost:3000
```

**Response (200):**
```json
{
  "id": "maestro-worker",
  "name": "Maestro Worker",
  "description": "Worker-specific capabilities for task execution",
  "type": "role",
  "version": "1.0.0",
  "instructions": "# Maestro Worker Skill\n\n## Overview\n..."
}
```

**Error Responses:**
- `404 NOT_FOUND` - Skill not found
- `500 INTERNAL_ERROR` - Failed to load skill

---

### GET /api/skills/role/:role

Returns skills appropriate for a specific role.

**Request:**
```http
GET /api/skills/role/worker HTTP/1.1
Host: localhost:3000
```

**Parameters:**
- `role` - Must be `"worker"` or `"orchestrator"`

**Response (200):**
```json
[
  {
    "id": "Maestro CLI",
    "name": "Maestro CLI",
    "description": "Core CLI commands and capabilities for all Maestro sessions",
    "type": "system",
    "version": "1.0.0"
  },
  {
    "id": "Maestro Worker",
    "name": "Maestro Worker",
    "description": "Worker-specific capabilities for task execution",
    "type": "role",
    "version": "1.0.0"
  }
]
```

**Error Responses:**
- `400 VALIDATION_ERROR` - Invalid role value
- `500 INTERNAL_ERROR` - Failed to load skills

---

### POST /api/skills/:id/reload

Reload a skill from disk (clears cache and reloads). Useful during development.

**Request:**
```http
POST /api/skills/maestro-worker/reload HTTP/1.1
Host: localhost:3000
```

**Response (200):**
```json
{
  "id": "maestro-worker",
  "name": "Maestro Worker",
  "description": "Worker-specific capabilities for task execution",
  "type": "role",
  "version": "1.0.0",
  "reloaded": true
}
```

**Error Responses:**
- `404 NOT_FOUND` - Skill not found
- `501 NOT_IMPLEMENTED` - Reload not supported by the skill loader
- `500 INTERNAL_ERROR` - Failed to reload skill

## Loading Skills

### ISkillLoader Interface

Skills are loaded via the `ISkillLoader` interface (domain layer), with a `FileSystemSkillLoader` implementation (infrastructure layer):

```typescript
interface ISkillLoader {
  load(skillName: string): Promise<Skill | null>;
  loadForRole(role: 'worker' | 'orchestrator'): Promise<Skill[]>;
  listAvailable(): Promise<string[]>;
  validateDependencies(skill: Skill): Promise<boolean>;
  reload?(skillName: string): Promise<Skill | null>;
  formatForPrompt?(skills: Skill[]): string;
}
```

### FileSystemSkillLoader

The `FileSystemSkillLoader` loads skills from disk with in-memory caching:

#### load(skillName)

Loads a single skill by name from the skills directory.

**Parameters:**
- `skillName` - The skill directory name (e.g., "maestro-cli")

**Returns:**
- `Skill` object with manifest and instructions
- `null` if skill not found or invalid

**Process:**
```
1. Check in-memory cache first
2. Build skill path: {SKILLS_DIR}/{skillName}
3. Check if directory exists
4. Read manifest.json
5. Parse manifest JSON
6. Read skill.md
7. Cache and return { manifest, instructions }
```

**Error Handling:**
- Directory not found → returns `null`
- Manifest not found → returns `null`
- Instructions not found → continues with empty instructions (warning)
- Parse error → throws `SkillLoadError`

#### listAvailable()

Lists all available skills in the skills directory.

**Returns:**
- Array of skill names (directory names)
- Empty array if skills directory not found

**Process:**
```
1. Check if {SKILLS_DIR} exists
2. Read directory contents
3. Filter for directories containing manifest.json
4. Sort alphabetically
5. Return skill names
```

#### reload(skillName)

Clears cached skill and reloads from disk. Useful during development.

**Returns:**
- Reloaded `Skill` object, or `null` if not found

## Skills for Roles

### loadForRole(role)

Gets all skills appropriate for a specific role via `ISkillLoader.loadForRole()`.

**Parameters:**
- `role` - `'worker'` or `'orchestrator'`

**Returns:**
- Array of Skill objects for the role

**Logic:**
```
1. Always include 'maestro-cli' (system skill for all roles)
2. Add role-specific skill:
   - role='worker' → add 'maestro-worker'
   - role='orchestrator' → add 'maestro-orchestrator'
3. Return skills array
```

**API Endpoint:** `GET /api/skills/role/:role`

## Skill Validation and Dependencies

### validateSkillDependencies(skill)

Validates that all required dependencies for a skill are available.

**Function Signature:**
```typescript
function validateSkillDependencies(skill: Skill): boolean
```

**Parameters:**
- `skill` - The skill to validate

**Returns:**
- `true` if all dependencies are available
- `false` if any dependencies are missing

**Process:**
```
1. Check if skill has dependencies
2. If no dependencies, return true
3. For each dependency:
   a. Try to load dependency skill
   b. If not found, log warning and return false
4. Return true if all dependencies found
```

**Implementation:**
```typescript
export function validateSkillDependencies(skill: Skill): boolean {
  if (!skill.manifest.dependencies || skill.manifest.dependencies.length === 0) {
    return true;
  }

  for (const dep of skill.manifest.dependencies) {
    const depSkill = loadSkill(dep);
    if (!depSkill) {
      console.warn(`Missing dependency: ${skill.manifest.name} requires ${dep}`);
      return false;
    }
  }

  return true;
}
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 117-131)

### Dependency Graph Example

```
maestro-worker
  └── depends on: maestro-cli

maestro-orchestrator
  └── depends on: maestro-cli

custom-skill
  ├── depends on: maestro-cli
  └── depends on: maestro-worker

maestro-cli
  └── depends on: (none)
```

## Formatting Skills for Prompts

### formatSkillsForPrompt(skills)

Formats skills into markdown for inclusion in LLM prompts.

**Function Signature:**
```typescript
function formatSkillsForPrompt(skills: Skill[]): string
```

**Parameters:**
- `skills` - Array of skills to format

**Returns:**
- Markdown string combining all skill instructions

**Format:**
```markdown
---
# Skill Name (vVersion)

Description text

[skill.md contents]

---
# Next Skill Name (vVersion)

Description text

[skill.md contents]
```

**Implementation:**
```typescript
export function formatSkillsForPrompt(skills: Skill[]): string {
  return skills
    .map(skill => {
      const header = `# ${skill.manifest.name} (v${skill.manifest.version})\n\n${skill.manifest.description}`;
      const content = skill.instructions ? `\n\n${skill.instructions}` : '';
      return `---\n${header}${content}`;
    })
    .join('\n\n');
}
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 84-92)

## Data Types

### TypeScript Interfaces

```typescript
// Skill manifest metadata (src/domain/services/ISkillLoader.ts)
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  type?: 'system' | 'role' | 'custom';
  assignTo?: string[];
  capabilities?: string[];
  dependencies?: string[];
  author?: string;
  license?: string;
  config?: Record<string, any>;
}

// Complete skill object
export interface Skill {
  manifest: SkillManifest;
  instructions: string;
}
```

**Location:** `src/domain/services/ISkillLoader.ts`

## Usage in Session Spawning

Skills are loaded and included when spawning sessions:

```typescript
// In POST /sessions/spawn endpoint
const skillsToUse = skills && Array.isArray(skills) ? skills : [];

// Create session with skills
const session = storage.createSession({
  projectId,
  taskIds,
  metadata: {
    skills: skillsToUse,
    role,
    // ...
  },
  // ...
});

// Generate manifest with skills
const result = await generateManifestViaCLI({
  role,
  projectId,
  taskIds,
  skills: skillsToUse,  // Passed to CLI
  sessionId: session.id,
  apiUrl
});

// Skills are included in manifest and loaded by CLI
```

## Error Handling

### Skills Directory Not Found

```typescript
if (!existsSync(SKILLS_DIR)) {
  console.warn(`Skills directory not found: ${SKILLS_DIR}`);
  return [];  // Return empty array, don't fail
}
```

### Skill Not Found

```typescript
const skill = loadSkill(skillName);
if (!skill) {
  console.warn(`Skill not found: ${skillName}`);
  // Continue without skill, don't fail
}
```

### Invalid Manifest

```typescript
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch (err) {
  console.error(`Failed to load skill ${skillName}:`, err);
  return null;  // Return null, let caller handle
}
```

### Missing Instructions

```typescript
if (!existsSync(instructionsPath)) {
  console.warn(`Instructions not found for skill: ${skillName}`);
  instructions = '';  // Continue with empty instructions
}
```

## Best Practices

### Skill Development

1. **Always include manifest.json** - Required for skill recognition
2. **Provide clear instructions** - skill.md should be comprehensive
3. **Declare dependencies** - List all required skills
4. **Use semantic versioning** - Follow semver for version field
5. **Test skills independently** - Verify skill loads correctly

### Skill Management

1. **Validate dependencies** - Check all deps before using skill
2. **Handle missing skills gracefully** - Don't fail entire session
3. **Log skill loading** - Provide visibility into skill resolution
4. **Keep skills focused** - One skill per capability area
5. **Document capabilities** - Clear capability list in manifest

### System Integration

1. **Default to core skills** - maestro-cli always included
2. **Role-appropriate skills** - Load skills matching session role
3. **Custom skill support** - Allow users to add custom skills
4. **Graceful degradation** - Continue if optional skills missing

## Related Specifications

- **[01-MANIFEST-SCHEMA.md](../maestro-cli/docs/spec/01-MANIFEST-SCHEMA.md)** - Manifest includes skills array
- **[06-CLI-INTEGRATION-SPECIFICATION.md](./06-CLI-INTEGRATION-SPECIFICATION.md)** - CLI receives skills parameter
- **[08-SESSION-SPAWNING-SPECIFICATION.md](./08-SESSION-SPAWNING-SPECIFICATION.md)** - Skills used in spawning

## Implementation Reference

**Domain Interface:**
- `src/domain/services/ISkillLoader.ts` - `ISkillLoader` interface, `SkillManifest`, `Skill` types

**Infrastructure Implementation:**
- `src/infrastructure/skills/FileSystemSkillLoader.ts` - Filesystem-based skill loader with caching

**API Routes:**
- `src/api/skillRoutes.ts` - REST endpoints for skill management

**Skills Directory (default):**
```typescript
const SKILLS_DIR = config.skillsDir;  // Default: ~/.agents-ui/maestro-skills
```

**ISkillLoader Methods:**
- `load(skillName)` - Load single skill
- `loadForRole(role)` - Get skills for role
- `listAvailable()` - List all skills
- `validateDependencies(skill)` - Validate deps
- `reload?(skillName)` - Reload from disk (optional)
- `formatForPrompt?(skills)` - Format for LLM (optional)
