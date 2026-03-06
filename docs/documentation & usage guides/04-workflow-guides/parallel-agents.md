# Run Multiple Agents in Parallel

**Scenario:** You have several independent tasks. Run multiple Claudes simultaneously and get everything done faster.

---

## Prerequisites

- A project with multiple tasks created
- Tasks that are independent (don't step on each other's code)

## When Parallel Works Best

Parallel execution shines when tasks don't overlap:
- Different files or directories
- Different services (frontend vs backend vs tests)
- Independent features

Avoid parallel sessions on the same files — they'll create merge conflicts.

---

## Step 1: Create Your Tasks

```bash
maestro task create "Build user profile page" \
  --desc "Create /profile route with user info display. Use src/pages/." \
  --priority high

maestro task create "Add email notification service" \
  --desc "Create email service in src/services/email.ts using Resend." \
  --priority high

maestro task create "Write API integration tests" \
  --desc "Add tests for all /api/users endpoints in tests/api/." \
  --priority medium

maestro task create "Update README with setup instructions" \
  --desc "Document environment variables, install steps, and dev workflow." \
  --priority low
```

## Step 2: Spawn Sessions for Each Task

```bash
maestro session spawn --task task_profile_001
maestro session spawn --task task_email_002
maestro session spawn --task task_tests_003
maestro session spawn --task task_readme_004
```

Each command opens a new terminal session. Four Claudes are now working in parallel, each isolated in its own tmux session.

## Step 3: Watch All Sessions

Monitor everything from one terminal:

```bash
maestro session watch sess_aaa,sess_bbb,sess_ccc,sess_ddd
```

```
[session:watch] Watching 4 session(s): sess_aaa, sess_bbb, sess_ccc, sess_ddd
[session:watch] Connected. Listening for events...
[10:00:01] sess_aaa status: working
[10:00:02] sess_bbb status: working
[10:00:02] sess_ccc status: working
[10:00:03] sess_ddd status: working
[10:02:15] sess_ddd COMPLETED: Worker: Update README
[10:05:30] sess_ccc progress: Writing test for POST /api/users
[10:08:42] sess_aaa progress: Building profile component
[10:10:00] sess_bbb COMPLETED: Worker: Add email service
[10:15:22] sess_ccc COMPLETED: Worker: Write API tests
[10:18:45] sess_aaa COMPLETED: Worker: Build user profile
[session:watch] All watched sessions have finished.
```

Or list all active sessions:

```bash
maestro session list --status working
```

**In the desktop app:** All four sessions appear as cards. Each shows live terminal output and timeline events. You see the full picture at a glance.

## Step 4: Review Results

Check overall task status:

```bash
maestro task list
```

```
ID              Title                              Status      Priority
task_profile    Build user profile page            ✅ completed  high
task_email      Add email notification service     ✅ completed  high
task_tests      Write API integration tests        ✅ completed  medium
task_readme     Update README with setup           ✅ completed  low
```

---

## Using Different Models for Different Tasks

Match model capability to task complexity:

```bash
# Complex frontend work — use Opus
maestro session spawn --task task_profile_001 --model opus

# Straightforward service — Sonnet is fine
maestro session spawn --task task_email_002 --model sonnet

# Test writing — Haiku is fast and cheap
maestro session spawn --task task_tests_003 --model haiku

# README update — Haiku handles it
maestro session spawn --task task_readme_004 --model haiku
```

## Using Team Members

Pre-configure agents with different roles:

```bash
# Create specialized team members
maestro team-member create "Frontend Dev" --role "React specialist" --avatar "🎨" --mode worker --model opus
maestro team-member create "Backend Dev" --role "Node.js API developer" --avatar "⚙️" --mode worker --model sonnet
maestro team-member create "QA Engineer" --role "Test writer" --avatar "🧪" --mode worker --model haiku

# Spawn with team members
maestro session spawn --task task_profile_001 --team-member-id tm_frontend
maestro session spawn --task task_email_002 --team-member-id tm_backend
maestro session spawn --task task_tests_003 --team-member-id tm_qa
```

Each team member gets their custom identity and instructions injected into Claude's system prompt.

---

## Parallel vs Orchestration

| Parallel (this guide) | Orchestration |
|------------------------|---------------|
| You create all tasks | Coordinator creates subtasks |
| You spawn each session | Coordinator spawns workers |
| You monitor progress | Coordinator monitors workers |
| Best for known, independent work | Best for complex, interdependent work |
| Full control | Automated coordination |

**Rule of thumb:** If you know exactly what needs to happen, go parallel. If the work needs planning and coordination, use an [orchestrator](./orchestrator-coordination.md).

---

## Tips

- **Check for file conflicts.** If two sessions edit the same file, you'll need to resolve conflicts manually.
- **Use `--timeout` with watch** to auto-exit after a set time:

```bash
maestro session watch sess_aaa,sess_bbb --timeout 600000  # 10 minutes
```

- **JSON output for scripting:**

```bash
maestro session watch sess_aaa,sess_bbb --json
```

Returns one JSON object per line — pipe to `jq` or log processors.

---

## What Next?

- **Want automated coordination?** See [Use an Orchestrator](./orchestrator-coordination.md).
- **Want to assign agents to a team?** See [Set Up a Team](./team-setup.md).
- **Want sequential processing?** See [Queue Mode](./queue-mode.md).
