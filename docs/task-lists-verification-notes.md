# Task Lists UI - Manual Verification Notes

Not run (UI changes only).

Suggested checks:
- Open Maestro panel and switch to the Lists primary tab.
- Click "New List" in the subtab bar; confirm create modal opens.
- Create a list and confirm it appears with task count.
- Expand a list, add tasks via "Add Tasks", and reorder tasks (drag or up/down).
- Remove a task from the list and confirm error banner appears if backend rejects.
- Reorder lists (drag or up/down) and confirm ordering persists on refresh.
- Verify missing task references render with "Missing task reference" warning.
