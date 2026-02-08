# Inter-Session Communication in Maestro

## Overview

This document explores approaches for enabling direct communication between Claude sessions in the Maestro application. Currently, sessions operate independently and can only coordinate through the central server's task management system.

## Problem Statement

**Goal**: Enable a session to send a message to another session as an input prompt which executes in the next turn.

**Use Cases**:
- Session A completes a task and needs Session B to review the changes
- An orchestrator session delegates work to a worker session with specific context
- A worker session encounters a blocker and requests help from another worker
- Collaborative debugging where one session passes findings to another
- Dynamic task handoff between specialized agents

**Current Limitations**:
- Sessions can only spawn new sessions via the server API
- No direct message passing between running sessions
- Coordination happens through shared task state in the server
- No real-time prompt injection from one session to another

## System Architecture Context

### Current Components

1. **maestro-server** (Node.js/Express)
   - REST API for projects, tasks, and sessions
   - WebSocket server for real-time UI updates
   - EventBus (InMemoryEventBus) for internal domain events
   - File-based JSON storage (~/.maestro/data/)

2. **maestro-cli** (Node.js)
   - Command-line interface for agents
   - Communicates with server via HTTP API
   - Used by Claude sessions to report progress, manage tasks, etc.

3. **maestro-ui** (Tauri/Rust + React)
   - Desktop application with terminal management
   - PTY (pseudo-terminal) implementation in Rust
   - Listens to server events via WebSocket
   - Spawns and manages terminal sessions

4. **Sessions**
   - Claude Code instances running in terminals
   - Each has unique MAESTRO_SESSION_ID
   - Environment variables injected at spawn time
   - Execute within project working directory

### Current Event Flow

```
┌─────────────────┐
│  Claude Session │
│   (Terminal)    │
└────────┬────────┘
         │
         │ HTTP API calls
         │ (maestro CLI)
         ▼
┌─────────────────┐       ┌──────────────────┐
│ maestro-server  │◄─────►│  EventBus        │
│  (Express)      │       │  (InMemory)      │
└────────┬────────┘       └────────┬─────────┘
         │                         │
         │ WebSocket               │ Broadcasts
         │ broadcasts              │ domain events
         ▼                         ▼
┌─────────────────┐       ┌──────────────────┐
│   maestro-ui    │       │ Other listeners  │
│   (Desktop)     │       │                  │
└─────────────────┘       └──────────────────┘
```

## Proposed Approaches

This research evaluates two primary approaches:

### 1. tmux-Based Communication
Uses tmux's built-in features for inter-process communication between terminal sessions.

### 2. Server-Mediated Communication
Extends the existing maestro-server infrastructure to route messages between sessions.

Each approach is detailed in the following documents:
- [02-tmux-approach.md](./02-tmux-approach.md)
- [03-server-approach.md](./03-server-approach.md)
- [04-comparison.md](./04-comparison.md)
- [05-recommendations.md](./05-recommendations.md)

## Key Design Considerations

1. **Message Delivery**: How messages reach the target session
2. **Prompt Injection**: How messages become Claude input prompts
3. **Timing**: When messages are delivered (immediate vs. next turn)
4. **Reliability**: Ensuring messages are not lost
5. **Security**: Preventing unauthorized session access
6. **Backward Compatibility**: Not breaking existing functionality
7. **Terminal Compatibility**: Working with various terminal emulators
8. **State Management**: Tracking pending messages and delivery status
9. **Error Handling**: What happens if target session is unavailable
10. **Scalability**: Supporting multiple concurrent conversations

## Success Criteria

A successful implementation should:

- ✅ Allow session A to send a text message to session B
- ✅ Message appears as input to Claude in session B's next turn
- ✅ Support both synchronous (request-response) and asynchronous messaging
- ✅ Handle cases where target session doesn't exist or is terminated
- ✅ Provide feedback to sender about message delivery
- ✅ Maintain session isolation and security
- ✅ Integrate seamlessly with existing Maestro workflows
- ✅ Support both UI-spawned and session-spawned sessions
