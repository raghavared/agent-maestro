# 04 - Session Management Testing

**Goal:** Verify the lifecycle of sessions, including creation, editing, syncing, and deletion.

## Prerequisites
- Maestro Server running.
- UI App running.
- Maestro CLI available.

## Test Flows

### 1. Session Creation (Manual & CLI)
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | CLI: `maestro session spawn --task <taskId>` | New session appears in UI "Sessions" list. Terminal window opens. | |
| 1.2 | UI: Click "New Session" (if implemented) | New session card appears in the list. | |
| 1.3 | Verify Session Metadata | Session shows correct Name, Associated Task, and Status. | |

### 2. Session Editing
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | UI: Rename Session | Click edit icon, change name. Name updates in UI list. | |
| 2.2 | CLI: `maestro session info` (inside session) | Returns updated session name and details. | |

### 3. Real-time Synchronization
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Open UI in two separate windows/browsers | Both show same session list. | |
| 3.2 | Create session in Window A | Session appears instantly in Window B. | |
| 3.3 | Update status in Window B (e.g., active -> idle) | Status updates instantly in Window A. | |

### 4. Session Deletion/Closing
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | UI: Click "Delete" or "Close" on session | Session removed from list. Associated terminal closes. | |
| 4.2 | Verify Persistence | Reload app. Deleted session does NOT reappear. | |

## Success Criteria
- [ ] Sessions can be created via CLI and UI.
- [ ] Session details are editable.
- [ ] Changes sync in real-time across clients.
- [ ] Sessions can be deleted/closed permanently.
