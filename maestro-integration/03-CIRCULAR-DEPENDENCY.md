# Circular Dependency Evaluation

This document evaluates the bidirectional dependencies between the server and CLI components.

## Dependency Directions

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────┐                    ┌─────────────┐    │
│  │             │  child_process     │             │    │
│  │   Server    │ ──────────────────►│     CLI     │    │
│  │             │  (manifest gen)    │             │    │
│  │             │                    │             │    │
│  │             │◄──────────────────│             │    │
│  │             │   REST API calls   │             │    │
│  └─────────────┘                    └─────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Analysis

### Server → CLI (01-SERVER-CLI.md)

| Aspect | Details |
|--------|---------|
| **Dependency Type** | Runtime process invocation |
| **Coupling** | Loose (CLI is external binary) |
| **When Used** | Session spawn only |
| **Failure Mode** | Spawn fails if CLI unavailable |
| **Alternative** | Server could generate manifests itself |

### CLI → Server (02-CLI-SERVER.md)

| Aspect | Details |
|--------|---------|
| **Dependency Type** | HTTP REST API calls |
| **Coupling** | Loose (standard HTTP, local-first) |
| **When Used** | Task/session CRUD, updates |
| **Failure Mode** | Graceful (offline mode continues) |
| **Alternative** | Local-only mode already works |

## Is This a Circular Dependency?

**Technically Yes, But Practically No.**

The dependencies are:
1. **Different in nature**: One is process invocation, one is HTTP
2. **Different in timing**: Never simultaneous
3. **Independently operable**: Each can work without the other

### Why It's Not Problematic

1. **No Import Cycles**
   - Server doesn't import CLI code
   - CLI doesn't import server code
   - They communicate via external interfaces (process/HTTP)

2. **Graceful Degradation**
   - CLI works offline (local storage)
   - Server works without CLI (but can't generate manifests)

3. **Clear Boundaries**
   - Server → CLI: Only for manifest generation
   - CLI → Server: Only for data sync

4. **No Startup Dependencies**
   - Server starts independently
   - CLI starts independently
   - Neither waits for the other

## Dependency Flow During Operations

### Session Spawn (The Only Interaction Point)

```
1. Client (UI or CLI) calls POST /sessions/spawn
   │
   ▼
2. Server creates session record
   │
   ▼
3. Server spawns CLI process for manifest
   │
   └──► CLI reads task data (from local storage, NOT server)
        CLI generates manifest
        CLI writes to filesystem
        CLI exits
   │
   ▼
4. Server reads manifest, emits WebSocket event
   │
   ▼
5. Client receives event, spawns terminal
```

**Key Insight**: During manifest generation, the CLI reads from its **local storage**, not from the server. This breaks what would otherwise be a direct circular call.

### CLI Update Commands

```
1. User runs: maestro update "Working on X"
   │
   ▼
2. CLI calls POST /tasks/{id}/timeline (blocking)
   │
   ▼
3. Server updates database, emits WebSocket event
   │
   ▼
4. UI receives event, updates display
```

**Key Insight**: CLI now uses server as single source of truth. Server must be running for CLI write operations.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CLI unavailable during spawn | Low | Medium | Show clear error, suggest installation |
| Server unavailable during CLI updates | Low | Low | Local-first pattern, graceful degradation |
| Conflicting data versions | Medium | Low | Server is source of truth, CLI syncs on connect |
| Deadlock | None | N/A | No blocking mutual calls |

## Recommendations

### Current State: Acceptable

The current architecture is reasonable because:
1. Clear separation of concerns
2. Graceful degradation on both sides
3. No blocking mutual dependencies

### Future Improvements

1. **Move Manifest Generation to Server (Optional)**
   - The `IManifestGenerator` interface already exists
   - Would remove Server → CLI dependency entirely
   - Trade-off: Duplicated manifest logic

2. **Event Sourcing (Optional)**
   - Server as single source of truth
   - CLI becomes pure HTTP client
   - Would simplify but reduce offline capability

3. **Keep Current Architecture (Recommended)**
   - Well-understood boundaries
   - Good offline support
   - Minimal coupling

## Conclusion

**No problematic circular dependency exists.**

The bidirectional communication is:
- **Loosely coupled**: External interfaces (process/HTTP)
- **Failure-tolerant**: Each component degrades gracefully
- **Non-blocking**: No mutual waiting

The architecture is sound. The only consideration is ensuring the CLI binary is available for session spawning, which is a deployment concern, not an architectural flaw.
