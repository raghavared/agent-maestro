# Phase VII: Maestro CLI

## Overview

Phase VII focuses on building the **Maestro CLI (`maestro`)**, a robust command-line interface that serves as the primary bridge between Large Language Models (LLMs) operating within terminals and the Maestro Server.

While the Agent Maestro provides a visual interface for humans, the Maestro CLI empowers **agents** to autonomously manage their own state, report progress, and query information.

## The "Bridge" Concept

In the Maestro ecosystem, an LLM agent runs inside a terminal session. To be effective, it needs to communicate with the orchestration layer (Maestro Server).

```
┌──────────────┐          ┌────────────────┐          ┌────────────────┐
│  Agent Maestro   │          │  Agent (LLM)   │          │ Maestro Server │
│ (Human View) │          │   (Terminal)   │          │ (Orchestrator) │
└──────┬───────┘          └───────┬────────┘          └───────┬────────┘
       │                          │                           │
       │                          ▼                           │
       │                  ┌──────────────┐                    │
       │                  │ Maestro CLI  │                    │
       └──────────────────►  (Bridge)    ◄────────────────────┘
                          └──────────────┘
```

The CLI allows the Agent to say:
- *"I have finished the task."* (`maestro task update <id> --status completed`)
- *"What am I supposed to do?"* (`maestro task get <id>`)
- *"I need to break this down."* (`maestro subtask create ...`)

## Documentation Index

1. **[Objectives](./01-OBJECTIVES.md)**
   - Core goals: Robustness, LLM-usability, Context Awareness.
   
2. **[Architecture](./02-ARCHITECTURE.md)**
   - Tech stack, environment variables, and request flow.

3. **[CLI Reference](./03-CLI-REFERENCE.md)**
   - Detailed command reference, flags, and JSON output formats.

4. **[Implementation Plan](./04-IMPLEMENTATION-PLAN.md)**
   - Step-by-step guide to building and integrating the CLI.

## Quick Start (Preview)

```bash
# Human usage (pretty tables)
$ maestro task list --status pending

# LLM usage (parsable JSON)
$ maestro task list --status pending --json
```
