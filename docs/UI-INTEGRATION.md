# ⚠️ DEPRECATED - UI-INTEGRATION.md

**This document describes an older UI implementation and is kept for historical reference only.**

**For the current UI implementation, see:**
- [README.md](./README.md) - Complete implementation guide with current UI code
- [FINAL-ARCHITECTURE.md](./FINAL-ARCHITECTURE.md) - Architecture overview

---

## What Changed

This document originally described multiple approaches for UI integration with varying levels of responsibility.

**This has been superseded by the current architecture:**

### Current UI Implementation (Simple):

1. **Spawn Request:**
   ```typescript
   POST /api/sessions/spawn {
     projectId, taskIds, role: "worker",
     skills, spawnSource: "manual"
   }
   ```

2. **WebSocket Listener:**
   ```typescript
   ws.on('session:spawn_request', (data) => {
     const { command, cwd, envVars } = data;
     invoke('create_session', { command, cwd, envVars });
   });
   ```

That's it! The UI no longer:
- ❌ Fetches project details
- ❌ Prepares environment variables
- ❌ Knows about task IDs or project IDs
- ❌ Builds command strings

Server prepares everything. UI just receives and spawns.

See [README.md](./README.md) Section "3. UI Implementation" for the current UI code.

---

**Date Created**: February 2026
**Superseded By**: README.md
**Status**: Deprecated - Historical Reference Only
