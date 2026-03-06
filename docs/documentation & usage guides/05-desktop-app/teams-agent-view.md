# Teams & Agent View

**Build teams of AI agents, configure each member, and watch them collaborate in real time.**

---

## Team Members

Before creating a team, you need team member profiles. These define the identity and capabilities of each agent.

### Team Members Panel

Click the **Members** icon in the icon rail to open the team members panel.

[screenshot placeholder: Team Members panel showing a grid of agent profiles with avatars, names, roles, and model badges]

### Creating a Team Member

Click **+ New Member** to open the team member creation modal.

[screenshot placeholder: Team Member creation modal showing all configuration fields]

| Field | Description |
|-------|-------------|
| **Name** | Display name (e.g., "Frontend Dev", "Code Reviewer") |
| **Role** | Short description of what this agent does |
| **Avatar** | Emoji or character that represents this member |
| **Identity** | Free-text instructions that shape the agent's behavior and expertise |
| **Agent tool** | `Claude Code`, `OpenAI Codex`, or `Google Gemini` |
| **Model** | Specific model to use (e.g., Haiku, Sonnet, Opus for Claude) |
| **Mode** | The agent's orchestration role (see below) |
| **Permission mode** | How the agent handles tool permissions |
| **Skills** | Which skill plugins to attach |
| **Capabilities** | Fine-grained permission toggles |
| **Command permissions** | Which Maestro CLI commands the agent can use |

### Agent Modes

| Mode | Description |
|------|-------------|
| **Worker** | Standalone executor — writes code, runs tests, fixes bugs |
| **Coordinator** | Orchestrator — breaks down tasks, spawns workers, monitors progress |
| **Coordinated Worker** | Worker spawned by a coordinator, reports back to it |
| **Coordinated Coordinator** | Coordinator spawned by another coordinator |

### Capabilities

Fine-grained toggles for what the agent is allowed to do:

| Capability | Description |
|------------|-------------|
| **Spawn Sessions** | Can create new agent sessions |
| **Edit Tasks** | Can create, edit, and delete tasks |
| **Report Task-Level** | Can report progress on individual tasks |
| **Report Session-Level** | Can report session-wide progress |

### Command Permissions

Control which Maestro CLI commands the agent can use, organized by group:
- **Root** — `whoami`, `status`, `commands`
- **Task** — `task:list`, `task:get`, `task:create`, `task:edit`, etc.
- **Session** — `session:siblings`, `session:info`, `session:prompt`, etc.
- **Team Member** — `team-member:create`, `team-member:list`, `team-member:get`
- **Show/Modal** — `show:modal`, `modal:events`

Defaults depend on the agent's mode. Toggle individual commands to restrict or grant access.

### Preset Templates

Quick-start from pre-configured templates:

| Template | Role | Mode |
|----------|------|------|
| **Simple Worker** | Default executor | Worker |
| **Coordinator** | Task orchestrator | Coordinator |
| **Batch Coordinator** | Intelligent batch orchestrator | Coordinator |
| **DAG Coordinator** | DAG-based orchestrator | Coordinator |
| **Recruiter** | Team member recruiter with skill discovery | Worker |

### Sound Identity

Each team member can be assigned a unique **sound instrument** — when that agent reports progress, completion, or errors, you hear their distinctive sound. Makes it easy to track who's doing what by ear.

---

## Teams

Teams group multiple members together for coordinated work.

### Teams Panel

Click the **Teams** icon in the icon rail to open the teams panel.

[screenshot placeholder: Teams panel showing team cards with member counts and launch buttons]

When no teams exist, you'll see:

```
╔═══════════════════════════════════════╗
║                                       ║
║       NO TEAMS YET                    ║
║                                       ║
║    Create teams to group your         ║
║    team members together              ║
║                                       ║
╚═══════════════════════════════════════╝
```

### Creating a Team

Click **+ Create Team** to open the team creation modal.

[screenshot placeholder: Team creation modal with name, description, leader selection, and member list]

| Field | Description |
|-------|-------------|
| **Name** | Team display name |
| **Description** | What this team does |
| **Avatar** | Emoji for the team |
| **Leader** | Which member is the coordinator (spawns and manages others) |
| **Members** | Select which team members to include |

### Team Hierarchy

Teams support nesting — a team can contain **sub-teams**. This lets you model complex organizational structures:

```
Main Team
├── Frontend Team
│   ├── UI Developer
│   └── Component Tester
├── Backend Team
│   ├── API Developer
│   └── Database Engineer
└── QA Team
    └── Integration Tester
```

---

## Launching a Team

Click the **Run** button on a team card to open the launch configuration modal.

[screenshot placeholder: Team Launch Configuration modal showing all members with their tools, models, and permission toggles]

### Launch Configuration

For each team member, you can override:

| Setting | Options |
|---------|---------|
| **Agent tool** | Claude Code, OpenAI Codex, Google Gemini |
| **Model** | Tool-specific model options |
| **Dangerous mode** | Toggle bypass-permissions mode (shown as ⚠ dangerous / 🛡 safe) |
| **Skills** | Add or remove skill plugins per member |
| **Command permissions** | Fine-tune CLI command access |

Expand a member's card to see the full skills selector and command permissions grid.

### Launch Actions

| Button | Action |
|--------|--------|
| **Cancel** | Close without launching |
| **Save** | Save override configuration for future launches |
| **Save as Team** | Save this configuration as a new reusable team |
| **Launch** | Start all team members simultaneously |

When you click **Launch**, Maestro:
1. Spawns a coordinator session for the team leader
2. The coordinator spawns worker sessions for each team member
3. All sessions appear in the sidebar and can be viewed individually or in the Team View

---

## Team View

When a team is running, click the **Team View** button to see all team terminals simultaneously in a split-screen overlay.

[screenshot placeholder: Team View showing coordinator terminal on the left and worker terminals stacked on the right]

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  👨‍👩‍👧‍👦 My Team    Active    3 members    Esc to close       │
├─────────────────────────────┬──────────────────────────────┤
│                             │  ⚡ Frontend Dev   working   │
│  🎯 Coordinator             │  ┌────────────────────────┐  │
│                             │  │ Agent terminal output  │  │
│  ┌───────────────────────┐  │  └────────────────────────┘  │
│  │                       │  ├──────────────────────────────┤
│  │  Coordinator terminal │  │  ⚡ Backend Dev    working   │
│  │  output               │  │  ┌────────────────────────┐  │
│  │                       │  │  │ Agent terminal output  │  │
│  └───────────────────────┘  │  └────────────────────────┘  │
├─────────────────────────────┴──────────────────────────────┤
```

- **Coordinator** takes the left panel (full height)
- **Workers** stack vertically in the right panel
- A **resizable divider** between coordinator and workers — drag to adjust the split
- Each slot shows the member's **avatar**, **name**, **role**, and **status**

### Interaction

| Action | Effect |
|--------|--------|
| **Double-click a terminal** | Jump to that session in the main workspace and close the Team View |
| **Press Escape** | Close the Team View overlay |
| **Drag the divider** | Resize the coordinator/worker split (20%–80% range) |

Terminals are **live** — they show real-time output. Each terminal auto-scrolls to the latest output.

### Team Session Groups

In the multi-project sessions view, sessions spawned by the same team are grouped together with the team's name and avatar, making it easy to see which sessions belong to which team.

> **Next:** [Command Palette & Keyboard Shortcuts](./command-palette.md) — Quick access to everything.
