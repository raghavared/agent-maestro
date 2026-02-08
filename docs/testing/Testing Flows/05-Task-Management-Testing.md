# 05 - Task Management Testing

**Goal:** Verify the Maestro Panel functionality, including Task CRUD, Subtask management, and status transitions.

## Prerequisites
- Maestro Server running.
- UI App running.

## Test Flows

### 1. Maestro Panel Overview
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1.1 | Open Maestro Panel | Lists all tasks grouped by status (Pending, In Progress, etc.). | |
| 1.2 | Check Empty State | If no tasks, shows helpful "Get Started" message or empty state illustration. | |

### 2. Task Creation
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 2.1 | Click "Create Task" button | Modal or inline form appears. | |
| 2.2 | Enter Title, Description, Priority | | |
| 2.3 | Submit | New task appears in "Pending" list. WebSocket event received. | |

### 3. Task Editing & Details
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 3.1 | Click on a Task | Task Detail view opens (SlidePanel or Modal). | |
| 3.2 | Edit Description | Changes saved and reflected immediately. | |
| 3.3 | Change Status (Drag & Drop or Dropdown) | Task moves to new column/group. Timestamp updated. | |

### 4. Subtask Management
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 4.1 | Add Subtask (UI) | New checkbox item appears under parent task. | |
| 4.2 | Toggle Subtask Completion | Progress bar (if any) updates. | |
| 4.3 | Refresh Page | **Persistence Check:** Subtasks remain in their state (checked/unchecked). | |
| 4.4 | Delete Subtask | Subtask removed from list. | |

### 5. Status Transitions
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 5.1 | Move Task to "Blocked" | UI indicates blocked state (e.g., Red border/icon). | |
| 5.2 | Move Task to "Completed" | Visual indication of completion (Strikethrough or Green). | |

## Success Criteria
- [ ] Tasks can be created, read, updated, and deleted.
- [ ] Subtasks function correctly and **persist** after refresh.
- [ ] Status changes are reflected visually and via API.
- [ ] Maestro Panel updates in real-time.
