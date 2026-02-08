# Skills Specification

**Version:** 1.0.0
**Last Updated:** 2026-02-04
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
  name: string;                    // Required: Display name
  version: string;                 // Required: Semantic version
  description: string;             // Required: Brief description
  type: 'system' | 'role';         // Required: Skill type
  assignTo: string[];              // Required: Roles (worker, orchestrator, all)
  capabilities: string[];          // Required: Capability list
  dependencies: string[];          // Required: Dependent skill names (can be empty)
  config?: Record<string, any>;    // Optional: Custom configuration
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable skill name |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `description` | string | Yes | Short description of skill purpose |
| `type` | enum | Yes | `system` (core) or `role` (role-specific) |
| `assignTo` | string[] | Yes | Roles: `["worker"]`, `["orchestrator"]`, `["worker", "orchestrator"]`, or `["all"]` |
| `capabilities` | string[] | Yes | List of capabilities this skill provides |
| `dependencies` | string[] | Yes | Skill names this skill depends on (empty array if none) |
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

**Endpoint:** `GET /api/skills`

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

**Error Response:**
```json
[]
```
(Returns empty array if skills directory is missing or cannot be read)

**Implementation:**
```typescript
router.get('/skills', (req: Request, res: Response) => {
  try {
    const skillIds = listAvailableSkills();
    const skills = [];

    for (const id of skillIds) {
      try {
        const skill = loadSkill(id);
        if (skill && skill.manifest) {
          skills.push({
            id,
            name: skill.manifest.name || id,
            description: skill.manifest.description || '',
            type: skill.manifest.type || 'system',
            version: skill.manifest.version || '1.0.0',
          });
        }
      } catch (err) {
        console.warn(`[Skills API] Failed to load skill ${id}:`, err);
      }
    }

    res.json(skills);
  } catch (err) {
    console.error('[Skills API] Failed to list skills:', err);
    res.json([]);
  }
});
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/skills.ts` (lines 1-46)

## Loading Skills from Filesystem

### loadSkill(skillName)

Loads a single skill by name from the skills directory.

**Function Signature:**
```typescript
function loadSkill(skillName: string): Skill | null
```

**Parameters:**
- `skillName` - The skill directory name (e.g., "maestro-cli")

**Returns:**
- `Skill` object with manifest and instructions
- `null` if skill not found or invalid

**Process:**
```
1. Build skill path: ~/.agents-ui/maestro-skills/{skillName}
2. Check if directory exists
3. Read manifest.json
4. Parse manifest JSON
5. Read skill.md
6. Return { manifest, instructions }
```

**Error Handling:**
```typescript
// Directory not found
if (!existsSync(skillPath)) {
  console.warn(`Skill not found: ${skillName} (looked in ${skillPath})`);
  return null;
}

// Manifest not found
if (!existsSync(manifestPath)) {
  console.warn(`Manifest not found for skill: ${skillName}`);
  return null;
}

// Instructions not found (warning, not fatal)
if (!existsSync(instructionsPath)) {
  console.warn(`Instructions not found for skill: ${skillName}`);
  instructions = '';  // Continue with empty instructions
}

// Parse error
catch (err) {
  console.error(`Failed to load skill ${skillName}:`, err);
  return null;
}
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 26-57)

### listAvailableSkills()

Lists all available skills in the skills directory.

**Function Signature:**
```typescript
function listAvailableSkills(): string[]
```

**Returns:**
- Array of skill names (directory names)
- Empty array if skills directory not found

**Process:**
```
1. Check if ~/.agents-ui/maestro-skills/ exists
2. Read directory contents
3. Filter for directories containing manifest.json
4. Sort alphabetically
5. Return skill names
```

**Implementation:**
```typescript
export function listAvailableSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) {
    console.warn(`Skills directory not found: ${SKILLS_DIR}`);
    return [];
  }

  try {
    const { readdirSync } = require('fs');
    return readdirSync(SKILLS_DIR)
      .filter((f: string) => existsSync(join(SKILLS_DIR, f, 'manifest.json')))
      .sort();
  } catch (err) {
    console.error('Failed to list skills:', err);
    return [];
  }
}
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 97-112)

## Skills for Roles

### getSkillsForRole(role)

Gets all skills appropriate for a specific role.

**Function Signature:**
```typescript
function getSkillsForRole(role: 'worker' | 'orchestrator' | 'all'): Skill[]
```

**Parameters:**
- `role` - The session role type

**Returns:**
- Array of Skill objects for the role

**Logic:**
```
1. Always include 'maestro-cli' (system skill for all roles)
2. Add role-specific skill:
   - role='worker' → add 'maestro-worker'
   - role='orchestrator' → add 'maestro-orchestrator'
   - role='all' → add both
3. Return skills array
```

**Implementation:**
```typescript
export function getSkillsForRole(role: 'worker' | 'orchestrator' | 'all'): Skill[] {
  const skills: Skill[] = [];

  // All sessions get maestro-cli
  const cliSkill = loadSkill('maestro-cli');
  if (cliSkill) skills.push(cliSkill);

  // Add role-specific skill
  if (role === 'worker') {
    const workerSkill = loadSkill('maestro-worker');
    if (workerSkill) skills.push(workerSkill);
  } else if (role === 'orchestrator') {
    const orchestratorSkill = loadSkill('maestro-orchestrator');
    if (orchestratorSkill) skills.push(orchestratorSkill);
  }

  return skills;
}
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 62-79)

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
// Skill manifest metadata
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  type: 'system' | 'role';
  assignTo: string[];
  capabilities: string[];
  dependencies: string[];
  config?: Record<string, any>;
}

// Complete skill object
export interface Skill {
  manifest: SkillManifest;
  instructions: string;
}
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 7-21)

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

**Primary Implementation:**
- File: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/skills.ts` (lines 1-132)
- API: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/skills.ts` (lines 1-46)

**Constants:**
```typescript
const SKILLS_DIR = join(homedir(), '.agents-ui', 'maestro-skills');
```

**Exports:**
- `loadSkill(skillName)` - Load single skill
- `listAvailableSkills()` - List all skills
- `getSkillsForRole(role)` - Get skills for role
- `formatSkillsForPrompt(skills)` - Format for LLM
- `validateSkillDependencies(skill)` - Validate deps
