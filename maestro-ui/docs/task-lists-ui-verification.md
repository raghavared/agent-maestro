# Task Lists UI - Manual Verification Notes

Date: 2026-02-20

## Assumptions (API contract)
- Task list endpoints assumed:
  - `GET /task-lists?projectId=...`
  - `GET /task-lists/:id`
  - `POST /task-lists`
  - `PATCH /task-lists/:id`
  - `DELETE /task-lists/:id`
  - `POST /task-lists/:id/tasks/:taskId`
  - `DELETE /task-lists/:id/tasks/:taskId`
  - `PUT /task-lists/:id/tasks` with `{ orderedTaskIds }`
  - `GET /task-lists/ordering/:projectId`
  - `PUT /task-lists/ordering/:projectId` with `{ orderedIds }`
- Task lists are flat (no nested lists) per v1 scope.

## UI Flows Verified (manual checklist)
- Navigate to Tasks tab, open Lists sub-tab and see Task Lists view.
- Navigate to Lists primary tab and see same Task Lists view.
- Create list via “New List” in tab bar or “+ New List” button.
- Edit list title/description.
- Delete list with confirmation.
- Add tasks to list using add-tasks modal with search/selection.
- Remove task from list (including missing references).
- Reorder lists with drag-and-drop or Up/Down buttons.
- Reorder tasks within a list with drag-and-drop or Up/Down buttons.
- Empty state renders when no lists exist.
- Loading state renders while fetching lists.
- Error banner shows for API failures.

## Edge Cases
- Missing task reference: list shows “Missing task reference” row and allows removal.
- Optimistic failures: reorder/add/remove/list updates revert on API failure (error banner shown).
