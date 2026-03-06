# Building Custom Workflows

**Maestro's power comes from combining its primitives — tasks, teams, skills, and orchestrators — into workflows that automate complex, multi-step processes.**

---

## The Building Blocks

Every custom workflow is a composition of four things:

| Primitive | Role |
|-----------|------|
| **Tasks** | Define *what* needs to be done (with acceptance criteria) |
| **Team Members** | Define *who* does it (identity, skills, memory, permissions) |
| **Skills** | Define *how* they do it (injected instructions and capabilities) |
| **Orchestrators** | Define *coordination* (decomposition, spawning, monitoring) |

The art is in how you combine them.

## Workflow Templates

Maestro ships with five built-in workflow templates that define the execution algorithm:

### Worker Templates

| Template | Algorithm |
|----------|-----------|
| `execute-simple` | Read task → implement directly → report → complete. No decomposition. |
| `execute-tree` | Discover subtask tree → determine dependency order → execute sequentially → report. |

### Orchestrator Templates

| Template | Algorithm |
|----------|-----------|
| `coordinate-default` | Analyze → create subtasks → spawn one worker per subtask → monitor → verify → complete. |
| `coordinate-batching` | Identify independent vs dependent work → group into batches → execute batches in parallel, sequentially across batches. |
| `coordinate-dag` | Map work as a DAG → execute in topological waves → maximize parallelism across independent branches. |

Browse templates via the API:

```bash
# List all templates
curl http://localhost:3000/api/workflow-templates

# Filter by mode
curl http://localhost:3000/api/workflow-templates?mode=coordinator
```

## Example: Full-Stack Feature Development

This workflow uses an orchestrator to break a feature into frontend, backend, and test subtasks — then assigns each to a specialized team member.

### Step 1: Create Specialized Team Members

```bash
# Backend engineer
maestro team-member create "Backend Dev" \
  --role "Backend Engineer" \
  --identity "You are a backend engineer specializing in TypeScript and Express. Focus on API design, database models, and server logic. Always write tests for your endpoints." \
  --model sonnet \
  --skill-ids "nodejs-backend-patterns" \
  --avatar "🔧"

# Frontend engineer
maestro team-member create "Frontend Dev" \
  --role "Frontend Engineer" \
  --identity "You are a frontend engineer specializing in React and TypeScript. Build clean, accessible UI components. Follow existing component patterns in the codebase." \
  --model sonnet \
  --skill-ids "frontend-design" \
  --avatar "🎨"

# Test engineer
maestro team-member create "Test Engineer" \
  --role "QA Engineer" \
  --identity "You are a QA engineer. Write comprehensive tests — unit, integration, and E2E. Cover edge cases. Never mark a task complete without verifying tests pass." \
  --model sonnet \
  --avatar "🧪"
```

### Step 2: Create Team and Tasks

```bash
# Create team
maestro team create "Feature Team" \
  --leader <backend-dev-id> \
  --members <backend-dev-id>,<frontend-dev-id>,<test-engineer-id>

# Create parent task
maestro task create "Add user profile page" \
  --desc "Implement a user profile page with avatar upload, bio editing, and activity history" \
  --priority high

# Create subtasks
maestro task create "Build profile API endpoints" --parent <parent-task-id> --priority high
maestro task create "Build profile UI components" --parent <parent-task-id> --priority high
maestro task create "Write profile feature tests" --parent <parent-task-id> --priority medium
```

### Step 3: Launch Orchestrator

```bash
maestro session spawn \
  --task <parent-task-id> \
  --mode coordinator \
  --team-member-id <backend-dev-id>
```

The orchestrator reads the parent task, discovers the subtask tree, spawns workers for each subtask, assigns team members based on skill fit, monitors progress, and reports back when everything is integrated.

## Example: Code Review Workflow

Three agents collaborate: one writes code, one reviews, and one fixes issues.

### Setup

```bash
# Author agent
maestro team-member create "Author" \
  --role "Code Author" \
  --identity "You are a developer. Implement the task requirements, write clean code, and submit for review."

# Reviewer agent
maestro team-member create "Reviewer" \
  --role "Code Reviewer" \
  --identity "You are a code reviewer. Read the code changes, check for bugs, security issues, and style violations. Report issues clearly with file paths and line numbers."

# Fixer agent
maestro team-member create "Fixer" \
  --role "Issue Fixer" \
  --identity "You are a bug fixer. Read review feedback, locate the issues in the codebase, and fix them. Verify your fixes don't introduce regressions."
```

### Orchestration

Create a coordinator task that manages the pipeline:

```bash
maestro task create "Review Pipeline: Implement and review feature X" \
  --desc "1. Author implements the feature. 2. Reviewer reviews the changes. 3. Fixer addresses any issues found. 4. Final verification."

maestro session spawn \
  --task <task-id> \
  --mode coordinator
```

The coordinator decomposes this into sequential phases, spawning the author first, then the reviewer on the same files, then the fixer for any flagged issues.

## Example: Documentation Workflow

An agent reads the codebase, generates documentation, and a human reviews.

```bash
# Documentation specialist
maestro team-member create "Doc Writer" \
  --role "Documentation Engineer" \
  --identity "You are a documentation engineer. Read source code thoroughly, understand the architecture, and write clear, accurate documentation. Include code examples. Follow the existing docs style." \
  --skill-ids "code-visualizer"

# Create task
maestro task create "Generate API documentation" \
  --desc "Read all API route files in src/api/, understand each endpoint, and generate comprehensive API documentation with request/response examples."

# Spawn as worker (single agent, direct execution)
maestro session spawn \
  --task <task-id> \
  --team-member-id <doc-writer-id>
```

The session runs, the agent reads the codebase, generates docs, and reports completion. You review the output and iterate.

## Combining Skills with Workflows

Skills inject domain-specific instructions into any session. Combine them with team members for specialized agents:

```bash
# Skill directories
~/.claude/skills/code-review/SKILL.md      # Global code review instructions
<project>/.claude/skills/db-migration/SKILL.md  # Project-specific migration guide

# Associate skills with team members
maestro team-member edit <member-id> --skill-ids "code-review,db-migration"

# Or pass skills at spawn time
maestro session spawn --task <task-id> --skill "code-review"
```

Skills are loaded from the filesystem and injected into the agent's system prompt. Project-scoped skills override global skills with the same name.

## Choosing the Right Workflow Template

| Scenario | Template | Why |
|----------|----------|-----|
| Single, well-defined task | `execute-simple` | No decomposition needed |
| Task with existing subtask tree | `execute-tree` | Respects pre-defined structure and dependencies |
| Feature with distinct parts | `coordinate-default` | Linear decomposition, one worker per subtask |
| Mix of parallel and sequential work | `coordinate-batching` | Groups independent work into parallel batches |
| Complex dependency graph | `coordinate-dag` | Maximum parallelism via topological ordering |

## Tips

- **Start simple.** Use `execute-simple` for most tasks. Only escalate to orchestrators when work genuinely needs decomposition.
- **Use team member identity to specialize.** A well-written identity prompt is more valuable than complex workflow configuration.
- **Let the orchestrator decompose.** Don't pre-create subtasks for coordinators — let them analyze and plan.
- **Combine memory with skills.** Use `team-member memory append` to teach agents project-specific knowledge, and skills for reusable methodology.
- **Monitor with `session watch`.** Track orchestrated workflows in real time: `maestro session watch <session-id>`.
