# Phase VII Implementation Plan

## Overview
This plan outlines the steps to build and integrate the Maestro CLI.

---

## Step 1: Scaffold the CLI Project
**Location:** `/maestro-cli` (new package or inside `src-tauri`? -> Better as a separate node package inside the monorepo structure, e.g., `/packages/cli` or root `/maestro-cli` if not using workspaces. For now, let's assume `/maestro-cli` alongside `maestro-server`).

1.  `npm init` in `maestro-cli`.
2.  Install dependencies:
    -   `commander`
    -   `chalk`
    -   `node-fetch`
    -   `cli-table3`
    -   `dotenv`
3.  Configure `bin` entry in `package.json`.

## Step 2: Implement Core Infrastructure
1.  **Config Loader:** Logic to read Env Vars -> Config File -> Defaults.
2.  **API Client:** A wrapper around `fetch` that handles base URLs and error parsing.
3.  **Output Formatter:** A utility class that takes data and renders it as Table or JSON based on the flag.

## Step 3: Implement Commands (Iterative)
1.  **`whoami` / `status`:** Easiest to verify connectivity.
2.  **`task list` / `task get`:** Read-only operations.
3.  **`task create` / `task update`:** Write operations.
4.  **Subtasks:** Granular control.

## Step 4: Integration Testing
1.  Start Maestro Server locally.
2.  Run CLI commands against it.
3.  Verify JSON output validity (using `jq` or test scripts).

## Step 5: Integration with Agent Maestro (Phase VI Dependency)
1.  Ensure Agent Maestro spawns terminals with correct `MAESTRO_*` environment variables.
2.  Test that a terminal inside Agent Maestro can run `maestro whoami` and see the correct session ID.

## Step 6: LLM "Prompt Engineering"
1.  Update the System Prompt for the LLM Agent.
2.  Teach it about the CLI:
    > "You have access to a tool called `maestro`. Use `maestro task list --json` to see your work."
3.  Verify the LLM uses it correctly.

---

## Timeline (Estimated)

- **Day 1:** Scaffolding, Core Infra, `status` command.
- **Day 2:** Task management commands (CRUD).
- **Day 3:** Session/Subtask commands + JSON polishing.
- **Day 4:** Integration with Server & UI Testing.
