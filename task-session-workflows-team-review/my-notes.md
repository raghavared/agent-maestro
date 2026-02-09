
2. **Single `sessionStatus` for many-to-many.** The Task has one `sessionStatus` field but can have multiple sessions. Last writer wins, which means the field is unreliable when multiple sessions work on the same task.

this has to be fixed immediately.

the ui, server, and apis, and cli all the places it must be fixed

12. **`sessionStatus` naming inconsistency.** The type is `TaskSessionStatus` and the field comment says "renamed from agentStatus", but `UpdateTaskPayload` still has a comment referencing "Renamed from agentStatus". The rename appears complete in code but the comments could be cleaner.

first we need to make it many - many and and update the name to task session status.

