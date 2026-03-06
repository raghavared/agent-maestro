# Projects

**A project is a container that groups your tasks, sessions, and teams into one workspace.**

---

## What is a Project?

A project in Maestro is a workspace boundary. It ties together everything related to a piece of work — the tasks that define what needs to happen, the sessions that do the work, and the team members involved.

Every project is linked to a directory on your filesystem. When you create a project, you're telling Maestro: "this folder is where work happens."

```bash
maestro project create "my-app" --dir /path/to/my-app
```

That's it. You now have a project. All tasks, sessions, and team members you create will be scoped to it.

## Why Projects Matter

Without projects, everything would be one flat pile — tasks from different repos mixed together, sessions with no context about what they belong to. Projects give you:

- **Isolation.** Each project has its own tasks, sessions, and teams. Work on `frontend-app` doesn't bleed into `backend-api`.
- **Context.** When a Claude session spawns inside a project, it knows which directory to work in and which tasks are relevant.
- **Organization.** The Maestro UI groups everything by project, so you can switch between workspaces cleanly.

## How It Works

Projects are stored as plain JSON files on disk:

```
~/.maestro/data/projects/<project-id>.json
```

Each project file contains:

```typescript
{
  id: string;          // Unique identifier
  name: string;        // Human-readable name (e.g., "my-app")
  workingDir: string;  // Filesystem path (e.g., "/Users/you/projects/my-app")
  description?: string;
  isMaster?: boolean;  // Whether this is a master project
  createdAt: number;
  updatedAt: number;
}
```

## Working with Projects

### Create a project

```bash
maestro project create "my-app"
```

If you don't specify `--dir`, it defaults to the current working directory.

### List all projects

```bash
maestro project list
```

### View project details

```bash
maestro project get <project-id>
```

### Delete a project

```bash
maestro project delete <project-id>
```

## Advanced: Master Projects

A master project can see across other projects. It's designed for cross-project orchestration — when you need one coordinator to manage work that spans multiple repositories or services.

```bash
# Mark a project as master
maestro project set-master <project-id>

# Remove master status
maestro project unset-master <project-id>
```

When a session runs inside a master project, it gets access to special commands:

```bash
# See all projects
maestro master projects

# See tasks across projects
maestro master tasks --project <other-project-id>

# See sessions across projects
maestro master sessions --project <other-project-id>

# Get full cross-project context
maestro master context
```

**When to use master projects:** You're building a system with a frontend repo, a backend repo, and an infrastructure repo. A master project lets one orchestrator coordinate work across all three.

## One Project Per Scope

The general rule: **one project per repo, feature area, or team**. Keep projects focused. If you find yourself with hundreds of unrelated tasks in one project, split it up.

> **Next:** [Tasks](./tasks.md) — The backbone of everything Maestro does.
