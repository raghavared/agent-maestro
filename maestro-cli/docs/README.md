# Maestro CLI - Documentation

Complete documentation for the Maestro CLI multi-agent task orchestration system.

## Quick Start

**New to Maestro CLI?** Start here:

1. **[00-README.md](spec/00-README.md)** - Overview and introduction
2. **[01-MANIFEST-SCHEMA.md](spec/01-MANIFEST-SCHEMA.md)** - Core manifest structure (multi-task model)
3. **[07-CLI-COMMANDS-REFERENCE.md](spec/07-CLI-COMMANDS-REFERENCE.md)** - Command reference
4. **[implementation/SPEC-REVIEW.md](implementation/SPEC-REVIEW.md)** - Architectural review and current state

## Documentation Structure

### 📋 Specification (`/spec/`)

Complete technical specification for Maestro CLI:

| Document | Description |
|----------|-------------|
| [00-README.md](spec/00-README.md) | System overview and introduction |
| [01-MANIFEST-SCHEMA.md](spec/01-MANIFEST-SCHEMA.md) | **Multi-task manifest structure** (CRITICAL) |
| [02-CLI-ARCHITECTURE.md](spec/02-CLI-ARCHITECTURE.md) | CLI architecture and design patterns |
| [03-SYSTEM-PROMPTS.md](spec/03-SYSTEM-PROMPTS.md) | Worker and orchestrator prompt templates |
| [04-STANDARD-SKILLS.md](spec/04-STANDARD-SKILLS.md) | Built-in skills for task management |
| [05-HOOKS-SYSTEM.md](spec/05-HOOKS-SYSTEM.md) | Event hooks and lifecycle management |
| [06-IMPLEMENTATION-SUMMARY.md](spec/06-IMPLEMENTATION-SUMMARY.md) | Implementation overview |
| [07-CLI-COMMANDS-REFERENCE.md](spec/07-CLI-COMMANDS-REFERENCE.md) | Complete CLI command reference |
| [08-SESSION-INITIALIZATION.md](spec/08-SESSION-INITIALIZATION.md) | Session lifecycle and initialization |
| [09-ARCHITECTURE-DIAGRAMS.md](spec/09-ARCHITECTURE-DIAGRAMS.md) | System architecture diagrams |
| [10-FUTURE-ENHANCEMENTS.md](spec/10-FUTURE-ENHANCEMENTS.md) | Planned features and enhancements |
| [11-CONFIGURATION-AND-VALIDATION.md](spec/11-CONFIGURATION-AND-VALIDATION.md) | Config validation and schemas |

### 🔍 Implementation Reviews (`/implementation/`)

Architectural reviews and implementation summaries:

- **[SPEC-REVIEW.md](implementation/SPEC-REVIEW.md)** - Comprehensive spec vs implementation analysis
- **[MULTI-TASK-UPDATE.md](implementation/MULTI-TASK-UPDATE.md)** - Multi-task model implementation summary
- **[archive/](implementation/archive/)** - Historical planning documents

### 🔌 Integration Guides

- **[HOOKS-INTEGRATION.md](HOOKS-INTEGRATION.md)** - Hooks system integration guide

## Key Architectural Concepts

### Multi-Task Model (PRIMARY)

Maestro CLI uses a **multi-task model** as the core architecture:

```typescript
interface MaestroManifest {
  manifestVersion: string;
  role: 'worker' | 'orchestrator';
  tasks: TaskData[];  // ALWAYS an array
  session: SessionConfig;
}
```

**Important:**
- **Multi-task is primary**: `tasks: TaskData[]` is always an array
- **Single-task is a special case**: Just `tasks: [oneTask]`
- **CLI accepts comma-separated IDs**: `--task-ids task-1,task-2,task-3`
- **Primary task**: First task in array (`tasks[0]`)

### Two-Role Architecture

**Worker** - Executes specific tasks:
- Reads task from manifest
- Spawns Claude Code with task-specific prompt
- Reports progress and completion
- Uses task management skills

**Orchestrator** - Coordinates workers:
- Manages overall project flow
- Spawns worker sessions
- Monitors progress across tasks
- Handles dependencies

### Manifest-Based Design

All sessions initialized from JSON manifests:
- Generated via `maestro manifest generate`
- Stored at `~/.maestro/sessions/{SESSION_ID}/manifest.json`
- Contains tasks, context, skills, and configuration
- Validated against JSON schema

### Template System

Role-specific prompts from markdown templates:
- `worker-prompt.md` - Worker system prompt
- `orchestrator-prompt.md` - Orchestrator system prompt
- Variable substitution from manifest data
- Multi-task support with `${ALL_TASKS}` variable

## Current Implementation Status

✅ **Complete and Synchronized**

- Spec documents updated to reflect multi-task model
- Code fully implements multi-task architecture
- Template system supports both single and multi-task sessions
- CLI commands accept comma-separated task IDs
- Validation and error handling in place

⏳ **Testing Recommended**

- Manual testing for single-task sessions
- Manual testing for multi-task sessions
- Unit tests for new multi-task features
- Integration tests for end-to-end workflows

See [MULTI-TASK-UPDATE.md](implementation/MULTI-TASK-UPDATE.md) for testing checklist.

## Migration Notes

**Old Format** (deprecated):
```json
{
  "task": {
    "id": "task-1",
    "title": "..."
  }
}
```

**New Format** (current):
```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "..."
    }
  ]
}
```

**Code Migration:**
```typescript
// Old (deprecated)
const task = manifest.task;

// New (current)
const primaryTask = manifest.tasks[0];
const allTasks = manifest.tasks;
```

## For Developers

### Understanding the System

1. Read [spec/00-README.md](spec/00-README.md) for overview
2. Review [implementation/SPEC-REVIEW.md](implementation/SPEC-REVIEW.md) for architecture
3. Study [spec/01-MANIFEST-SCHEMA.md](spec/01-MANIFEST-SCHEMA.md) for data structures
4. Check [spec/07-CLI-COMMANDS-REFERENCE.md](spec/07-CLI-COMMANDS-REFERENCE.md) for CLI usage

### Making Changes

1. **Update spec first** - Document the intended design
2. **Implement in code** - Follow spec precisely
3. **Update examples** - Show both single and multi-task cases
4. **Test thoroughly** - Verify both modes work
5. **Update review docs** - Note architectural changes

### Code Locations

- **CLI Commands**: `maestro-cli/src/commands/`
- **Services**: `maestro-cli/src/services/`
- **Templates**: `maestro-cli/templates/`
- **Types**: `maestro-cli/src/types/`
- **Tests**: `maestro-cli/tests/`

## Version History

- **v1.0** (2026-02-04) - Multi-task model as primary architecture
  - Updated all spec documents
  - Fixed code to use `tasks` array
  - Enhanced prompt generator for multi-task
  - Added comprehensive documentation

## Contributing

When contributing to Maestro CLI:

1. **Maintain spec-code synchronization** - Always update both
2. **Follow multi-task model** - Use `tasks` array everywhere
3. **Test both modes** - Single-task and multi-task sessions
4. **Update documentation** - Keep reviews current
5. **Follow architectural patterns** - Manifest-based, template-driven

## Questions?

- Check [implementation/SPEC-REVIEW.md](implementation/SPEC-REVIEW.md) for architectural details
- Review [spec/](spec/) for technical specifications
- See [implementation/MULTI-TASK-UPDATE.md](implementation/MULTI-TASK-UPDATE.md) for recent changes
