# Maestro CLI Skills Support - Implementation Guide

## Quick Start

### For Users

```bash
# Create a skill in ~/.skills/
mkdir -p ~/.skills/my-skill
echo "# My Skill" > ~/.skills/my-skill/skill.md

# List available skills
maestro skill list

# Get skill info
maestro skill info my-skill

# Validate all skills
maestro skill validate

# Use skills in a manifest
{
  "manifestVersion": "1.0",
  "role": "worker",
  "task": { ... },
  "session": { ... },
  "skills": ["my-skill"]
}
```

### For Developers

## Architecture

### 1. Manifest Type
- Location: `src/types/manifest.ts`
- Field: `skills?: string[]`
- Optional, can be omitted or empty

### 2. Schema Validation
- Location: `src/schemas/manifest-schema.ts`
- Validates skills as array of strings
- Nullable, optional field

### 3. SkillLoader Service
- Location: `src/services/skill-loader.ts`
- Discovers skills in `~/.skills/`
- Methods:
  - `discover()`: List all skills
  - `load(skillNames)`: Load specific skills
  - `getSkillInfo(skillName)`: Get skill details

### 4. Claude Spawner Integration
- Location: `src/services/claude-spawner.ts`
- Updated `buildClaudeArgs()` to be async
- Loads skills and adds `--plugin-dir` for each
- Gracefully handles missing/invalid skills

### 5. CLI Commands
- Location: `src/commands/skill.ts`
- Commands:
  - `maestro skill list [--json]`
  - `maestro skill info <name> [--json]`
  - `maestro skill validate`

## API

### SkillLoader

```typescript
class SkillLoader {
  constructor(skillsDir?: string);

  async discover(): Promise<SkillInfo[]>
  async load(skillNames: string[]): Promise<SkillLoadResult>
  async getSkillInfo(skillName: string): Promise<SkillInfo | null>
}

interface SkillInfo {
  name: string;
  path: string;
  valid: boolean;
  description?: string;
}

interface SkillLoadResult {
  loaded: string[];    // Paths to successfully loaded skills
  missing: string[];   // Skill names not found
  invalid: string[];   // Skills without skill.md
}
```

### ClaudeSpawner

```typescript
class ClaudeSpawner {
  constructor(templatesDir?: string, skillLoader?: SkillLoader);

  // Now async
  async buildClaudeArgs(manifest: MaestroManifest): Promise<string[]>
}
```

## File Structure

```
maestro-cli/
├── src/
│   ├── types/
│   │   └── manifest.ts (modified: +skills field)
│   ├── schemas/
│   │   └── manifest-schema.ts (modified: +skills validation)
│   ├── services/
│   │   ├── skill-loader.ts (NEW)
│   │   └── claude-spawner.ts (modified: async buildClaudeArgs)
│   ├── commands/
│   │   └── skill.ts (NEW)
│   └── index.ts (modified: register skill commands)
└── tests/
    ├── services/
    │   ├── skill-loader.test.ts (NEW: 20 tests)
    │   └── claude-spawner.test.ts (modified: +7 async tests)
    ├── commands/
    │   └── skill.test.ts (NEW: 11 tests)
    ├── schemas/
    │   └── manifest-schema.test.ts (modified: +5 tests)
    └── fixtures/
        └── skills/
            ├── valid-skill/skill.md
            ├── invalid-skill/ (no skill.md)
            └── another-skill/skill.md
```

## Error Handling

All methods use graceful degradation:
- Returns empty arrays/null on errors
- No exceptions thrown
- Categorizes problems in result objects
- Missing skills don't fail session spawn

Example:
```typescript
// Load returns categorized results
const result = await loader.load(['skill-1', 'skill-2']);
// {
//   loaded: ['/home/user/.skills/skill-1'],
//   missing: [],
//   invalid: ['skill-2'] // no skill.md
// }
```

## Testing

All tests pass (176 total):
- 20 SkillLoader tests
- 11 CLI command tests
- 5 manifest schema tests
- 7 claude-spawner async tests
- Plus all existing tests still pass

Run tests:
```bash
npm test -- --run
```

## Implementation Notes

### Design Decisions
1. **Graceful Degradation**: Missing/invalid skills don't fail the session
2. **Additive Plugin Loading**: Skills are added alongside maestro plugin dir
3. **Optional Field**: Skills field is completely optional
4. **CLI-First**: All skill logic in CLI, server will call CLI commands
5. **Standard Location**: Skills default to `~/.skills/` (configurable)
6. **Result Objects**: Use result objects instead of exceptions

### Backward Compatibility
- Manifests without skills still work
- buildClaudeArgs async change is transparent to spawn()
- All existing tests pass

### Next Steps (Phase 2)
- Server endpoint: `/api/skills` to list skills
- Server calls: `maestro skill list --json`
- Task skill assignment through server API
