# Resume Points — Agent Maestro

Use the sections below to strengthen your resume. Pick and tailor based on the role you're targeting.

---

## Project Summary (for "Projects" section)

### Agent Maestro — Multi-Agent Orchestration Platform
**Open Source | Tauri, React, TypeScript, Rust, Node.js**

Built a full-stack desktop platform for orchestrating multiple AI coding agents (Claude, Codex, Gemini) across software projects. Includes a native desktop app, REST/WebSocket backend server, CLI tool, and MCP protocol integration. Enables developers to decompose work into tasks, spawn and coordinate AI agents in parallel, and monitor all activity in real-time from a unified interface.

**GitHub:** github.com/subhangR/agent-maestro | **License:** AGPL-3.0

---

## Bullet Points — By Target Role

### For AI / ML Engineering Roles

- Designed a 4-mode agent coordination model (worker, coordinator, coordinated-worker, coordinated-coordinator) enabling hierarchical multi-agent task execution with dependency-aware scheduling
- Built a manifest-based prompt composition system that dynamically generates system prompts, task context, capability policies, and skill injections for each AI agent session
- Implemented multi-provider agent spawning supporting Claude Code, OpenAI Codex, and Google Gemini CLI tools with unified lifecycle management
- Created an inter-agent messaging system (async mail) enabling persistent agent-to-agent communication across isolated sessions
- Integrated Model Context Protocol (MCP) to bridge AI agents with the orchestration layer via standardized tool calls

### For Full-Stack / Software Engineering Roles

- Architected a monorepo with 4 packages (desktop app, server, CLI, MCP server) using npm workspaces, with cross-platform binary builds for macOS, Linux, and Windows
- Built a real-time event-driven backend with Express v5, WebSocket broadcasting, and domain-driven design (DDD) with dependency injection and file-based persistence
- Developed a Tauri v2 desktop application with React, featuring integrated terminal emulation (xterm.js), Monaco code editor, Excalidraw whiteboard, and Mermaid diagram rendering
- Implemented 22 Zustand state stores, 49 custom React hooks, and 50+ components to manage complex UI state across task management, session tracking, and workspace views
- Designed a REST API with 40+ endpoints covering projects, tasks, sessions, teams, skills, workflow templates, and cross-project master operations

### For Systems / Infrastructure Roles

- Implemented native PTY (pseudo-terminal) management in Rust via Tauri, supporting tmux session persistence, automatic reconnection, and isolated agent execution environments
- Built SSH connection management with remote filesystem operations, file transfer, and port forwarding integrated into the desktop application
- Designed a WebSocket bridge that translates domain events into real-time client notifications across 20+ event types (task updates, session spawns, agent progress)
- Created a dual-environment architecture (prod on port 3001, staging on port 3002) with fully isolated data directories enabling simultaneous development and production usage
- Built cross-platform binary packaging pipelines using esbuild and pkg for CLI/server distribution on darwin-arm64, darwin-x64, linux-x64, and win-x64

### For DevTools / Developer Experience Roles

- Built a feature-rich CLI with Commander.js supporting 60+ commands across task management, session control, queue workflows, team operations, and real-time progress reporting
- Designed a plugin/skills system enabling injectable markdown-based context plugins scoped at session, project, or global levels for customizing AI agent behavior
- Implemented session recording and replay functionality for debugging and reviewing AI agent work sessions
- Created a command palette, global keyboard shortcuts, drag-and-drop task management, and @mention-based agent references for a polished developer UX
- Added a creative sound identity system where each team member agent has a unique instrument (piano, guitar, violin, trumpet, drums) providing audio feedback on agent events

### For Frontend / UI Engineering Roles

- Built a complex desktop UI with Tauri v2 and React featuring a 3-column layout with icon rail navigation, expandable sidebar, and dynamic workspace panels
- Integrated Monaco Editor, Excalidraw, Mermaid, and xterm.js into a unified workspace with lazy loading and space-based tab management
- Implemented drag-and-drop task reordering using @dnd-kit with Kanban board, tree view, and list view modes
- Managed complex application state across 22 Zustand stores with real-time WebSocket synchronization from a Node.js backend
- Designed responsive modals and overlays for task creation (with dependency graphs, subtask trees, skill assignment), team configuration, and agent launch settings

---

## Technical Skills to Highlight

| Category | Technologies |
|----------|-------------|
| Languages | TypeScript, Rust, JavaScript, HTML/CSS |
| Frontend | React 18, Zustand, Vite, xterm.js, Monaco Editor, Excalidraw, Mermaid, @dnd-kit |
| Desktop | Tauri v2, native PTY management, system tray, secure storage |
| Backend | Node.js, Express v5, WebSocket (ws), REST API design, DDD |
| CLI | Commander.js, Chalk, Ora, esbuild, binary packaging (pkg) |
| AI/Agents | Multi-agent orchestration, Claude Code, MCP protocol, prompt engineering, agent lifecycle management |
| Infrastructure | tmux, SSH, cross-platform builds (macOS/Linux/Windows), dual environment architecture |
| Tools | Git, npm workspaces, Vitest, Jest, Bun |

---

## Metrics / Scale (use where relevant)

- 4-package TypeScript/Rust monorepo
- 50+ React components, 22 state stores, 49 custom hooks
- 40+ REST API endpoints with WebSocket event broadcasting
- 60+ CLI commands with JSON output support
- 3 AI provider integrations (Claude, Codex, Gemini)
- 91 architecture and design documents
- Cross-platform builds for 4 targets (macOS ARM/Intel, Linux, Windows)

---

## One-Liner Descriptions (for LinkedIn, GitHub bio, etc.)

**Short:**
> Builder of Agent Maestro — an open-source platform for orchestrating multiple AI coding agents from a single desktop interface.

**Medium:**
> Built Agent Maestro, a full-stack multi-agent orchestration platform (Tauri, React, Rust, Node.js) that coordinates AI coding agents across projects with real-time task management, hierarchical agent coordination, and integrated terminal/editor workspace.

**Long:**
> Creator of Agent Maestro — an open-source desktop platform for managing multiple AI coding agents. Features a Tauri v2 native app with integrated terminals, Monaco editor, and Excalidraw whiteboard; a DDD backend with real-time WebSocket events; a 60+ command CLI; and support for Claude, Codex, and Gemini agents with hierarchical coordination, dependency-aware task scheduling, and inter-agent messaging.

---

## Interview Framing

### "Tell me about a technical project you've built"

**Problem:** Managing multiple AI coding agents is chaotic — separate terminals, no coordination, no visibility into what each agent is doing.

**Solution:** I built Agent Maestro, a desktop platform that lets you break work into tasks, spawn multiple AI agents, coordinate them with a worker/coordinator hierarchy, and monitor everything in real-time.

**Technical depth (pick one per interview):**
- *Architecture:* DDD backend with dependency injection, real-time WebSocket event bridge, manifest-based agent configuration
- *Systems:* Rust-based PTY management in Tauri, tmux session persistence, SSH tunneling, cross-platform binary builds
- *AI/Agents:* 4-mode coordination model, prompt composition pipeline, multi-provider spawning, MCP protocol integration
- *Frontend:* 50+ component React app with 22 Zustand stores, integrated terminal/editor/whiteboard, drag-and-drop task management

**Scale:** 4-package monorepo, 40+ API endpoints, 60+ CLI commands, 3 AI providers, cross-platform builds.

**What I learned:** Multi-agent coordination is fundamentally a distributed systems problem — you need clear contracts (manifests), reliable communication (WebSocket + mail), and graceful failure handling (blocked/error states).
