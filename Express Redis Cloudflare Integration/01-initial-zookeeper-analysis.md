# Zookeeper Integration Analysis for Agent Maestro

## 1. Current Architecture — How Things Work Today

### Three Communication Layers

**Layer 1: Mail System (Agent-to-Agent, Persistent, Async)**
- Agents communicate via a REST-based mailbox: `POST /api/mail` to send, `GET /api/mail/inbox/:sessionId` to poll, `GET /api/mail/wait/:sessionId` for long-poll (up to 120s hold).
- Messages are stored as JSON files in `~/.maestro/data/mail/<id>.json` with an in-memory cache.
- No push to agents — agents must poll or long-poll. Each `mail wait` costs one HTTP connection that blocks until a message arrives or times out.
- No message ACK, no read receipts, no cursor-based consumption. Agents track their own read position via timestamps.

**Layer 2: InMemoryEventBus (Internal, Non-Persistent)**
- A Node.js `EventEmitter` wrapper shared by all services within the single server process.
- 27 domain events (task:*, session:*, mail:*, notify:*, team_member:*, project:*).
- Used by `MailService.waitForMail()` to resolve long-poll promises when matching mail arrives.
- Zero persistence, zero cross-process scope. If the server restarts, all subscriptions and in-flight events are lost.

**Layer 3: WebSocket Bridge (Server-to-UI Only)**
- Forwards all domain events to connected WebSocket clients (the Maestro UI panel).
- Supports per-session filtering for UI views.
- Agent CLIs have NO WebSocket client — they cannot receive push notifications.

### Key Limitations

| Limitation | Impact |
|---|---|
| Single-server, single-process | Cannot horizontally scale |
| Polling-based agent communication | Latency, wasted connections |
| No distributed locks or CAS | Race conditions on concurrent task updates |
| No message ordering guarantees | Last-writer-wins on task status |
| No message ACK/delivery guarantees | Messages can be read multiple times or missed |
| UI required to spawn agents | `session:spawn` event goes to UI, which launches the process |
| No agent heartbeat/liveness | Server cannot detect crashed agents proactively |

---

## 2. Where Zookeeper Can Be Integrated

### Integration Point 1: Distributed Event Bus (Replace InMemoryEventBus)

**Current:** `InMemoryEventBus` is process-local. Events die with the process.

**With Zookeeper:** Use ZK watches on znodes to implement a distributed event bus. Each domain event type maps to a znode path (e.g., `/maestro/events/mail/received`, `/maestro/events/session/updated`). Services write event data to znodes; watchers on those paths get notified across all server instances.

**Integration point:** `maestro-server/src/infrastructure/events/` — create `ZookeeperEventBus` implementing `IEventBus`. Wire it in `container.ts` as a drop-in replacement.

```
/maestro/events/
├── mail/
│   ├── received    # Watch for new mail events
│   └── deleted
├── session/
│   ├── created
│   ├── updated
│   ├── spawn
│   └── completed
├── task/
│   ├── created
│   ├── updated
│   └── deleted
└── notify/
    ├── progress
    └── needs_input
```

**Benefit:** Multiple maestro-server instances can share events. Enables horizontal scaling.

### Integration Point 2: Agent Session Registry & Liveness (Ephemeral Znodes)

**Current:** Session status is updated via HTTP calls from CLI hooks (`SessionStart`, `SessionEnd`, `Stop`). If an agent crashes without calling `session complete`, it stays as `working` forever — the server has no liveness detection.

**With Zookeeper:** Each agent session creates an **ephemeral znode** at `/maestro/sessions/active/<sessionId>`. ZK automatically deletes ephemeral znodes when the client disconnects (agent process dies). The server watches `/maestro/sessions/active/` children and detects agent death in real-time.

**Integration points:**
- `maestro-cli/src/commands/session.ts` — the `register` command creates an ephemeral ZK node.
- `maestro-server/src/application/services/SessionService.ts` — watches for child deletions to auto-mark sessions as `failed`.
- `plugins/maestro-orchestrator/hooks/hooks.json` — `SessionStart` hook additionally creates the ZK ephemeral node.

```
/maestro/sessions/
├── active/                    # Ephemeral znodes (auto-delete on disconnect)
│   ├── sess_123 → { pid, host, startedAt, teamMemberId }
│   ├── sess_456 → { pid, host, startedAt, teamMemberId }
│   └── ...
├── locks/                     # Distributed locks for task assignment
│   └── task_<id> → held by sess_xxx
└── coordination/              # Barriers, leader election
    └── project_<id>/
        └── barrier_<name>
```

**Benefit:** Immediate crash detection, no orphaned "working" sessions.

### Integration Point 3: Real-Time Agent-to-Agent Communication (ZK Watches)

**Current:** Agents poll `GET /api/mail/inbox` or long-poll `GET /api/mail/wait`. Latency is bounded by poll interval or long-poll timeout. No true push.

**With Zookeeper:** Each agent maintains a ZK session and watches its mailbox znode (e.g., `/maestro/mail/inbox/<sessionId>`). When a message is written, the watch fires immediately, notifying the recipient agent without polling.

**Integration points:**
- `maestro-cli/src/commands/mail.ts` — the `wait` command subscribes to a ZK watch instead of HTTP long-poll.
- `maestro-server/src/application/services/MailService.ts` — `sendMail()` writes/updates the recipient's inbox znode to trigger their watch.
- New: `maestro-cli/src/services/zk-client.ts` — a shared Zookeeper client for the CLI.

**Flow with Zookeeper:**
```
Agent A sends mail:
  1. CLI POSTs to /api/mail (unchanged)
  2. MailService persists mail (unchanged)
  3. MailService updates ZK znode /maestro/mail/inbox/<recipientId> (NEW)
  4. Agent B's ZK watch fires immediately (NEW)
  5. Agent B reads mail from REST API (or from ZK znode data)
```

**Benefit:** True push delivery to agents. Sub-second notification latency.

### Integration Point 4: Distributed Locks for Task Assignment

**Current:** Task assignment uses optimistic overwrite (`taskSessionStatuses`). If two agents simultaneously claim the same task, last write wins with no conflict detection.

**With Zookeeper:** Use ZK's distributed lock recipe (`/maestro/locks/tasks/<taskId>`). An agent must acquire the lock before updating task assignment. ZK's sequential ephemeral znodes provide fair, ordered lock acquisition.

**Integration points:**
- `maestro-server/src/application/services/TaskService.ts` — `updateTask()` acquires ZK lock before writing.
- `maestro-cli/src/commands/task.ts` — task edit/report commands can optimistically try lock, fail gracefully.

**Benefit:** Prevents duplicate task assignment, ensures consistency.

### Integration Point 5: Coordinator-Worker Barrier Synchronization

**Current:** Coordinator agents poll child session statuses to know when all children are done. No native barrier/join primitive.

**With Zookeeper:** Use ZK's barrier recipe. Coordinator creates a barrier znode (`/maestro/barriers/<projectId>/<barrierName>`) with expected participant count. Each child agent registers at the barrier when complete. When all participants arrive, the barrier releases and the coordinator's watch fires.

**Integration points:**
- `maestro-cli/src/services/workflow-templates.ts` — coordinate templates can use barrier primitives in their "monitor" phase.
- New commands: `maestro barrier create --count N`, `maestro barrier arrive`, `maestro barrier wait`.

**Benefit:** Eliminates polling for batch/wave completion. Enables efficient DAG execution.

### Integration Point 6: Leader Election for Multi-Server Deployment

**Current:** Single server, no redundancy. If the server crashes, all coordination stops.

**With Zookeeper:** Use ZK leader election recipe. Multiple maestro-server instances compete for leadership. The leader handles spawn events and coordination; followers serve read requests and standby.

**Integration point:** `maestro-server/src/server.ts` — startup registers for leader election. Only the leader mounts spawn-related routes.

---

## 3. Recommended Architecture with Zookeeper

```
                    ┌─────────────────────┐
                    │    Zookeeper         │
                    │    Ensemble          │
                    │  (3 or 5 nodes)      │
                    └────────┬────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                  │
    ┌──────▼──────┐   ┌─────▼──────┐   ┌──────▼──────┐
    │ maestro-    │   │ maestro-   │   │ maestro-    │
    │ server #1   │   │ server #2  │   │ server #N   │
    │ (leader)    │   │ (follower) │   │ (follower)  │
    └──────┬──────┘   └─────┬──────┘   └──────┬──────┘
           │                │                  │
    ┌──────▼────────────────▼──────────────────▼──────┐
    │              Agent CLI Processes                 │
    │  Each maintains a ZK session for:                │
    │  - Ephemeral liveness node                       │
    │  - Watches on inbox znode                        │
    │  - Barrier participation                         │
    └─────────────────────────────────────────────────┘
```

### ZK Node Structure

```
/maestro/
├── leader/                          # Leader election
│   └── election/
│       ├── server_0000000001        # Sequential ephemeral
│       └── server_0000000002
├── sessions/
│   └── active/                      # Ephemeral znodes per agent
│       ├── sess_123 → {pid, host}
│       └── sess_456 → {pid, host}
├── events/                          # Distributed event bus
│   ├── mail/received/<seqId>        # Sequential persistent
│   ├── session/updated/<seqId>
│   └── task/updated/<seqId>
├── mail/
│   └── inbox/                       # Watch triggers for push
│       ├── sess_123 → {lastMailId, count}
│       └── sess_456 → {lastMailId, count}
├── locks/
│   └── tasks/                       # Distributed locks
│       └── task_<id>/
│           ├── lock_0000000001      # Sequential ephemeral
│           └── lock_0000000002
├── barriers/                        # Coordination barriers
│   └── project_<id>/
│       └── wave_1/
│           ├── _meta → {threshold: 3}
│           ├── sess_123
│           ├── sess_456
│           └── sess_789
└── config/                          # Shared config
    └── server-url → http://...
```

---

## 4. Implementation Priority (Phased Approach)

### Phase 1: Agent Liveness Detection (Highest ROI, Lowest Risk)
- Add ZK client to maestro-cli
- Create ephemeral znodes on session register
- Watch for session death in SessionService
- **Files:** New `ZookeeperClient` infra class, modify `session.ts` register, modify `SessionService`

### Phase 2: Real-Time Mail Delivery
- Replace `mail wait` long-poll with ZK watch
- MailService updates inbox znodes on send
- **Files:** Modify `MailService.sendMail()`, modify `mail.ts` wait command

### Phase 3: Distributed Event Bus
- Create `ZookeeperEventBus` implementing `IEventBus`
- Wire in `container.ts` based on config flag
- **Files:** New `ZookeeperEventBus`, modify `container.ts`, modify `Config.ts`

### Phase 4: Distributed Locks & Barriers
- Add lock primitives for task assignment
- Add barrier primitives for coordinator workflows
- **Files:** New `DistributedLock`, `DistributedBarrier` services, modify `TaskService`, add CLI commands

### Phase 5: Multi-Server Support
- Leader election for spawn coordination
- Shared session/event state via ZK
- **Files:** Modify `server.ts`, add election module

---

## 5. Technology Considerations

### ZK Client Library for Node.js/Bun
- **node-zookeeper-client** (npm): Mature, callback-based. Works with Bun.
- **zookeeper** (npm): Lower-level, C bindings. May have Bun compatibility issues.
- Recommendation: Use `node-zookeeper-client` with a Promise wrapper.

### ZK vs. Alternatives
| Feature | Zookeeper | etcd | Redis |
|---|---|---|---|
| Ephemeral nodes | Native | Lease-based | No |
| Watches | Native | Watch API | Pub/Sub (no persistence) |
| Distributed locks | Recipe | Built-in | Redlock (approximate) |
| Barriers | Recipe | Manual | No |
| Ordering guarantees | Strong (ZAB) | Strong (Raft) | None |
| Node.js ecosystem | Mature | Good | Excellent |
| Operational complexity | High (JVM, ensemble) | Medium (Go binary) | Low |

ZK is strongest for the ephemeral node + watch combination which maps perfectly to agent liveness and real-time notification. The operational overhead of running a JVM-based ZK ensemble is the main trade-off.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ZK ensemble ops complexity | Start with single ZK node in dev; 3-node in prod |
| CLI startup latency from ZK connection | Lazy connection — only connect when needed (e.g., `mail wait`, `session register`) |
| ZK session timeout causing false death detection | Tune session timeout (30s default); add grace period before marking failed |
| Network partition between agents and ZK | Fall back to HTTP polling if ZK unavailable |
| Data consistency during migration | Run ZK alongside existing system; feature-flag each integration point |

---

## 7. Files That Would Be Modified/Created

### New Files
- `maestro-server/src/infrastructure/zookeeper/ZookeeperClient.ts` — Connection management, reconnect logic
- `maestro-server/src/infrastructure/zookeeper/ZookeeperEventBus.ts` — Distributed IEventBus implementation
- `maestro-server/src/infrastructure/zookeeper/DistributedLock.ts` — Lock recipe wrapper
- `maestro-server/src/infrastructure/zookeeper/DistributedBarrier.ts` — Barrier recipe wrapper
- `maestro-server/src/infrastructure/zookeeper/SessionWatcher.ts` — Watches ephemeral session nodes
- `maestro-cli/src/services/zk-client.ts` — CLI-side ZK client (lazy, singleton)

### Modified Files
- `maestro-server/src/container.ts` — Wire ZK client and ZK-based event bus (behind feature flag)
- `maestro-server/src/infrastructure/Config.ts` — Add ZK connection config (ZOOKEEPER_CONNECT_STRING, ZOOKEEPER_ENABLED)
- `maestro-server/src/application/services/SessionService.ts` — Add session death watcher
- `maestro-server/src/application/services/MailService.ts` — Update inbox znodes on send
- `maestro-server/src/application/services/TaskService.ts` — Distributed lock on task assignment
- `maestro-cli/src/commands/session.ts` — Create ephemeral ZK node on register
- `maestro-cli/src/commands/mail.ts` — ZK watch-based wait alternative
- `maestro-cli/src/config.ts` — Add ZOOKEEPER_CONNECT_STRING env var
- `maestro-server/src/types.ts` — Add ZK-related config types
