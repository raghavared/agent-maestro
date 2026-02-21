# Master Project Feature — Architecture Design

## Overview

A **Master Project** is a special project designation that gives its sessions cross-project visibility. Sessions spawned within a master project can query and access tasks, sessions, docs, and team members across **all** projects in the Maestro app. This enables a "super-agent" workflow where one agent has full context of the entire workspace.

Multiple projects can be designated as master projects simultaneously, allowing different master agents to operate in different working directories while each having full cross-project access.

---

## 1. Data Model Changes

### 1.1 Project Type Extension

```typescript
// maestro-server/src/types.ts
export interface Project {
  id: string;
  name: string;
  workingDir: string;
  description?: string;
  isMaster?: boolean;       // NEW — marks this as a master project
  createdAt: number;
  updatedAt: number;
}
```

**Why a flag on Project?** Simplest approach — no new entities, no separate config file. A master project is just a regular project with elevated scope. This keeps the existing project CRUD intact and only adds behavior when `isMaster === true`.

### 1.2 Session Context Extension

```typescript
// maestro-server/src/types.ts — Session interface
export interface Session {
  // ... existing fields ...
  isMasterSession?: boolean;  // NEW — derived from project.isMaster at spawn time
}
```

Sessions spawned in a master project automatically inherit `isMasterSession: true`. This is cached on the session so the CLI doesn't need to look up the project every time.

---

## 2. Server Changes

### 2.1 ProjectService Updates

```typescript
// maestro-server/src/application/services/ProjectService.ts

// New method
async setMasterStatus(projectId: string, isMaster: boolean): Promise<Project> {
  const project = await this.projectRepo.findById(projectId);
  if (!project) throw new NotFoundError('Project', projectId);

  const updated = { ...project, isMaster, updatedAt: Date.now() };
  await this.projectRepo.update(updated);
  this.eventBus.emit('project:updated', { project: updated });
  return updated;
}

// New method
async listMasterProjects(): Promise<Project[]> {
  const all = await this.projectRepo.findAll();
  return all.filter(p => p.isMaster === true);
}
```

### 2.2 New API Routes — Cross-Project Queries

**Option A (Recommended): Dedicated `/api/master` route group**

```typescript
// maestro-server/src/api/masterRoutes.ts (NEW FILE)

// Toggle master status
PUT    /api/projects/:id/master    { isMaster: boolean }

// Cross-project queries (require master project context)
GET    /api/master/projects                    → all projects
GET    /api/master/tasks?projectId=<id>        → tasks, optional filter by project
GET    /api/master/sessions?projectId=<id>     → sessions, optional filter
GET    /api/master/docs?projectId=<id>         → all docs across projects
GET    /api/master/team-members?projectId=<id> → team members across projects

// Context endpoint — returns full cross-project summary
GET    /api/master/context                     → { projects, taskCounts, sessionCounts }
```

**Authorization model**: These endpoints check that the requesting session (via `X-Session-Id` header or query param) belongs to a master project. If not, return `403 Forbidden`.

### 2.3 SessionService Updates

When spawning a session in a master project:
1. Set `session.isMasterSession = true`
2. Include cross-project context in the manifest
3. Inject `MAESTRO_IS_MASTER=true` into session environment

```typescript
// In SessionService.spawnSession()
const project = await this.projectRepo.findById(projectId);
if (project.isMaster) {
  session.isMasterSession = true;
  session.env = {
    ...session.env,
    MAESTRO_IS_MASTER: 'true',
  };
}
```

### 2.4 Manifest Generation Enhancement

When generating a manifest for a master session, include:
- List of all projects with their names, IDs, and working directories
- Summary of task counts per project
- Active session counts per project

This gives the spawned agent immediate awareness of the full workspace.

---

## 3. CLI Changes

### 3.1 Config Extension

```typescript
// maestro-cli/src/config.ts
export interface MaestroConfig {
  // ... existing ...
  isMaster: boolean;  // NEW — from MAESTRO_IS_MASTER env var
}
```

### 3.2 New CLI Commands

```bash
# Mark/unmark a project as master
maestro project set-master <projectId>
maestro project unset-master <projectId>

# Cross-project queries (only available in master sessions)
maestro master projects              # List all projects
maestro master tasks [--project <id>] # List tasks across projects
maestro master sessions [--project <id>] # List sessions across projects
maestro master context               # Full cross-project summary
```

### 3.3 Existing Command Enhancements

When in a master session (`MAESTRO_IS_MASTER=true`):
- `maestro task list` gains `--all-projects` flag
- `maestro session list` gains `--all-projects` flag
- `maestro project list` already works (no change needed)

### 3.4 Command Permissions

```typescript
// maestro-cli/src/services/command-permissions.ts
// Add master-only commands that are gated behind isMaster context
const MASTER_COMMANDS = ['master:projects', 'master:tasks', 'master:sessions', 'master:context'];
```

---

## 4. Prompt System Changes

### 4.1 Master Session Prompt Additions

When a session is a master session, the prompt builder includes:

```xml
<master_project_context>
  <description>You are operating in a Master Project session. You have access to ALL projects in the workspace.</description>
  <projects>
    <project id="proj_xxx" name="Frontend App" workingDir="/path/to/frontend" taskCount="12" activeSessionCount="3" />
    <project id="proj_yyy" name="Backend API" workingDir="/path/to/backend" taskCount="8" activeSessionCount="2" />
    <!-- ... all projects ... -->
  </projects>
  <commands>
    Use `maestro master projects` to list all projects.
    Use `maestro master tasks --project <id>` to view tasks in any project.
    Use `maestro master sessions --project <id>` to view sessions in any project.
    Use `maestro master context` for a full workspace overview.
  </commands>
</master_project_context>
```

---

## 5. UI Changes

### 5.1 Project Visual Indicator

Master projects display a crown/star icon next to their name in:
- Project selector sidebar
- Project tab bar
- Multi-project board

### 5.2 Master Toggle

- Project settings/edit modal includes a "Master Project" toggle
- Confirmation dialog when enabling: "This will give sessions in this project access to all other projects"

### 5.3 Cross-Project Dashboard (Optional/Future)

When viewing a master project, an optional "All Projects" tab shows:
- Aggregated task board across all projects
- Session activity across all projects
- Unified timeline view

---

## 6. App Startup Flow

### 6.1 First Launch

When the Maestro app starts for the first time:
1. User is prompted to set up their first project
2. Option to designate it as a master project
3. If designated master, the project gets `isMaster: true`

### 6.2 Master Project Folder

The user provides a `workingDir` for the master project — this is where master sessions operate from. It could be:
- A parent directory containing multiple project repos
- A dedicated workspace folder
- Any directory the user chooses

### 6.3 Auto-Spawn Option (Future)

Optionally, when a master project is created, auto-spawn a "Master Agent" session that monitors and orchestrates work across projects.

---

## 7. Security & Authorization

### 7.1 Access Control

- Cross-project endpoints validate `isMasterSession` on the requesting session
- Regular sessions cannot access cross-project data
- The `isMaster` flag on a project can only be toggled by the user (not by sessions)

### 7.2 Read-Only Cross-Project Access

Master sessions can **read** all projects, tasks, sessions, and docs. For **writes** (creating tasks, spawning sessions in other projects), the master session must specify the target `projectId` explicitly.

---

## 8. Implementation Order

### Phase 1: Core Data Model (Server)
1. Add `isMaster` to Project type
2. Add `isMasterSession` to Session type
3. Update ProjectService with `setMasterStatus()`
4. Add `PUT /api/projects/:id/master` endpoint
5. Update validation schemas

### Phase 2: Cross-Project API (Server)
6. Create `masterRoutes.ts` with cross-project query endpoints
7. Add authorization middleware for master endpoints
8. Register routes in server.ts

### Phase 3: Session & Manifest (Server + CLI)
9. Update SessionService to set `isMasterSession` on spawn
10. Update manifest generation to include cross-project context
11. Add `MAESTRO_IS_MASTER` env var injection

### Phase 4: CLI Commands
12. Add `maestro project set-master / unset-master`
13. Add `maestro master` command group (projects, tasks, sessions, context)
14. Update command permissions for master-only commands
15. Add `--all-projects` flag to task/session list

### Phase 5: Prompt System
16. Update prompt builder for master session context
17. Add master project XML block to prompts

### Phase 6: UI
18. Add master project visual indicator (icon)
19. Add master toggle in project settings
20. Update project creation flow with master option

---

## 9. Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    MAESTRO APP                            │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Project A   │  │  Project B   │  │  Project C   │     │
│  │  (regular)   │  │  (regular)   │  │  (regular)   │     │
│  │             │  │             │  │             │     │
│  │  Tasks ──┐  │  │  Tasks ──┐  │  │  Tasks ──┐  │     │
│  │  Sessions │  │  │  Sessions │  │  │  Sessions │  │     │
│  │  Docs     │  │  │  Docs     │  │  │  Docs     │  │     │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘     │
│        │              │              │             │
│        └──────────────┼──────────────┘             │
│                       │                             │
│               ┌───────▼────────┐                    │
│               │ Cross-Project  │                    │
│               │ Query Layer    │                    │
│               │ /api/master/*  │                    │
│               └───────┬────────┘                    │
│                       │                             │
│  ┌────────────────────▼─────────────────────┐       │
│  │         MASTER PROJECT                    │       │
│  │         isMaster: true                    │       │
│  │                                           │       │
│  │  ┌─────────────────────────────────┐     │       │
│  │  │  Master Session                  │     │       │
│  │  │  isMasterSession: true           │     │       │
│  │  │                                  │     │       │
│  │  │  Can see: All Projects          │     │       │
│  │  │          All Tasks              │     │       │
│  │  │          All Sessions           │     │       │
│  │  │          All Docs               │     │       │
│  │  │                                  │     │       │
│  │  │  Uses: maestro master commands  │     │       │
│  │  └─────────────────────────────────┘     │       │
│  └───────────────────────────────────────────┘       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 10. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Master flag location | On Project entity | Simplest, no new entities, leverages existing CRUD |
| Multiple masters | Allowed | Flexibility — user may want different master contexts |
| Cross-project access | Read by default, write with explicit projectId | Safety — prevents accidental cross-project mutations |
| Auth model | Session-based (isMasterSession) | Cached at spawn, no per-request project lookups |
| CLI command group | `maestro master` | Clean separation, doesn't pollute existing commands |
| Manifest inclusion | Cross-project summary at spawn | Agent gets immediate context without extra CLI calls |
