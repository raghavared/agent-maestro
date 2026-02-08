# Discussion Points & Key Decisions

This document summarizes the chronological evolution and key technical decisions made during the design of the Maestro Orchestration architecture.

## 1. Core Objective: Automated Execution
**Goal:** Transform Maestro from a manual task tracker into an automated agentic system.
**Result:** Users click "Run Task," and the system plans and executes the work automatically via Claude Code.

## 2. Architecture: Two-Tier System
We moved from a single "do it" command to a separated concern model:
*   **Tier 1 (Orchestrator):** Pure planning. No code editing. Analysis only.
*   **Tier 2 (Worker):** Pure execution. Follows the plan. Reports status.

## 3. The "Non-Interactive" Pivot
**Initial Idea:** Call Claude API to plan tasks.
**Problem:** API lacks project context (file structure, existing code state).
**Solution:** Use **Claude Code binary** in `--non-interactive` mode.
*   **Benefit:** Claude sees the actual file system and project context.
*   **Mechanism:** Pass prompt via stdin, capture JSON via stdout.

## 4. Structured Communication (JSON)
The Orchestrator must output machine-readable data, not just chat.
*   **Protocol:** Strict JSON schema for the Execution Plan.
*   **Parsing:** System parses JSON to create actual `Subtask` objects in the database.
*   **Mapping:** The JSON explicitly maps Subtask Groups -> Worker Sessions.

## 5. Intelligent Session Management
**Insight:** Spawning new terminals for every subtask is slow and wasteful.
**Strategy:** "Warm" Session Reuse.
*   **Context Fingerprinting:** specific files/dirs a session has loaded.
*   **Matching:** If a new task group needs `auth/`, reuse the session that just finished `login/`.
*   **Impact:** Estimated 40-60% performance gain.

## 6. Context Chaining
**Problem:** Even with reuse, some sessions must be independent (parallelism). Learning is lost between them.
**Solution:** Pass a **Context Summary** from session outputs to future session inputs.
*   **Artifact:** Sessions produce a "knowledge dump" (decisions made, files modified).
*   **Injection:** Orchestrator injects this context into the prompt of dependent sessions.
*   **Result:** Session B knows what Session A decided, without re-reading the code.

## 7. Granular Visibility
**Requirement:** reliable status tracking.
**Solution:**
*   **Subtasks:** The unit of work.
*   **Hooks:** Real-time updates via `maestro subtask-start`, `maestro subtask-complete`.
*   **UI:** Shows exactly which subtask is running in which terminal.

## 7. Folder Structure
**Decision:** Consolidate all documentation into `Maestro-Agents-UI docs/maestro-orchestration/`.
*   `01-ARCHITECTURE-OVERVIEW.md`
*   `02-ORCHESTRATOR-SKILL.md`
*   `03-WORKER-SKILL.md`
*   `04-INTELLIGENT-SESSION-MANAGEMENT.md`
*   `05-IMPLEMENTATION-PLAN.md`
