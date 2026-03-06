# Architecture Diagram

## Overview

This diagram shows the three-layer architecture of Maestro: the client layer (Desktop App + CLI), the server layer, and the storage layer.

## Mermaid Diagram

```mermaid
graph TB
    subgraph Clients ["Client Layer"]
        UI["<b>Desktop App</b><br/>(Tauri + React)<br/>maestro-ui"]
        CLI["<b>CLI Tool</b><br/>(Node.js)<br/>maestro-cli"]
    end

    subgraph Server ["Server Layer"]
        API["<b>Maestro Server</b><br/>(Express + WebSocket)<br/>Port 2357 (prod) / 3000 (dev)"]
    end

    subgraph Storage ["Storage Layer"]
        subgraph DataDir ["~/.maestro/data/"]
            Projects["projects/<br/>&lt;id&gt;.json"]
            Tasks["tasks/<br/>&lt;id&gt;.json"]
            Sessions["sessions/<br/>&lt;id&gt;.json"]
            Teams["teams/<br/>&lt;projectId&gt;.json"]
            TeamMembers["team-members/<br/>&lt;projectId&gt;.json"]
            TaskLists["task-lists/<br/>&lt;id&gt;.json"]
            Orderings["orderings/"]
        end
        Manifests["~/.maestro/sessions/<br/>&lt;id&gt;/manifest.json"]
    end

    subgraph PTY ["PTY Sessions"]
        Claude["Claude Code<br/>(AI Agent)"]
        Codex["Codex<br/>(AI Agent)"]
        Gemini["Gemini<br/>(AI Agent)"]
    end

    UI -->|"HTTP REST API"| API
    UI -->|"WebSocket<br/>(real-time events)"| API
    CLI -->|"HTTP REST API"| API
    API -->|"Read/Write JSON"| DataDir
    API -->|"Generate Manifest"| Manifests
    UI -->|"Tauri create_session()<br/>Spawn PTY"| PTY
    PTY -->|"maestro CLI commands<br/>(report progress, etc.)"| API

    style Clients fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Server fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style Storage fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style PTY fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
```

## Text Description (for accessibility)

```
+----------------------------------+
|         CLIENT LAYER             |
|  +------------+  +------------+  |
|  | Desktop App|  |   CLI Tool |  |
|  | (Tauri +   |  | (Node.js)  |  |
|  |  React)    |  |            |  |
|  +-----+------+  +-----+------+  |
|        |               |         |
+--------|---------------|----------+
         |               |
    HTTP/WS REST     HTTP REST
         |               |
+--------|---------------|----------+
|        v               v         |
|      SERVER LAYER                |
|  +---------------------------+   |
|  | Maestro Server            |   |
|  | (Express + WebSocket)     |   |
|  | Port 2357 (prod)         |   |
|  +-------------+-------------+   |
+----------------|------------------+
                 |
          Read/Write JSON
                 |
+----------------|------------------+
|                v                  |
|         STORAGE LAYER            |
|  ~/.maestro/data/                |
|  +----------+ +----------+      |
|  | projects | | tasks    |      |
|  +----------+ +----------+      |
|  +----------+ +----------+      |
|  | sessions | | teams    |      |
|  +----------+ +----------+      |
|  +---------------+              |
|  | team-members  |              |
|  +---------------+              |
+----------------------------------+

        PTY SESSIONS
  +--------+ +-------+ +--------+
  | Claude | | Codex | | Gemini |
  +--------+ +-------+ +--------+
      |          |          |
      +----------+----------+
               |
        CLI commands back
         to Server API
```

## Usage

- **Where**: "How It Works" page, "Core Concepts" overview
- **Format**: Render as SVG from Mermaid, or use as inline Mermaid in docs site
- **Key points to convey**: No database (just JSON files), three-package architecture, WebSocket for real-time updates, PTY sessions for AI agents
