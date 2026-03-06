# Coordinate Across Multiple Projects

**Scenario:** You manage multiple repos or services. See tasks, sessions, and progress across all of them from one place.

---

## Prerequisites

- Multiple projects registered in Maestro
- At least one master project set up

## Step 1: Create Your Projects

Register each repo as a Maestro project:

```bash
maestro project create "frontend-app"
maestro project create "backend-api"
maestro project create "shared-lib"
```

```
Project created
ID: proj_frontend_001
Name: frontend-app

Project created
ID: proj_backend_002
Name: backend-api

Project created
ID: proj_shared_003
Name: shared-lib
```

## Step 2: Designate a Master Project

Set one project as the master — this is your control center:

```bash
maestro project set-master proj_frontend_001
```

The master project can query across all other projects.

## Step 3: Spawn a Master Session

```bash
maestro session spawn --task <task-id> --mode coordinator
```

When spawning from a master project, the session gets cross-project visibility.

---

## Master Commands

From a master session or with master context, you can query everything:

### See All Projects

```bash
maestro master projects
```

```
ID                Name           Working Dir                   Master
proj_frontend     frontend-app   /Users/you/code/frontend      [master]
proj_backend      backend-api    /Users/you/code/backend
proj_shared       shared-lib     /Users/you/code/shared
```

### See Tasks Across All Projects

```bash
maestro master tasks
```

```
ID            Title                        Status      Priority   Project
task_fe_001   Build login page             🔄 working    high       frontend-app
task_be_001   Add auth endpoint            ⬜ todo       high       backend-api
task_be_002   Set up database              ✅ completed  high       backend-api
task_sh_001   Extract shared types         🔄 working    medium     shared-lib
```

Filter by project:

```bash
maestro master tasks --project proj_backend_002
```

### See Sessions Across All Projects

```bash
maestro master sessions
```

```
ID            Name                     Status     Project
sess_001      Worker: Build login      working    frontend-app
sess_002      Worker: Extract types    working    shared-lib
sess_003      Worker: Set up DB        completed  backend-api
```

Filter by project:

```bash
maestro master sessions --project proj_frontend_001
```

### Full Workspace Overview

```bash
maestro master context
```

```
Workspace Overview
==================

proj_frontend [master] — frontend-app
  Tasks: 3 (1 working, 1 todo, 1 completed)
  Sessions: 2 (1 working, 1 completed)

proj_backend — backend-api
  Tasks: 4 (2 todo, 2 completed)
  Sessions: 1 (1 completed)

proj_shared — shared-lib
  Tasks: 2 (1 working, 1 completed)
  Sessions: 1 (1 working)
```

---

## Cross-Project Workflows

### Coordinating a Feature Across Repos

When a feature spans multiple projects (e.g., shared types → backend API → frontend UI):

1. Create tasks in each project
2. Spawn workers in each project
3. Use the master view to monitor everything
4. Use inter-session messaging if workers need to coordinate

```bash
# Create tasks in each project
MAESTRO_PROJECT_ID=proj_shared maestro task create "Export UserType interface"
MAESTRO_PROJECT_ID=proj_backend maestro task create "Add GET /api/users endpoint"
MAESTRO_PROJECT_ID=proj_frontend maestro task create "Build user list component"

# Spawn workers
MAESTRO_PROJECT_ID=proj_shared maestro session spawn --task task_sh_types
MAESTRO_PROJECT_ID=proj_backend maestro session spawn --task task_be_users
MAESTRO_PROJECT_ID=proj_frontend maestro session spawn --task task_fe_users

# Monitor from master
maestro master sessions
```

**In the desktop app:** The multi-project board shows all projects side by side. Switch between project views or see the aggregated master view.

---

## Unsetting Master

To remove master status from a project:

```bash
maestro project unset-master proj_frontend_001
```

---

## Tips

- **One master project per workspace.** The master project is your command center — pick the one you work from most.
- **Project context matters.** Most commands operate within a project context. Use `MAESTRO_PROJECT_ID` or `--project` to target specific projects from anywhere.
- **Master sessions see everything.** A coordinator spawned from a master project can query tasks and sessions across all projects.

---

## What Next?

- **Want agents to communicate across sessions?** See [Inter-Session Messaging](./inter-session-messaging.md).
- **Want to track everything live?** See [Track Progress in Real Time](./real-time-tracking.md).
- **Want a team per project?** See [Set Up a Team](./team-setup.md).
