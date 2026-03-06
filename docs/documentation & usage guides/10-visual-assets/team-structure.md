# Team Structure Diagram

## Overview

Teams in Maestro organize team members into hierarchies with leaders, members, roles, and sub-teams. Each team member has a specific configuration controlling their AI agent behavior.

## Team Hierarchy Diagram

```mermaid
graph TB
    subgraph Team ["Team: Backend Overhaul"]
        direction TB
        Leader["<b>Lead Architect</b><br/>Role: Senior Engineer<br/>Model: claude-opus-4-6<br/>Mode: coordinator<br/>Avatar: 🏗️"]

        subgraph Members ["Team Members"]
            M1["<b>API Developer</b><br/>Role: Backend Dev<br/>Model: claude-sonnet-4-6<br/>Mode: coordinated-worker<br/>Avatar: 🔧"]
            M2["<b>DB Specialist</b><br/>Role: Database Engineer<br/>Model: claude-sonnet-4-6<br/>Mode: coordinated-worker<br/>Avatar: 🗄️"]
            M3["<b>Test Writer</b><br/>Role: QA Engineer<br/>Model: claude-haiku-4-5<br/>Mode: coordinated-worker<br/>Avatar: 🧪"]
        end

        Leader -->|"coordinates"| M1
        Leader -->|"coordinates"| M2
        Leader -->|"coordinates"| M3
    end

    style Team fill:#f5f5f5,stroke:#424242,stroke-width:2px
    style Leader fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Members fill:#fff3e0,stroke:#e65100
```

## Team Member Configuration

```mermaid
graph LR
    subgraph TeamMember ["Team Member Properties"]
        direction TB
        Identity["<b>Identity</b><br/>name, role, avatar<br/>identity (persona)"]
        AI["<b>AI Config</b><br/>model (opus/sonnet/haiku)<br/>agentTool (claude/codex/gemini)<br/>permissionMode"]
        Behavior["<b>Behavior</b><br/>mode (worker/coordinator)<br/>skills[]<br/>memory[]"]
        Access["<b>Access Control</b><br/>capabilities {}<br/>commandPermissions {}"]
    end

    Identity --- AI
    AI --- Behavior
    Behavior --- Access

    style Identity fill:#e3f2fd,stroke:#1565c0
    style AI fill:#fff3e0,stroke:#e65100
    style Behavior fill:#e8f5e9,stroke:#2e7d32
    style Access fill:#ffebee,stroke:#c62828
```

## Sub-Team Structure

```mermaid
graph TB
    subgraph Root ["Root Team: Product Launch"]
        RootLead["🎯 Product Lead<br/>(coordinator)"]

        subgraph SubTeam1 ["Sub-Team: Frontend"]
            FE_Lead["🎨 FE Lead<br/>(coordinated-coordinator)"]
            FE1["⚛️ React Dev<br/>(coordinated-worker)"]
            FE2["🎭 CSS Dev<br/>(coordinated-worker)"]
            FE_Lead --> FE1
            FE_Lead --> FE2
        end

        subgraph SubTeam2 ["Sub-Team: Backend"]
            BE_Lead["🔧 BE Lead<br/>(coordinated-coordinator)"]
            BE1["🗄️ API Dev<br/>(coordinated-worker)"]
            BE2["📊 Data Dev<br/>(coordinated-worker)"]
            BE_Lead --> BE1
            BE_Lead --> BE2
        end

        subgraph SubTeam3 ["Sub-Team: QA"]
            QA_Lead["🧪 QA Lead<br/>(coordinated-coordinator)"]
            QA1["✅ Test Writer<br/>(coordinated-worker)"]
            QA_Lead --> QA1
        end

        RootLead --> FE_Lead
        RootLead --> BE_Lead
        RootLead --> QA_Lead
    end

    style Root fill:#fafafa,stroke:#424242,stroke-width:2px
    style SubTeam1 fill:#e3f2fd,stroke:#1565c0
    style SubTeam2 fill:#fff3e0,stroke:#e65100
    style SubTeam3 fill:#e8f5e9,stroke:#2e7d32
```

## Agent Modes in Team Context

```mermaid
graph TB
    subgraph Modes ["Agent Modes"]
        direction LR
        Worker["<b>worker</b><br/>Standalone executor<br/>No parent coordinator"]
        Coordinator["<b>coordinator</b><br/>Standalone orchestrator<br/>Spawns & monitors workers"]
        CW["<b>coordinated-worker</b><br/>Worker spawned BY<br/>a coordinator"]
        CC["<b>coordinated-coordinator</b><br/>Coordinator spawned by<br/>another coordinator"]
    end

    Coordinator -->|spawns| CW
    Coordinator -->|spawns| CC
    CC -->|spawns| CW

    style Worker fill:#e8f5e9,stroke:#2e7d32
    style Coordinator fill:#e3f2fd,stroke:#1565c0
    style CW fill:#fff3e0,stroke:#e65100
    style CC fill:#f3e5f5,stroke:#6a1b9a
```

## Capability Matrix

| Capability | worker | coordinator | coordinated-worker | coordinated-coordinator |
|------------|--------|-------------|-------------------|------------------------|
| Execute tasks | Yes | No (delegates) | Yes | No (delegates) |
| Spawn sessions | No | Yes | No | Yes |
| Edit tasks | Yes | Yes | Configurable | Yes |
| Report to parent | N/A | N/A | Yes | Yes |
| Monitor workers | No | Yes | No | Yes |

## Text Description

```
TEAM HIERARCHY:

Team
├── Leader (coordinator mode)
│   ├── Member A (coordinated-worker)
│   ├── Member B (coordinated-worker)
│   └── Sub-Team
│       ├── Sub-Leader (coordinated-coordinator)
│       ├── Member C (coordinated-worker)
│       └── Member D (coordinated-worker)

TEAM MEMBER PROPERTIES:
- name: Display name (e.g., "API Developer")
- role: What they do (e.g., "Backend Developer")
- avatar: Emoji identifier
- identity: Persona/instructions
- model: AI model to use (opus/sonnet/haiku)
- agentTool: Which AI tool (claude-code/codex/gemini)
- mode: How they operate in the team
- permissionMode: Security level
- skills: Attached skill IDs
- memory: Persistent memory entries
- capabilities: What actions they can perform
- commandPermissions: Which CLI commands they can run
```

## Usage

- **Where**: "Teams" concept page, "Team Members" concept page, team management guides
- **Format**: Use hierarchy diagram for overview; sub-team structure for advanced usage; capability matrix as reference table
- **Key points**: Leaders coordinate, members execute; sub-teams enable nested orchestration; each member has granular configuration
