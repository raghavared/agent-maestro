# Phase 2 Production Test Flows

This document outlines the standard Manual Verification Flows to validate that the Phase 2 (Hooks & Observability) implementation is successful. These tests verify the full loop: **Agent Action → Hook → Server → UI**.

---

## Test Flow 1: The "Live Observability" Loop
**Goal:** Verify that an agent's file system activity is instantly visible in the Maestro UI.

### Prerequisites
1. Maestro Server is running (`npm run dev:server`).
2. Maestro UI is open in a browser (`http://localhost:1420`).
3. Maestro CLI is installed and linked.

### Step-by-Step Instructions

1.  **Create the Task**
    *   Open your terminal.
    *   Run: `maestro task create --title "Test Phase 2 Observability" --priority high`
    *   **Verify:** Copy the returned `Task ID` (e.g., `task_123`). Check that the task appears in the Maestro UI.

2.  **Spawn the Session**
    *   Run: `maestro session spawn --task task_123 --name "Observability Test"`
    *   **Verify:** A new terminal window (or tab) opens automatically. The Maestro UI "Sessions" list shows the new session with a green "Active" badge.

3.  **Simulate Agent Activity (The "Hook" Test)**
    *   *Note: If Claude Code is not fully installed, use the manual hook simulation script.*
    *   In the **spawned terminal**, run:
        ```bash
        # Simulating Claude reading a file
        echo '{"type":"read","file":"src/config.ts"}' | ~/.claude/hooks/log-tool-use.sh
        ```
    *   **Verify (Crucial):** Look at the **Maestro UI Task Card** for `task_123`.
        *   Does a "Live Activity" line appear saying "Reading src/config.ts"?
        *   Does the "Last Active" timestamp update?

4.  **Complete the Loop**
    *   In the **spawned terminal**, run:
        ```bash
        # Simulating session end
        echo '{"status":"completed"}' | ~/.claude/hooks/session-end.sh
        ```
    *   **Verify:** The session status in Maestro UI changes to "Completed" (gray/checked).

---

## Test Flow 2: The "Blocked & Rescue" Loop
**Goal:** Verify that when an agent is stuck waiting for user permission, the UI alerts the human operator immediately.

### Prerequisites
*   Same as Flow 1.

### Step-by-Step Instructions

1.  **Start a New Session**
    *   Run: `maestro session spawn --task task_123 --name "Permission Test"`
    *   **Verify:** Session is "Active" in UI.

2.  **Trigger Permission Block**
    *   In the **spawned terminal**, run:
        ```bash
        # Simulate a dangerous command requiring permission
        echo '{"type":"permission_prompt","command":"rm -rf /"}' | ~/.claude/hooks/notify-permission.sh
        ```

3.  **Verify UI Alert**
    *   Look at the Maestro UI.
    *   **Check 1:** Does the session status badge turn **Yellow/Orange**?
    *   **Check 2:** Is there a "⚠️ Waiting for Permission" label visible on the Task Card?
    *   **Check 3:** (Optional) Does a toast notification appear in the top-right corner?

4.  **Resolve the Block**
    *   In the **spawned terminal**, simulate the user pressing "Y" (Enter):
        ```bash
        # Simulate resuming activity
        echo '{"type":"bash","command":"echo safe_command"}' | ~/.claude/hooks/log-tool-use.sh
        ```
    *   **Verify:** The Maestro UI status returns to **Green/Active**. The "Waiting" label disappears.

---

## Success Criteria
If both flows complete successfully, the system has achieved the core Phase 2 requirement: **Closing the feedback loop between the Agent's hidden terminal state and the Orchestrator's visible UI.**
