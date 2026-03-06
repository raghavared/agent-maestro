# Monorepo Migration

> **Level:** Advanced | **Time:** 45 minutes | **Sessions:** 1 master + 2 coordinators + multiple workers

Migrate three standalone services into a monorepo using master sessions and multi-project coordination.

---

## What you build

A monorepo migration across three codebases:

- **Auth service** — JWT authentication and user management
- **User service** — User profiles and preferences
- **Shared libraries** — Common utilities, types, and middleware

You use a master session to coordinate across all three projects simultaneously.

## Prerequisites

- Maestro installed (`maestro status` returns a response)
- Completed the [E-Commerce Feature example](./ecommerce-feature.md) (recommended)
- Three existing service directories

---

## Step 1: Create projects

Create a project for each service and one for the monorepo destination.

```bash
# Monorepo destination (master project)
maestro project create "Platform Monorepo" --working-dir ~/projects/platform-monorepo

# Individual services
maestro project create "Auth Service" --working-dir ~/projects/auth-service
maestro project create "User Service" --working-dir ~/projects/user-service
maestro project create "Shared Libraries" --working-dir ~/projects/shared-libs
```

```
Project created:
  ID:   proj_1772050100000_monorepo
  Name: Platform Monorepo

Project created:
  ID:   proj_1772050100000_auth
  Name: Auth Service

Project created:
  ID:   proj_1772050100000_user
  Name: User Service

Project created:
  ID:   proj_1772050100000_shared
  Name: Shared Libraries
```

### Set the monorepo as a master project

A master project can manage tasks and sessions across other projects.

```bash
maestro project set-master proj_1772050100000_monorepo
```

```
Project "Platform Monorepo" is now a master project.
```

---

## Step 2: Create tasks in each project

Each project gets its own set of migration tasks.

### Shared libraries tasks

```bash
export MAESTRO_PROJECT_ID=proj_1772050100000_shared

maestro task create "Extract shared types" \
  --desc "Identify TypeScript types and interfaces used by both auth-service and user-service. Extract them into a shared @platform/types package. Include: User, AuthToken, ApiResponse, PaginationParams, ErrorCode. Set up the package with tsconfig, package.json, and barrel exports." \
  --priority high

maestro task create "Extract shared middleware" \
  --desc "Extract common Express middleware used by both services into a @platform/middleware package. Include: error handler, request logger, rate limiter, CORS config, request ID generator. Each middleware should be independently importable." \
  --priority high

maestro task create "Extract shared utilities" \
  --desc "Extract common utility functions into a @platform/utils package. Include: date formatting, string helpers, validation functions, crypto helpers (hash, compare), JWT sign/verify wrappers. Add unit tests for every utility function." \
  --priority medium
```

### Auth service tasks

```bash
export MAESTRO_PROJECT_ID=proj_1772050100000_auth

maestro task create "Migrate auth service to monorepo" \
  --desc "Move the auth service codebase into packages/auth-service/ in the monorepo. Update all import paths to use @platform/types, @platform/middleware, and @platform/utils packages instead of local copies. Update tsconfig to use project references. Ensure all existing tests pass after migration." \
  --priority high

maestro task create "Update auth service dependencies" \
  --desc "Replace direct dependencies with workspace references. Remove duplicated packages that now come from shared libs. Update package.json to use workspace:* protocol for @platform/* packages. Verify the service builds and starts correctly." \
  --priority high
```

### User service tasks

```bash
export MAESTRO_PROJECT_ID=proj_1772050100000_user

maestro task create "Migrate user service to monorepo" \
  --desc "Move the user service codebase into packages/user-service/ in the monorepo. Update all import paths to use @platform/types, @platform/middleware, and @platform/utils packages. Update tsconfig to use project references. Ensure all existing tests pass after migration." \
  --priority high

maestro task create "Update user service dependencies" \
  --desc "Replace direct dependencies with workspace references. Remove duplicated packages that now come from shared libs. Update package.json to use workspace:* protocol for @platform/* packages. Verify the service builds and starts correctly." \
  --priority high
```

### Integration tasks (on the master project)

```bash
export MAESTRO_PROJECT_ID=proj_1772050100000_monorepo

maestro task create "Set up monorepo workspace" \
  --desc "Initialize the monorepo with a root package.json using npm workspaces (or pnpm/yarn workspaces). Create the packages/ directory structure. Set up root tsconfig.json with project references for all packages. Add turbo.json or nx.json for build orchestration. Configure shared ESLint and Prettier configs." \
  --priority high

maestro task create "Run cross-service integration tests" \
  --desc "Write and run integration tests that verify the migrated services work together. Test: auth service issues a token, user service validates it using shared JWT utilities. Test: both services use the shared error handler correctly. Test: shared middleware works identically in both services. All tests must pass from the monorepo root." \
  --priority medium

maestro task create "Update CI/CD pipeline" \
  --desc "Create a GitHub Actions workflow for the monorepo. Use turbo/nx to only build and test changed packages. Set up: lint all packages, build shared libs first, build services in parallel, run unit tests per package, run integration tests. Add caching for node_modules and build outputs." \
  --priority medium
```

---

## Step 3: View tasks across all projects

Use master commands to see everything from one place.

```bash
export MAESTRO_PROJECT_ID=proj_1772050100000_monorepo

maestro master tasks
```

```
All tasks across projects:

  Project              Task                                    Status   Priority
  ─────────────────────────────────────────────────────────────────────────────
  Shared Libraries     Extract shared types                    todo     high
  Shared Libraries     Extract shared middleware                todo     high
  Shared Libraries     Extract shared utilities                 todo     medium
  Auth Service         Migrate auth service to monorepo        todo     high
  Auth Service         Update auth service dependencies         todo     high
  User Service         Migrate user service to monorepo        todo     high
  User Service         Update user service dependencies         todo     high
  Platform Monorepo    Set up monorepo workspace               todo     high
  Platform Monorepo    Run cross-service integration tests     todo     medium
  Platform Monorepo    Update CI/CD pipeline                   todo     medium
```

---

## Step 4: Spawn the master coordinator

A master session coordinates across all projects. It spawns sub-coordinators for each project.

```bash
maestro session spawn \
  --mode coordinator \
  --name "migration-master" \
  --context "You are coordinating a monorepo migration across three projects. Phase 1: Set up monorepo workspace and extract shared libraries (in parallel). Phase 2: Migrate both services (in parallel, after shared libs are done). Phase 3: Run integration tests and update CI/CD (after both services are migrated). Spawn sub-coordinators for each project."
```

```
Session spawned:
  ID:     sess_1772050200000_master
  Name:   migration-master
  Mode:   coordinator
  Status: spawning
```

---

## Step 5: Monitor the multi-level orchestration

### View all sessions across projects

```bash
maestro master sessions
```

```
All sessions across projects:

  Project              Session                  Mode                     Status    Tasks
  ────────────────────────────────────────────────────────────────────────────────────────
  Platform Monorepo    migration-master         coordinator              working   3
  Platform Monorepo    monorepo-setup           worker                   working   1
  Shared Libraries     shared-libs-coord        coordinated-coordinator  working   3
  Shared Libraries     types-worker             coordinated-worker       working   1
  Shared Libraries     middleware-worker         coordinated-worker       working   1
```

The master coordinator has:

1. Spawned a worker to set up the monorepo workspace
2. Spawned a sub-coordinator for the shared libraries project
3. The sub-coordinator has spawned its own workers for types and middleware

### Track the full orchestration tree

```bash
maestro session info sess_1772050200000_master
```

```
Session: migration-master
  ID:       sess_1772050200000_master
  Status:   working
  Mode:     coordinator

  Child sessions:
    sess_1772050200000_setup   monorepo-setup        worker                   completed
    sess_1772050300000_shcoord shared-libs-coord      coordinated-coordinator  working
    sess_1772050300000_aucoord auth-service-coord     coordinated-coordinator  idle
    sess_1772050300000_uscoord user-service-coord     coordinated-coordinator  idle
```

Notice the auth and user service coordinators are idle — they wait for the shared libraries to complete first.

---

## Step 6: Watch phases unfold

### Phase 1: Shared libraries + workspace setup (parallel)

```bash
maestro master tasks --project proj_1772050100000_shared
```

```
Tasks for Shared Libraries:

  Task                           Status        Priority
  Extract shared types           completed     high
  Extract shared middleware      completed     high
  Extract shared utilities       in_progress   medium
```

```bash
maestro task get <monorepo-setup-task-id>
```

```
Task: Set up monorepo workspace
  Status: completed
  Timeline:
    [15 min ago]  Progress: Created root package.json with workspaces config
    [10 min ago]  Progress: Set up tsconfig project references
    [5 min ago]   Completed: Monorepo workspace ready with turbo.json
```

### Phase 2: Service migrations (parallel, after Phase 1)

Once shared libraries are complete, the master coordinator unblocks the service coordinators.

```bash
maestro master sessions
```

```
All sessions across projects:

  Project              Session                  Mode                     Status     Tasks
  ────────────────────────────────────────────────────────────────────────────────────────
  Platform Monorepo    migration-master         coordinator              working    3
  Shared Libraries     shared-libs-coord        coordinated-coordinator  completed  3
  Auth Service         auth-service-coord       coordinated-coordinator  working    2
  Auth Service         auth-migrate-worker      coordinated-worker       working    1
  User Service         user-service-coord       coordinated-coordinator  working    2
  User Service         user-migrate-worker      coordinated-worker       working    1
```

Both services migrate in parallel, each with their own coordinator and workers.

### Phase 3: Integration tests + CI/CD (after Phase 2)

```bash
maestro master tasks
```

```
All tasks across projects:

  Project              Task                                    Status      Priority
  ─────────────────────────────────────────────────────────────────────────────────
  Shared Libraries     Extract shared types                    completed   high
  Shared Libraries     Extract shared middleware                completed   high
  Shared Libraries     Extract shared utilities                 completed   medium
  Auth Service         Migrate auth service to monorepo        completed   high
  Auth Service         Update auth service dependencies         completed   high
  User Service         Migrate user service to monorepo        completed   high
  User Service         Update user service dependencies         completed   high
  Platform Monorepo    Set up monorepo workspace               completed   high
  Platform Monorepo    Run cross-service integration tests     in_progress medium
  Platform Monorepo    Update CI/CD pipeline                   in_progress medium
```

---

## Step 7: Review the completed migration

```bash
maestro master context
```

```
Master context for Platform Monorepo:

  Projects:    4
  Tasks:       10 (10 completed)
  Sessions:    11 (11 completed)
  Duration:    38 minutes

  Project Summary:
    Platform Monorepo  - 3/3 tasks completed
    Shared Libraries   - 3/3 tasks completed
    Auth Service       - 2/2 tasks completed
    User Service       - 2/2 tasks completed
```

The final monorepo structure:

```
platform-monorepo/
├── package.json              # Workspace root
├── turbo.json                # Build orchestration
├── tsconfig.json             # Root project references
├── packages/
│   ├── types/                # @platform/types
│   │   ├── src/
│   │   └── package.json
│   ├── middleware/            # @platform/middleware
│   │   ├── src/
│   │   └── package.json
│   ├── utils/                # @platform/utils
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   ├── auth-service/         # Migrated auth service
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   └── user-service/         # Migrated user service
│       ├── src/
│       ├── tests/
│       └── package.json
├── tests/
│   └── integration/          # Cross-service tests
└── .github/
    └── workflows/
        └── ci.yml            # Monorepo CI pipeline
```

---

## Orchestration diagram

```
                         ┌─────────────────┐
                         │  Master Session  │
                         │ migration-master │
                         └────────┬────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌────────▼────────┐  ┌────────▼────────┐           │
   │  Monorepo Setup │  │  Shared Libs    │           │
   │  (worker)       │  │  (sub-coord)    │           │
   └────────┬────────┘  └────────┬────────┘           │
            │              ┌─────┼─────┐              │
            │              │     │     │              │
  Phase 1   │           types  mw   utils             │
            │           wkr   wkr   wkr               │
            │              │     │     │              │
            ▼              └─────┴─────┘              │
   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
            │                                         │
   ┌────────▼────────┐          ┌─────────────────────▼─┐
   │  Auth Service   │          │  User Service          │
   │  (sub-coord)    │          │  (sub-coord)           │
   └────────┬────────┘          └────────┬───────────────┘
  Phase 2   │                            │
         migrate                      migrate
         deps                         deps
            │                            │
            ▼                            ▼
   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
            │                            │
  Phase 3  integration tests         CI/CD pipeline
```

---

## Key concepts demonstrated

| Concept | How it appears in this example |
|---------|-------------------------------|
| Master project | The monorepo project oversees all others |
| Multi-project coordination | Tasks exist across four separate projects |
| `master tasks` / `master sessions` | Single-pane view across all projects |
| Coordinated-coordinator | Sub-coordinators for shared libs, auth, and user services |
| Coordinated-worker | Workers spawned by sub-coordinators |
| Phase-based execution | Shared libs first, services second, tests third |
| Cross-project dependencies | Services depend on shared libraries completing first |

---

## Full command summary

```bash
# 1. Create projects
maestro project create "Platform Monorepo" --working-dir ~/projects/platform-monorepo
maestro project create "Auth Service" --working-dir ~/projects/auth-service
maestro project create "User Service" --working-dir ~/projects/user-service
maestro project create "Shared Libraries" --working-dir ~/projects/shared-libs

# 2. Set master
maestro project set-master <monorepo-project-id>

# 3. Create tasks per project (see Step 2 above for full commands)
# Shared Libraries: 3 tasks
# Auth Service: 2 tasks
# User Service: 2 tasks
# Platform Monorepo: 3 tasks

# 4. Spawn master coordinator
maestro session spawn --mode coordinator --name "migration-master" \
  --context "Coordinate monorepo migration across three projects..."

# 5. Monitor
maestro master tasks
maestro master sessions
maestro master context
```

---

## What you learned

- **Master projects** coordinate work across multiple projects
- **`maestro master` commands** give a unified view of tasks and sessions
- **Multi-level orchestration** uses coordinators that spawn sub-coordinators
- **Coordinated-coordinator** mode lets sub-coordinators manage their own workers
- **Phase-based execution** ensures dependencies are respected across projects
- **Cross-project context** lets the master session understand the full picture

## Next steps

- [Open Source Contribution](./open-source-contribution.md) — Use custom skills and queue mode for a meta workflow
- [Master Sessions Guide](/docs/guides/master-sessions) — Deep dive into multi-project coordination
- [Advanced Patterns](/docs/guides/advanced-patterns) — DAG execution, batching, and more
