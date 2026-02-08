# Phase VII Objectives

## Primary Goals

### 1. The "Voice" of the Agent
The primary objective is to give the LLM agent a standardized way to communicate with the Maestro system. The agent should not need to craft raw HTTP requests (curl) or understand the API schema. It should interact with a high-level, robust CLI tool.

### 2. Context Awareness
The CLI must be "session-aware". When running inside a terminal spawned by Agents UI, it should automatically detect:
- The current **Project ID**
- The current **Session ID**
- The current **Task IDs** (if assigned)
- The **API Server URL**

This minimizes the arguments the agent needs to provide.
*Example: `maestro task complete` (infers task ID from context) vs `maestro task complete <id>`.*

### 3. Dual-Mode Output
The CLI must serve two masters:
1.  **Humans:** Rich, colored, formatted output (tables, spinners, emojis).
2.  **Machines (LLMs):** Strict, deterministic JSON output via a `--json` flag.

### 4. Robustness & Error Handling
- **Retries:** Network blips should not crash the agent's workflow.
- **Clear Errors:** Error messages must be descriptive enough for an LLM to self-correct (e.g., "Task ID not found" vs "Error 404").
- **Validation:** Client-side validation of inputs before hitting the server.

---

## Success Criteria

1.  **Installation:** `npm install -g @maestro/cli` works globally.
2.  **Environment:** The CLI automatically picks up `MAESTRO_*` environment variables injected by the Agents UI.
3.  **LLM Usability:** An LLM can successfully perform a full task lifecycle (Start -> Subtasks -> Complete) using only CLI commands, with no human intervention.
4.  **Format:** `--json` output validates against a strictly defined schema.
5.  **Help:** `maestro help` provides clear, concise examples for all commands.
