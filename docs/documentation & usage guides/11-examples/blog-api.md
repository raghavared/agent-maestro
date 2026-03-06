# Build a Blog API

> **Level:** Beginner | **Time:** 15 minutes | **Sessions:** 1 worker

Build a REST API for a blog with posts and authentication. This example walks you through the core Maestro workflow: create a project, add tasks, spawn a session, and track progress.

---

## What you build

A Node.js blog API with three features:

- `GET /posts` and `POST /posts` endpoints
- JWT authentication middleware
- Unit tests for all endpoints

## Prerequisites

- Maestro installed (`maestro status` returns a response)
- A working directory for your project (e.g., `~/projects/blog-api`)

---

## Step 1: Create a project

Every Maestro workflow starts with a project. A project links to a directory on disk.

```bash
maestro project create "Blog API" --working-dir ~/projects/blog-api
```

```
Project created:
  ID:   proj_1772040100000_abc123def
  Name: Blog API
  Dir:  /Users/you/projects/blog-api
```

Copy the project ID. You need it for the next steps.

```bash
export MAESTRO_PROJECT_ID=proj_1772040100000_abc123def
```

---

## Step 2: Create tasks

Create three tasks that represent the work. Each task has a title and description.

### Task 1: Create posts endpoints

```bash
maestro task create "Create /posts endpoints" \
  --desc "Build a REST API with Express.js. Create GET /posts (list all posts, return JSON array) and POST /posts (create a new post, accept title and body in request body, return created post with 201 status). Use an in-memory array for storage. Include proper error handling and input validation." \
  --priority high
```

```
Task created:
  ID:       task_1772040200000_posts123
  Title:    Create /posts endpoints
  Status:   todo
  Priority: high
```

### Task 2: Add authentication

```bash
maestro task create "Add JWT authentication" \
  --desc "Add JWT-based authentication middleware to the blog API. Create POST /auth/login endpoint that accepts username/password and returns a JWT token. Create middleware that validates the JWT token on protected routes. Protect the POST /posts endpoint so only authenticated users can create posts. GET /posts remains public." \
  --priority high
```

```
Task created:
  ID:       task_1772040200000_auth456
  Title:    Add JWT authentication
  Status:   todo
  Priority: high
```

### Task 3: Write tests

```bash
maestro task create "Write unit tests" \
  --desc "Write unit tests using Jest for the blog API. Test GET /posts returns empty array initially, POST /posts creates a post and returns 201, POST /posts without auth returns 401, POST /auth/login with valid credentials returns a token, POST /auth/login with invalid credentials returns 401. Aim for full coverage of all endpoints." \
  --priority medium
```

```
Task created:
  ID:       task_1772040200000_test789
  Title:    Write unit tests
  Status:   todo
  Priority: medium
```

### Verify your tasks

```bash
maestro task list
```

```
Tasks for Blog API:

  ID                              Title                    Status   Priority
  task_1772040200000_posts123     Create /posts endpoints  todo     high
  task_1772040200000_auth456      Add JWT authentication   todo     high
  task_1772040200000_test789      Write unit tests         todo     medium
```

---

## Step 3: Spawn a worker session

Spawn a single worker session and assign it all three tasks.

```bash
maestro session spawn \
  --tasks task_1772040200000_posts123,task_1772040200000_auth456,task_1772040200000_test789 \
  --mode worker \
  --name "blog-api-worker"
```

```
Session spawned:
  ID:     sess_1772040300000_work111
  Name:   blog-api-worker
  Mode:   worker
  Status: spawning
  Tasks:  3
```

The session starts inside a PTY terminal. Maestro injects the task details into the agent's system prompt. The agent reads the task descriptions and begins working.

---

## Step 4: Monitor progress

### Check session status

```bash
maestro session info sess_1772040300000_work111
```

```
Session: blog-api-worker
  ID:       sess_1772040300000_work111
  Status:   working
  Mode:     worker
  Tasks:    3
  Started:  2 minutes ago
```

### Watch the session in real time

```bash
maestro session logs sess_1772040300000_work111 --follow
```

This streams the agent's output to your terminal. Press `Ctrl+C` to stop watching.

### Check task progress

As the agent works, it reports progress on each task.

```bash
maestro task get task_1772040200000_posts123
```

```
Task: Create /posts endpoints
  ID:       task_1772040200000_posts123
  Status:   in_progress
  Priority: high

  Timeline:
    [2 min ago]  Status changed to in_progress
    [1 min ago]  Progress: Created Express app with GET /posts endpoint
    [30s ago]    Progress: Added POST /posts with input validation
```

---

## Step 5: Review results

Once the agent finishes all tasks, the session status changes to `completed`.

```bash
maestro session info sess_1772040300000_work111
```

```
Session: blog-api-worker
  ID:       sess_1772040300000_work111
  Status:   completed
  Mode:     worker
  Tasks:    3 (3 completed)
  Duration: 8 minutes
```

Check each task:

```bash
maestro task list
```

```
Tasks for Blog API:

  ID                              Title                    Status      Priority
  task_1772040200000_posts123     Create /posts endpoints  completed   high
  task_1772040200000_auth456      Add JWT authentication   completed   high
  task_1772040200000_test789      Write unit tests         completed   medium
```

Review the generated files in your project directory:

```bash
ls ~/projects/blog-api/
```

```
package.json
src/
  index.js
  routes/
    posts.js
    auth.js
  middleware/
    authenticate.js
tests/
  posts.test.js
  auth.test.js
```

---

## Full command summary

```bash
# 1. Create project
maestro project create "Blog API" --working-dir ~/projects/blog-api
export MAESTRO_PROJECT_ID=<project-id>

# 2. Create tasks
maestro task create "Create /posts endpoints" \
  --desc "Build GET /posts and POST /posts with Express.js..." \
  --priority high

maestro task create "Add JWT authentication" \
  --desc "Add JWT auth middleware and POST /auth/login..." \
  --priority high

maestro task create "Write unit tests" \
  --desc "Write Jest tests for all endpoints..." \
  --priority medium

# 3. Spawn worker
maestro session spawn \
  --tasks <task-id-1>,<task-id-2>,<task-id-3> \
  --mode worker \
  --name "blog-api-worker"

# 4. Monitor
maestro session logs <session-id> --follow
maestro task list

# 5. Review
maestro session info <session-id>
```

---

## What you learned

- **Projects** group tasks and sessions around a working directory
- **Tasks** describe units of work with titles and detailed descriptions
- **Worker sessions** execute tasks autonomously inside PTY terminals
- **Progress reporting** lets you track what the agent is doing in real time
- Maestro handles the full lifecycle: create, assign, execute, and complete

## Next steps

- [Full-Stack E-Commerce Feature](./ecommerce-feature.md) — Use a coordinator to break down and delegate work across multiple agents
- [CLI Reference](/docs/reference/cli) — Explore all available commands
- [Core Concepts](/docs/concepts) — Understand sessions, tasks, and agent modes in depth
