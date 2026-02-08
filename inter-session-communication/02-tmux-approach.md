# tmux-Based Inter-Session Communication

## Overview

This approach leverages tmux's built-in capabilities to enable communication between terminal sessions. tmux provides several mechanisms for inter-pane/window communication that can be adapted for session-to-session messaging.

## tmux Fundamentals

### Key Concepts

- **Session**: A collection of windows managed by tmux
- **Window**: A full screen view (like tabs in a browser)
- **Pane**: A split section within a window
- **Target**: Syntax to identify sessions, windows, or panes (e.g., `session:window.pane`)

### tmux Command Structure

```bash
tmux <command> -t <target> [args]
```

## Communication Mechanisms

### 1. Send-Keys Command

The primary mechanism for sending input to another tmux pane/window.

**Syntax**:
```bash
tmux send-keys -t <target> "text to send" Enter
```

**Example**:
```bash
# Send a command to session named "worker-1"
tmux send-keys -t worker-1 "echo Hello from orchestrator" Enter

# Send to a specific pane in a session
tmux send-keys -t worker-1:0.0 "maestro task start task_123" Enter
```

**Characteristics**:
- Sends keystrokes directly to the target pane
- Can include special keys (Enter, C-c, C-d, etc.)
- Synchronous operation (returns immediately)
- No confirmation of delivery or execution

### 2. Display-Message Command

For displaying messages in the target session's status line.

**Syntax**:
```bash
tmux display-message -t <target> "message text"
```

**Example**:
```bash
tmux display-message -t worker-1 "Task ready for review"
```

**Characteristics**:
- Non-intrusive (shown in status bar)
- Temporary display (disappears after timeout)
- Doesn't interrupt current work
- Good for notifications, not command injection

### 3. Named Pipes (FIFOs)

Create filesystem-based communication channels.

**Setup**:
```bash
# Session A creates a named pipe
mkfifo /tmp/session_a_inbox

# Session A listens to pipe in background
while read line; do
  echo "Received: $line"
done < /tmp/session_a_inbox &

# Session B sends to pipe
echo "Hello from Session B" > /tmp/session_a_inbox
```

**Characteristics**:
- Requires setup in each session
- Filesystem-based (cleanup needed)
- Can be blocking or non-blocking
- More complex but more flexible

### 4. Shared Environment Variables

Using tmux's `setenv` and `showenv` commands.

**Syntax**:
```bash
# Set global environment variable
tmux setenv -g MESSAGE_FOR_WORKER_1 "Start task 123"

# Read environment variable in target session
tmux showenv -g MESSAGE_FOR_WORKER_1
```

**Characteristics**:
- Global to tmux server
- No direct notification mechanism
- Requires polling or hooks
- Good for small config data, not messages

## Implementation Design

### Architecture

```
┌────────────────────────────────────────────────────┐
│                  tmux Server                        │
│                                                     │
│  ┌──────────────┐           ┌──────────────┐      │
│  │  Session A   │           │  Session B   │      │
│  │  (sender)    │           │  (receiver)  │      │
│  │              │           │              │      │
│  │  1. Compose  │           │  3. Execute  │      │
│  │     message  │           │     prompt   │      │
│  │              │           │              │      │
│  │  2. tmux     │──────────►│              │      │
│  │     send-keys│  "message"│              │      │
│  │              │           │              │      │
│  └──────────────┘           └──────────────┘      │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Message Flow

1. **Session A (Sender)**:
   ```bash
   maestro session send --to sess_123 --message "Review PR in task_456"
   ```

2. **CLI Command Processing**:
   - Validates target session exists in server
   - Constructs message payload
   - Determines tmux target name

3. **tmux Execution**:
   ```bash
   tmux send-keys -t sess_123 "$(cat <<EOF
   # Message from session sess_789:
   # Review PR in task_456
   # [Press Enter to acknowledge]
   EOF
   )" Enter
   ```

4. **Session B (Receiver)**:
   - Sees message text in terminal
   - Claude processes it as user input in next turn
   - Can respond or execute the request

### CLI Integration

#### New Commands

**Send message**:
```bash
maestro session send --to <session-id> --message <text>
maestro session send --to <session-id> --file <path>
```

**Check inbox** (for queued messages):
```bash
maestro session inbox
maestro session inbox --clear
```

#### Implementation Pseudocode

```typescript
// maestro-cli/src/commands/session-send.ts

async function sendMessage(targetSessionId: string, message: string) {
  // 1. Validate target session exists
  const session = await api.get(`/api/sessions/${targetSessionId}`);
  if (!session) {
    throw new Error(`Session ${targetSessionId} not found`);
  }

  // 2. Check if session is running
  if (session.status !== 'running') {
    throw new Error(`Session ${targetSessionId} is not running`);
  }

  // 3. Verify tmux session exists
  const tmuxSessions = execSync('tmux list-sessions -F "#{session_name}"')
    .toString()
    .split('\n');

  if (!tmuxSessions.includes(targetSessionId)) {
    throw new Error(`tmux session ${targetSessionId} not found`);
  }

  // 4. Format message
  const formattedMessage = formatMessageForTmux(message, {
    from: config.sessionId,
    timestamp: Date.now()
  });

  // 5. Send via tmux
  execSync(`tmux send-keys -t ${targetSessionId} "${formattedMessage}" Enter`);

  // 6. Log to server
  await api.post(`/api/sessions/${targetSessionId}/events`, {
    type: 'message_received',
    data: { from: config.sessionId, message }
  });

  console.log(`Message sent to ${targetSessionId}`);
}
```

## Advantages

### 1. **Direct Communication**
- Messages go directly to target terminal
- No server intermediary required
- Low latency

### 2. **Simple Implementation**
- Uses existing tmux infrastructure
- No new server components needed
- Minimal code changes

### 3. **Immediate Delivery**
- Messages appear instantly in target session
- No polling or WebSocket connections needed

### 4. **Terminal Agnostic**
- Works with any terminal that supports tmux
- No special terminal features required

### 5. **Debugging Friendly**
- Can manually test with tmux commands
- Visible in terminal history
- Easy to trace message flow

## Disadvantages

### 1. **tmux Dependency**
- **Critical**: Requires all sessions to run within tmux
- Breaks if user spawns sessions outside tmux
- Non-tmux terminals cannot participate

### 2. **No Delivery Confirmation**
- `send-keys` returns immediately
- No guarantee message was seen or processed
- Cannot detect if session crashed after send

### 3. **Terminal Pollution**
- Messages appear as raw text in terminal
- Interferes with Claude's context window
- Hard to distinguish from legitimate input

### 4. **Security Concerns**
- Any process can send to any tmux session
- No authentication or authorization
- Risk of command injection attacks
- Malicious sessions could disrupt others

### 5. **Session Identification**
- Assumes tmux session name == MAESTRO_SESSION_ID
- Complex if sessions span multiple panes/windows
- Hard to locate the "right" pane for message delivery

### 6. **State Management Issues**
- Server doesn't know about messages
- No history or audit trail
- Cannot track pending messages
- Difficult to implement request-response patterns

### 7. **Terminal Multiplexer Lock-in**
- Locked to tmux specifically
- Cannot support zellij, screen, or other multiplexers
- Note: Maestro UI uses zellij for terminal management

### 8. **Message Queuing**
- No built-in queue mechanism
- Cannot defer messages until session is ready
- Lost if session is busy or blocked

### 9. **Platform Compatibility**
- tmux primarily Unix/Linux/macOS
- Windows support limited (WSL required)
- May not work in all deployment scenarios

## Technical Challenges

### 1. **Identifying Target Session**

**Problem**: How to map MAESTRO_SESSION_ID to tmux target?

**Solutions**:
- **Option A**: Use session ID as tmux session name
  ```bash
  tmux new-session -s sess_1770536761607_vuk2qvstb
  ```

- **Option B**: Maintain mapping in server
  ```typescript
  {
    maestroSessionId: "sess_123",
    tmuxTarget: "worker-1:0.0"
  }
  ```

- **Option C**: Store in tmux environment
  ```bash
  tmux setenv -t worker-1 MAESTRO_SESSION_ID sess_123
  ```

### 2. **Message Format**

**Problem**: How to distinguish messages from normal input?

**Solutions**:
- **Prefix marker**:
  ```
  @MESSAGE_FROM:sess_789: Review PR in task_456
  ```

- **Structured format**:
  ```json
  {"type":"session_message","from":"sess_789","body":"Review PR"}
  ```

- **CLI command wrapper**:
  ```bash
  maestro inbox read
  # Displays: "Message from sess_789: Review PR"
  ```

### 3. **Delivery Timing**

**Problem**: When should the message "activate"?

**Solutions**:
- **Immediate**: Use `send-keys` directly
  - Pro: Instant delivery
  - Con: May interrupt Claude mid-thought

- **Queued**: Store in file, read on next `maestro` command
  - Pro: Non-intrusive
  - Con: Requires polling mechanism

- **Hook-based**: Trigger on prompt display
  - Pro: Natural timing
  - Con: Requires shell integration

### 4. **Claude Integration**

**Problem**: How does Claude perceive the message?

**Current Behavior**:
- Claude sees all terminal text as context
- Distinguishes user input by prompt timing

**Desired Behavior**:
- Message appears as user input
- Claude responds in next turn

**Implementation**:
```bash
# Send formatted message that Claude will interpret as user input
tmux send-keys -t sess_123 "$(cat <<'EOF'
[New message from orchestrator session]
Please review the changes in task_456 and provide feedback.
EOF
)" Enter
```

## Implementation Phases

### Phase 1: Proof of Concept
- Manual tmux send-keys testing
- Validate message appears in Claude session
- Confirm Claude processes it as input

### Phase 2: CLI Command
- Implement `maestro session send` command
- Basic validation (session exists)
- Simple text messages only

### Phase 3: Server Integration
- Log messages to server timeline
- Update session status on message send/receive
- Basic delivery tracking

### Phase 4: Advanced Features
- Message queuing for offline sessions
- Request-response patterns
- Message acknowledgment
- Rate limiting

### Phase 5: Polish
- Error handling and retry logic
- Security measures (sender validation)
- Documentation and examples

## Example Use Cases

### Use Case 1: Orchestrator to Worker

**Scenario**: Orchestrator breaks down task and assigns to worker

```bash
# Orchestrator session (sess_orch_1)
maestro task create --title "Implement login endpoint" --output-id
# Output: task_123

maestro session spawn --task task_123 --output-id
# Output: sess_worker_1

# Wait for worker to be ready
sleep 2

# Send specific instructions
maestro session send --to sess_worker_1 --message "$(cat <<EOF
The login endpoint should:
1. Accept POST /api/auth/login
2. Validate credentials against User model
3. Return JWT token on success
4. Use bcrypt for password comparison

Relevant files:
- src/routes/auth.ts
- src/models/User.ts
- src/utils/jwt.ts
EOF
)"
```

### Use Case 2: Worker to Worker Handoff

**Scenario**: Frontend worker needs backend API worker to create endpoint

```bash
# Frontend worker (sess_frontend)
maestro session send --to sess_backend --message "$(cat <<EOF
I'm implementing the user profile page and need a new API endpoint:

GET /api/users/:id/profile
Response: { username, email, createdAt, avatarUrl }

Please implement this and let me know when ready.
EOF
)"
```

### Use Case 3: Request-Response Pattern

**Scenario**: Session A asks Session B for information

```bash
# Session A (sess_a)
maestro session send --to sess_b --message "What's the status of task_789?"

# Session B (sess_b)
# (Claude processes message and responds)
maestro session send --to sess_a --message "Task 789 is 80% complete. Working on tests now."
```

## Security Considerations

### Threats

1. **Command Injection**
   - Malicious session sends crafted message with shell commands
   - Example: `"; rm -rf /; #"`

2. **Session Hijacking**
   - Unauthorized process sends to legitimate session
   - Could disrupt work or inject malicious prompts

3. **Information Disclosure**
   - Messages visible in terminal history
   - Could leak sensitive data

### Mitigations

1. **Input Sanitization**
   ```typescript
   function sanitizeMessage(msg: string): string {
     // Escape shell metacharacters
     return msg.replace(/[;&|<>$`\\]/g, '\\$&');
   }
   ```

2. **Session Validation**
   ```typescript
   // Verify sender is registered Maestro session
   const sender = await api.get(`/api/sessions/${senderId}`);
   if (!sender || sender.status !== 'running') {
     throw new Error('Unauthorized sender');
   }
   ```

3. **Message Signing**
   ```typescript
   // Include HMAC signature in message
   const signature = hmac(message, sessionSecret);
   const payload = { message, signature, from: sessionId };
   ```

4. **Rate Limiting**
   ```typescript
   // Prevent message spam
   const recentMessages = await getRecentMessages(sessionId, 60000);
   if (recentMessages.length > 10) {
     throw new Error('Rate limit exceeded');
   }
   ```

## Alternatives within tmux Approach

### A. Message Files

Instead of send-keys, write messages to files that sessions poll:

```bash
# Send message
echo "Review task_456" > ~/.maestro/sessions/sess_123/inbox/msg_001.txt

# Receive message (in session hook or periodic check)
if [ -f ~/.maestro/sessions/$MAESTRO_SESSION_ID/inbox/*.txt ]; then
  cat ~/.maestro/sessions/$MAESTRO_SESSION_ID/inbox/*.txt
  rm ~/.maestro/sessions/$MAESTRO_SESSION_ID/inbox/*.txt
fi
```

**Pros**:
- Non-intrusive
- Persistent (messages not lost)
- Easy to implement message queue

**Cons**:
- Requires polling or hooks
- Not immediate delivery
- Filesystem I/O overhead

### B. tmux Buffer Paste

Use tmux's clipboard/buffer system:

```bash
# Send message
tmux set-buffer "Message from sess_a"
tmux paste-buffer -t sess_b

# Or in one command
echo "Message" | tmux load-buffer - && tmux paste-buffer -t sess_b
```

**Pros**:
- Built-in tmux feature
- Clean API

**Cons**:
- Global buffer (one at a time)
- Race conditions with multiple senders
- Still uses send-keys internally

## Testing Strategy

### Unit Tests
- CLI command parsing
- Message formatting
- Session validation

### Integration Tests
```bash
#!/bin/bash
# Test: Send message between two sessions

# Start test tmux session
tmux new-session -d -s test_session_a
tmux send-keys -t test_session_a "echo 'Session A started'" Enter

tmux new-session -d -s test_session_b
tmux send-keys -t test_session_b "echo 'Session B started'" Enter

# Send message from A to B
maestro session send --to test_session_b --message "Hello from A"

# Verify message appeared in B
tmux capture-pane -t test_session_b -p | grep "Hello from A"

# Cleanup
tmux kill-session -t test_session_a
tmux kill-session -t test_session_b
```

### Manual Tests
1. Spawn two Maestro sessions in tmux
2. Send message from session 1 to session 2
3. Verify Claude in session 2 sees and responds to message
4. Test edge cases (invalid target, session crash, etc.)

## Conclusion

The tmux approach offers a **simple, direct solution** for inter-session communication with **low implementation complexity**. However, it suffers from **significant architectural limitations**:

- **Hard dependency on tmux** (Maestro UI uses zellij, not tmux)
- **No delivery guarantees** or state management
- **Security vulnerabilities** without additional layers
- **Terminal pollution** affects Claude's context

**Verdict**: While tmux provides the basic mechanism, it's better suited as a **debugging tool** or **prototype** rather than a production solution. The lack of integration with Maestro's existing server architecture and the mismatch with the UI's terminal multiplexer (zellij) make it less desirable for the final implementation.

**Recommendation**: Use tmux approach for initial prototyping and proof-of-concept, but plan to migrate to the server-mediated approach for production use.
