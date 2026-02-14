# Task Archival and Deletion Flow

## Overview

This document explains how Maestro handles task archival and deletion, including the hierarchical nature of tasks (parent-child relationships) and how subtasks are affected by these operations.

## Task Hierarchical Model

### Task Structure

Tasks in Maestro follow a **hierarchical model** where tasks can have parent-child relationships:

```typescript
interface Task {
  id: string;
  projectId: string;
  parentId: string | null;  // null for root tasks, task ID for subtasks
  title: string;
  description: string;
  status: TaskStatus;
  // ... other fields
}
```

**Key Points:**
- **Root Tasks**: Tasks with `parentId: null`
- **Subtasks**: Tasks with a non-null `parentId` referencing another task
- **Unlimited Depth**: Subtasks can have their own subtasks (recursive hierarchy)
- **Task Tree**: The system builds a tree structure from these parent-child relationships

### Hierarchical Navigation

The UI provides several ways to work with hierarchical tasks:

1. **Collapsible Tree View**: Subtasks can be expanded/collapsed under their parent
2. **Subtask Button**: Shows count of direct children and allows toggling visibility
3. **Add Subtask**: Create new subtasks under any task
4. **Breadcrumb Navigation**: Reference tasks can link to parent contexts

## Task Status Model

Tasks can have the following statuses:

```typescript
type TaskStatus =
  | 'todo'        // Initial state
  | 'in_progress' // Work has started
  | 'in_review'   // Needs review
  | 'completed'   // Successfully finished
  | 'cancelled'   // Stopped/abandoned
  | 'blocked'     // Cannot proceed
  | 'archived';   // Soft-deleted/hidden
```

### Status Transitions

- **Active Statuses**: `todo`, `in_progress`, `in_review`, `blocked`
- **Terminal Statuses**: `completed`, `cancelled`, `archived`
- Tasks can transition from any status to `archived` or `completed`

## Archival Flow

### What is Archival?

**Archival is a soft-delete operation** that:
- Changes the task status to `'archived'`
- Hides the task from the main "Tasks" tab
- Moves the task to the "Archived" tab
- **Preserves all task data** (can be unarchived by changing status)
- **Does NOT cascade** to subtasks automatically

### Archiving a Task

#### From the UI

**Location**: `maestro-ui/src/components/maestro/TaskListItem.tsx:224-233`

```typescript
const handleArchiveTask = async () => {
    setIsDeleting(true);
    try {
        await updateTask(task.id, { status: 'archived' });
    } catch (error) {
        console.error("Failed to archive task:", error);
    } finally {
        setIsDeleting(false);
    }
};
```

**Steps:**
1. Expand a task in the task list
2. Click the **"Archive Task"** button at the bottom
3. Task status changes to `'archived'`
4. Task disappears from active tabs with slide-out animation
5. Task appears in the "Archived" tab

#### Backend Processing

**Location**: `maestro-server/src/application/services/TaskService.ts:96-145`

```typescript
async updateTask(id: string, updates: UpdateTaskPayload): Promise<Task> {
    // ... validation
    const task = await this.taskRepo.update(id, userUpdates);
    await this.eventBus.emit('task:updated', task);
    // ... notification events
    return task;
}
```

**What happens:**
- Task status updated to `'archived'`
- `task:updated` event emitted
- UI receives WebSocket update
- Task automatically filtered from active views

### Archival Behavior with Subtasks

**IMPORTANT**: Archival does **NOT** cascade to subtasks by default.

**Example Scenario:**
```
Parent Task (archived)
├── Subtask 1 (todo)        ← NOT archived
├── Subtask 2 (in_progress) ← NOT archived
└── Subtask 3 (completed)   ← NOT archived
```

**Implications:**
- Subtasks remain in their current status
- Subtasks still appear in the UI under their respective status filters
- Parent-child relationship is preserved
- Archived parent can be expanded to view subtasks in the archived tab

**To archive a task hierarchy:**
- Users must manually archive each subtask
- OR delete the entire hierarchy (see deletion flow)

### Viewing Archived Tasks

**Location**: `maestro-ui/src/components/maestro/MaestroPanel.tsx:816-855`

```typescript
{activeTab === "archived" && (
    <div className="terminalContent">
        {archivedRoots.map(node =>
            renderTaskNode(node, 0, { showPermanentDelete: true })
        )}
    </div>
)}
```

**Archived Tab Features:**
- Shows only root tasks with `status === 'archived'`
- Sorted by most recently updated
- Displays **permanent delete** button instead of archive
- Subtasks of archived parents are visible when expanded
- Empty state message when no archived tasks exist

### Unarchiving Tasks

To restore an archived task:

1. Navigate to the "Archived" tab
2. Expand the task
3. Click the status badge
4. Select a different status (e.g., `todo`, `in_progress`)
5. Task moves back to the "Tasks" tab

## Deletion Flow

### What is Deletion?

**Deletion is a permanent operation** that:
- **Removes the task from storage completely**
- **Cascades to ALL descendants** (subtasks, sub-subtasks, etc.)
- **Cannot be undone**
- Requires user confirmation

### Deleting a Task

#### Deletion Entry Points

**1. From Archived Tab (Permanent Delete)**

**Location**: `maestro-ui/src/components/maestro/TaskListItem.tsx:771-781`

```typescript
{showPermanentDelete ? (
    <button
        className="terminalDeleteBtn"
        onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask();
        }}
        title="Permanently delete task"
    >
        Delete Task
    </button>
) : (
    // Archive button shown in other tabs
)}
```

Only visible in the "Archived" tab with `showPermanentDelete={true}`

**2. Via API/CLI**

Tasks can also be deleted programmatically through the API.

#### Deletion Confirmation

**Location**: `maestro-ui/src/components/maestro/TaskListItem.tsx:813-830`

```typescript
<ConfirmActionModal
    isOpen={showDeleteConfirm}
    title="[ DELETE TASK ]"
    message={
        totalDescendantCount > 0
            ? <>Are you sure you want to delete <strong>"{task.title}"</strong>?
               This task has <strong>{totalDescendantCount} subtask{totalDescendantCount !== 1 ? 's' : ''}</strong>
               that will also be deleted.</>
            : <>Are you sure you want to delete <strong>"{task.title}"</strong>?</>
    }
    confirmLabel={totalDescendantCount > 0 ? `Delete All (${totalDescendantCount + 1})` : "Delete"}
    cancelLabel="Cancel"
    confirmDanger
    busy={isDeleting}
    onClose={() => setShowDeleteConfirm(false)}
    onConfirm={confirmDeleteTask}
/>
```

**Confirmation Modal Shows:**
- Task title being deleted
- **Count of subtasks** that will be deleted
- Warning about cascade deletion
- Danger-styled confirm button

#### Frontend Deletion Logic

**Location**: `maestro-ui/src/components/maestro/TaskListItem.tsx:188-195`

```typescript
// Calculate total descendant count (recursive) for delete confirmation
const totalDescendantCount = useMemo(() => {
    const countDescendants = (parentId: string): number => {
        const children = Array.from(tasks.values()).filter(t => t.parentId === parentId);
        return children.reduce((sum, child) => sum + 1 + countDescendants(child.id), 0);
    };
    return countDescendants(task.id);
}, [tasks, task.id]);
```

**Algorithm:**
- Recursively count all descendants
- Include grandchildren, great-grandchildren, etc.
- Display total count in confirmation modal

**Location**: `maestro-ui/src/components/maestro/TaskListItem.tsx:239-249`

```typescript
const confirmDeleteTask = async () => {
    setIsDeleting(true);
    try {
        await deleteTask(task.id);
        setShowDeleteConfirm(false);
    } catch (error) {
        console.error("Failed to delete task:", error);
    } finally {
        setIsDeleting(false);
    }
};
```

#### Backend Deletion Logic

**Location**: `maestro-server/src/application/services/TaskService.ts:194-214`

```typescript
/**
 * Delete a task and all its descendants (cascade delete).
 */
async deleteTask(id: string): Promise<void> {
    const task = await this.taskRepo.findById(id);
    if (!task) {
        throw new NotFoundError('Task', id);
    }

    // Recursively collect all descendant task IDs
    const descendantIds = await this.collectDescendantIds(id);

    // Delete descendants bottom-up (children first)
    for (const descendantId of descendantIds.reverse()) {
        await this.taskRepo.delete(descendantId);
        await this.eventBus.emit('task:deleted', { id: descendantId });
    }

    // Delete the task itself
    await this.taskRepo.delete(id);
    await this.eventBus.emit('task:deleted', { id });
}
```

**Deletion Algorithm:**

1. **Verify Task Exists**: Check if task with given ID exists
2. **Collect Descendants**: Recursively find all child task IDs
3. **Bottom-Up Deletion**: Delete from leaves to root
   - Delete children before parents
   - Prevents orphaned tasks
   - Maintains referential integrity
4. **Event Emission**: Emit `task:deleted` for each deleted task
5. **Delete Root**: Finally delete the original task

**Location**: `maestro-server/src/application/services/TaskService.ts:216-228`

```typescript
/**
 * Recursively collect all descendant task IDs.
 */
private async collectDescendantIds(parentId: string): Promise<string[]> {
    const children = await this.taskRepo.findByParentId(parentId);
    const ids: string[] = [];
    for (const child of children) {
        ids.push(child.id);
        const grandchildren = await this.collectDescendantIds(child.id);
        ids.push(...grandchildren);
    }
    return ids;
}
```

**Recursive Collection:**
- Depth-first search of task tree
- Collects IDs at all levels
- Returns flattened array of descendant IDs

### Deletion Behavior with Subtasks

**Deletion ALWAYS cascades** to all descendants, regardless of depth.

**Example Scenario:**
```
Parent Task (deleted)
├── Subtask 1 (deleted)
│   └── Sub-subtask 1.1 (deleted)
├── Subtask 2 (deleted)
│   ├── Sub-subtask 2.1 (deleted)
│   └── Sub-subtask 2.2 (deleted)
└── Subtask 3 (deleted)
```

**All tasks in the hierarchy are permanently removed.**

### API Endpoint

**Route**: `DELETE /api/tasks/:id`

**Location**: `maestro-server/src/api/taskRoutes.ts:166-175`

```typescript
router.delete('/tasks/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await taskService.deleteTask(id);
        res.json({ success: true, id });
    } catch (err: any) {
        handleError(err, res);
    }
});
```

**Response:**
```json
{
  "success": true,
  "id": "task_1234567890_abc123"
}
```

## Comparison: Archival vs Deletion

| Aspect | Archival | Deletion |
|--------|----------|----------|
| **Permanence** | Reversible (change status) | Irreversible |
| **Data** | Preserved | Permanently removed |
| **Subtasks** | Not affected | Cascades to all descendants |
| **Visibility** | Moved to "Archived" tab | Completely removed |
| **Use Case** | Hide completed/outdated tasks | Remove unwanted tasks |
| **Confirmation** | None required | Requires explicit confirmation |
| **Button Location** | Main task view | Archived tab only |
| **API** | `PATCH /api/tasks/:id` with `status: 'archived'` | `DELETE /api/tasks/:id` |

## Best Practices

### When to Archive

- Task is completed but you want to keep the record
- Task is no longer relevant but might be referenced later
- Task should be hidden from active views but data preserved
- You want the option to restore the task later

### When to Delete

- Task was created by mistake
- Task is a duplicate
- Task contains sensitive data that should be removed
- Task and all its subtasks are no longer needed
- You need to permanently clean up archived tasks

### Working with Subtasks

**Archiving Parent Tasks:**
- Archive parent first if it's the main task
- Decide if subtasks should be completed, archived, or remain active
- Manually archive/complete subtasks as needed
- Archived parents with active subtasks are still visible in the tree

**Deleting Parent Tasks:**
- **Warning**: Deleting a parent deletes ALL subtasks
- Review the subtask count in the confirmation modal
- Consider archiving instead if you might need the data
- Use deletion only when you're sure about removing the entire hierarchy

### UI Workflow

1. **Active Tasks** → "Tasks" tab (default)
2. **Completed Tasks** → "Completed" tab
3. **Hidden Tasks** → Archive to "Archived" tab
4. **Unwanted Tasks** → Delete from "Archived" tab

This creates a clear progression:
```
Tasks → Completed → Archived → Deleted
       (or cancelled)
```

## Implementation Files

### Frontend Components

- **TaskListItem**: `maestro-ui/src/components/maestro/TaskListItem.tsx`
  - Handles archive/delete UI (lines 224-249, 771-830)
  - Shows confirmation modal with subtask count
  - Slide-out animations for archived tasks

- **MaestroPanel**: `maestro-ui/src/components/maestro/MaestroPanel.tsx`
  - Tab navigation (lines 560-603, 816-855)
  - Filter logic for archived tasks (lines 482-484)
  - Renders archived tab with permanent delete option

- **TaskStatusControl**: `maestro-ui/src/components/maestro/TaskStatusControl.tsx`
  - Status dropdown with archive option (lines 111-162)
  - Status symbols and labels (lines 13-31)

### Backend Services

- **TaskService**: `maestro-server/src/application/services/TaskService.ts`
  - Update task status (lines 96-145)
  - Cascade deletion logic (lines 194-228)
  - Event emission for UI updates

- **TaskRoutes**: `maestro-server/src/api/taskRoutes.ts`
  - PATCH endpoint for status updates (lines 70-90)
  - DELETE endpoint for task removal (lines 166-175)

### Type Definitions

- **Server Types**: `maestro-server/src/types.ts`
  - Task interface (lines 34-68)
  - TaskStatus enum (line 100)

- **UI Types**: `maestro-ui/src/app/types/maestro.ts`
  - MaestroTask interface (lines 87-132)
  - TaskStatus type (line 4)

## Testing

### Test Coverage

**Location**: `maestro-server/test/tasks.test.ts`

Current test suite covers:
- Task creation with parent-child relationships (lines 76-95)
- Task status updates (lines 245-297)
- Task deletion (lines 338-358)
- Child task listing (lines 361-389)

**Missing Tests:**
- Cascade deletion of multi-level hierarchies
- Archive/unarchive workflows
- Orphan detection and prevention

### Manual Testing Checklist

**Archival:**
- [ ] Archive root task without subtasks
- [ ] Archive root task with active subtasks
- [ ] Archive subtask (parent remains active)
- [ ] Unarchive task back to different statuses
- [ ] Verify archived tab filtering
- [ ] Verify slide-out animation

**Deletion:**
- [ ] Delete root task without subtasks
- [ ] Delete root task with subtasks (verify count in modal)
- [ ] Delete task with multi-level hierarchy
- [ ] Cancel deletion and verify nothing was deleted
- [ ] Verify permanent delete only appears in archived tab
- [ ] Verify deletion events propagate to UI

## Edge Cases and Considerations

### Orphaned Tasks

The current implementation prevents orphaned tasks by:
- Bottom-up deletion (children before parents)
- Atomic operations in the repository layer
- Event-driven updates to maintain consistency

### Concurrent Operations

**Potential Issues:**
- Multiple users archiving/deleting the same task
- Archiving parent while child is being updated
- Deleting task while session is actively working on it

**Mitigations:**
- Repository layer handles concurrent access
- Event bus ensures eventual consistency
- UI shows loading states during operations

### Session Impact

**When a task is archived:**
- Active sessions continue working
- Task appears in "Archived" tab but sessions still track it
- Task-session status mapping preserved

**When a task is deleted:**
- Sessions remain but lose task reference
- Consider cleanup of orphaned sessions
- UI handles missing task references gracefully

## Future Enhancements

### Potential Improvements

1. **Bulk Operations**
   - Archive/delete multiple tasks at once
   - Select all subtasks option
   - Batch confirmation modal

2. **Cascade Archival**
   - Option to archive all subtasks with parent
   - "Archive hierarchy" checkbox in UI
   - Configurable cascade behavior

3. **Trash/Recycle Bin**
   - Soft-delete before permanent delete
   - Time-based auto-cleanup of archived tasks
   - Restore from trash functionality

4. **Audit Trail**
   - Log who archived/deleted tasks
   - Timestamp of operations
   - Deletion reason/notes

5. **Archive States**
   - Multiple archive categories
   - Auto-archive completed tasks after N days
   - Archive folders/tags

## Summary

**Key Takeaways:**

1. **Hierarchical Model**: Tasks form a tree structure with parent-child relationships
2. **Archival = Soft Delete**: Changes status to `'archived'`, preserves data, does not cascade
3. **Deletion = Hard Delete**: Permanently removes task and ALL descendants recursively
4. **User Safety**: Deletion requires confirmation and shows subtask count
5. **Clear Workflow**: Tasks → Completed → Archived → Deleted
6. **Bottom-Up Deletion**: Algorithm deletes children before parents
7. **Event-Driven**: Updates propagate via WebSocket for real-time UI sync

Understanding this flow is crucial for:
- Building features that work with task hierarchies
- Preventing data loss through proper archival/deletion
- Maintaining referential integrity in the task tree
- Providing clear user expectations about permanence
