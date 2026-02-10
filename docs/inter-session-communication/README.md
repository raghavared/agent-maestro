# Inter-Session Communication Research

Research on enabling direct communication between Claude sessions in the Maestro application.

## Problem Statement

Enable a session to send a message to another session as an input prompt which executes in the next turn.

## Documents

This folder contains comprehensive research comparing two approaches:

1. **[01-overview.md](./01-overview.md)**
   - Problem statement and use cases
   - Current system architecture
   - Design considerations
   - Success criteria

2. **[02-tmux-approach.md](./02-tmux-approach.md)**
   - Using tmux's built-in communication features
   - Implementation details with send-keys
   - Advantages and disadvantages
   - Security considerations
   - Example use cases

3. **[03-server-approach.md](./03-server-approach.md)**
   - Extending maestro-server for message routing
   - Complete architecture and data model
   - REST API design
   - CLI command specifications
   - WebSocket integration
   - Implementation phases

4. **[04-comparison.md](./04-comparison.md)**
   - Detailed side-by-side comparison
   - 13 evaluation criteria
   - Use case analysis
   - Migration paths
   - Winner: **Server Approach**

5. **[05-recommendations.md](./05-recommendations.md)** ⭐
   - Executive summary and final verdict
   - Implementation strategy (phased approach)
   - Technical specifications
   - Security requirements
   - Testing strategy
   - Risk mitigation

## Quick Summary

### Two Approaches Evaluated

| Aspect | tmux Approach | Server Approach |
|--------|---------------|-----------------|
| Implementation | Simple (2-3 days) | Complex (3-4 weeks) |
| Terminal Compatibility | tmux only ❌ | Universal ✅ |
| Delivery Guarantee | None ❌ | Strong ✅ |
| Security | Weak ❌ | Strong ✅ |
| Scalability | Limited ⚠️ | High ✅ |
| Integration | Minimal ❌ | Extensive ✅ |

### Final Recommendation: **Server-Mediated Approach**

#### Critical Blocker for tmux

Maestro UI uses **zellij** (confirmed in `maestro-ui/src-tauri/src/pty.rs`), not tmux. The tmux approach would require:
- Rewriting UI terminal management (massive effort)
- Breaking existing functionality
- Losing zellij's features

**Verdict**: tmux approach is not viable without major architectural changes.

#### Why Server Approach?

1. **Compatible** with Maestro's zellij-based UI
2. **Reliable** with persistent storage and queuing
3. **Secure** with authentication and authorization
4. **Observable** through event system and timeline
5. **Extensible** for future features (threading, attachments, etc.)

## Implementation Plan

### Recommended Strategy: Server-First with POC

1. **Phase 0**: tmux POC (3 days) - Internal validation only
2. **Phase 1**: Core server infrastructure (1 week)
3. **Phase 2**: Event system integration (1 week)
4. **Phase 3**: Delivery mechanisms (1 week)
5. **Phase 4**: Production features (1 week)
6. **Total**: 3-4 weeks for MVP

### Technical Highlights

**Data Model**:
```typescript
interface Message {
  id: string;
  from: string;        // Sender session ID
  to: string;          // Receiver session ID
  message: string;
  status: 'pending' | 'delivered' | 'read' | 'failed';
  createdAt: number;
  metadata?: {
    taskId?: string;
    type?: 'request' | 'response' | 'notification';
    priority?: 'low' | 'medium' | 'high';
  };
}
```

**CLI Commands**:
```bash
# Send message
maestro session send --to <session-id> --message <text>

# Check inbox
maestro inbox
maestro inbox --mark-read
maestro inbox --clear
maestro inbox --watch
```

**API Endpoints**:
- `POST /api/sessions/:id/messages` (send)
- `GET /api/sessions/:id/messages` (inbox)
- `PATCH /api/messages/:id` (mark as read)
- `DELETE /api/messages/:id` (delete)

## Use Cases

1. **Orchestrator delegates to worker**
   - Break down tasks and assign with context
   - Send specific instructions

2. **Worker requests clarification**
   - Ask orchestrator questions
   - Get feedback on approach

3. **Peer review**
   - Worker A asks Worker B to review
   - Exchange feedback

4. **Status updates**
   - Report progress to orchestrator
   - Notify when unblocked

## Next Steps

1. Review and validate research findings
2. Get stakeholder approval for server approach
3. Allocate 3-4 weeks for implementation
4. Begin with Phase 0 POC for UX validation
5. Proceed with server implementation

## Research Methodology

This research was conducted by analyzing:
- Current Maestro architecture (server, CLI, UI)
- Event system and WebSocket infrastructure
- Terminal implementation (confirmed zellij usage)
- Security and reliability requirements
- Existing patterns in Maestro codebase
- Industry best practices for message passing

## Key Findings

1. **Architecture**: Maestro uses zellij, not tmux (critical finding)
2. **Event System**: Existing `EventBus` and `WebSocketBridge` ready for extension
3. **Storage Pattern**: File-based JSON storage (consistent approach)
4. **CLI Pattern**: Established command structure to follow
5. **Security**: Need authentication, authorization, rate limiting

## Questions or Feedback

For questions about this research or the implementation plan, refer to:
- Technical details: `03-server-approach.md`
- Implementation strategy: `05-recommendations.md`
- Comparison rationale: `04-comparison.md`

---

**Research Date**: February 2026
**Status**: Complete
**Recommendation**: Implement server-mediated approach
