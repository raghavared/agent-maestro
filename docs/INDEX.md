# Maestro Integration Documentation Index

**Current Architecture:** Server-Generated Manifests (Approach C)
**Last Updated:** February 3, 2026

---

## 🚀 Start Here

### New to Maestro Integration?

1. **[STATUS.md](./STATUS.md)** - Current state, architecture decisions, implementation status
2. **[QUICK-START.md](./QUICK-START.md)** - Step-by-step guide to get everything working
3. **[README.md](./README.md)** - Complete integration guide with code examples

---

## 📚 Current Documentation

### Core Documents

| Document | Description | Status |
|----------|-------------|--------|
| **[STATUS.md](./STATUS.md)** | Current architecture, decisions, implementation status | ✅ Current |
| **[README.md](./README.md)** | Complete integration guide with all implementation details | ✅ Current |
| **[QUICK-START.md](./QUICK-START.md)** | Step-by-step setup and testing guide | ✅ Current |
| **[FINAL-ARCHITECTURE.md](./FINAL-ARCHITECTURE.md)** | Detailed architecture reference | ✅ Current |

### Historical Documents (Deprecated)

| Document | Description | Status |
|----------|-------------|--------|
| **[ARCHITECTURE-UPDATE.md](./ARCHITECTURE-UPDATE.md)** | Old "Approach B" architecture | ⚠️ Deprecated |
| **[SERVER-INTEGRATION.md](./SERVER-INTEGRATION.md)** | Old server implementation | ⚠️ Deprecated |
| **[CLI-INTEGRATION.md](./CLI-INTEGRATION.md)** | Old CLI implementation | ⚠️ Deprecated |
| **[UI-INTEGRATION.md](./UI-INTEGRATION.md)** | Old UI implementation | ⚠️ Deprecated |
| **[INTEGRATION-UPDATE-SUMMARY.md](./INTEGRATION-UPDATE-SUMMARY.md)** | Historical implementation log | ⚠️ Historical |

**Note:** Deprecated docs are kept for historical reference and show the evolution of the architecture.

---

## 🎯 Quick Navigation

### By Role

#### I'm implementing the **Server**
1. Read [STATUS.md](./STATUS.md) - Understand current architecture
2. See [README.md](./README.md) Section "1. Server Implementation"
3. Key point: Server calls `maestro manifest generate` as child process

#### I'm implementing the **CLI**
1. Read [STATUS.md](./STATUS.md) - Understand architecture
2. See [README.md](./README.md) Section "2. CLI Implementation"
3. Two commands: `manifest generate` and `worker init`

#### I'm implementing the **UI**
1. Read [STATUS.md](./STATUS.md) - Understand architecture
2. See [README.md](./README.md) Section "3. UI Implementation"
3. Ultra-simple: Just receive WebSocket event and spawn terminal

#### I'm **testing the integration**
1. Follow [QUICK-START.md](./QUICK-START.md) step-by-step
2. Test manifest generation first
3. Then test full flow

### By Topic

#### Environment Variables
- **[README.md](./README.md)** Section "Environment Variables"
- Only 3 vars: `MAESTRO_SESSION_ID`, `MAESTRO_MANIFEST_PATH`, `MAESTRO_SERVER_URL`

#### Manifest Format
- **[FINAL-ARCHITECTURE.md](./FINAL-ARCHITECTURE.md)** - Complete manifest structure
- **[README.md](./README.md)** - Manifest generation code example

#### API Contracts
- **[README.md](./README.md)** Section "API Contracts"
- POST /api/sessions/spawn request/response
- WebSocket event format

#### Spawn Flow
- **[README.md](./README.md)** Section "Complete Flow" - 16-step detailed flow
- **[FINAL-ARCHITECTURE.md](./FINAL-ARCHITECTURE.md)** - Flow diagram

#### Troubleshooting
- **[QUICK-START.md](./QUICK-START.md)** Section "Troubleshooting"
- **[README.md](./README.md)** Section "Troubleshooting"

---

## 🔑 Key Concepts

### Server-Generated Manifests (Approach C)

The current architecture uses **server-generated manifests**:

```
User clicks "Start Task"
    ↓
UI calls POST /api/sessions/spawn
    ↓
Server executes: maestro manifest generate (child process)
    ↓
CLI fetches data and writes manifest to ~/.maestro/sessions/{sessionId}/manifest.json
    ↓
Server broadcasts spawn_request with manifest path
    ↓
UI spawns terminal with 3 env vars
    ↓
Terminal runs: maestro worker init
    ↓
CLI loads pre-generated manifest
    ↓
Claude starts with full context
```

### Minimal Environment Variables

Only 3 env vars are passed:

```bash
MAESTRO_SESSION_ID=sess_123
MAESTRO_MANIFEST_PATH=~/.maestro/sessions/sess_123/manifest.json
MAESTRO_SERVER_URL=http://localhost:3000
```

All other data (tasks, project, skills, working dir) is in the manifest file.

### Spawn Source Types

Only two values:
- `"manual"` - User clicked "Start Task" in UI
- `"orchestrator"` - Spawned by orchestrator agent (future feature)

---

## 📦 Component Breakdown

### maestro-server
- Receives spawn requests
- Calls `maestro manifest generate`
- Broadcasts WebSocket events
- Manages data storage

**Key File:** `maestro-server/src/api/sessions.ts`

### maestro-cli
- `manifest generate` - Creates manifest files
- `worker init` - Loads manifest and spawns Claude
- Generates prompts from templates
- Loads plugins and skills

**Key Files:**
- `maestro-cli/src/commands/manifest-generator.ts`
- `maestro-cli/src/commands/worker-init.ts`

### maestro-ui
- Calls spawn API
- Listens for WebSocket events
- Spawns terminals

**Key File:** `maestro-ui/src/contexts/MaestroContext.tsx`

---

## 🧪 Testing Strategy

### Unit Testing
1. Test `maestro manifest generate` creates valid manifest
2. Test `maestro worker init` loads manifest correctly
3. Test server spawn endpoint calls CLI
4. Test UI WebSocket listener

### Integration Testing
1. Full flow: UI → Server → CLI → Terminal → Claude
2. Verify only 3 env vars passed
3. Verify manifest contains all data
4. Verify Claude starts with full context

### Manual Testing
Follow [QUICK-START.md](./QUICK-START.md) step-by-step

---

## 📋 Implementation Checklist

### Server
- [ ] Implement spawn endpoint with `execAsync('maestro manifest generate')`
- [ ] Validate spawn source ("manual" | "orchestrator")
- [ ] Broadcast spawn_request with manifest path

### CLI
- [ ] Implement `maestro manifest generate` command
- [ ] Update `maestro worker init` to read `MAESTRO_MANIFEST_PATH`
- [ ] Remove dependencies on old env vars

### UI
- [ ] Update WebSocket listener
- [ ] Add `role` and `spawnSource` to spawn request
- [ ] Remove old env var preparation code

---

## ❓ FAQ

### Why only 3 environment variables?

Because all data is in the manifest file. This keeps the interface clean and allows for easy extension without changing environment variables.

### Why is the manifest pre-generated?

1. Reusable by orchestrator
2. Single source of truth for manifest logic
3. Faster worker startup (no API calls needed)
4. Easier to debug (can inspect manifest file)

### What happened to the old approaches?

They are deprecated but kept in historical docs:
- Approach A: UI prepared env vars, CLI generated manifest at runtime
- Approach B: Server prepared complete env vars, CLI still generated manifest
- Approach C (Current): Server generates manifest via CLI, minimal env vars

### Where are orchestrator sessions documented?

Orchestrator is a future feature. Worker sessions are implemented first. The architecture supports orchestrators (they use `spawnSource: "orchestrator"`), but implementation is not yet documented.

---

## 🔗 External Resources

- [Maestro Server Docs](../maestro-server/docs/)
- [Maestro CLI Docs](../maestro-cli/docs/)
- [Claude Code Documentation](https://docs.anthropic.com/claude/docs)

---

## 📞 Getting Help

If you're stuck:

1. Check [STATUS.md](./STATUS.md) for current implementation status
2. Follow [QUICK-START.md](./QUICK-START.md) step-by-step
3. Review troubleshooting sections in docs
4. Check that `maestro manifest generate` works independently

---

**Last Updated:** February 3, 2026
**Architecture:** Approach C (Server-Generated Manifests)
**Status:** ✅ Documented and ready for implementation
