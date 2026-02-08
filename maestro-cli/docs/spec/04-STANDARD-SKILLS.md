# Standard Skills Integration

## Overview

Maestro CLI supports loading standard Claude Code skills from the `.skills/` directory. These skills are:

- **Standard Claude Code plugins** (not Maestro-specific)
- **Optional** - selected by users in the UI
- **Listed in the manifest** - under `manifest.skills[]`
- **Loaded at session start** - passed to Claude as `--plugin-dir` arguments

## What Are Standard Skills?

Standard skills are Claude Code plugins that follow the [skill development guide](https://github.com/anthropics/claude-code/docs/skills.md). They are stored in:

```
~/.skills/
├── code-visualizer/
│   └── skill.md
├── frontend-design/
│   └── skill.md
├── skill-creator/
│   └── skill.md
└── custom-skill/
    └── skill.md
```

These skills:
- Provide specialized knowledge or capabilities
- Are self-contained and portable
- Work with any Claude Code session
- Can be selected per-session in Maestro

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Maestro UI                           │
│                                                      │
│  User selects skills:                               │
│  ☑ code-visualizer                                  │
│  ☐ frontend-design                                  │
│  ☐ skill-creator                                    │
│                                                      │
│  Adds to manifest:                                  │
│  "skills": ["code-visualizer"]                      │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│              Maestro CLI                             │
│                                                      │
│  1. Reads manifest.skills                           │
│  2. For each skill:                                 │
│     - Find in ~/.skills/{skill-name}/               │
│     - Validate skill.md exists                      │
│     - Get full path                                 │
│  3. Pass to Claude:                                 │
│     --plugin-dir ~/.skills/code-visualizer          │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│               Claude Code                            │
│                                                      │
│  Session runs with:                                 │
│  • Maestro Worker system prompt                     │
│  • Maestro CLI commands                             │
│  • code-visualizer skill                            │
└──────────────────────────────────────────────────────┘
```

## Skill Discovery

### CLI Implementation

```typescript
// src/services/skill-loader.ts

import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export class SkillLoader {
  private skillsDir = join(homedir(), '.skills');

  /**
   * Discover all available skills in ~/.skills/
   */
  async discover(): Promise<SkillInfo[]> {
    if (!existsSync(this.skillsDir)) {
      return [];
    }

    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    const skills: SkillInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = join(this.skillsDir, entry.name);
      const skillFile = join(skillPath, 'skill.md');

      if (existsSync(skillFile)) {
        skills.push({
          name: entry.name,
          path: skillPath,
          valid: true
        });
      }
    }

    return skills;
  }

  /**
   * Load specified skills and return their paths
   */
  async load(skillNames: string[]): Promise<SkillLoadResult> {
    const loaded: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const skillName of skillNames) {
      const skillPath = join(this.skillsDir, skillName);

      // Check if skill directory exists
      if (!existsSync(skillPath)) {
        missing.push(skillName);
        continue;
      }

      // Validate skill.md exists
      const skillFile = join(skillPath, 'skill.md');
      if (!existsSync(skillFile)) {
        invalid.push(skillName);
        continue;
      }

      loaded.push(skillPath);
    }

    return { loaded, missing, invalid };
  }

  /**
   * Get metadata for a specific skill
   */
  async getSkillInfo(skillName: string): Promise<SkillInfo | null> {
    const skillPath = join(this.skillsDir, skillName);
    const skillFile = join(skillPath, 'skill.md');

    if (!existsSync(skillFile)) {
      return null;
    }

    // Could parse skill.md for metadata here
    return {
      name: skillName,
      path: skillPath,
      valid: true
    };
  }
}

interface SkillInfo {
  name: string;
  path: string;
  valid: boolean;
  description?: string;
  version?: string;
}

interface SkillLoadResult {
  loaded: string[];    // Successfully loaded skill paths
  missing: string[];   // Skills not found
  invalid: string[];   // Invalid skill directories
}
```

## Manifest Integration

### Specifying Skills in Manifest

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "task": { /* ... */ },
  "skills": [
    "code-visualizer",
    "frontend-design"
  ],
  "session": { /* ... */ }
}
```

### Empty Skills (No Skills)

```json
{
  "manifestVersion": "1.0",
  "role": "worker",
  "task": { /* ... */ },
  "skills": [],  // or omit this field entirely
  "session": { /* ... */ }
}
```

## Loading Process

### Worker Init with Skills

```typescript
// src/commands/worker.ts

export async function workerInit() {
  // ... read manifest ...

  // Load skills if specified
  let skillPaths: string[] = [];

  if (manifest.skills && manifest.skills.length > 0) {
    console.log(`🔌 Loading ${manifest.skills.length} skill(s)...`);

    const skillLoader = new SkillLoader();
    const result = await skillLoader.load(manifest.skills);

    // Report results
    if (result.loaded.length > 0) {
      console.log(`✅ Loaded: ${result.loaded.length} skill(s)`);
      result.loaded.forEach(path => {
        const name = path.split('/').pop();
        console.log(`   • ${name}`);
      });
    }

    if (result.missing.length > 0) {
      console.warn(`⚠️  Not found: ${result.missing.join(', ')}`);
    }

    if (result.invalid.length > 0) {
      console.warn(`⚠️  Invalid: ${result.invalid.join(', ')}`);
    }

    skillPaths = result.loaded;
    console.log('');
  }

  // Spawn Claude with skill paths
  await spawner.spawn({
    // ... other config ...
    skillPaths
  });
}
```

### Claude Spawning with Skills

```typescript
// src/services/claude-spawner.ts

export class ClaudeSpawner {
  async spawn(config: SpawnConfig): Promise<ChildProcess> {
    const args = [
      '--model', config.model,
      '--permission-mode', config.permissionMode,
      '--append-system-prompt', promptFile
    ];

    // Add each skill as a plugin directory
    for (const skillPath of config.skillPaths) {
      args.push('--plugin-dir', skillPath);
    }

    // Spawn Claude
    const process = spawn('claude', args, {
      cwd: config.workingDirectory || process.cwd(),
      stdio: 'inherit',
      env: process.env
    });

    return process;
  }
}
```

## Error Handling

### Missing Skills

```typescript
// If skill is not found
const result = await skillLoader.load(['nonexistent-skill']);

// Result:
{
  loaded: [],
  missing: ['nonexistent-skill'],
  invalid: []
}

// CLI output:
⚠️  Not found: nonexistent-skill
ℹ️  Available skills: code-visualizer, frontend-design
ℹ️  Continuing without this skill...
```

### Invalid Skills

```typescript
// If skill directory exists but skill.md is missing
const result = await skillLoader.load(['broken-skill']);

// Result:
{
  loaded: [],
  missing: [],
  invalid: ['broken-skill']
}

// CLI output:
⚠️  Invalid skill directory: broken-skill (missing skill.md)
ℹ️  Continuing without this skill...
```

### Graceful Degradation

Skills are **optional**. If a skill fails to load:
- ✅ Warn the user
- ✅ Continue with other skills
- ✅ Spawn Claude without the failed skill
- ❌ Don't fail the entire session

```typescript
// Robust skill loading
async function loadSkillsRobustly(skillNames: string[]): Promise<string[]> {
  const skillLoader = new SkillLoader();
  const result = await skillLoader.load(skillNames);

  // Warn about problems but don't fail
  if (result.missing.length > 0) {
    console.warn(`⚠️  Skills not found: ${result.missing.join(', ')}`);
    console.warn('ℹ️  Install missing skills or remove from manifest');
  }

  if (result.invalid.length > 0) {
    console.warn(`⚠️  Invalid skills: ${result.invalid.join(', ')}`);
  }

  // Return only successfully loaded skills
  return result.loaded;
}
```

## UI Integration

### Skill Selection in UI

```typescript
// UI component for skill selection

interface SkillSelectorProps {
  availableSkills: SkillInfo[];
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
}

function SkillSelector({ availableSkills, selectedSkills, onChange }: SkillSelectorProps) {
  return (
    <div>
      <h3>Select Skills (Optional)</h3>
      <p>Choose specialized skills for this task</p>

      {availableSkills.map(skill => (
        <label key={skill.name}>
          <input
            type="checkbox"
            checked={selectedSkills.includes(skill.name)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...selectedSkills, skill.name]);
              } else {
                onChange(selectedSkills.filter(s => s !== skill.name));
              }
            }}
          />
          {skill.name}
          {skill.description && <span className="description">{skill.description}</span>}
        </label>
      ))}
    </div>
  );
}
```

### Discovering Available Skills

```typescript
// UI fetches available skills for selection

async function getAvailableSkills(): Promise<SkillInfo[]> {
  // Option 1: Call Maestro CLI
  const result = await exec('maestro skill list --json');
  return JSON.parse(result.stdout);

  // Option 2: Scan directory directly (if UI has filesystem access)
  const skillsDir = join(homedir(), '.skills');
  const entries = await readdir(skillsDir, { withFileTypes: true });

  return entries
    .filter(e => e.isDirectory())
    .map(e => ({
      name: e.name,
      path: join(skillsDir, e.name),
      valid: existsSync(join(skillsDir, e.name, 'skill.md'))
    }));
}
```

### Generating Manifest with Skills

```typescript
// UI generates manifest with selected skills

function generateWorkerManifest(
  task: Task,
  options: SpawnOptions
): MaestroManifest {
  return {
    manifestVersion: "1.0",
    role: "worker",
    task: task,
    skills: options.selectedSkills || [],  // ← User's selection
    session: {
      model: options.model || "sonnet",
      permissionMode: options.permissionMode || "acceptEdits"
    }
  };
}
```

## CLI Commands for Skills

### List Available Skills

```bash
# List all available skills
$ maestro skill list

Available skills:
  • code-visualizer (Auto-generates code flow diagrams)
  • frontend-design (Create distinctive frontend interfaces)
  • skill-creator (Guide for creating effective skills)
  • hook-development (Create and implement Claude Code hooks)

# JSON output for programmatic use
$ maestro skill list --json
[
  {"name":"code-visualizer","path":"~/.skills/code-visualizer","valid":true},
  {"name":"frontend-design","path":"~/.skills/frontend-design","valid":true}
]
```

### Get Skill Info

```bash
# Get details about a specific skill
$ maestro skill info code-visualizer

Skill: code-visualizer
Path: /Users/username/.skills/code-visualizer
Valid: Yes
Description: Auto-generates code flow diagrams from Python module analysis
```

### Validate Skills

```bash
# Validate all skills
$ maestro skill validate

Validating skills in ~/.skills/...

✅ code-visualizer (valid)
✅ frontend-design (valid)
⚠️  broken-skill (missing skill.md)
❌ invalid-skill (not a directory)

Summary: 2 valid, 1 warning, 1 error
```

## Common Skills for Maestro

### Recommended Skills

**For Backend Tasks**:
- Standard Claude Code tools (no special skills needed)

**For Frontend Tasks**:
- `frontend-design` - Creates polished UI components

**For Complex Projects**:
- `code-visualizer` - Generates architecture diagrams

**For Skill Development**:
- `skill-creator` - Guide for creating new skills
- `hook-development` - Create Claude Code hooks

### Skill Recommendations in UI

```typescript
// UI can recommend skills based on task type

function recommendSkills(task: Task): string[] {
  const recommendations: string[] = [];

  // Frontend tasks
  if (task.tags?.includes('frontend') ||
      task.description.toLowerCase().includes('ui')) {
    recommendations.push('frontend-design');
  }

  // Architecture tasks
  if (task.complexity === 'high' ||
      task.description.toLowerCase().includes('architecture')) {
    recommendations.push('code-visualizer');
  }

  return recommendations;
}
```

## Best Practices

### 1. Use Skills Sparingly

Only include skills that are actually needed:

✅ **Good**:
```json
// Frontend task with design skill
"skills": ["frontend-design"]
```

❌ **Bad**:
```json
// Backend API task with frontend skill
"skills": ["frontend-design"]  // Not relevant!
```

### 2. Test Skills Beforehand

Ensure skills work before using them in production:

```bash
# Test a skill manually
claude --plugin-dir ~/.skills/code-visualizer

# In Claude:
> Use the code-visualizer skill to...
```

### 3. Document Skill Usage

In task technical notes, mention if a skill should be used:

```json
{
  "task": {
    "title": "Redesign landing page",
    "technicalNotes": "Use frontend-design skill for high-quality UI design",
    // ...
  },
  "skills": ["frontend-design"]
}
```

### 4. Handle Missing Skills Gracefully

Don't make skills a hard requirement:

```typescript
// ✅ Good - warn but continue
if (skillNotFound) {
  console.warn('Skill not found, continuing without it');
}

// ❌ Bad - fail completely
if (skillNotFound) {
  throw new Error('Cannot continue without skill');
}
```

## Summary

Standard skills integration:
- ✅ Optional skills from `~/.skills/`
- ✅ Selected by users in UI
- ✅ Listed in manifest
- ✅ Gracefully handle missing skills
- ✅ Pass to Claude as `--plugin-dir`

Next: [05-HOOKS-SYSTEM.md](./05-HOOKS-SYSTEM.md) - Minimal hooks for server integration
