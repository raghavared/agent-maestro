# Documentation Style Guide

> Every page in Maestro's docs follows these conventions. Read this before writing or reviewing any documentation.

---

## Voice and Tone

### Use Active Voice

Write direct sentences where the subject performs the action.

| Do | Don't |
|----|-------|
| Maestro spawns a new session. | A new session is spawned by Maestro. |
| Create a task with `maestro task create`. | A task can be created using `maestro task create`. |
| The coordinator assigns work to agents. | Work is assigned to agents by the coordinator. |

### Use Present Tense

Describe what the software does now, not what it will do.

| Do | Don't |
|----|-------|
| This command creates a session. | This command will create a session. |
| The server returns a JSON response. | The server will return a JSON response. |
| Maestro stores data as JSON files. | Maestro will store data as JSON files. |

### Use Second Person

Address the reader directly as "you."

| Do | Don't |
|----|-------|
| You can spawn multiple sessions. | Users can spawn multiple sessions. |
| Run this command in your terminal. | The user should run this command in their terminal. |
| Your project directory contains... | The developer's project directory contains... |

### Use Imperative Mood for Instructions

Start step-by-step instructions with a verb.

| Do | Don't |
|----|-------|
| Run `maestro status`. | You should run `maestro status`. |
| Open the Maestro desktop app. | The Maestro desktop app should be opened. |
| Set the `MAESTRO_API_URL` variable. | The `MAESTRO_API_URL` variable needs to be set. |

---

## Sentence Structure

### Keep Sentences Short

Aim for 10–15 words per sentence. Never exceed 20 words.

| Do | Don't |
|----|-------|
| Sessions run inside PTY terminals. The server manages their lifecycle. | Sessions run inside PTY terminals and the server is responsible for managing their entire lifecycle from start to finish. |
| Tasks have seven statuses. Each status reflects a stage in the workflow. | Tasks have seven different statuses, each of which reflects a different stage in the task's workflow lifecycle. |

### One Idea Per Sentence

Each sentence covers exactly one concept.

```markdown
<!-- Do -->
A project groups related tasks and sessions. Each project has a working directory.
You set the working directory when you create the project.

<!-- Don't -->
A project groups related tasks and sessions and each project has a working
directory that you set when you create the project.
```

### Lead with the Goal

Start paragraphs with what the reader wants to achieve.

```markdown
<!-- Do -->
To spawn a coordinator session, run:

<!-- Don't -->
The session spawn command supports several modes, one of which is the
coordinator mode, which you can use by running:
```

---

## Terminology

### Define Terms on First Use

Link every Maestro-specific term to the glossary on first mention within a page.

```markdown
A [session](/docs/concepts/sessions) runs a single AI agent inside a PTY terminal.
The [coordinator](/docs/concepts/agent-modes#coordinator) assigns tasks to worker sessions.
```

### Use Consistent Names

| Term | Always Use | Never Use |
|------|-----------|-----------|
| Session | session | process, instance, agent instance |
| Task | task | job, ticket, work item |
| Project | project | workspace, repo |
| Team member | team member | agent profile, persona |
| Coordinator | coordinator | orchestrator, leader, manager |
| Worker | worker | executor, runner |
| Skill | skill | plugin, extension, module |
| Manifest | manifest | config file, session config |

### Capitalize Properly

- **Product name**: Maestro (always capitalized)
- **Concepts**: lowercase (session, task, project, team member)
- **CLI commands**: monospace (`maestro task create`)
- **Modes**: lowercase in prose (coordinator mode, worker mode)

---

## Code Examples

### Every Concept Needs a Runnable Example

Place a code example within two scrolls of any new concept. The reader should never wonder "but how do I actually do this?"

```markdown
## Sessions

A session runs a single AI agent inside a PTY terminal.

Create a session:

​```bash
maestro session spawn --task task_abc123 --mode worker
​```
```

### Show Real Output

Display actual terminal output, not descriptions of output.

````markdown
<!-- Do -->
```bash
maestro task get task_abc123
```

```
ID:       task_abc123
Title:    Fix login bug
Status:   in_progress
Priority: high
```

<!-- Don't -->
Running `maestro task get` displays the task details including ID, title,
status, and priority.
````

### Use Realistic Values

Use plausible IDs, names, and data in examples. Avoid `foo`, `bar`, and `test123`.

| Do | Don't |
|----|-------|
| `maestro task create "Fix authentication timeout"` | `maestro task create "test task"` |
| `task_1772040904192_s2fbh399k` | `task_123` |
| `--team-member-id tm_backend_dev` | `--team-member-id foo` |

### Format Code Blocks Correctly

- Use `bash` language tag for CLI commands
- Use `typescript` for TypeScript/data models
- Use `json` for JSON output
- Use inline code (`` ` ``) for single commands, flags, and values in prose

---

## Progressive Disclosure

### Start Simple, Add Complexity

Introduce the basic usage first. Add advanced options after.

```markdown
## Spawning a Session

Spawn a worker session for a single task:

​```bash
maestro session spawn --task task_abc123
​```

### Advanced Options

Specify the AI agent tool and permission mode:

​```bash
maestro session spawn \
  --task task_abc123 \
  --agent-tool claude-code \
  --permission-mode bypassPermissions \
  --model claude-sonnet-4-6
​```
```

### Use Collapsible Sections for Deep Dives

Wrap advanced or reference content in `<details>` blocks.

```markdown
<details>
<summary>Full list of session statuses</summary>

| Status | Description |
|--------|-------------|
| `spawning` | Session is being created |
| `idle` | Waiting for input |
| `working` | Actively processing |
| `completed` | Finished successfully |
| `failed` | Terminated with error |
| `stopped` | Manually stopped |

</details>
```

### Layer Information

Structure pages in this order:

1. **What** — One-sentence definition
2. **Why** — When and why you use it (2–3 sentences)
3. **How (basic)** — Simplest possible example
4. **How (advanced)** — Options, flags, edge cases
5. **Reference** — Full tables, all flags, all statuses

---

## Formatting Conventions

### Headings

- Use sentence case: "Create a project" not "Create A Project"
- Use `##` for main sections, `###` for subsections
- Do not skip heading levels

### Lists

- Use numbered lists for sequential steps
- Use bullet lists for unordered items
- Keep list items parallel in structure

```markdown
<!-- Do: parallel structure -->
- Create a project
- Add tasks to the project
- Spawn sessions for each task

<!-- Don't: mixed structure -->
- Creating a project
- You should add tasks
- Sessions need to be spawned
```

### Tables

Use tables for structured reference data (flags, statuses, comparisons). Keep tables under 5 columns.

### Admonitions

Use blockquotes with bold labels for callouts:

```markdown
> **Note:** Sessions persist across server restarts.

> **Warning:** Deleting a project removes all its tasks and sessions.

> **Tip:** Use `--json` with any command for machine-readable output.
```

---

## File Naming

- Use lowercase with hyphens: `session-management.md`
- Match the URL path: `docs/concepts/sessions.md` → `/docs/concepts/sessions`
- Group by type: `concepts/`, `guides/`, `reference/`, `troubleshooting/`

---

## Review Checklist

Before submitting any documentation page, verify:

- [ ] All sentences are under 20 words
- [ ] Active voice throughout
- [ ] Present tense throughout
- [ ] Second person ("you") throughout
- [ ] Every Maestro term linked to glossary on first use
- [ ] At least one runnable code example per concept
- [ ] Terminal output shown (not described)
- [ ] Simple usage before advanced usage
- [ ] Breadcrumbs at top of page
- [ ] "Next steps" section at bottom
- [ ] All cross-links resolve to real pages
- [ ] No orphan pages (every page linked from at least one other page)
