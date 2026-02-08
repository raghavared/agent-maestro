# Task Session Visualization Documentation

This directory contains comprehensive documentation and visual diagrams explaining how task sessions flow through the Maestro system.

## Contents

1. **[SESSION-STATUS-FLOW.md](./SESSION-STATUS-FLOW.md)** - Session status types and state transitions
2. **[SESSION-LIFECYCLE.md](./SESSION-LIFECYCLE.md)** - Complete session lifecycle from creation to completion
3. **[SESSION-TIMELINE.md](./SESSION-TIMELINE.md)** - Timeline events and tracking
4. **[COMPONENT-FLOWS.md](./COMPONENT-FLOWS.md)** - How sessions flow between UI, Server, Storage, and CLI
5. **[WEBSOCKET-EVENTS.md](./WEBSOCKET-EVENTS.md)** - All WebSocket events related to sessions
6. **[QUEUE-STRATEGY.md](./QUEUE-STRATEGY.md)** - Queue-based session processing strategy
7. **[PARENT-CHILD-SESSIONS.md](./PARENT-CHILD-SESSIONS.md)** - Session-spawned sessions (orchestrator/worker pattern)
8. **[ARCHITECTURE-OVERVIEW.md](./ARCHITECTURE-OVERVIEW.md)** - High-level architecture diagrams

## Quick Reference

### Session Status Types

```typescript
type SessionStatus = 'spawning' | 'idle' | 'working' | 'completed' | 'failed' | 'stopped';
```

### Key Components

- **Maestro UI** (`/maestro-ui/`) - Desktop app with terminal sessions
- **Maestro Server** (`/maestro-server/`) - REST API + WebSocket server
- **Maestro CLI** (`/maestro-cli/`) - Command-line interface for agents

### Storage Location

Sessions are stored at: `~/.maestro/data/sessions/{sessionId}.json`

## Diagrams Legend

- 🔵 **Blue boxes**: UI components
- 🟢 **Green boxes**: Server components
- 🟡 **Yellow boxes**: Storage/Persistence
- 🔴 **Red boxes**: CLI components
- ⚡ **Lightning**: WebSocket events
- 📡 **Satellite**: HTTP REST API calls

---

Generated: 2026-02-06
