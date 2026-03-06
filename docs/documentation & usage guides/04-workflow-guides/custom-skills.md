# Customize Agent Behavior with Skills

**Scenario:** You want Claude to follow specific instructions, coding standards, or workflows. Skills are markdown files that get injected into Claude's system prompt.

---

## Prerequisites

- A project set up in Maestro
- A text editor for creating skill files

## What is a Skill?

A skill is a markdown file (SKILL.md) that contains instructions for Claude. When you attach a skill to a session, its contents become part of Claude's system prompt. Skills can define:

- Coding standards and conventions
- Framework-specific patterns
- Workflow instructions
- Role-specific behavior

---

## Step 1: Create a Skill File

Skills live in one of two locations:

**Project-scoped** (specific to one project):
```
<your-project>/.claude/skills/<skill-name>/SKILL.md
<your-project>/.agents/skills/<skill-name>/SKILL.md
```

**Global** (available across all projects):
```
~/.claude/skills/<skill-name>/SKILL.md
~/.agents/skills/<skill-name>/SKILL.md
```

Create a project skill:

```bash
mkdir -p .claude/skills/react-expert
```

Write the skill file:

```markdown
# React Expert

You are a React specialist working in this codebase.

## Coding Standards

- Use functional components with hooks. Never use class components.
- Use TypeScript for all new files. No `any` types.
- Use Tailwind CSS for styling. No inline styles or CSS modules.
- All components must be accessible (ARIA labels, keyboard navigation).

## File Structure

- Components go in `src/components/<feature>/`
- Hooks go in `src/hooks/`
- Types go in `src/types/`
- Tests go next to the component: `Component.test.tsx`

## Patterns

- Use `useQuery` and `useMutation` from TanStack Query for data fetching.
- Use `zod` for form validation with `react-hook-form`.
- Error boundaries wrap every page-level component.

## Testing

- Write tests with Vitest and Testing Library.
- Test behavior, not implementation.
- Every component must have at least one test.
```

Save as `.claude/skills/react-expert/SKILL.md`.

## Step 2: Verify the Skill

```bash
maestro skill list
```

```
Name            Source    Valid   Description
react-expert    project  ✓      React Expert
```

Get full details:

```bash
maestro skill info react-expert
```

Validate all skills:

```bash
maestro skill validate
```

```
Valid skills:
  ✓ react-expert (project)
  ✓ maestro-worker (global)
  ✓ maestro-orchestrator (global)

Invalid skills: none
```

## Step 3: Use the Skill in a Session

Load the skill when spawning:

```bash
maestro session spawn --task task_abc --skill react-expert
```

Claude's system prompt now includes the full contents of your SKILL.md. It will follow the React coding standards, file structure, and patterns you defined.

---

## Built-in Skills

Maestro ships with two built-in skills:

### maestro-worker

Loaded automatically for worker sessions. Contains instructions for:
- Executing tasks autonomously
- Reporting progress with `maestro task report` and `maestro report`
- Working within the Maestro ecosystem

### maestro-orchestrator

Loaded automatically for coordinator sessions. Contains instructions for:
- Analyzing and decomposing tasks
- Spawning and monitoring worker sessions
- Coordinating multi-agent workflows
- Using `maestro session prompt` for communication

---

## Installing Skills from GitHub

Share skills across teams by publishing them to GitHub:

```bash
maestro skill install owner/repo-name
```

This clones the skill into your project's skill directory.

Options:

```bash
# Install globally (available to all projects)
maestro skill install owner/react-patterns --scope global

# Install to specific target
maestro skill install owner/react-patterns --target agents --project-path /path/to/project
```

Browse available skills:

```bash
maestro skill browse react
```

---

## Attaching Skills to Team Members

Skills can be permanently attached to team members:

```bash
maestro team-member edit tm_alice_001 --skill-ids react-expert,frontend-design
```

Every session spawned with this team member will automatically load their skills. This means Alice always gets the React instructions regardless of how her session is spawned.

---

## Skill Scoping Rules

- **Project skills override global skills** with the same name
- **Multiple skills can be loaded** in a single session
- Skills are injected via Claude Code's `--plugin-dir` flag
- Skill content is pure markdown — no code execution

---

## Example: Backend API Skill

```markdown
# Backend API Developer

## Stack
- Express.js with TypeScript
- Prisma for database access
- Zod for input validation
- Vitest for testing

## API Conventions
- RESTful routes: GET /resource, POST /resource, PUT /resource/:id, DELETE /resource/:id
- Always validate request body with Zod before processing
- Return consistent JSON: { data: ... } for success, { error: ... } for failures
- Use HTTP status codes correctly (201 for created, 404 for not found, 422 for validation)

## Error Handling
- Wrap all route handlers in try/catch
- Log errors to console with full stack trace
- Never expose internal errors to clients

## Database
- All queries go through Prisma client
- Use transactions for multi-table operations
- Add database indexes for any column used in WHERE clauses
```

---

## Example: Code Review Skill

```markdown
# Code Reviewer

Your job is to review code, not write it.

## Review Checklist
1. Security: Check for injection, XSS, auth bypass
2. Performance: Look for N+1 queries, unnecessary re-renders, missing indexes
3. Types: Verify TypeScript types are accurate, no `any` escape hatches
4. Tests: Ensure tests cover the happy path and at least one error path
5. Style: Consistent with existing codebase patterns

## Output Format
For each issue found:
- **File**: path/to/file.ts:lineNumber
- **Severity**: critical | warning | suggestion
- **Issue**: What's wrong
- **Fix**: How to fix it
```

---

## Tips

- **Keep skills focused.** One skill = one domain. Combine them by loading multiple skills.
- **Be specific.** Vague instructions lead to vague results. Include file paths, naming conventions, and concrete examples.
- **Test your skills.** Spawn a session with the skill and verify Claude follows the instructions.
- **Version control your skills.** Store project skills in your repo — they're just markdown files.

---

## What Next?

- **Want to control what agents can run?** See [Permissions](./permissions.md).
- **Want to set up a full team?** See [Set Up a Team](./team-setup.md).
- **Want automated coordination?** See [Use an Orchestrator](./orchestrator-coordination.md).
