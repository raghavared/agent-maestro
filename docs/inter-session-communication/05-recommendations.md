# Implementation Recommendations

## Executive Summary

After thorough research and comparison of two approaches for inter-session communication in Maestro, we **strongly recommend implementing the server-mediated approach** for production use.

While the tmux approach offers simplicity and low latency, it has critical architectural mismatches with Maestro and lacks essential features for production deployment. The server approach, though requiring more implementation effort, provides the reliability, security, and extensibility needed for a robust inter-session communication system.

## Primary Recommendation: Server-Mediated Approach

### Rationale

1. **Architectural Compatibility**
   - Maestro UI uses **zellij**, not tmux (confirmed in `maestro-ui/src-tauri/src/pty.rs`)
   - Server approach is terminal multiplexer agnostic
   - Consistent with existing Maestro architecture patterns

2. **Production Requirements**
   - Delivery guarantees (messages not lost)
   - Security and authorization
   - State management and observability
   - Cross-platform support

3. **Future Extensibility**
   - Foundation for advanced features (threading, attachments, encryption)
   - Integration with UI for message history
   - Analytics and monitoring capabilities

### Critical Blocker for tmux Approach

The tmux approach has a **fundamental incompatibility**:
- Maestro UI uses zellij for terminal management
- tmux approach requires all sessions to run in tmux
- Cannot send messages between tmux and zellij sessions
- Would require rewriting UI terminal management (massive effort)

**Verdict**: tmux approach is not viable for Maestro without major architectural changes.

## Implementation Strategy

### Recommended: Server-First with POC Validation

**Phase 0: Proof of Concept (3-5 days)**
- Build minimal tmux POC for internal testing only
- Validate user experience and messaging patterns
- Test with real Claude sessions
- **DO NOT ship to users**

**Phase 1: Core Server Infrastructure (Week 1)**
- Message entity and repository
- File-based storage (consistent with Maestro architecture)
- REST API endpoints:
  - `POST /api/sessions/:id/messages` (send)
  - `GET /api/sessions/:id/messages` (inbox)
  - `PATCH /api/messages/:id` (mark as read)
  - `DELETE /api/messages/:id` (delete)
- Basic CLI commands:
  - `maestro session send`
  - `maestro inbox`

**Phase 2: Event System Integration (Week 2)**
- Add message events to `DomainEvents.ts`:
  - `message:created`
  - `message:delivered`
  - `message:read`
  - `session:message_received`
  - `session:message_sent`
- Event handlers
- WebSocket broadcasting via existing `WebSocketBridge`
- Timeline integration

**Phase 3: Delivery Mechanisms (Week 2-3)**
- Polling-based inbox check (simple)
- Hook integration (automatic check)
- WebSocket push (optional, for real-time)
- Message queuing for offline sessions

**Phase 4: Production Features (Week 3)**
- Message expiration/cleanup
- Rate limiting
- Authorization rules (role-based)
- Security validation
- Error handling

**Phase 5: Testing & Documentation (Week 4)**
- Unit tests
- Integration tests
- End-to-end tests
- User documentation
- Example use cases

**Phase 6: UI Integration (Future)**
- Message history view in desktop app
- Notification indicators
- Conversation threads
- Real-time updates

### Total Estimated Effort

- **Core implementation**: 2-3 weeks
- **Testing and polish**: 1 week
- **Total**: 3-4 weeks for MVP

## Technical Specifications

### Data Model

```typescript
interface Message {
  id: string;                    // msg_1770536761607_abc123
  from: string;                  // Sender session ID
  to: string;                    // Receiver session ID
  message: string;               // Message body
  status: MessageStatus;         // pending, delivered, read, failed
  createdAt: number;            // Timestamp
  deliveredAt?: number;         // When delivered
  readAt?: number;              // When acknowledged
  expiresAt?: number;           // Optional expiration
  metadata?: {
    taskId?: string;            // Related task
    type?: MessageType;         // request, response, notification
    priority?: 'low' | 'medium' | 'high';
    requiresAck?: boolean;      // Requires acknowledgment
  };
}

type MessageStatus = 'pending' | 'delivered' | 'read' | 'failed' | 'expired';
type MessageType = 'request' | 'response' | 'notification' | 'command';
```

### Storage Structure

```
~/.maestro/data/messages/
├── by-receiver/
│   ├── sess_a/
│   │   ├── msg_001.json
│   │   └── msg_002.json
│   └── sess_b/
│       └── msg_003.json
└── by-sender/
    └── sess_a/
        └── msg_001.json -> ../../by-receiver/sess_b/msg_001.json
```

### API Endpoints

1. **Send Message**
   ```
   POST /api/sessions/:receiverId/messages
   Headers: X-Session-ID: <sender-session-id>
   Body: { message, metadata }
   ```

2. **Get Inbox**
   ```
   GET /api/sessions/:sessionId/messages?status=pending&limit=10
   ```

3. **Mark as Read**
   ```
   PATCH /api/messages/:messageId
   Body: { status: "read" }
   ```

4. **Delete Message**
   ```
   DELETE /api/messages/:messageId
   ```

### CLI Commands

```bash
# Send message
maestro session send --to <session-id> --message <text>
maestro session send --to sess_b --message "Review PR in task_456"
maestro session send --to sess_b --file message.txt
maestro session send --to sess_b --message "Ready" --priority high

# Check inbox
maestro inbox                    # Show all pending messages
maestro inbox --mark-read        # Show and mark as read
maestro inbox --clear            # Show and delete
maestro inbox --quiet            # Only show if messages exist
maestro inbox --watch            # Stream new messages (blocking)
```

### Prompt Hook Integration

Automatically check inbox when Claude prompt appears:

```bash
# ~/.config/claude-code/hooks/prompt-display
#!/bin/bash
if [ -n "$MAESTRO_SESSION_ID" ]; then
  maestro inbox --quiet
fi
```

## Security Requirements

### Authentication
- Verify sender session exists and is active
- Validate session ID via X-Session-ID header
- Reject requests from completed/invalid sessions

### Authorization
- Orchestrators can message anyone
- Workers can message orchestrators
- Workers can message workers in same project
- Enforce role-based access control

### Input Validation
- Sanitize message content
- Limit message length (max 10,000 characters)
- Remove control characters
- Validate metadata fields

### Rate Limiting
- Max 10 messages per session per minute
- Prevent spam and abuse
- Return 429 status on limit exceeded

### Audit Logging
- Log all message sends/receives
- Track delivery status changes
- Store in timeline for debugging

## Migration & Compatibility

### Backward Compatibility
- No changes to existing APIs
- Purely additive feature
- Existing sessions work without modification
- Optional feature (sessions can ignore messages)

### Versioning Strategy
- Start with v1 API endpoints
- Use semantic versioning
- Maintain backward compatibility
- Document API changes

## Performance Considerations

### Latency Targets
- Message send: < 100ms (localhost)
- Message delivery (polling): < 500ms
- Message delivery (WebSocket): < 100ms

### Scalability
- Support 100+ concurrent sessions
- Handle 1000+ messages per hour
- Efficient storage (file-based)
- Periodic cleanup of old messages

### Resource Usage
- Minimal memory footprint
- Disk usage: ~1KB per message
- Cleanup messages after 7 days
- Configurable retention policy

## Alternative Approaches Considered

### 1. tmux Approach (Rejected)
**Pros**: Simple, low latency
**Cons**: Incompatible with Maestro UI (uses zellij), no reliability, weak security
**Verdict**: Not viable for production

### 2. File-Based Queue (Rejected)
**Pros**: No server dependency
**Cons**: Requires polling, no real-time, race conditions, cleanup complexity
**Verdict**: Less elegant than server approach

### 3. Redis/Message Queue (Future)
**Pros**: High performance, advanced features
**Cons**: External dependency, operational complexity
**Verdict**: Overkill for MVP, consider for scale

## Testing Strategy

### Unit Tests
- Message repository CRUD
- CLI command parsing
- Event handlers
- Authorization logic

### Integration Tests
- End-to-end message flow
- WebSocket broadcasting
- Timeline integration
- Error scenarios

### Manual Testing
- Send message between two sessions
- Verify Claude sees messages
- Test offline session queuing
- Stress test (high message volume)

## Success Metrics

### Functional
- ✅ Message delivery success rate > 99%
- ✅ No message loss (persist to disk)
- ✅ Messages appear in Claude's context
- ✅ Delivery latency < 500ms (polling), < 100ms (push)

### Operational
- ✅ Zero breaking changes to existing features
- ✅ No performance degradation
- ✅ Clean audit trail
- ✅ Graceful error handling

### User Experience
- ✅ Intuitive CLI commands
- ✅ Clear message formatting
- ✅ Helpful error messages
- ✅ Works across all terminal types

## Risks & Mitigation

### Risk 1: Complex Implementation
**Impact**: High
**Probability**: Medium
**Mitigation**:
- Break into small incremental phases
- Start with MVP, iterate
- Extensive testing at each phase

### Risk 2: User Experience Issues
**Impact**: Medium
**Probability**: Medium
**Mitigation**:
- Build POC for UX validation
- Gather early feedback
- Iterate on message formatting

### Risk 3: Performance Degradation
**Impact**: Medium
**Probability**: Low
**Mitigation**:
- Performance testing before release
- Monitoring and metrics
- Optimize hot paths (polling, WebSocket)

### Risk 4: Security Vulnerabilities
**Impact**: High
**Probability**: Low
**Mitigation**:
- Security review before release
- Input validation and sanitization
- Rate limiting and authorization
- Audit logging

## Open Questions

### 1. Message Retention
**Question**: How long should messages be kept?
**Options**:
- A. 7 days (recommended)
- B. Until read + 24 hours
- C. Configurable per project

**Recommendation**: Start with 7 days, make configurable later

### 2. Message Delivery Timing
**Question**: When should messages be displayed to Claude?
**Options**:
- A. Automatic via prompt hook (recommended)
- B. Manual check only
- C. Combination (hook + manual)

**Recommendation**: Hook with manual fallback

### 3. Broadcast Messaging
**Question**: Should we support 1:many messages?
**Options**:
- A. Yes, for orchestrator → all workers
- B. No, only 1:1 for MVP
- C. Future enhancement

**Recommendation**: Not in MVP, add later if needed

### 4. Offline Session Handling
**Question**: What if receiver session is completed?
**Options**:
- A. Error immediately (recommended for MVP)
- B. Queue until session restarts
- C. Redirect to orchestrator

**Recommendation**: Error for MVP, queue in v2

## Post-Launch Considerations

### Phase 2 Features (Future)
- Conversation threading
- File attachments
- Rich text formatting (Markdown)
- Message templates
- Broadcast messaging
- Group conversations
- Presence indicators (online/offline)

### UI Integration (Future)
- Message history panel
- Real-time notifications
- Conversation view
- Search and filter
- Export conversations

### Analytics (Future)
- Message volume metrics
- Delivery success rate
- Average response time
- Session collaboration patterns
- Most active message routes

## Conclusion

The server-mediated approach is the clear choice for implementing inter-session communication in Maestro. Despite higher initial implementation effort, it provides:

1. **Compatibility** with Maestro's zellij-based UI
2. **Reliability** through persistent storage and queuing
3. **Security** via authentication and authorization
4. **Observability** through event system and timeline integration
5. **Extensibility** for future advanced features

The tmux approach, while simpler, has fundamental architectural incompatibilities that make it unsuitable for production use.

**Recommended Action**: Proceed with server-mediated implementation following the phased strategy outlined above.

---

**Document Status**: Final Recommendation
**Date**: 2026-02-08
**Author**: Research Task (Maestro Worker Agent)
