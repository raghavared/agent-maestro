# Control What Agents Can Do (Permissions)

**Scenario:** You want to restrict what Claude can run. Limit file edits, prevent session spawning, or lock down specific commands per team member.

---

## Prerequisites

- A project with team members set up
- Understanding of the four agent modes

## Permission Modes

Every session runs in a permission mode that controls how Claude interacts with your system.

### acceptEdits (default)

Claude can edit files directly. You review each edit.

```bash
maestro session spawn --task task_abc --permission-mode acceptEdits
```

Best for: trusted workers doing active development.

### interactive

Claude suggests changes and you confirm each one. Full interactivity.

```bash
maestro session spawn --task task_abc --permission-mode interactive
```

Best for: when you want to approve every action.

### readOnly

Claude can read files and analyze code but cannot modify anything.

```bash
maestro session spawn --task task_abc --permission-mode readOnly
```

Best for: code review, analysis, planning sessions.

### bypassPermissions

Full access. No prompts, no restrictions. Claude runs everything without asking.

```bash
maestro session spawn --task task_abc --permission-mode bypassPermissions
```

Best for: automated pipelines, CI/CD, trusted orchestrators. Use with caution.

---

## Setting Permissions on Team Members

Permission modes can be baked into team member configurations:

```bash
# Developer can edit freely
maestro team-member create "Developer" \
  --role "Full-stack developer" \
  --avatar "💻" \
  --mode worker \
  --permission-mode acceptEdits

# Reviewer can only read
maestro team-member create "Reviewer" \
  --role "Code reviewer" \
  --avatar "🔍" \
  --mode worker \
  --permission-mode readOnly

# CI Agent runs unattended
maestro team-member create "CI Agent" \
  --role "Automated pipeline runner" \
  --avatar "🤖" \
  --mode worker \
  --permission-mode bypassPermissions
```

When you spawn a session with a team member, their permission mode is automatically applied:

```bash
# This session inherits readOnly from the Reviewer team member
maestro session spawn --task task_review --team-member-id tm_reviewer
```

---

## Command Permissions (Fine-Grained Control)

Beyond file-level permissions, you can control which Maestro commands a team member can run.

### Command Groups

Commands are organized into groups. Enable or disable entire groups:

| Group | Commands |
|-------|----------|
| `task` | task create, edit, delete, complete, block, report |
| `session` | session spawn, prompt, watch, logs, report |
| `team` | team create, edit, delete, add-member |
| `team-member` | team-member create, edit, delete, memory |
| `skill` | skill list, info, install |
| `master` | master projects, tasks, sessions, context |

### Setting Command Permissions

Command permissions are set on team members via the API or UI. They control what the agent is allowed to do within Maestro:

**Example: Worker that can report but can't spawn**

A worker should execute tasks and report progress, but shouldn't create new sessions:

```json
{
  "commandPermissions": {
    "groups": {
      "task": true,
      "session": false
    },
    "commands": {
      "session:report": true,
      "session:siblings": true,
      "session:info": true
    }
  }
}
```

This worker can:
- Use all task commands (create subtasks, report progress)
- Report session status (`session report`)
- See siblings (`session siblings`)
- View session info (`session info`)

But cannot:
- Spawn new sessions (`session spawn`)
- Send messages to other sessions (`session prompt`)
- Watch other sessions (`session watch`)

**Example: Orchestrator that can coordinate but can't edit tasks**

```json
{
  "commandPermissions": {
    "groups": {
      "session": true,
      "task": false
    },
    "commands": {
      "task:get": true,
      "task:list": true,
      "task:tree": true,
      "task:children": true,
      "task:report": true
    }
  }
}
```

This orchestrator can:
- Spawn sessions, watch workers, send messages
- View tasks and their tree structure
- Report task progress

But cannot:
- Create, edit, or delete tasks
- Change task status directly

### Checking Available Commands

From inside a session, an agent can check what commands it's allowed to use:

```bash
maestro commands
```

```
Available Commands:
  ✓ task get
  ✓ task list
  ✓ task tree
  ✓ task report progress
  ✓ task report complete
  ✗ task create
  ✗ task edit
  ✗ task delete
  ✓ session report progress
  ✓ session report complete
  ✓ session siblings
  ✗ session spawn
  ✗ session prompt
```

Check a specific command:

```bash
maestro commands --check "session spawn"
```

```
✗ session spawn: Not permitted
```

---

## Capability Flags

Team members also have capability flags — higher-level permissions that control system behaviors:

| Capability | Description |
|-----------|-------------|
| `can_spawn_sessions` | Can this agent spawn new sessions? |
| `can_edit_tasks` | Can this agent create/modify tasks? |
| `can_report_task_level` | Can this agent report at the task level? |
| `can_report_session_level` | Can this agent report at the session level? |

These are set when creating team members and injected into the agent's prompt:

```xml
<capabilities>
  <capability name="can_spawn_sessions" enabled="true" />
  <capability name="can_edit_tasks" enabled="true" />
  <capability name="can_report_task_level" enabled="true" />
  <capability name="can_report_session_level" enabled="true" />
</capabilities>
```

---

## Permission Precedence

When multiple permission sources exist, the highest-priority source wins:

1. **Session-level override** (highest) — `--permission-mode` flag on spawn
2. **Per-member override** — override set in spawn configuration
3. **Team member setting** — `permissionMode` on the team member
4. **Default** — `acceptEdits`

Example:

```bash
# Team member has readOnly, but override to acceptEdits for this session
maestro session spawn --task task_abc \
  --team-member-id tm_reviewer \
  --permission-mode acceptEdits
```

---

## Practical Patterns

### Read-only analysis session

```bash
maestro team-member create "Analyst" --role "Code analyst" --avatar "📊" --mode worker --permission-mode readOnly
maestro session spawn --task task_review --team-member-id tm_analyst
```

### Locked-down worker

Worker that can only execute its task and report — no task creation, no spawning:

```bash
maestro team-member create "Runner" \
  --role "Task executor" \
  --avatar "🏃" \
  --mode coordinated-worker \
  --permission-mode acceptEdits
```

With command restrictions set via API to disable `session:spawn` and `task:create`.

### Full-trust orchestrator

Coordinator with full access for automated pipelines:

```bash
maestro team-member create "Orchestrator" \
  --role "Automated coordinator" \
  --avatar "🎯" \
  --mode coordinator \
  --permission-mode bypassPermissions
```

---

## Tips

- **Start restrictive, loosen as needed.** It's easier to grant permissions than to recover from unintended actions.
- **Use readOnly for review tasks.** If the task is "analyze this code" or "review this PR," readOnly prevents accidental edits.
- **Combine permission mode with command permissions.** Permission mode controls file access; command permissions control Maestro commands. Use both.
- **Test permissions before production.** Spawn a session and run `maestro commands` to verify what's allowed.

---

## What Next?

- **Want to set up team members?** See [Set Up a Team](./team-setup.md).
- **Want to customize agent behavior?** See [Custom Skills](./custom-skills.md).
- **Want to run a single task?** Start from the beginning: [Run a Single Task](./single-task.md).
