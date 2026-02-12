# Fix: Subtasks Now Show Session Status Badges

## Problem
Subtasks were not displaying session status badges (working, completed, failed, etc.) even when sessions were working on their parent tasks.

## Root Cause
The `TaskListItem` component was only fetching sessions directly associated with each task via `useTaskSessions(task.id)`. When a session was created for a parent task:
1. The session's `taskIds` array contained only the parent task ID
2. Child tasks (subtasks) would not find this session when calling `useTaskSessions(subtask.id)`
3. Therefore, no session badges were displayed on subtasks

## Solution
Modified `maestro-ui/src/components/maestro/TaskListItem.tsx` to:
1. Detect if the current task is a subtask (by checking `task.parentId`)
2. If it's a subtask, also fetch sessions from the parent task
3. Merge both the subtask's own sessions and parent task sessions into a combined list
4. Display all sessions in the badge area

### Code Changes
- Added parent task lookup and parent sessions fetching for subtasks
- Created `allSessions` computed array that combines:
  - Task's own sessions
  - Parent task sessions (if this is a subtask)
- Updated all references from `taskSessions` to `allSessions` in:
  - Session badge rendering
  - Session count display
  - Timeline aggregation
  - Sessions tab content
  - Loading states

## Behavior After Fix
- **Parent tasks**: Show sessions that are directly working on them (unchanged)
- **Subtasks with own sessions**: Show their own sessions
- **Subtasks without own sessions**: Inherit and display parent task sessions
- **Subtasks with both**: Display both their own sessions AND parent task sessions (deduplicated)

## Benefits
1. Users can now see at a glance which sessions are working on a parent task by looking at any of its subtasks
2. Session status is visible at all levels of the task hierarchy
3. Better visibility into work progress across task trees
4. Consistent session status information regardless of which task level you're viewing
