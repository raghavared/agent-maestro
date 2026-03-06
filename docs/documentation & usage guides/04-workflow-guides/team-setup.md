# Set Up a Team of Specialized Agents

**Scenario:** Different tasks need different skills. Create a team with specialized agents — a frontend developer, a backend engineer, a tester — each with their own identity, model, and instructions.

---

## Prerequisites

- A project set up in Maestro
- Tasks that benefit from specialized roles

## Step 1: Create Team Members

Each team member is a reusable agent configuration. Define their role, model, and behavior.

```bash
# Frontend specialist — uses Opus for complex UI work
maestro team-member create "Alice" \
  --role "Senior Frontend Developer" \
  --avatar "🎨" \
  --mode coordinated-worker \
  --model opus \
  --identity "You are Alice, a senior frontend developer. You specialize in React, TypeScript, and CSS. You write clean, accessible components with proper ARIA attributes. You prefer Tailwind for styling."

# Backend specialist — Sonnet for API work
maestro team-member create "Bob" \
  --role "Backend Engineer" \
  --avatar "⚙️" \
  --mode coordinated-worker \
  --model sonnet \
  --identity "You are Bob, a backend engineer. You specialize in Node.js, Express, and PostgreSQL. You follow REST conventions strictly and always validate inputs with Zod."

# Test writer — Haiku for fast, focused test generation
maestro team-member create "Charlie" \
  --role "QA Engineer" \
  --avatar "🧪" \
  --mode coordinated-worker \
  --model haiku \
  --identity "You are Charlie, a QA engineer. You write thorough integration and unit tests. You focus on edge cases and error paths. You use Vitest."
```

Output for each:

```
Team member created
ID: tm_alice_001
Name: 🎨 Alice
Role: Senior Frontend Developer
Mode: coordinated-worker
Model: opus
Agent Tool: claude-code
```

## Step 2: Create a Team

Group members into a team with a leader:

```bash
maestro team create "Feature Team" \
  --desc "Full-stack team for feature development" \
  --leader tm_alice_001 \
  --members tm_alice_001,tm_bob_002,tm_charlie_003 \
  --avatar "🚀"
```

```
Team created
ID: team_feat_001
Name: 🚀 Feature Team
Leader: 🎨 Alice
Members: 3
```

## Step 3: View the Team

```bash
maestro team get team_feat_001
```

```
Team: 🚀 Feature Team
Status: active
Leader: 🎨 Alice (tm_alice_001)
Members:
  🎨 Alice — Senior Frontend Developer (opus, coordinated-worker)
  ⚙️ Bob — Backend Engineer (sonnet, coordinated-worker)
  🧪 Charlie — QA Engineer (haiku, coordinated-worker)
```

Or see the full tree:

```bash
maestro team tree team_feat_001
```

## Step 4: Assign Tasks to Team Members

Create tasks and spawn sessions with specific team members:

```bash
# Create tasks
maestro task create "Build dashboard UI" --priority high
maestro task create "Build dashboard API" --priority high
maestro task create "Write dashboard tests" --priority medium

# Spawn with team members
maestro session spawn --task task_ui_001 --team-member-id tm_alice_001
maestro session spawn --task task_api_002 --team-member-id tm_bob_002
maestro session spawn --task task_test_003 --team-member-id tm_charlie_003
```

Each session inherits the team member's:
- **Model** — Alice uses Opus, Bob uses Sonnet, Charlie uses Haiku
- **Identity** — Custom instructions for their role
- **Permission mode** — What they're allowed to do
- **Skills** — Any attached skill configurations

---

## What Each Agent Sees

When Alice's session spawns, her system prompt includes:

```xml
<self_identity>
  <name>Alice</name>
  <role>Senior Frontend Developer</role>
  <avatar>🎨</avatar>
  <identity>You are Alice, a senior frontend developer. You specialize in React, TypeScript, and CSS...</identity>
</self_identity>
```

She knows who she is, what she's good at, and what she should focus on.

---

## Adding Team Member Memory

Give team members persistent context that carries across sessions:

```bash
# Add memory entries
maestro team-member memory append tm_alice_001 "We use Next.js 14 with App Router in this project."
maestro team-member memory append tm_alice_001 "Design system components are in src/components/ui/."
maestro team-member memory append tm_bob_002 "Database is PostgreSQL on Supabase. Connection string is in .env."

# View memory
maestro team-member memory list tm_alice_001
```

Memory entries are injected into the agent's prompt every session. Use this for project-specific knowledge that should persist.

```bash
# Clear memory if needed
maestro team-member memory clear tm_alice_001
```

---

## Adding Skills to Team Members

Attach skills for specialized behavior:

```bash
maestro team-member edit tm_alice_001 --skill-ids react-expert,frontend-design
maestro team-member edit tm_bob_002 --skill-ids nodejs-backend-patterns
```

Skills are markdown instruction files that get loaded into the agent's context. See [Custom Skills](./custom-skills.md).

---

## Setting Permissions per Team Member

Control what each team member can do:

```bash
# Alice can edit files freely
maestro team-member edit tm_alice_001 --permission-mode acceptEdits

# Charlie can only read and suggest (no edits)
maestro team-member edit tm_charlie_003 --permission-mode readOnly
```

Permission modes:
- `acceptEdits` — Can edit files directly (default)
- `interactive` — Suggests changes, user confirms
- `readOnly` — Can only read, cannot modify
- `bypassPermissions` — Full access, no prompts

See [Permissions](./permissions.md) for fine-grained command permissions.

---

## Using a Coordinator with a Team

For automated coordination, create a team leader as a coordinator:

```bash
maestro team-member create "Lead" \
  --role "Technical Lead" \
  --avatar "👔" \
  --mode coordinator \
  --model opus \
  --identity "You are the tech lead. Break down tasks, assign to team members based on their strengths, and verify the combined output."
```

Then spawn the coordinator — it will see available team members and delegate work:

```bash
maestro session spawn --task task_feature_001 \
  --skill maestro-orchestrator \
  --team-member-id tm_lead_001
```

The coordinator knows about Alice, Bob, and Charlie and will assign subtasks to them based on their roles.

---

## Tips

- **Use descriptive identities.** The identity field is free-form text injected into the system prompt. Be specific about coding standards, frameworks, and preferences.
- **Match models to complexity.** Use Opus for architects and complex work. Sonnet for solid execution. Haiku for repetitive tasks like tests and docs.
- **Reset a team member** to clear session state:

```bash
maestro team-member reset tm_alice_001
```

---

## What Next?

- **Want automated orchestration?** See [Use an Orchestrator](./orchestrator-coordination.md).
- **Want agents to talk to each other?** See [Inter-Session Messaging](./inter-session-messaging.md).
- **Want to control permissions?** See [Permissions](./permissions.md).
