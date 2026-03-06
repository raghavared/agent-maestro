# Teams & Team Members

**Instead of spawning generic Claude sessions, you create named agent profiles with specific roles, models, and personalities. Then you group them into teams.**

---

## What is a Team Member?

A team member is a reusable agent profile. Instead of saying "spawn a Claude session with Opus, using these skills, with this persona," you define it once as a team member and reuse it across tasks.

```bash
maestro team-member create "Alice" \
  --role "Frontend Engineer" \
  --avatar "👩‍💻" \
  --model opus \
  --identity "You are a senior frontend engineer who writes clean, accessible React code. You prefer Tailwind CSS and always write tests."
```

Now whenever you assign Alice to a task, she spawns with that exact configuration — same model, same persona, same skills.

## Why Team Members Matter

Without team members, every session is a blank slate. Claude doesn't know if it's supposed to be a frontend expert or a DevOps engineer. Team members solve this:

- **Consistency.** The same agent behaves the same way every time.
- **Specialization.** A frontend agent and a backend agent approach problems differently because they have different identities.
- **Memory.** Team members can accumulate persistent notes across sessions.
- **Cost control.** Assign Opus to complex work and Haiku to simple tasks.

## Team Member Data Model

```typescript
interface TeamMember {
  id: string;
  projectId: string;
  name: string;                    // "Alice"
  role: string;                    // "Frontend Engineer"
  identity?: string;               // Custom system prompt / persona
  avatar: string;                  // "👩‍💻"
  model?: string;                  // "opus", "sonnet", "haiku"
  agentTool?: 'claude-code' | 'codex' | 'gemini';
  mode?: 'worker' | 'coordinator' | 'coordinated-worker' | 'coordinated-coordinator';
  permissionMode?: 'acceptEdits' | 'interactive' | 'readOnly' | 'bypassPermissions';
  skillIds?: string[];             // Skills to load for this member
  memory?: string[];               // Persistent notes across sessions
  capabilities?: {
    can_spawn_sessions?: boolean;
    can_edit_tasks?: boolean;
    can_report_task_level?: boolean;
    can_report_session_level?: boolean;
  };
  commandPermissions?: {
    groups?: Record<string, boolean>;
    commands?: Record<string, boolean>;
  };
}
```

Team members are stored at `~/.maestro/data/team-members/<project-id>.json`.

## Creating Team Members

### Basic

```bash
maestro team-member create "Bob" --role "Backend Engineer"
```

### Fully configured

```bash
maestro team-member create "Alice" \
  --role "Frontend Engineer" \
  --avatar "👩‍💻" \
  --model opus \
  --agent-tool claude-code \
  --mode worker \
  --permission-mode acceptEdits \
  --identity "You are a senior frontend engineer specializing in React and TypeScript. You write accessible, performant components with comprehensive tests. You prefer Tailwind CSS for styling." \
  --skill-ids my-frontend-skill,code-review
```

### Edit an existing member

```bash
maestro team-member edit <member-id>
```

### View a member

```bash
maestro team-member get <member-id>
```

### List all members

```bash
maestro team-member list
```

## Identity: The Custom System Prompt

The `identity` field is injected into Claude's system prompt when the team member starts a session. It shapes how the agent thinks and responds.

Good identities are:
- **Specific** about expertise: "You specialize in GraphQL APIs and PostgreSQL."
- **Clear** about preferences: "You prefer functional patterns over classes."
- **Actionable**: "Always run the test suite before reporting completion."

```bash
maestro team-member update-identity <member-id>
# Opens an editor to write/update the identity
```

## Memory: Persistent Notes

Team members can accumulate memory — notes that persist across sessions. Use this for knowledge that should carry over:

```bash
# Add a memory entry
maestro team-member memory append <member-id> "The auth module uses JWT with RS256 signing"

# View all memories
maestro team-member memory list <member-id>

# Clear all memories
maestro team-member memory clear <member-id>
```

Memories are included in the manifest when the team member spawns, so Claude sees them as part of its context.

## Assigning Team Members to Tasks

When you spawn a session with a team member, the member's configuration (model, identity, skills, permissions) is applied automatically:

```bash
# Spawn a session with a specific team member
maestro session spawn --task <task-id> --team-member-id <member-id>
```

You can also assign team members to tasks directly:

```bash
maestro task edit <task-id>
# Set teamMemberId in the editor
```

## What is a Team?

A team groups multiple team members together with a leader. It represents a unit that works together on related tasks.

```bash
maestro team create "Frontend Squad" \
  --desc "Handles all UI/UX work" \
  --leader <alice-member-id> \
  --members <bob-member-id>,<charlie-member-id> \
  --avatar "🎨"
```

## Team Data Model

```typescript
interface Team {
  id: string;
  projectId: string;
  name: string;                // "Frontend Squad"
  description?: string;
  avatar?: string;             // "🎨"
  leaderId: string;            // Team member who leads
  memberIds: string[];         // All team member IDs
  subTeamIds: string[];        // Nested teams
  status: 'active' | 'archived';
}
```

Teams are stored at `~/.maestro/data/teams/<project-id>.json`.

## Working with Teams

### Create

```bash
maestro team create "Backend Team" \
  --desc "API and database development" \
  --leader <lead-member-id> \
  --members <member-1-id>,<member-2-id>
```

### Add and remove members

```bash
maestro team add-member <team-id> <member-id-1> <member-id-2>
maestro team remove-member <team-id> <member-id>
```

### Sub-teams

Teams can contain sub-teams for hierarchical organization:

```bash
maestro team add-sub-team <parent-team-id> <sub-team-id>
maestro team remove-sub-team <parent-team-id> <sub-team-id>
```

### View team structure

```bash
# See the full team tree
maestro team tree <team-id>

# View team details
maestro team get <team-id>

# List all teams
maestro team list
```

### Archive/unarchive

```bash
maestro team archive <team-id>
maestro team unarchive <team-id>
```

## Permission Modes

Each team member can have a different permission mode, controlling how much autonomy they have:

| Mode | Behavior |
|------|----------|
| `acceptEdits` | Claude can edit files without asking (default) |
| `interactive` | Claude asks before each file edit |
| `readOnly` | Claude can read but not modify files |
| `bypassPermissions` | Claude can do anything without prompts |

```bash
maestro team-member create "Reviewer" \
  --role "Code Reviewer" \
  --permission-mode readOnly
```

## Capabilities

Fine-grained control over what a team member can do within Maestro:

```typescript
capabilities: {
  can_spawn_sessions: true,      // Can this member spawn new sessions?
  can_edit_tasks: true,           // Can this member create/edit tasks?
  can_report_task_level: true,    // Can this member report on tasks?
  can_report_session_level: true  // Can this member report session status?
}
```

A worker typically doesn't need `can_spawn_sessions`. A coordinator does. Set capabilities to match the role.

## Example: Building a Team

```bash
# Create team members
maestro team-member create "Lead" \
  --role "Tech Lead" --model opus --mode coordinator --avatar "👑"

maestro team-member create "Frontend" \
  --role "Frontend Dev" --model sonnet --mode worker --avatar "🎨" \
  --identity "React/TypeScript specialist. Use Tailwind. Write tests."

maestro team-member create "Backend" \
  --role "Backend Dev" --model sonnet --mode worker --avatar "⚙️" \
  --identity "Node.js/Express specialist. Write clean REST APIs."

maestro team-member create "QA" \
  --role "QA Engineer" --model haiku --mode worker --avatar "🧪" \
  --identity "Write thorough tests. Focus on edge cases and error paths."

# Create the team
maestro team create "Product Team" \
  --leader <lead-id> \
  --members <frontend-id>,<backend-id>,<qa-id>
```

> **Next:** [Skills](./skills.md) — Inject custom instructions and context into your sessions.
