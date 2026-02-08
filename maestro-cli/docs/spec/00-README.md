# Final Maestro CLI Documentation

## Overview

This directory contains the finalized architecture for the Maestro CLI - a robust, manifest-based orchestration system for Claude Code agents.

## Core Philosophy

**The Maestro CLI is a universal bridge between any orchestration system and Claude Code.**

- ✅ Works with any UI (web, desktop, CLI)
- ✅ Works with any server (REST, GraphQL, gRPC)
- ✅ Works standalone (just CLI + manifests)
- ✅ Simple, predictable, testable

## Key Architectural Decisions

### 1. Manifest-Based (Not Skill-Based)

**Old Approach**: Complex skill system with custom manifests, hooks, templates
**New Approach**: Simple JSON manifests with all task data

```
UI/Server generates manifest → CLI reads manifest → Spawns Claude with context
```

### 2. Worker/Orchestrator as System Prompts

Maestro Worker and Orchestrator are **not** custom skills. They are:
- System prompt templates in the CLI
- Behavioral instructions added to Claude's context
- Simple, version-controlled, maintainable

### 3. Standard Skills Only

The only "skills" in Maestro are standard Claude Code skills from `.skills/`:
- `code-visualizer`
- `frontend-design`
- `skill-creator`
- etc.

Users select these in the UI, and they're listed in the manifest.

### 4. Minimal Environment Variables

Only essential session tracking:
```bash
MAESTRO_MANIFEST_PATH=/path/to/manifest.json
MAESTRO_PROJECT_ID=proj-123
MAESTRO_SESSION_ID=sess-456
MAESTRO_API_URL=http://localhost:3000
```

All task data goes in the manifest.

### 5. Minimal Hooks

Hooks are not extensible. They're built into the CLI for:
- Reporting session start to server
- Reporting session end to server
- Basic progress tracking

That's it. Keep it simple.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Any Orchestration UI                   │
│              (Web UI, Desktop UI, CLI, etc.)             │
│                                                          │
│  1. User configures task                                │
│  2. Optionally selects standard skills                  │
│  3. Generates manifest.json                             │
│  4. Saves to ~/.maestro/sessions/{SESSION_ID}/          │
│  5. Spawns terminal with env vars                       │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ Spawns: maestro worker init
                        │ Env: MAESTRO_MANIFEST_PATH, etc.
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│                    Maestro CLI                           │
│                                                          │
│  maestro worker init:                                   │
│  1. Read manifest from MAESTRO_MANIFEST_PATH            │
│  2. Validate manifest structure                         │
│  3. Load worker system prompt template                  │
│  4. Inject task data into template                      │
│  5. Discover and load standard skills from manifest     │
│  6. Execute SessionStart hook (report to server)        │
│  7. Spawn Claude Code with:                             │
│     - Generated system prompt                           │
│     - Standard skill plugin directories                 │
│     - Maestro CLI commands available                    │
│  8. Monitor Claude process                              │
│  9. Execute SessionEnd hook (report to server)          │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ HTTP API calls
                        │ POST /api/sessions
                        │ PATCH /api/tasks
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│                    Maestro Server                        │
│                  (Optional Component)                    │
│                                                          │
│  • CRUD for tasks, sessions, subtasks                   │
│  • WebSocket broadcasting                               │
│  • Data persistence                                     │
└──────────────────────────────────────────────────────────┘
```

## Documentation Structure

### Core Documentation

1. **[01-MANIFEST-SCHEMA.md](./01-MANIFEST-SCHEMA.md)** ✅
   - Complete manifest specification with TypeScript types
   - Example manifests (minimal and complete)
   - Validation rules and schema definition
   - Manifest generation and evolution

2. **[02-CLI-ARCHITECTURE.md](./02-CLI-ARCHITECTURE.md)** ✅
   - CLI internal architecture and components
   - Directory structure and data flow
   - Core services implementation
   - Command implementation patterns

3. **[03-SYSTEM-PROMPTS.md](./03-SYSTEM-PROMPTS.md)** ✅
   - Redirects to actual template files (source of truth)
   - Template variable reference
   - Template selection by role/strategy

4. **[04-STANDARD-SKILLS.md](./04-STANDARD-SKILLS.md)** ✅
   - Standard skills integration from `~/.skills/`
   - Skill discovery and loading mechanism
   - UI integration for skill selection
   - Error handling and graceful degradation

5. **[05-HOOKS-SYSTEM.md](./05-HOOKS-SYSTEM.md)** ✅
   - Minimal hook system (SessionStart, SessionEnd)
   - Server integration and reporting
   - Offline mode support
   - Implementation details

6. **[06-IMPLEMENTATION-SUMMARY.md](./06-IMPLEMENTATION-SUMMARY.md)** ✅
   - Quick reference guide for developers
   - Implementation checklist with phases
   - Testing strategy and success criteria
   - Migration guide from old architecture

7. **[07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md)** ✅ **NEW**
   - Complete reference for all CLI commands
   - Arguments, options, and examples
   - API endpoints for each command
   - Exit codes and error handling
   - JSON output formats

8. **[08-SESSION-INITIALIZATION.md](./08-SESSION-INITIALIZATION.md)** ✅ **NEW**
   - Session initialization sequence
   - Session brief display format
   - Initial commands execution
   - Error handling during init
   - Worker vs Orchestrator differences

9. **[09-ARCHITECTURE-DIAGRAMS.md](./09-ARCHITECTURE-DIAGRAMS.md)** ✅ **NEW**
   - Complete system architecture diagrams
   - Data flow visualizations
   - Responsibility matrix
   - File system layout
   - Communication patterns

10. **[10-FUTURE-ENHANCEMENTS.md](./10-FUTURE-ENHANCEMENTS.md)** ✅ **NEW**
    - Planned features for future versions
    - Custom init scripts per skill
    - Session recovery
    - CI/CD integration
    - Task templates and more

11. **[11-CONFIGURATION-AND-VALIDATION.md](./11-CONFIGURATION-AND-VALIDATION.md)** ✅
    - Configuration priority order
    - Environment variables
    - User and project configuration files
    - Manifest validation
    - Testing strategies
    - Security considerations

12. **[12-COMMAND-PERMISSIONS.md](./12-COMMAND-PERMISSIONS.md)** ✅ **NEW**
    - Command permissions system overview
    - Role and strategy-based permissions
    - Default command sets for each role/strategy
    - Explicit command overrides
    - Checking and discovering permissions
    - Implementation details

## Design Principles

### 1. Universal Compatibility

The CLI must work with ANY orchestration system:
- Custom web UIs
- Desktop applications
- Other CLIs
- CI/CD pipelines
- Standalone scripts

**How**: Standard interface (manifests + env vars)

### 2. Zero Magic

Everything is explicit:
- No auto-discovery of tasks
- No implicit configuration
- No hidden state
- Everything in manifest or env vars

### 3. Fail-Fast Validation

Validate everything early:
- Manifest structure
- Required env vars
- Skill availability
- Server connectivity

Better to fail before spawning Claude than during execution.

### 4. Testability First

Every component must be testable in isolation:
- Manifest reader
- Prompt generator
- Skill loader
- Hook executor
- Claude spawner

### 5. Progressive Enhancement

Core functionality works with zero external dependencies:
- No server? CLI still works (just no progress reporting)
- No standard skills? CLI still works (just base Claude)
- No hooks? CLI still works (just spawns Claude)

## Implementation Phases

### Phase 1: Core Manifest System (Week 1)
- [ ] Define manifest schema
- [ ] Implement manifest validator
- [ ] Create TypeScript types
- [ ] Write unit tests

### Phase 2: System Prompt Templates (Week 1)
- [ ] Write worker system prompt template
- [ ] Write orchestrator system prompt template
- [ ] Implement template variable injection
- [ ] Test prompt generation

### Phase 3: Standard Skills Integration (Week 2)
- [ ] Implement skill discovery
- [ ] Implement skill loader
- [ ] Test with standard skills
- [ ] Handle missing skills gracefully

### Phase 4: CLI Commands (Week 2)
- [ ] Implement `maestro worker init`
- [ ] Implement `maestro orchestrator init`
- [ ] Implement `maestro whoami`
- [ ] Implement task/subtask commands
- [ ] Implement context commands

### Phase 5: Minimal Hooks (Week 3)
- [ ] Implement SessionStart hook
- [ ] Implement SessionEnd hook
- [ ] Add server integration
- [ ] Handle offline mode

### Phase 6: Testing & Documentation (Week 3)
- [ ] Write integration tests
- [ ] Write end-to-end tests
- [ ] Create usage examples
- [ ] Write migration guide

## Success Criteria

The Maestro CLI is successful when:

1. ✅ Any UI can generate a manifest and spawn a worker
2. ✅ CLI works completely offline (no server needed)
3. ✅ CLI integrates with any server (REST, GraphQL, etc.)
4. ✅ Standard skills work seamlessly
5. ✅ System prompts are maintainable and version-controlled
6. ✅ Error messages are clear and actionable
7. ✅ 100% test coverage on core components
8. ✅ Documentation is complete and clear

## Getting Started

1. Read [01-MANIFEST-SCHEMA.md](./01-MANIFEST-SCHEMA.md) to understand the manifest structure
2. Read [02-CLI-ARCHITECTURE.md](./02-CLI-ARCHITECTURE.md) to understand how the CLI works
3. Read [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md) for all available commands

## Quick Example

```bash
# 1. Create a manifest
cat > ~/.maestro/sessions/sess-123/manifest.json << 'EOF'
{
  "manifestVersion": "1.0",
  "role": "worker",
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement user authentication",
      "description": "Add JWT-based authentication",
      "acceptanceCriteria": ["Users can login"],
      "projectId": "proj-1",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "skills": [],
  "session": {
    "model": "sonnet",
    "permissionMode": "acceptEdits"
  }
}
EOF

# 2. Set environment variables
export MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess-123/manifest.json
export MAESTRO_PROJECT_ID=proj-1
export MAESTRO_SESSION_ID=sess-123
export MAESTRO_API_URL=http://localhost:3000

# 3. Initialize worker
maestro worker init

# Claude Code session starts with:
# - Maestro Worker system prompt with task context
# - Maestro CLI commands available
# - Progress reported to server
```

## Questions?

For command reference, see [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md)

For session initialization details, see [08-SESSION-INITIALIZATION.md](./08-SESSION-INITIALIZATION.md)

For architecture diagrams, see [09-ARCHITECTURE-DIAGRAMS.md](./09-ARCHITECTURE-DIAGRAMS.md)

---

## Final Architectural Decisions

### ✅ Confirmed Decisions (Feb 2, 2026)

1. **Task Data Passing**: Manifest file path approach
   - `MAESTRO_MANIFEST_PATH` points to manifest JSON file
   - Location: `~/.maestro/sessions/{SESSION_ID}/manifest.json`
   - Cleaner, supports larger data, versionable
   - No JSON in environment variables

2. **Prompt Generation**: CLI-side only
   - CLI generates prompts from local templates
   - Templates in `maestro-cli/templates/`
   - No server involvement in prompt generation
   - Works offline, faster, no server dependency
   - Future: Support for dynamic templates

3. **Skills System**: Standard skills only
   - Skills from `~/.skills/` directory (standard Claude Code skills)
   - No custom "Maestro skills" concept
   - Listed in `manifest.skills[]` array
   - Examples: `code-visualizer`, `frontend-design`, `skill-creator`

4. **CLI Commands**: Complete reference provided
   - All commands documented in [07-CLI-COMMANDS-REFERENCE.md](./07-CLI-COMMANDS-REFERENCE.md)
   - Includes: task, session, report, queue, status, whoami, commands
   - API endpoints specified for each command
   - Exit codes and error handling documented

5. **Session Initialization**: Brief + Initial Commands
   - CLI displays formatted session brief before spawning Claude
   - Auto-executes initial commands (`maestro whoami`, `maestro task start`)
   - Detailed in [08-SESSION-INITIALIZATION.md](./08-SESSION-INITIALIZATION.md)

6. **Orchestrator Spawning**: Manifest-based
   - `maestro session spawn` creates manifest for worker
   - Orchestrator workflows to be detailed in Phase 2
   - Basic implementation documented

7. **Global Options**: Essential only
   - `--json` for machine-readable output
   - `--debug` for troubleshooting
   - Not a priority unless impacts agent capabilities

8. **Environment Variables**: Minimal set
   ```bash
   MAESTRO_MANIFEST_PATH    # Required: Path to manifest
   MAESTRO_PROJECT_ID       # Required: Project identifier
   MAESTRO_SESSION_ID       # Required: Session identifier
   MAESTRO_API_URL          # Optional: Server URL (default: http://localhost:3000)
   ```

### 📋 Documentation Status

- ✅ **Complete**: Core architecture and specifications
- ✅ **Complete**: CLI commands reference
- ✅ **Complete**: Session initialization flow
- ✅ **Complete**: Manifest schema and examples
- ✅ **Complete**: System prompt templates
- ✅ **Complete**: Standard skills integration
- ✅ **Complete**: Minimal hooks system
- ⏳ **Future**: Advanced orchestrator workflows
- ⏳ **Future**: Dynamic template system
- ⏳ **Future**: Extended configuration options

---

**Last Updated**: 2026-02-06
**Status**: ✅ Updated - Report commands migration complete
**Version**: 1.0.0
**Implementation Plan**: See `../IMPLEMENTATION-PLAN.md`
**Clarifications**: See `../CLARIFICATIONS-SUMMARY.md`
