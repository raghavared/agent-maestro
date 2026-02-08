# Key Decisions for Phase I Final Production

The following decisions must be finalized and locked before proceeding to the final implementation of Production Phase I.

## 1. Skill System Protocol
- **Decision Needed:** Should we use the standard Claude Code skill directory (`~/.claude-code/skills`) or maintain a separate Maestro-specific directory (`~/.agents-ui/maestro-skills`)?
- **Current Recommendation:** Use `~/.agents-ui/maestro-skills` for isolation, but provide a symlink option to Claude Code for seamless integration.

## 2. Terminal Technology Choice (Tauri vs. External)
- **Decision Needed:** Should `maestro session spawn` always open a terminal *inside* the Agents UI (Tauri window) or should it support opening external terminals (e.g., iTerm2, Kitty)?
- **Current Recommendation:** Focus exclusively on the Tauri-internal terminal for Phase 1 to ensure environment variable injection and state sync are tightly controlled.

## 3. Subtask Consistency Model
- **Decision Needed:** How do we handle conflicting updates to subtasks?
- **Current Recommendation:** "Last Write Wins" at the subtask level, facilitated by moving to a dedicated subtask API. This replaces the current "Whole Task Patching" which causes "Whole Task Overwrites".

## 4. Agent Authentication
- **Decision Needed:** Is basic Project ID + Session ID context enough for "Production", or do we need API Key/JWT authentication immediately?
- **Current Recommendation:** Basic context (Project/Session ID) is sufficient for Phase 1 (Local Dev environment focus). Formal Auth is deferred to Phase 3.

## 5. Offline Mutability
- **Decision Needed:** If a worker session loses connection, should the CLI block or queue the update?
- **Current Recommendation:** CLI should block with a "Connecting..." message and retry. UI should queue for better UX.

## 6. CLI Versioning
- **Decision Needed:** How will we distribute updates to the CLI once it's globally installed?
- **Current Recommendation:** Implement a basic check on startup (`maestro version --check`) that queries the server and warns the user if an update is available.
