# Maestro Integration Status

**Last Updated:** February 3, 2026
**Current Architecture:** Approach C (Server-Generated Manifests)

---

## ✅ Current Architecture: Server-Generated Manifests

The Maestro integration uses **Approach C** - a clean, manifest-driven architecture where:

1. Server calls `maestro manifest generate` as child process
2. Manifest is pre-generated and saved to `~/.maestro/sessions/{sessionId}/manifest.json`
3. Only 3 environment variables passed: `MAESTRO_SESSION_ID`, `MAESTRO_MANIFEST_PATH`, `MAESTRO_SERVER_URL`
4. CLI reads pre-generated manifest from file
5. All task/project data is in the manifest

**See:** [README.md](./README.md) for complete implementation guide

---

## 📐 Key Architectural Decisions

### ✅ Manifest Generation
- **Decision:** Server calls CLI for manifest generation
- **Implementation:** `maestro manifest generate` command
- **Storage:** `~/.maestro/sessions/{sessionId}/manifest.json`
- **Why:** Reusable by orchestrator, single source of truth for manifest logic

### ✅ Environment Variables
- **Decision:** Minimal env vars only
- **Variables:**
  - `MAESTRO_SESSION_ID` - Session identifier
  - `MAESTRO_MANIFEST_PATH` - Path to pre-generated manifest
  - `MAESTRO_SERVER_URL` - Server base URL
- **Why:** All data in manifest, clean separation

### ✅ Spawn Source
- **Decision:** Only two values
- **Values:** `"manual"` | `"orchestrator"`
- **Why:** Clear, simple, covers all use cases
  - `manual` = User clicked "Start Task" in UI
  - `orchestrator` = Spawned by orchestrator agent

### ✅ Hierarchical Tasks
- **Decision:** Use `parentId` field, no subtasks array
- **Why:** Child tasks are full Task entities with all capabilities

---

## 📝 Documentation Status

### ✅ Current Docs (Updated for Approach C)

- **README.md** - Main integration guide with current architecture
- **FINAL-ARCHITECTURE.md** - Complete architecture reference
- **QUICK-START.md** - Step-by-step guide with manifest generation tests
- **STATUS.md** (this file) - Current state and decisions

### ⚠️ Deprecated Docs (Historical Reference)

- **ARCHITECTURE-UPDATE.md** - Old "Approach B" description
- **SERVER-INTEGRATION.md** - Old server implementation
- **CLI-INTEGRATION.md** - Old CLI implementation
- **UI-INTEGRATION.md** - Old UI implementation

These files have been marked as deprecated and kept for historical context only.

### 🔄 To Be Updated

- **INTEGRATION-UPDATE-SUMMARY.md** - Needs final status update

---

## 🚀 Implementation Status

### ✅ Documented

- [x] Server spawn endpoint with CLI manifest generation
- [x] `maestro manifest generate` CLI command
- [x] `maestro worker init` reading pre-generated manifest
- [x] UI WebSocket listener (minimal implementation)
- [x] Environment variables (minimal set)
- [x] WebSocket event format
- [x] API contracts

### 🚧 To Be Implemented

#### Server (maestro-server)
- [ ] Implement spawn endpoint with `execAsync('maestro manifest generate')`
- [ ] Update spawn source validation to only allow "manual" | "orchestrator"
- [ ] Update session schema to include `metadata.spawnSource` and `metadata.spawnedBy`

#### CLI (maestro-cli)
- [ ] Implement `maestro manifest generate` command
- [ ] Update `maestro worker init` to read from `MAESTRO_MANIFEST_PATH`
- [ ] Remove old env var dependencies (MAESTRO_TASK_IDS, MAESTRO_PROJECT_ID, etc.)
- [ ] Create ManifestGenerator service
- [ ] Update PromptGenerator to use manifest data

#### UI (maestro-ui)
- [ ] Update MaestroContext WebSocket listener
- [ ] Update spawn request to include `role` and `spawnSource: "manual"`
- [ ] Remove old env var preparation code
- [ ] Test terminal spawning with minimal env vars

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] `maestro manifest generate` creates valid manifest file
- [ ] `maestro worker init` loads and uses pre-generated manifest
- [ ] Server spawn endpoint calls CLI and creates manifest
- [ ] WebSocket emits spawn_request with complete data
- [ ] UI spawns terminal with minimal env vars
- [ ] Only 3 env vars passed (verified in terminal)
- [ ] Claude starts with full task context from manifest

### Integration Testing

- [ ] Full flow: UI → Server → CLI manifest gen → Server → UI → Terminal → Claude
- [ ] Manifest file contains all expected data
- [ ] Spawn source "manual" works
- [ ] Session status updates correctly
- [ ] Task-session relationships work

---

## 📊 Component Responsibilities

### Server (maestro-server)
**Does:**
- ✅ Receives spawn requests
- ✅ Validates input
- ✅ Calls `maestro manifest generate` as child process
- ✅ Creates session record
- ✅ Broadcasts spawn_request events
- ✅ Manages data storage

**Does NOT:**
- ❌ Generate prompts
- ❌ Load plugins
- ❌ Spawn Claude
- ❌ Spawn terminals

### CLI (maestro-cli)
**Does:**
- ✅ `manifest generate` - Fetches data and creates manifest
- ✅ `worker init` - Loads manifest and spawns Claude
- ✅ Generates prompts from templates
- ✅ Loads plugins and skills
- ✅ Spawns Claude processes

**Does NOT:**
- ❌ Store session data
- ❌ Broadcast events
- ❌ Spawn terminals

### UI (maestro-ui)
**Does:**
- ✅ Calls spawn API endpoint
- ✅ Listens for WebSocket events
- ✅ Spawns terminals

**Does NOT:**
- ❌ Generate manifests
- ❌ Prepare environment variables (beyond receiving them)
- ❌ Fetch project/task details
- ❌ Know about manifest structure

---

## 🎯 Next Steps

### Immediate (High Priority)
1. Implement `maestro manifest generate` command
2. Update server spawn endpoint to call CLI
3. Update `maestro worker init` to use manifest path
4. Test end-to-end flow

### Short Term
5. Update UI to use new spawn API format
6. Remove old deprecated code
7. Update all type definitions
8. Write integration tests

### Long Term
9. Implement orchestrator spawning (later feature)
10. Add manifest versioning
11. Implement manifest caching/cleanup strategy
12. Performance optimization

---

## 🔑 Key Files

### Documentation
- `README.md` - Main integration guide
- `FINAL-ARCHITECTURE.md` - Architecture reference
- `QUICK-START.md` - Getting started guide
- `STATUS.md` (this file) - Current status

### Implementation
- `maestro-server/src/api/sessions.ts` - Spawn endpoint
- `maestro-cli/src/commands/manifest-generator.ts` - Manifest generation
- `maestro-cli/src/commands/worker-init.ts` - Worker initialization
- `maestro-ui/src/contexts/MaestroContext.tsx` - WebSocket listener

---

## 📞 Questions & Clarifications

### Resolved
- ✅ Use Approach C (server-generated manifests)
- ✅ Only 3 env vars (SESSION_ID, MANIFEST_PATH, SERVER_URL)
- ✅ Spawn source only "manual" | "orchestrator"
- ✅ No task IDs or project IDs in env vars
- ✅ Manifest storage at `~/.maestro/sessions/{sessionId}/`

### Open
- ⚠️ Manifest cleanup strategy after session completion?
- ⚠️ Retry logic if CLI manifest generation fails?
- ⚠️ Cache manifests or regenerate for each spawn?

---

## ✨ Benefits of Current Architecture

1. **Single Source of Truth** - Manifest file contains all spawn data
2. **Minimal Coupling** - Only 3 env vars between components
3. **Reusable** - Orchestrator can use same manifest generation
4. **Testable** - Can test manifest generation independently
5. **Clean** - Clear separation of concerns
6. **Simple UI** - UI just receives and spawns
7. **Flexible** - Easy to add new manifest fields

---

**Status:** ✅ Architecture finalized, ready for implementation
