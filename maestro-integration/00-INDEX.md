# Maestro Integration Specifications

This folder contains the integration contracts between the three Maestro components:
- **maestro-server** (Backend)
- **maestro-cli** (Command Line Interface)
- **maestro-ui** (Desktop Application)

## Documents

| Document | Description |
|----------|-------------|
| [01-SERVER-CLI.md](./01-SERVER-CLI.md) | Server → CLI integration (manifest generation) |
| [02-CLI-SERVER.md](./02-CLI-SERVER.md) | CLI → Server integration (REST API calls) |
| [03-CIRCULAR-DEPENDENCY.md](./03-CIRCULAR-DEPENDENCY.md) | Circular dependency evaluation |
| [04-UI-SERVER-API.md](./04-UI-SERVER-API.md) | UI → Server integration (REST API calls) |
| [05-SERVER-UI-WEBSOCKET.md](./05-SERVER-UI-WEBSOCKET.md) | Server → UI integration (WebSocket events) |
| [06-AGENTIC-TESTING.md](./06-AGENTIC-TESTING.md) | Agentic testing strategy for integration validation |
| [07-HIERARCHICAL-TASK-MODEL.md](./07-HIERARCHICAL-TASK-MODEL.md) | Hierarchical task model (parentId, tree hooks, breadcrumbs) |

## Architecture Overview

```
┌─────────────────┐
│   Maestro UI    │  REST API (04)    WebSocket (05)
│  (Tauri+React)  │ ─────────────────► ◄────────────────
└────────┬────────┘
         │
         v
┌──────────────────────────┐
│    Maestro Server        │
│  (Express + WebSocket)   │
└──────────┬───────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  CLI→Server  Server→CLI
     (02)        (01)
     │           │
     v           v
┌───────────────────┐
│   Maestro CLI     │
│   (Terminal)      │
└───────────────────┘
```

## Key Integration Points

1. **Server → CLI (01)**: Server invokes CLI for manifest generation during session spawn
2. **CLI → Server (02)**: CLI calls server REST APIs for task/session CRUD operations
3. **UI → Server (04)**: UI calls server REST APIs through MaestroClient
4. **Server → UI (05)**: Server broadcasts WebSocket events for real-time updates
5. **Hierarchical Tasks (07)**: Tasks use `parentId` field for parent-child relationships across all components
