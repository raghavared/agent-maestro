# Skills

**Skills are markdown instruction files that inject custom context and behaviors into Claude's system prompt. They let you shape what Claude knows and how it works — without modifying Maestro itself.**

---

## What is a Skill?

A skill is a directory containing a `SKILL.md` file. When a session loads a skill, the contents of that markdown file get injected into Claude's system prompt as a plugin. This means Claude reads your instructions before it starts working.

```
~/.claude/skills/code-review/SKILL.md
```

```markdown
---
name: code-review
description: Enforces code review standards
---

# Code Review Skill

When reviewing code, always check for:
1. Security vulnerabilities (SQL injection, XSS, CSRF)
2. Performance issues (N+1 queries, unbounded loops)
3. Test coverage (every public function should have tests)
4. Error handling (no swallowed exceptions)

Format your review as a checklist with pass/fail for each item.
```

That's a skill. When Claude loads it, it follows those review guidelines.

## Why Skills Matter

Skills give you repeatable, composable instructions. Instead of typing the same context into every task description, you define it once as a skill and attach it to any session or team member.

Use cases:
- **Coding standards.** "Use Prettier, ESLint, and our naming conventions."
- **Domain knowledge.** "Here's how our API authentication works."
- **Workflow rules.** "Always run tests before reporting completion."
- **Project context.** "This repo uses a monorepo structure with Turborepo."

## Skill Locations

Maestro looks for skills in four directories, in two scopes:

### Global skills (available to all projects)

```
~/.claude/skills/<skill-name>/SKILL.md
~/.agents/skills/<skill-name>/SKILL.md
```

### Project skills (available only in that project)

```
<project-dir>/.claude/skills/<skill-name>/SKILL.md
<project-dir>/.agents/skills/<skill-name>/SKILL.md
```

**Precedence:** Project-scoped skills override global skills with the same name. If you have both `~/.claude/skills/lint/SKILL.md` and `./project/.claude/skills/lint/SKILL.md`, the project version wins.

## Creating a Skill

### 1. Create the directory

```bash
mkdir -p ~/.claude/skills/my-skill
```

### 2. Write the SKILL.md

```bash
cat > ~/.claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: Short description of what this skill does
version: 1.0.0
---

# My Custom Skill

Instructions for Claude go here. Be specific about what you want.

## Rules
- Always do X before Y
- Never use Z library — use W instead
- Format output as JSON

## Context
This project uses Express.js with TypeScript and PostgreSQL.
The database schema is at `src/db/schema.ts`.
EOF
```

### 3. Verify it's detected

```bash
maestro skill list
maestro skill info my-skill
```

## Skill Frontmatter

The YAML frontmatter at the top of `SKILL.md` provides metadata:

```yaml
---
name: my-skill              # Kebab-case identifier
description: What it does    # Human-readable summary
version: 1.0.0              # Semantic version
role: worker                 # Filter: 'worker' or 'orchestrator'
scope: global                # 'global' or 'project'
triggers:                    # Optional trigger keywords
  - code-review
  - lint
tags:                        # Categorization
  - quality
  - testing
---
```

The frontmatter is optional — the skill works without it. But it helps with discovery and filtering.

## Using Skills

### Attach a skill when spawning a session

```bash
maestro session spawn --task <task-id> --skill my-skill
```

### Attach skills to a team member

```bash
maestro team-member create "Alice" \
  --role "Frontend Dev" \
  --skill-ids my-frontend-skill,code-review
```

Every session Alice runs will automatically load those skills.

### Attach skills when generating a manifest

```bash
maestro manifest generate \
  --mode worker \
  --project-id <id> \
  --task-ids <task-id> \
  --skills my-skill,another-skill \
  --output manifest.json
```

## Built-in Skills

Maestro ships with two built-in skills as plugins:

### `maestro-worker`

Loaded automatically for all worker and coordinated-worker sessions. Provides:
- Hooks for session lifecycle (auto-registers on start, auto-completes on end)
- The Maestro system prompt that teaches Claude how to use `maestro` commands
- Task reporting capabilities

### `maestro-orchestrator`

Loaded automatically for coordinator and coordinated-coordinator sessions. Provides:
- Everything the worker plugin provides
- Additional context for spawning and monitoring worker sessions
- Coordination strategies and decomposition guidance

You don't need to specify these — they're injected automatically based on the session mode.

## How Skills Are Injected

When a session spawns, skills are loaded and injected via Claude's `--plugin-dir` flag:

```
Manifest specifies skills: ["my-skill", "code-review"]
    ↓
SkillLoader discovers skill directories
    ↓
Each skill path is added as: --plugin-dir <skill-path>
    ↓
Claude loads the SKILL.md as part of its system prompt
    ↓
Claude follows the instructions
```

## Skill CLI Commands

```bash
# List all available skills
maestro skill list

# Filter by scope
maestro skill list --scope project
maestro skill list --scope global

# Get details about a skill
maestro skill info <skill-name>

# Validate all skills (check for errors)
maestro skill validate

# Install a skill from GitHub
maestro skill install <owner/repo>

# Browse community skills
maestro skill browse [search-query]
```

## Example: A Real Skill

Here's a practical skill for a TypeScript API project:

```markdown
---
name: ts-api-standards
description: TypeScript API development standards for our team
version: 1.0.0
role: worker
---

# TypeScript API Standards

## Tech Stack
- Runtime: Node.js 20+ with TypeScript 5.x
- Framework: Express.js
- Database: PostgreSQL with Prisma ORM
- Testing: Vitest + Supertest
- Validation: Zod schemas

## Code Conventions
- Use `async/await` everywhere, never raw Promises
- All API responses use the shape: `{ data: T } | { error: string, code: number }`
- Validate all inputs with Zod at the route handler level
- Use dependency injection — never import database clients directly

## File Structure
- Routes: `src/routes/<resource>.ts`
- Services: `src/services/<resource>Service.ts`
- Types: `src/types/<resource>.ts`
- Tests: `src/__tests__/<resource>.test.ts`

## Before Completing a Task
1. Run `bun test` and ensure all tests pass
2. Run `bun lint` and fix any issues
3. Check that no `any` types were introduced
```

Save this as `<project>/.claude/skills/ts-api-standards/SKILL.md`, and every worker session in the project will follow these standards.

> **Next:** [Manifests](./manifests.md) — The configuration files that wire everything together.
