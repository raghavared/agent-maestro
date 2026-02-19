# I built a project manager for Claude agents (because juggling 7 terminal windows was driving me crazy)

Hey r/ClaudeAI! 👋

Ever had multiple Claude sessions running at once and completely lost track of which one was doing what?

Yeah, me too. Four Claude sessions on one project, three on another, all in separate terminals. No idea what any of them were actually working on. Absolute chaos.

So we built **Maestro** to fix this.

## What it does

Think of it as a project manager for your Claude agents. Desktop app + CLI + server working together.

**The main things:**
- **Task breakdown**: Create tasks, subtasks, dependencies - organize the work visually
- **Assign work**: Spin up Claude sessions and give each one specific tasks
- **Real-time tracking**: See what every Claude is doing, get progress updates in one timeline
- **Persistent sessions**: Your sessions keep running even if you close the app
- **Unified workspace**: Manage all your tasks, sessions, and terminals in one place
- **Session recording**: Record what happens and replay it later

**Two work modes:**
- Simple: Claude sees all tasks at once
- Queue: Feed tasks one at a time

**Two roles:**
- Workers: Claude sessions that write the code
- Orchestrators: Claude sessions that plan the work and spawn workers

## The CLI is Pretty Sweet

From any terminal where Claude is working, you can:
```bash
maestro whoami              # What am I working on?
maestro report progress "Finished the login route, starting tests"
maestro report blocked "Need database credentials"
maestro report complete "Auth system is done"
```

Claude can use these commands to report back, and everything shows up in the desktop app in real-time.

## Why this actually helps

Before: Seven terminal windows, constant context switching, no idea what's done or what's in progress

After: One workspace where you can see everything, assign work properly, and track progress in real-time

Plus:
- Open source (AGPL-3.0)
- Everything stored as simple JSON files - no database to configure
- Runs completely locally
- Works with SSH for remote development

## Quick start

```bash
npm install
npm run dev:all
```

That's it. Desktop app and server running.

---

If you've been drowning in Claude terminal windows, or you're working on projects where coordinating multiple agents would actually help, check it out: [GitHub link]

Happy to answer questions! We're actively developing it and would love feedback from the community.
