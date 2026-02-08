# Server-Mediated Inter-Session Communication

## Overview

This approach extends the existing maestro-server infrastructure to route messages between sessions. Messages flow through the central server, which maintains state, provides delivery guarantees, and integrates seamlessly with the existing event system.

## Architecture

### System Components

```
┌─────────────┐                                    ┌─────────────┐
│  Session A  │                                    │  Session B  │
│  (sender)   │                                    │  (receiver) │
└──────┬──────┘                                    └──────▲──────┘
       │                                                  │
       │ 1. POST /api/sessions/:id/messages              │
       │    { to: "sess_b", message: "..." }             │
       │                                                  │
       ▼                                                  │
┌─────────────────────────────────────────────────────────────────┐
│                      maestro-server                              │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │  REST API    │───►│   Message    │───►│  WebSocket      │  │
│  │  (Express)   │    │   Queue      │    │  Broadcast      │  │
│  └──────────────┘    └──────────────┘    └─────────────────┘  │
│                             │                      │            │
│                             │                      │            │
│                             ▼                      ▼            │
│                      ┌──────────────┐      ┌─────────────────┐ │
│                      │  EventBus    │      │  WebSocket      │ │
│                      │              │      │  Clients        │ │
│                      └──────────────┘      └─────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
       │                                                  │
       │ 2. WebSocket event:                             │
       │    "session:message_received"                   │ 3. Poll or WebSocket
       │                                                  │    GET /api/sessions/:id/messages
       │                                                  │
       └─────────────────────────────────────────────────┘
                              or
                    4. CLI: maestro inbox
                       Fetches pending messages
                       Displays to Claude
```

### Message Flow

1. **Sender (Session A)**:
   ```bash
   maestro session send --to sess_b --message "Review PR in task_456"
   ```

2. **CLI → Server**:
   ```http
   POST /api/sessions/sess_b/messages
   Content-Type: application/json
   X-Session-ID: sess_a

   {
     "from": "sess_a",
     "to": "sess_b",
     "message": "Review PR in task_456",
     "metadata": {
       "taskId": "task_456",
       "type": "request"
     }
   }
   ```

3. **Server Processing**:
   - Validates sender and receiver sessions exist
   - Checks receiver session is running/idle
   - Stores message in queue
   - Emits `session:message_received` event
   - Broadcasts via WebSocket to UI

4. **Delivery Mechanisms**:

   **Option A: Polling (Simple)**
   ```bash
   # In Session B's prompt hook
   maestro inbox --quiet
   # Displays pending messages
   ```

   **Option B: WebSocket Push (Real-time)**
   ```typescript
   // maestro-cli listens to WebSocket
   ws.on('session:message_received', (data) => {
     if (data.to === config.sessionId) {
       displayMessage(data.message);
     }
   });
   ```

   **Option C: Server-Sent Events (Hybrid)**
   ```bash
   # Long-polling endpoint
   GET /api/sessions/sess_b/messages/stream
   # Server holds connection until message arrives
   ```

5. **Receiver (Session B)**:
   - Message appears in terminal as formatted text
   - Claude processes in next turn
   - Can respond or execute the request

## Implementation Details

### 1. Data Model

#### Message Entity

```typescript
// maestro-server/src/domain/entities/Message.ts

export interface Message {
  id: string;                    // msg_1770536761607_abc123
  from: string;                  // Sender session ID
  to: string;                    // Receiver session ID
  message: string;               // Message body
  status: MessageStatus;         // pending, delivered, read, failed
  createdAt: number;            // Timestamp
  deliveredAt?: number;         // When delivered to receiver
  readAt?: number;              // When acknowledged by receiver
  expiresAt?: number;           // Optional expiration
  metadata?: {
    taskId?: string;            // Related task
    type?: MessageType;         // request, response, notification
    priority?: 'low' | 'medium' | 'high';
    requiresAck?: boolean;      // Requires explicit acknowledgment
  };
}

export type MessageStatus =
  | 'pending'      // Queued, not yet delivered
  | 'delivered'    // Sent to receiver
  | 'read'         // Acknowledged by receiver
  | 'failed'       // Delivery failed
  | 'expired';     // Expired before delivery

export type MessageType =
  | 'request'      // Requesting action
  | 'response'     // Response to previous message
  | 'notification' // Informational only
  | 'command';     // Executable command
```

#### Message Repository

```typescript
// maestro-server/src/domain/repositories/IMessageRepository.ts

export interface IMessageRepository {
  create(message: CreateMessagePayload): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  findByReceiver(sessionId: string, filter?: MessageFilter): Promise<Message[]>;
  findBySender(sessionId: string, filter?: MessageFilter): Promise<Message[]>;
  updateStatus(id: string, status: MessageStatus): Promise<Message>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  countPending(sessionId: string): Promise<number>;
}

export interface MessageFilter {
  status?: MessageStatus;
  type?: MessageType;
  since?: number;  // Timestamp
  limit?: number;
}
```

#### Storage

**File-based** (consistent with current architecture):
```
~/.maestro/data/messages/
├── by-receiver/
│   ├── sess_a/
│   │   ├── msg_001.json
│   │   └── msg_002.json
│   └── sess_b/
│       └── msg_003.json
├── by-sender/
│   └── sess_a/
│       └── msg_001.json -> ../../by-receiver/sess_b/msg_001.json
└── index.json
```

**Alternative: In-memory with persistence**:
- Keep active messages in memory
- Persist to disk on create/update
- Load on server startup

### 2. REST API Endpoints

#### Send Message

```http
POST /api/sessions/:receiverId/messages
Content-Type: application/json
X-Session-ID: <sender-session-id>

{
  "message": "Review PR in task_456",
  "metadata": {
    "taskId": "task_456",
    "type": "request",
    "priority": "high"
  }
}

Response 201:
{
  "id": "msg_1770536761607_abc123",
  "from": "sess_a",
  "to": "sess_b",
  "message": "Review PR in task_456",
  "status": "pending",
  "createdAt": 1707412345678
}
```

#### Get Messages (Inbox)

```http
GET /api/sessions/:sessionId/messages?status=pending&limit=10

Response 200:
{
  "messages": [
    {
      "id": "msg_001",
      "from": "sess_a",
      "message": "Review PR in task_456",
      "status": "pending",
      "createdAt": 1707412345678
    }
  ],
  "count": 1,
  "hasMore": false
}
```

#### Mark as Read

```http
PATCH /api/messages/:messageId
Content-Type: application/json

{
  "status": "read"
}

Response 200:
{
  "id": "msg_001",
  "status": "read",
  "readAt": 1707412345999
}
```

#### Delete Message

```http
DELETE /api/messages/:messageId

Response 204 No Content
```

### 3. CLI Commands

#### Send Message

```bash
maestro session send --to <session-id> --message <text>
maestro session send --to sess_b --message "Review PR in task_456"
maestro session send --to sess_b --file message.txt
maestro session send --to sess_b --message "Ready for review" --priority high
```

**Implementation**:
```typescript
// maestro-cli/src/commands/session-send.ts

async function sendMessage(options: SendOptions) {
  const { to, message, priority = 'medium', taskId, file } = options;

  // Read message from file if provided
  const messageText = file
    ? await fs.readFile(file, 'utf-8')
    : message;

  if (!messageText) {
    throw new Error('Message text or file required');
  }

  // Get current session ID
  const from = config.sessionId;
  if (!from) {
    throw new Error('No session context (MAESTRO_SESSION_ID not set)');
  }

  // Validate receiver exists
  const receiver = await api.get(`/api/sessions/${to}`);
  if (!receiver) {
    throw new Error(`Session ${to} not found`);
  }

  if (receiver.status === 'completed') {
    throw new Error(`Session ${to} is no longer running`);
  }

  // Send message
  const result = await api.post(`/api/sessions/${to}/messages`, {
    message: messageText,
    metadata: {
      taskId,
      type: 'request',
      priority
    }
  });

  console.log(`✓ Message sent to ${to} (${result.id})`);

  // Log to sender's timeline
  await api.post(`/api/sessions/${from}/timeline`, {
    type: 'message_sent',
    message: `Sent message to ${to}`,
    metadata: { messageId: result.id, to }
  });
}
```

#### Receive Messages (Inbox)

```bash
maestro inbox                    # Show all pending messages
maestro inbox --mark-read        # Show and mark as read
maestro inbox --clear            # Show and delete
maestro inbox --quiet            # Only show if messages exist
maestro inbox --watch            # Stream new messages (blocking)
```

**Implementation**:
```typescript
// maestro-cli/src/commands/inbox.ts

async function showInbox(options: InboxOptions) {
  const { markRead, clear, quiet, watch } = options;
  const sessionId = config.sessionId;

  if (!sessionId) {
    if (!quiet) {
      console.error('No session context');
    }
    process.exit(1);
  }

  // Fetch pending messages
  const response = await api.get(
    `/api/sessions/${sessionId}/messages?status=pending`
  );

  const messages = response.messages;

  if (messages.length === 0) {
    if (!quiet) {
      console.log('No pending messages');
    }
    return;
  }

  // Display messages
  console.log(`\n📬 ${messages.length} pending message(s):\n`);

  for (const msg of messages) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`From: ${msg.from}`);
    console.log(`Time: ${new Date(msg.createdAt).toLocaleString()}`);
    if (msg.metadata?.taskId) {
      console.log(`Task: ${msg.metadata.taskId}`);
    }
    console.log(`\n${msg.message}\n`);

    // Mark as read or clear
    if (markRead || clear) {
      const newStatus = clear ? 'read' : 'read';
      await api.patch(`/api/messages/${msg.id}`, { status: newStatus });
    }

    if (clear) {
      await api.delete(`/api/messages/${msg.id}`);
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Log to timeline
  await api.post(`/api/sessions/${sessionId}/timeline`, {
    type: 'messages_read',
    message: `Read ${messages.length} message(s)`,
    metadata: { count: messages.length }
  });
}
```

#### Watch Inbox (Streaming)

```typescript
async function watchInbox() {
  const sessionId = config.sessionId;

  console.log('📬 Watching for messages... (Ctrl+C to stop)\n');

  // Connect to WebSocket
  const ws = new WebSocket(config.websocketUrl);

  ws.on('open', () => {
    // Subscribe to session messages
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: `session:${sessionId}:messages`
    }));
  });

  ws.on('message', (data) => {
    const event = JSON.parse(data.toString());

    if (event.type === 'session:message_received' && event.data.to === sessionId) {
      const msg = event.data;
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`From: ${msg.from}`);
      console.log(`\n${msg.message}\n`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.log('Connection closed');
  });
}
```

### 4. Event System Integration

#### New Events

```typescript
// maestro-server/src/domain/events/DomainEvents.ts

export interface TypedEventMap {
  // Existing events...

  // New message events
  'message:created': {
    message: Message;
  };

  'message:delivered': {
    messageId: string;
    sessionId: string;
  };

  'message:read': {
    messageId: string;
    sessionId: string;
  };

  'session:message_received': {
    sessionId: string;
    message: Message;
  };

  'session:message_sent': {
    sessionId: string;
    messageId: string;
    to: string;
  };
}
```

#### Event Handlers

```typescript
// maestro-server/src/application/handlers/MessageHandlers.ts

export class MessageHandlers {
  constructor(
    private eventBus: IEventBus,
    private messageRepo: IMessageRepository,
    private sessionRepo: ISessionRepository
  ) {}

  register() {
    // When message created, notify receiver
    this.eventBus.on('message:created', async (data) => {
      const { message } = data;

      // Emit to receiver
      await this.eventBus.emit('session:message_received', {
        sessionId: message.to,
        message
      });

      // Update session timeline
      const session = await this.sessionRepo.findById(message.to);
      if (session) {
        await this.sessionRepo.addTimelineEvent(message.to, {
          id: generateId('evt'),
          type: 'message_received',
          timestamp: Date.now(),
          message: `Received message from ${message.from}`,
          metadata: { messageId: message.id }
        });
      }
    });

    // When message read, notify sender
    this.eventBus.on('message:read', async (data) => {
      const { messageId } = data;
      const message = await this.messageRepo.findById(messageId);

      if (message) {
        await this.eventBus.emit('session:message_delivered', {
          sessionId: message.from,
          messageId,
          status: 'read'
        });
      }
    });
  }
}
```

### 5. WebSocket Integration

#### Broadcasting Messages

```typescript
// maestro-server/src/infrastructure/websocket/WebSocketBridge.ts

// Add to setupEventHandlers()
const messageEvents: EventName[] = [
  'message:created',
  'message:delivered',
  'message:read',
  'session:message_received',
  'session:message_sent'
];

for (const event of messageEvents) {
  this.eventBus.on(event, (data) => {
    this.broadcast(event, data);
  });
}
```

#### Targeted Delivery

```typescript
// Send to specific session's WebSocket clients

private sendToSession(sessionId: string, event: string, data: any): void {
  const message = JSON.stringify({
    type: event,
    event,
    data,
    timestamp: Date.now()
  });

  let sent = 0;
  this.wss.clients.forEach((client) => {
    // Check if client is subscribed to this session
    if (client.readyState === WebSocket.OPEN &&
        client.sessionSubscriptions?.includes(sessionId)) {
      client.send(message);
      sent++;
    }
  });

  console.log(`📡 Sent ${event} to ${sent} client(s) for session ${sessionId}`);
}
```

### 6. Prompt Hook Integration

Automatically check inbox when Claude prompt appears:

```bash
# ~/.config/claude-code/hooks/prompt-display

#!/bin/bash
# Hook: Executed when Claude's prompt is displayed

# Check for pending messages
if [ -n "$MAESTRO_SESSION_ID" ]; then
  maestro inbox --quiet
fi
```

**Configuration**:
```json
{
  "hooks": {
    "prompt-display": "~/.config/claude-code/hooks/prompt-display"
  }
}
```

## Advantages

### 1. **Centralized State Management**
- Server tracks all messages
- Full audit trail and history
- Easy to query message status

### 2. **Delivery Guarantees**
- Messages persisted to disk
- Retries on failure
- Explicit acknowledgments

### 3. **Security & Authorization**
- Validate sender and receiver
- Rate limiting per session
- Permission checks (e.g., only orchestrator can message workers)

### 4. **Terminal Multiplexer Agnostic**
- Works with tmux, zellij, screen, or no multiplexer
- Compatible with Maestro UI's terminal implementation
- No external dependencies

### 5. **Rich Features**
- Message priority
- Expiration times
- Request-response patterns
- Conversation threads
- Bulk operations

### 6. **Observable & Debuggable**
- All messages visible in server logs
- UI can display message history
- Timeline integration shows communication flow

### 7. **Scalable**
- Can handle many concurrent sessions
- Message queuing prevents overload
- Async processing

### 8. **Consistent with Architecture**
- Uses existing EventBus pattern
- Follows REST API conventions
- Integrates with WebSocket infrastructure

### 9. **Flexible Delivery**
- Polling (simple, works everywhere)
- WebSocket push (real-time)
- Server-Sent Events (streaming)
- Combination of multiple methods

### 10. **Platform Independent**
- Works on any OS
- No terminal-specific features required
- Can work with headless sessions

## Disadvantages

### 1. **Server Dependency**
- Requires maestro-server to be running
- Single point of failure
- Cannot work offline

### 2. **Implementation Complexity**
- More code than tmux approach
- New data model and APIs
- Additional testing surface

### 3. **Latency**
- Messages route through server
- Network round-trip for each message
- Slower than direct terminal injection

### 4. **Storage Overhead**
- Messages persist to disk
- Need cleanup/expiration logic
- Could accumulate over time

### 5. **Polling Overhead** (if using polling)
- Sessions must periodically check inbox
- Unnecessary API calls if no messages
- Battery impact on laptops

### 6. **WebSocket Complexity** (if using push)
- CLI needs WebSocket client
- Connection management (reconnect, keepalive)
- Firewall/proxy issues

## Technical Challenges

### 1. **Prompt Injection Timing**

**Problem**: When should message appear in Claude's input?

**Options**:

**A. Manual Check**:
```bash
# User explicitly checks inbox
maestro inbox
```
- **Pro**: User control, non-intrusive
- **Con**: Messages can be missed

**B. Automatic via Hook**:
```bash
# In prompt-display hook
maestro inbox --quiet
```
- **Pro**: Automatic, timely
- **Con**: Requires Claude Code hooks support

**C. Prepend to Next Input**:
```bash
# CLI intercepts next user input
# Prepends pending messages before sending to Claude
```
- **Pro**: Seamless integration
- **Con**: Complex, requires shell integration

**D. Streaming Output**:
```bash
# maestro inbox --watch runs in background
# Displays messages as they arrive
```
- **Pro**: Real-time
- **Con**: Terminal output pollution

**Recommended**: Combination of B (hook) and A (manual) as fallback.

### 2. **Message Persistence & Cleanup**

**Problem**: How long to keep messages?

**Solutions**:

**A. TTL (Time-to-Live)**:
```typescript
const message = {
  id: 'msg_001',
  expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
};

// Periodic cleanup job
setInterval(async () => {
  await messageRepo.deleteExpired();
}, 60 * 60 * 1000); // Every hour
```

**B. Auto-delete on Read**:
```typescript
// Delete immediately after marking as read
await messageRepo.updateStatus(id, 'read');
await messageRepo.delete(id);
```

**C. Configurable Retention**:
```typescript
// Server config
{
  "messages": {
    "retention": "7d",
    "maxPerSession": 100
  }
}
```

### 3. **Offline Session Handling**

**Problem**: What if receiver session is terminated?

**Solutions**:

**A. Queue Until Reconnect**:
```typescript
// Messages wait in queue
// Delivered when session comes back online
if (session.status === 'completed') {
  throw new Error('Session no longer active');
}
```

**B. Configurable Behavior**:
```typescript
const sendOptions = {
  failIfOffline: false,  // Queue if offline
  requireActive: true    // Error if not running
};
```

**C. Notifications**:
```typescript
// If session offline, notify sender
if (receiverSession.status !== 'running') {
  await api.post(`/api/sessions/${senderSession.id}/timeline`, {
    type: 'message_queued',
    message: `Message queued for ${receiverSession.id} (session not active)`
  });
}
```

### 4. **Concurrent Message Delivery**

**Problem**: Multiple messages arriving simultaneously

**Solutions**:

**A. Timestamp Ordering**:
```typescript
const messages = await messageRepo.findByReceiver(sessionId);
messages.sort((a, b) => a.createdAt - b.createdAt);
```

**B. Message Batching**:
```bash
# Display all pending messages together
maestro inbox
# Shows:
# Message 1 from sess_a
# Message 2 from sess_b
# Message 3 from sess_a
```

**C. Priority Queue**:
```typescript
const highPriority = messages.filter(m => m.metadata?.priority === 'high');
const normalPriority = messages.filter(m => m.metadata?.priority !== 'high');
return [...highPriority, ...normalPriority];
```

### 5. **Request-Response Pattern**

**Problem**: How to implement request-response conversations?

**Solution: Message Threading**:

```typescript
// Request message
const request = await api.post(`/api/sessions/sess_b/messages`, {
  message: "What's the status of task_456?",
  metadata: {
    type: 'request',
    requiresResponse: true
  }
});

// Response message
const response = await api.post(`/api/sessions/sess_a/messages`, {
  message: "Task 456 is 80% complete",
  metadata: {
    type: 'response',
    inReplyTo: request.id
  }
});

// Query conversation thread
const thread = await api.get(
  `/api/messages/${request.id}/thread`
);
// Returns: [request, response]
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Message entity and repository
- [ ] File-based storage implementation
- [ ] Basic CRUD API endpoints
- [ ] Unit tests

### Phase 2: CLI Integration (Week 1-2)
- [ ] `maestro session send` command
- [ ] `maestro inbox` command
- [ ] Message formatting and display
- [ ] Error handling

### Phase 3: Event System (Week 2)
- [ ] Event definitions
- [ ] Event handlers
- [ ] WebSocket broadcasting
- [ ] Timeline integration

### Phase 4: Advanced Features (Week 3)
- [ ] Message priority
- [ ] TTL and expiration
- [ ] Request-response threading
- [ ] Bulk operations
- [ ] Rate limiting

### Phase 5: Real-time Delivery (Week 3-4)
- [ ] WebSocket push notifications
- [ ] CLI WebSocket client
- [ ] Connection management
- [ ] Fallback to polling

### Phase 6: Polish (Week 4)
- [ ] Prompt hook integration
- [ ] Documentation
- [ ] Examples and tutorials
- [ ] Performance testing

## Example Use Cases

### Use Case 1: Orchestrator Delegates to Worker

```bash
# Orchestrator (sess_orch)
maestro task create --title "Implement user profile endpoint" --output-id
# Output: task_123

maestro session spawn --task task_123 --skill maestro-worker --output-id
# Output: sess_worker_1

# Send detailed instructions
maestro session send --to sess_worker_1 --message "$(cat <<EOF
Please implement GET /api/users/:id/profile endpoint.

Requirements:
- Return user profile data (username, email, avatar)
- Validate user ID
- Handle not found case
- Add tests in test/api/users.test.ts

When complete, use: maestro report complete "Profile endpoint done"
EOF
)"
```

### Use Case 2: Worker Requests Clarification

```bash
# Worker (sess_worker_1)
maestro session send --to sess_orch --message "$(cat <<EOF
I need clarification on the user profile endpoint:

1. Should we include user's posts in the response?
2. What fields should be excluded for non-admin users?
3. Should we support query params for field selection?

Please advise.
EOF
)"

# Orchestrator sees message in inbox
maestro inbox
# Displays worker's questions

# Orchestrator responds
maestro session send --to sess_worker_1 --message "$(cat <<EOF
Answers:
1. No, posts should be separate endpoint
2. Exclude email for non-admin
3. No field selection for v1

Proceed with basic implementation.
EOF
)"
```

### Use Case 3: Peer Review

```bash
# Worker A completes task
maestro task complete task_123
maestro session send --to sess_worker_b --message "$(cat <<EOF
I've completed task_123 (user profile endpoint).
Can you review the changes in src/api/users.ts?

Focus on:
- Error handling
- Test coverage
- API documentation

Thanks!
EOF
)"

# Worker B reviews and responds
maestro session send --to sess_worker_a --message "$(cat <<EOF
Reviewed task_123. Looks good overall!

Minor suggestions:
- Add JSDoc comments to handler function
- Consider adding integration test for 404 case

Otherwise LGTM ✓
EOF
)"
```

### Use Case 4: Broadcast to Multiple Workers

```bash
# Orchestrator sends same message to all workers
for worker in $(maestro session list --json | jq -r '.[].id'); do
  maestro session send --to $worker --message "$(cat <<EOF
Team update:
- API schema has changed (see docs/api-schema-v2.md)
- Please update your endpoints accordingly
- Deadline: EOD tomorrow

Let me know if you have questions.
EOF
)"
done
```

## Security Considerations

### 1. **Authentication**

Verify sender is legitimate Maestro session:

```typescript
// Middleware
function requireSessionAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID required' });
  }

  const session = await sessionRepo.findById(sessionId);

  if (!session || session.status === 'completed') {
    return res.status(401).json({ error: 'Invalid session' });
  }

  req.session = session;
  next();
}
```

### 2. **Authorization**

Enforce role-based permissions:

```typescript
function canSendMessage(sender: Session, receiver: Session): boolean {
  // Orchestrators can message anyone
  if (sender.metadata?.role === 'orchestrator') {
    return true;
  }

  // Workers can message orchestrators
  if (receiver.metadata?.role === 'orchestrator') {
    return true;
  }

  // Workers can message workers in same project
  if (sender.projectId === receiver.projectId) {
    return true;
  }

  return false;
}
```

### 3. **Rate Limiting**

Prevent spam:

```typescript
const rateLimits = new Map<string, number[]>();

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  const maxMessages = 10;

  const timestamps = rateLimits.get(sessionId) || [];
  const recent = timestamps.filter(t => t > now - window);

  if (recent.length >= maxMessages) {
    return false; // Rate limit exceeded
  }

  recent.push(now);
  rateLimits.set(sessionId, recent);
  return true;
}
```

### 4. **Input Sanitization**

Prevent injection attacks:

```typescript
function sanitizeMessage(message: string): string {
  // Remove control characters
  message = message.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit length
  if (message.length > 10000) {
    message = message.substring(0, 10000);
  }

  return message;
}
```

### 5. **Audit Logging**

Track all messages:

```typescript
await auditLog.create({
  type: 'message_sent',
  actor: sender.id,
  target: receiver.id,
  details: {
    messageId: message.id,
    length: message.message.length,
    metadata: message.metadata
  },
  timestamp: Date.now()
});
```

## Testing Strategy

### Unit Tests

```typescript
describe('MessageRepository', () => {
  it('should create message', async () => {
    const message = await messageRepo.create({
      from: 'sess_a',
      to: 'sess_b',
      message: 'Test message'
    });

    expect(message.id).toBeDefined();
    expect(message.status).toBe('pending');
  });

  it('should find messages by receiver', async () => {
    const messages = await messageRepo.findByReceiver('sess_b');
    expect(messages.length).toBeGreaterThan(0);
  });

  it('should update message status', async () => {
    const message = await messageRepo.updateStatus('msg_001', 'read');
    expect(message.status).toBe('read');
    expect(message.readAt).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('Message API', () => {
  it('should send message between sessions', async () => {
    // Create sessions
    const sessionA = await createSession({ name: 'Session A' });
    const sessionB = await createSession({ name: 'Session B' });

    // Send message
    const res = await request(app)
      .post(`/api/sessions/${sessionB.id}/messages`)
      .set('X-Session-ID', sessionA.id)
      .send({ message: 'Hello' });

    expect(res.status).toBe(201);
    expect(res.body.from).toBe(sessionA.id);
    expect(res.body.to).toBe(sessionB.id);

    // Verify inbox
    const inbox = await request(app)
      .get(`/api/sessions/${sessionB.id}/messages`);

    expect(inbox.body.messages).toHaveLength(1);
    expect(inbox.body.messages[0].message).toBe('Hello');
  });
});
```

### End-to-End Tests

```bash
#!/bin/bash
# E2E test: Send message and verify delivery

# Start server
npm run dev:server &
SERVER_PID=$!
sleep 2

# Create project
PROJECT_ID=$(maestro project create "Test Project" --json | jq -r '.id')

# Create task
TASK_ID=$(maestro task create --project $PROJECT_ID --title "Test Task" --json | jq -r '.id')

# Spawn two sessions
SESSION_A=$(maestro session spawn --task $TASK_ID --json | jq -r '.sessionId')
SESSION_B=$(maestro session spawn --task $TASK_ID --json | jq -r '.sessionId')

# Send message from A to B
MAESTRO_SESSION_ID=$SESSION_A maestro session send --to $SESSION_B --message "Test message"

# Check B's inbox
MAESTRO_SESSION_ID=$SESSION_B maestro inbox | grep "Test message"

if [ $? -eq 0 ]; then
  echo "✓ E2E test passed"
else
  echo "✗ E2E test failed"
  exit 1
fi

# Cleanup
kill $SERVER_PID
```

## Conclusion

The server-mediated approach provides a **robust, scalable, and feature-rich solution** for inter-session communication. It leverages Maestro's existing infrastructure, provides strong delivery guarantees, and integrates seamlessly with the UI.

**Key Benefits**:
- ✅ Terminal multiplexer agnostic (works with zellij, tmux, or none)
- ✅ Centralized state and audit trail
- ✅ Security and authorization built-in
- ✅ Observable and debuggable
- ✅ Platform independent
- ✅ Extensible for future features

**Trade-offs**:
- ⚠️ More implementation complexity
- ⚠️ Server dependency
- ⚠️ Slightly higher latency than direct injection

**Verdict**: **Recommended for production use**. The server approach aligns with Maestro's architecture, provides essential features like security and reliability, and sets a foundation for advanced capabilities like conversation threading, broadcast messaging, and integration with the UI.
