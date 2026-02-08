# System Prompt Templates

## Overview

System prompts are markdown templates that define the behavior and capabilities of Maestro Worker and Orchestrator agents.

**The actual templates are the source of truth.** Refer to the template files directly for the latest content:

- **Worker (Simple)**: [`maestro-cli/templates/worker-simple-prompt.md`](../../templates/worker-simple-prompt.md)
- **Worker (Queue)**: [`maestro-cli/templates/worker-queue-prompt.md`](../../templates/worker-queue-prompt.md)
- **Orchestrator**: [`maestro-cli/templates/orchestrator-prompt.md`](../../templates/orchestrator-prompt.md)
- **Worker (Tree)**: [`maestro-cli/templates/worker-tree-prompt.md`](../../templates/worker-tree-prompt.md)

## Key Facts

- Stored in `maestro-cli/templates/`
- Version-controlled with the CLI
- Use `${VARIABLE_NAME}` syntax for template variable substitution
- Injected into Claude's system prompt via `--append-system-prompt`

## Template Variables

Variables are replaced with actual values from the manifest during prompt generation:

```typescript
${TASK_ID}                      // task.id (primary task)
${TASK_TITLE}                   // task.title
${TASK_DESCRIPTION}             // task.description
${TASK_PRIORITY}                // task.priority || 'medium'
${ACCEPTANCE_CRITERIA}          // Formatted acceptance criteria list
${CODEBASE_CONTEXT}             // Codebase context from manifest
${RELATED_TASKS}                // Related tasks information
${PROJECT_STANDARDS}            // Project coding standards
${ALL_TASKS}                    // Formatted list of all tasks (multi-task sessions)
${TASK_COUNT}                   // Number of tasks in session
${STRATEGY}                     // Worker strategy ('simple', 'queue')
${STRATEGY_INSTRUCTIONS}        // Strategy-specific instructions
```

## Template Selection

The CLI selects the template based on manifest role and strategy:

| Role | Strategy | Template |
|------|----------|----------|
| `worker` | `simple` (default) | `worker-simple-prompt.md` |
| `worker` | `queue` | `worker-queue-prompt.md` |
| `orchestrator` | any | `orchestrator-prompt.md` |
| `worker` | `tree` | `worker-tree-prompt.md` |

## Template Loading

Templates are loaded with a fallback chain:

1. **Server fetch by templateId** — If `manifest.templateId` is specified, fetches from `GET /api/templates/{templateId}`
2. **Server fetch by role** — Falls back to `GET /api/templates/role/{role}`
3. **Bundled templates** — Falls back to local templates in `maestro-cli/templates/`

This is handled by `PromptGenerator.generatePromptAsync()` with methods `fetchTemplateById()` and `fetchTemplateByRole()`.

**Note**: The spawn flow uses a minimal prompt (`"Run \`maestro whoami\` to understand your assignment and begin working."`) rather than injecting the full template. The full template content is rendered by `WhoamiRenderer` when the agent runs `maestro whoami`.

## Custom Templates

For advanced users, templates can be overridden:

```bash
# Custom template location (optional)
export MAESTRO_WORKER_TEMPLATE=~/.maestro/custom-worker-prompt.md

maestro worker init  # Uses custom template
```

Next: [04-STANDARD-SKILLS.md](./04-STANDARD-SKILLS.md) - Standard skills integration
