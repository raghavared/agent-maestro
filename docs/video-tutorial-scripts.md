# Maestro YouTube Tutorial Video Scripts

> **Series:** 7 videos | **Format:** Short-form (1-5 min each) | **Total runtime:** ~22 min
>
> Each video is self-contained but follows a logical progression.
> Tone: Conversational, developer-to-developer, no fluff. Show, don't tell.

---

## Video 1: What is Maestro?

**Duration:** ~1.5 min
**Goal:** Hook viewers. Explain the problem and show the solution in 90 seconds.

---

### SCRIPT

**[SCREEN: Multiple terminal windows scattered across the screen, all running Claude Code separately]**

**NARRATOR:**
You're using Claude Code. It's great. So you open two. Then three. Then five.

Now you've got five Claudes running — and zero coordination. They're duplicating work. They don't know about each other. One is stuck, and you don't notice for 20 minutes.

**[SCREEN: All terminals collapse into a single Maestro desktop app window]**

This is Maestro.

Maestro is an orchestration platform for Claude Code. It treats your AI agents like a real engineering team — with task assignments, progress tracking, and real-time coordination.

**[SCREEN: Quick montage of Maestro UI — task board, terminal sessions, live timeline]**

Here's how it works in three steps:

**[SCREEN: Creating a task in the UI]**

**One** — you break work into tasks. "Build the login page." "Add form validation." "Write tests."

**[SCREEN: Clicking "Start" on a task, session spawning]**

**Two** — you spawn Claude sessions on those tasks. Each Claude gets clear context — what to do, how to do it, and what done looks like.

**[SCREEN: Real-time dashboard showing multiple sessions working, timeline updating]**

**Three** — you watch everything happen in real time. Every file change, every progress update, every blocker — all visible in one place.

**[SCREEN: All tasks showing "completed" status]**

No more scattered terminals. No more silent failures. No more duplicated work.

Maestro turns Claude Code from a solo tool into a coordinated team.

**[SCREEN: Maestro logo + "Next video: Getting Started"]**

In the next video, I'll show you how to install Maestro and run your first task in under 5 minutes.

---

### KEY VISUALS
- Before/after: scattered terminals vs unified workspace
- Quick UI montage (task board, terminals, timeline)
- Three-step flow animation

### B-ROLL SUGGESTIONS
- Screen recording of multiple terminals being chaotic
- Screen recording of Maestro dashboard with live updates

---
---

## Video 2: Getting Started — Install & First Task

**Duration:** ~4 min
**Goal:** Install Maestro and complete a real task end-to-end.

---

### SCRIPT

**[SCREEN: Terminal, clean desktop]**

**NARRATOR:**
Let's install Maestro and run your first AI-powered task. The whole thing takes about 5 minutes.

**[SCREEN: Terminal showing clone + install]**

First, clone the repo and run the installer:

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
./install.sh
```

This installs three things: the Maestro server, the CLI, and the desktop app. No database. No Docker. Everything stores as plain JSON files on disk.

**[SCREEN: Terminal showing server start]**

Start the server:

```bash
maestro-server
```

You should see it running on port 2357.

**[SCREEN: Desktop app opening for first time]**

Now open the Maestro desktop app. You'll see an empty workspace. Let's set up a project.

**[SCREEN: Terminal with CLI commands]**

Open a terminal and create a project linked to your codebase:

```bash
maestro project create "my-todo-app" -d ~/projects/my-todo-app
```

You'll see it appear in the desktop app immediately.

**[SCREEN: Creating a task — either CLI or UI]**

Now let's create a task. You can do this in the UI — click the "+" button — or use the CLI:

```bash
maestro task create "Add a dark mode toggle to the settings page" \
  --project proj_xxx \
  --priority high
```

Give it a clear title and description. The more specific you are, the better Claude performs.

**[SCREEN: Spawning a session on the task]**

Now the fun part — spawn a Claude session on this task:

```bash
maestro session spawn --task task_xxx
```

Or in the desktop app, just click the play button on the task card.

**[SCREEN: Terminal showing Claude starting up with Maestro init banner]**

Watch what happens. Claude starts up with full context about your task. It knows what to build, what "done" looks like, and it starts working immediately.

**[SCREEN: Split view — Claude working in terminal + timeline updating in app]**

In the desktop app, you can see everything in real time — file changes, progress reports, the full timeline of events.

**[SCREEN: Task status changing to "completed"]**

When Claude finishes, it reports the task as complete. You can review the changes with `git diff`, and that's it.

**[SCREEN: Terminal showing final state]**

```bash
maestro task get task_xxx
```

Status: completed. That's your first Maestro task.

**[SCREEN: Maestro logo + "Next video: Tasks & Projects"]**

In the next video, we'll dive deeper into how to organize your work with projects, tasks, subtasks, and task hierarchies.

---

### KEY VISUALS
- Terminal install sequence (sped up)
- Desktop app appearing with empty state
- Task creation (UI or CLI)
- Claude starting with init banner
- Split screen: terminal + live timeline
- Task card transitioning to "completed"

---
---

## Video 3: Projects, Tasks & Task Management

**Duration:** ~4 min
**Goal:** Teach task organization — hierarchy, dependencies, priorities, docs, referencing.

---

### SCRIPT

**[SCREEN: Maestro desktop app with a project open]**

**NARRATOR:**
Tasks are the core unit of work in Maestro. Everything starts with a task — and how well you define your tasks directly determines how well Claude performs.

Let's look at how to organize work effectively.

**[SCREEN: CLI showing project commands]**

**Projects** are your top-level containers — think of them as workspaces. Each project maps to a folder on your machine:

```bash
maestro project create "backend-api" -d ~/projects/backend-api
maestro project create "frontend-app" -d ~/projects/frontend-app
```

Each project has its own tasks, sessions, and teams. They're completely isolated.

**[SCREEN: Task creation with full details]**

Now, tasks. A task has a title, description, priority, and status. But the real power is in the details.

```bash
maestro task create "Implement JWT authentication" \
  --project proj_xxx \
  --priority high \
  --description "Add JWT auth with refresh tokens.
    Use jsonwebtoken library. Store refresh tokens in Redis.
    Include login, logout, and token refresh endpoints."
```

Notice I'm being specific. Not "add auth" — but exactly what kind, what library, what endpoints. Specific tasks get specific results.

**[SCREEN: Creating subtasks under a parent]**

For bigger work, break tasks into subtasks:

```bash
# Parent task
maestro task create "Build user management system" --project proj_xxx

# Child tasks
maestro task create "Database schema for users" --parent task_parent
maestro task create "CRUD API endpoints" --parent task_parent
maestro task create "Input validation with Zod" --parent task_parent
maestro task create "Integration tests" --parent task_parent
```

**[SCREEN: `maestro task tree` showing visual hierarchy]**

Run `maestro task tree` and you see the full hierarchy with status indicators:

```
Build user management system [in_progress]
  ├── Database schema for users [completed]
  ├── CRUD API endpoints [in_progress]
  ├── Input validation with Zod [todo]
  └── Integration tests [todo]
```

**[SCREEN: Task status lifecycle diagram]**

Tasks flow through a lifecycle: **todo** to **in_progress** to **completed**. They can also be **blocked**, **in_review**, **cancelled**, or **archived**.

**[SCREEN: CLI showing task reporting commands]**

Agents report their progress on tasks using these commands:

```bash
maestro task report progress task_xxx "Schema created, starting endpoints"
maestro task report complete task_xxx "All endpoints built, tests passing"
maestro task report blocked task_xxx "Need database connection string"
```

Every report becomes a timeline event — visible in the desktop app in real time.

**[SCREEN: Desktop app showing task detail with timeline events]**

**Task docs** let you attach additional context. You can add acceptance criteria, technical notes, reference files — anything the agent needs to do the work well.

```bash
maestro task docs add task_xxx "API Schema" --file ./docs/api-schema.md
maestro task docs list task_xxx
```

**[SCREEN: Task referencing — showing dependencies]**

Tasks can also reference each other through **dependencies**. Task B depends on Task A? Set it up, and Maestro tracks it.

You can also reference tasks by ID across the system — in session manifests, in inter-session messages, anywhere you need to point an agent at specific work.

**[SCREEN: Maestro logo + "Next video: Sessions & Workers"]**

That's task management in Maestro. In the next video, we'll look at sessions — the actual Claude instances that do the work.

---

### KEY VISUALS
- Project creation and switching
- Task creation with rich description
- Subtask hierarchy (`task tree` output)
- Status lifecycle diagram
- Task timeline in desktop app
- Task docs attachment

---
---

## Video 4: Sessions, Workers & Reporting

**Duration:** ~4 min
**Goal:** Explain sessions, worker mode, manifests, reporting, and session logging.

---

### SCRIPT

**[SCREEN: Maestro desktop app, task board visible]**

**NARRATOR:**
A session is a single Claude Code instance working on one or more tasks. It's the execution unit of Maestro — where the actual work happens.

Let me show you how sessions work.

**[SCREEN: Spawning a session]**

When you spawn a session, Maestro does several things behind the scenes:

```bash
maestro session spawn --task task_xxx
```

**[SCREEN: Animated flow diagram]**

First, it generates a **manifest** — a JSON file containing everything Claude needs: the task details, which model to use, permissions, skills, and the agent's identity.

Then, the desktop app opens a terminal, sets environment variables, and launches Claude Code with that manifest injected into its system prompt.

Claude starts up, reads its task, and begins working. It's like handing a developer a detailed spec on day one.

**[SCREEN: Session status indicators in sidebar]**

Sessions go through a lifecycle: **spawning** — getting ready. **Working** — actively executing. Then either **completed**, **failed**, or **stopped**.

You can see session status in the sidebar — color-coded dots show you at a glance which sessions are active.

**[SCREEN: CLI showing session info and watch commands]**

From the CLI, you can monitor sessions in multiple ways:

```bash
# See all sessions
maestro session list --status working

# Get details on a specific session
maestro session get sess_xxx

# Stream real-time output
maestro session watch sess_xxx
```

The `watch` command streams events as they happen — progress updates, file modifications, task completions. It's like watching a live log.

**[SCREEN: Session timeline in desktop app]**

In the desktop app, every session has a **timeline panel** — a chronological record of everything the agent did. Started task, wrote file, reported progress, completed task. Each event has a timestamp.

This is your **session log** — the complete history of what happened and when.

**[SCREEN: Agent reporting progress from within a session]**

From the agent's side, workers report their status using these commands:

```bash
# During work
maestro session report progress "Building the login form component"

# When done
maestro session report complete "Login page implemented with form validation"

# If stuck
maestro session report blocked "Missing API key for OAuth integration"

# If something breaks
maestro session report error "Build fails — TypeScript compilation error in auth module"
```

These reports show up instantly in the timeline and update the session status.

**[SCREEN: Multi-task session]**

Sessions can also work on **multiple tasks at once**. Pass comma-separated task IDs:

```bash
maestro session spawn --tasks task_1,task_2,task_3
```

Claude receives context for all three tasks and works through them. This is great for related tasks where context from one informs the others.

**[SCREEN: Execution strategies diagram]**

Maestro supports two main **execution strategies**:

**Simple** — Claude gets all tasks at once and handles them in whatever order makes sense. Best for related work.

**Queue** — Tasks are processed one at a time, in order. Claude finishes task 1, then task 2, then task 3. Best for sequential pipelines like refactoring steps.

**[SCREEN: Maestro logo + "Next video: Team Members & Skills"]**

Sessions are where the work happens. But who does the work matters too. In the next video, we'll look at team members — how to create specialized agent identities with persistent memory.

---

### KEY VISUALS
- Session spawn flow animation
- Manifest structure (high-level)
- Session lifecycle diagram
- Live `watch` command output
- Session timeline in desktop app
- Multi-task session example
- Execution strategy comparison diagram

---
---

## Video 5: Team Members, Skills & Identity

**Duration:** ~4 min
**Goal:** Show how to create specialized agents with identities, memory, and skills.

---

### SCRIPT

**[SCREEN: Maestro desktop app, Teams panel open]**

**NARRATOR:**
So far, every Claude session has been generic — same model, same personality, same approach. But what if you could create specialized agents with different roles, expertise, and even persistent memory?

That's what team members are for.

**[SCREEN: Creating team members via CLI]**

A team member is a reusable agent profile. Think of it like hiring a specialist:

```bash
maestro team-member create "Alice" \
  --role "Senior Frontend Developer" \
  --model opus \
  --avatar "🎨" \
  --identity "You are a senior frontend engineer specializing in React
    and TypeScript. You write clean, accessible components.
    You prefer Tailwind CSS and always write unit tests."
```

```bash
maestro team-member create "Bob" \
  --role "Backend Engineer" \
  --model sonnet \
  --avatar "⚙️" \
  --identity "You are a backend engineer focused on Node.js and PostgreSQL.
    You design clean APIs, write comprehensive error handling,
    and always validate inputs with Zod."
```

```bash
maestro team-member create "Charlie" \
  --role "QA Engineer" \
  --model haiku \
  --avatar "🧪" \
  --identity "You are a QA engineer. You think about edge cases first.
    You write thorough integration tests and check for security issues."
```

**[SCREEN: Team member cards in desktop app showing avatar, name, role, model badge]**

Now when you spawn a session, you can assign a team member:

```bash
maestro session spawn --task frontend_task --team-member alice
```

Alice doesn't just get the task — she gets her entire identity injected into the system prompt. She *thinks* like a frontend developer. She'll reach for React patterns, write accessible HTML, and use Tailwind classes automatically.

**[SCREEN: Comparing two agents' different approaches to the same task]**

Give Alice and Bob the same task and they'll approach it completely differently — because their identities shape their decisions.

**[SCREEN: Memory commands]**

Here's where it gets powerful — **persistent memory**. You can teach team members facts they'll remember across every session:

```bash
maestro team-member memory append alice \
  --entry "This project uses Next.js 14 with App Router"

maestro team-member memory append alice \
  --entry "Design tokens are in src/styles/tokens.ts"

maestro team-member memory append bob \
  --entry "Database is PostgreSQL 15 on Supabase"

maestro team-member memory append bob \
  --entry "Run tests with: bun test"
```

Every time Alice spawns, she already knows the project uses Next.js with App Router. No re-explaining. No wasted context.

**[SCREEN: Skills — creating a SKILL.md file]**

**Skills** add another layer. A skill is a markdown file with domain-specific instructions that gets injected into the agent's prompt:

```markdown
# TypeScript API Standards
## Tech Stack
- Express.js + TypeScript + Prisma + Vitest
## Rules
- async/await everywhere
- Response shape: { data: T } | { error: string }
- Validate inputs with Zod
- No `any` types
## Before Completing
1. Run `bun test` — all must pass
2. Run `bun lint` — no errors
```

Save this as a skill, and attach it when spawning:

```bash
maestro session spawn --task api_task --skill ts-api-standards
```

Now Claude follows your project's coding standards automatically.

**[SCREEN: Team creation and team view]**

Put it all together with **teams**. Group your members:

```bash
maestro team create "Feature Team" \
  --leader alice \
  --members alice,bob,charlie
```

In the desktop app, you can launch the whole team at once — coordinator plus workers — and watch them collaborate in real time in the Team View.

**[SCREEN: Maestro logo + "Next video: Orchestration"]**

Team members give your agents personality, memory, and specialization. In the next video, we'll see what happens when you let a coordinator agent plan and delegate work to an entire team.

---

### KEY VISUALS
- Team member creation (CLI and UI)
- Team member cards with avatars and model badges
- Side-by-side comparison of two agents' approaches
- Memory entries being added
- Skill file creation
- Team View in desktop app (coordinator + workers)

---
---

## Video 6: Orchestration & Multi-Agent Coordination

**Duration:** ~4 min
**Goal:** Show coordinator mode, spawning workers, inter-session messaging, and parallel execution.

---

### SCRIPT

**[SCREEN: A single large task: "Build a REST API for a blog platform"]**

**NARRATOR:**
You have a big task. "Build a REST API for a blog platform with CRUD operations, authentication, and tests." That's too much for one session. You *could* break it down manually — but why not let Claude do it?

**[SCREEN: Spawning a coordinator session]**

Enter **coordinator mode**.

```bash
maestro session spawn --task task_xxx --mode coordinator
```

Instead of writing code, a coordinator *plans*. Watch what happens.

**[SCREEN: Coordinator terminal — Claude analyzing the task and creating subtasks]**

The coordinator reads the task, analyzes the scope, and breaks it into subtasks:

```
Creating subtask: "Set up Prisma schema for posts, users, and comments"
Creating subtask: "Build CRUD endpoints for posts"
Creating subtask: "Build CRUD endpoints for comments"
Creating subtask: "Add JWT authentication middleware"
Creating subtask: "Write integration tests"
```

**[SCREEN: Task tree updating in real time with new subtasks appearing]**

Watch the task tree update in the desktop app — subtasks appear one by one, nested under the parent.

**[SCREEN: Coordinator spawning worker sessions]**

Now the coordinator spawns workers:

```
Spawning worker on "Prisma schema" with model sonnet...
Spawning worker on "Post endpoints" with model sonnet...
Spawning worker on "Auth middleware" with model opus...
```

**[SCREEN: Desktop app showing multiple terminals side by side, all active]**

Suddenly you have three, four, five Claude instances running in parallel — each focused on their specific subtask, each with full context about what the others are doing.

**[SCREEN: Timeline showing events from all sessions interleaved]**

The coordinator monitors everything. If a worker gets blocked, the coordinator notices. If workers need to share context — like "here's the database schema you'll need" — the coordinator sends **inter-session messages**:

```bash
maestro session prompt sess_worker_2 \
  --message "Schema is ready. The posts table has: id, title, body,
    authorId, createdAt, updatedAt. Use these field names."
```

**[SCREEN: Worker receiving the message and continuing]**

The worker receives the message inline and incorporates it immediately. No copy-pasting between terminals. No context lost.

**[SCREEN: Workers completing one by one, task tree updating]**

Workers complete their subtasks and report back:

```bash
maestro task report complete task_schema "Prisma schema created with all models"
maestro task report complete task_posts "Post CRUD endpoints done, all tests pass"
```

The coordinator tracks progress, waits for dependencies, and when everything is done, verifies the integration and reports the parent task as complete.

**[SCREEN: Final task tree — everything green/completed]**

One task went in. A coordinator broke it into five pieces. Five workers executed in parallel. Real-time coordination kept everyone aligned. All done.

**[SCREEN: Showing parallel spawning for independent tasks]**

You don't always need a coordinator though. For **independent tasks** that don't require coordination, just spawn workers in parallel yourself:

```bash
maestro session spawn --task frontend_task
maestro session spawn --task backend_task
maestro session spawn --task docs_task
```

Three sessions, running simultaneously, completely independent. Watch them all with:

```bash
maestro session watch sess_1,sess_2,sess_3
```

**[SCREEN: Maestro logo + "Next video: Advanced Workflows"]**

Orchestration is Maestro's superpower. One coordinator can manage an entire team of workers, breaking down complex projects into parallel streams of work.

In the final video, we'll cover advanced workflows — queue mode, permissions, the desktop app power features, and multi-level orchestration.

---

### KEY VISUALS
- Large task being decomposed into subtasks (animated)
- Coordinator terminal output
- Task tree growing in real time
- Multiple worker terminals side by side
- Inter-session message flow diagram
- Workers completing, parent task turning green
- Parallel spawn without coordinator

---
---

## Video 7: Advanced Workflows — Queue Mode, Permissions & Power Features

**Duration:** ~4 min
**Goal:** Cover remaining features — queue mode, permissions, desktop app, multi-level orchestration, task lists, real-time tracking.

---

### SCRIPT

**[SCREEN: Maestro desktop app]**

**NARRATOR:**
Let's cover the power features that make Maestro a complete orchestration platform.

**[SCREEN: Queue mode — sequential task processing]**

**Queue mode**. Sometimes tasks must happen in order. Step 1 before step 2. Refactoring before testing. Queue mode handles this:

```bash
# Create ordered tasks
maestro task create "Extract database queries into repository layer"
maestro task create "Add TypeScript types to all repositories"
maestro task create "Update route handlers to use repositories"
maestro task create "Write integration tests"

# Spawn with queue strategy
maestro session spawn --tasks task_1,task_2,task_3,task_4 --strategy queue
```

Claude processes them one at a time, in order. Each step builds on the previous. You can track queue progress:

```bash
maestro queue status    # What's currently processing?
maestro queue list      # See all items and their status
```

**[SCREEN: Permissions — different access levels]**

**Permissions** control what agents can do. Maestro supports multiple modes:

- **acceptEdits** — Claude edits freely, you review after. This is the default.
- **interactive** — Claude proposes changes, you approve each one.
- **readOnly** — Claude can analyze and suggest, but can't modify files. Perfect for code review agents.
- **bypassPermissions** — full autonomy. Use for CI pipelines or trusted automation.

You can set permissions per team member:

```bash
maestro team-member edit alice --permission-mode acceptEdits
maestro team-member edit reviewer --permission-mode readOnly
```

Your code reviewer agent literally *cannot* edit files. It can only read, analyze, and report findings.

**[SCREEN: Desktop app — quick tour of power features]**

**The desktop app** has some features worth highlighting.

**[SCREEN: Command palette opening with Cmd+K]**

**Command palette** — press `Cmd+K` to search tasks, jump to sessions, and execute actions without touching the mouse.

**[SCREEN: Quick prompts — Cmd+1 through Cmd+5]**

**Quick prompts** — press `Cmd+1` through `Cmd+5` to send pre-configured messages to the active session. Set these up for commands you use constantly.

**[SCREEN: File explorer with Monaco editor]**

**Built-in code editor** — browse your project files and edit them right in the app. Full syntax highlighting, search, and replace.

**[SCREEN: Theme settings — switching between styles]**

**Themes** — Terminal, Material, Glass, Minimal. Pick your style.

**[SCREEN: Sound settings with per-agent instruments]**

**Sounds** — You can assign unique sounds to each team member. Hear when Alice finishes her task versus when Bob finishes his. It sounds small, but when you're running five agents, audio cues are incredibly useful.

**[SCREEN: Multi-level orchestration diagram]**

**Multi-level orchestration** — for large projects, you can have coordinators managing coordinators:

```
Top-Level Coordinator
├── Frontend Coordinator
│   ├── UI Worker
│   └── Component Worker
└── Backend Coordinator
    ├── API Worker
    └── Database Worker
```

The top-level coordinator delegates to sub-coordinators, who each manage their own workers. It's coordinators all the way down.

**[SCREEN: Real-time tracking — `maestro session watch` with multiple sessions]**

And everything — every task update, every session event, every progress report — flows through **WebSocket events** in real time. The desktop app, the CLI watch command, everything stays in sync.

```bash
maestro session watch sess_1,sess_2,sess_3,sess_4,sess_5
```

Five agents, one view, real-time updates. That's Maestro.

**[SCREEN: Recap montage — quick flashes of all 7 video topics]**

**[SCREEN: Final card]**

Let's recap the series:
- **Video 1**: What Maestro is and why it exists
- **Video 2**: Installing and running your first task
- **Video 3**: Organizing work with projects, tasks, and hierarchies
- **Video 4**: Sessions, workers, and progress reporting
- **Video 5**: Team members, skills, and persistent memory
- **Video 6**: Orchestration and multi-agent coordination
- **Video 7**: Advanced workflows and power features

That's everything you need to go from zero to running a coordinated team of AI agents.

Check out the docs, install Maestro, and start building.

**[SCREEN: Maestro logo + links]**

---

### KEY VISUALS
- Queue mode processing steps sequentially
- Permission modes comparison
- Command palette in action
- Theme switching montage
- Multi-level orchestration tree diagram
- Real-time watch command with multiple sessions
- Series recap montage

---
---

## Production Notes

### Suggested Recording Setup
- **Screen recording**: OBS or ScreenFlow at 1080p/60fps
- **Terminal font**: Large (16-18pt), high contrast theme
- **Desktop app**: Full screen, clean state
- **Narration**: Record audio separately for clean editing
- **Pacing**: 1 concept per 20-30 seconds, no dead air

### Thumbnail Strategy
Each video should have a consistent thumbnail style:
1. Maestro logo + video number
2. Key visual from the video (e.g., task tree, team members, coordinator flow)
3. Short title text (3-4 words max)

### YouTube Metadata
- **Playlist name**: "Maestro Tutorial Series"
- **Tags**: Claude Code, AI agents, orchestration, multi-agent, developer tools
- **End screens**: Link to next video + playlist

### Video Descriptions Template
```
Learn [topic] with Maestro — the orchestration platform for Claude Code.

In this video:
- [Bullet 1]
- [Bullet 2]
- [Bullet 3]

Full tutorial series: [playlist link]
Install Maestro: [repo link]
Documentation: [docs link]

Timestamps:
0:00 - Intro
0:XX - [Section 1]
0:XX - [Section 2]
...
```
