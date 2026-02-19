# Design Plan: Multi-Session Interaction via Maestro CLI

## Overview

Enable Maestro CLI agents to send input prompts to other active Maestro sessions. When Agent A runs `maestro session prompt <targetSessionId> --message "..."`, the message is routed through the maestro-server → WebSocket → UI → Tauri `write_to_session` → PTY, causing the text to appear in the target session's terminal and be submitted with Enter.

This feature is restricted to **active, running Maestro sessions** (status: `working`, `idle`, or `needs_input`). Non-Maestro terminals and completed/failed sessions will reject the command.

## Architecture

```
Agent A (CLI in PTY session)
  │
  ├── maestro session prompt <targetMaestroSessionId> --message "do X"
  │
  ▼
maestro-server (REST API)
  POST /api/sessions/:id/prompt
  │
  ├── 1. Validates target session exists & is active
  ├── 2. Emits 'session:prompt_send' domain event
  │
  ▼
WebSocketBridge → broadcasts to UI
  │
  ▼
useMaestroStore (React, Tauri webview)
  │
  ├── Receives 'session:prompt_send' event
  ├── Resolves maestroSessionId → PTY terminal sessionId
  │
  ▼
useSessionStore.sendPromptToSession(ptyId, { content }, 'send')
  │
  ├── invoke('write_to_session', { id: ptyId, data: text, source: 'system' })
  ├── sleep(30ms)
  ├── invoke('write_to_session', { id: ptyId, data: '\r', source: 'system' })
  │
  ▼
Rust PTY layer (pty.rs)
  │
  └── Writes bytes to target session's PTY stdin → text appears + Enter sent
```

## Detailed Changes

### 1. CLI Command: `maestro session prompt`

**File:** `maestro-cli/src/commands/session.ts`

Add a new subcommand under `session`:

```typescript
session
  .command('prompt <targetSessionId>')
  .description('Send an input prompt to another active Maestro session')
  .requiredOption('--message <message>', 'The prompt message to send')
  .option('--mode <mode>', 'Send mode: "send" (type + Enter) or "paste" (type only)', 'send')
  .action(async (targetSessionId, options) => {
    const { message, mode } = options;

    // Validate mode
    if (!['send', 'paste'].includes(mode)) {
      console.error('Error: --mode must be "send" or "paste"');
      process.exit(1);
    }

    // Get sender's session ID for audit/logging
    const senderSessionId = process.env.MAESTRO_SESSION_ID;
    if (!senderSessionId) {
      console.error('Error: MAESTRO_SESSION_ID not set. This command can only be run from within a Maestro session.');
      process.exit(1);
    }

    // POST to server
    const serverUrl = process.env.MAESTRO_SERVER_URL || 'http://localhost:2357';
    const res = await fetch(`${serverUrl}/api/sessions/${targetSessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        mode,
        senderSessionId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.error(`Error: ${err.error || 'Failed to send prompt'}`);
      process.exit(1);
    }

    console.log(`✓ Prompt sent to session ${targetSessionId}`);
  });
```

**CLI usage examples:**
```bash
# From within a Maestro agent session, send a prompt to another session
maestro session prompt sess_abc123 --message "Please review the auth module"

# Paste mode — types but doesn't press Enter
maestro session prompt sess_abc123 --message "some text" --mode paste
```

### 2. REST Endpoint: `POST /api/sessions/:id/prompt`

**File:** `maestro-server/src/api/sessionRoutes.ts`

Add after the existing `POST /sessions/:id/modal` block:

```typescript
// Send a prompt to a running session's terminal
router.post('/sessions/:id/prompt', async (req: Request, res: Response) => {
  try {
    const { content, mode = 'send', senderSessionId } = req.body;

    // Validate content
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required and must be a string' });
    }

    // Validate mode
    if (!['send', 'paste'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "send" or "paste"' });
    }

    // Verify target session exists
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify session is in an active state
    const activeStatuses = ['working', 'idle', 'needs_input', 'spawning'];
    if (!activeStatuses.includes(session.status)) {
      return res.status(409).json({
        error: `Session is not active (status: ${session.status}). Prompt can only be sent to active sessions.`
      });
    }

    // Emit domain event
    eventBus.emit('session:prompt_send', {
      sessionId: req.params.id,
      content,
      mode,
      senderSessionId: senderSessionId || null,
      timestamp: Date.now(),
    });

    // Add timeline event for audit trail
    await sessionService.addTimelineEvent(req.params.id, {
      type: 'prompt_received',
      timestamp: Date.now(),
      message: `Received prompt from session ${senderSessionId || 'unknown'}: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      metadata: { senderSessionId, mode },
    });

    res.json({ success: true });
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});
```

### 3. Domain Event: `session:prompt_send`

**File:** `maestro-server/src/domain/events/DomainEvents.ts`

Add the event interface:

```typescript
export interface SessionPromptSendEvent {
  type: 'session:prompt_send';
  data: {
    sessionId: string;
    content: string;
    mode: 'send' | 'paste';
    senderSessionId: string | null;
    timestamp: number;
  };
}
```

Add to `DomainEvent` union:
```typescript
export type DomainEvent =
  // ... existing events ...
  | SessionPromptSendEvent;
```

Add to `TypedEventMap`:
```typescript
'session:prompt_send': {
  sessionId: string;
  content: string;
  mode: 'send' | 'paste';
  senderSessionId: string | null;
  timestamp: number;
};
```

### 4. WebSocket Bridge Registration

**File:** `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`

Add `'session:prompt_send'` to the events array (after `'session:modal_closed'`):

```diff
      'session:modal_closed',
+     'session:prompt_send',
      // Team member events
```

This is a 1-line change. The bridge already broadcasts any registered event to all connected WebSocket clients.

### 5. UI Event Handler

**File:** `maestro-ui/src/stores/useMaestroStore.ts`

Add a new case in the `handleMessage` switch statement (after `session:spawn`):

```typescript
case 'session:prompt_send': {
  const { sessionId: maestroSessionId, content, mode } = message.data;

  // Find the terminal session linked to this maestro session
  const sessions = useSessionStore.getState().sessions;
  const terminalSession = sessions.find(
    (s) => s.maestroSessionId === maestroSessionId && !s.exited
  );

  if (!terminalSession) {
    console.warn(
      `[session:prompt_send] No active terminal found for maestro session ${maestroSessionId}`
    );
    break;
  }

  // Send the prompt to the terminal's PTY
  void useSessionStore.getState().sendPromptToSession(
    terminalSession.id,
    { content },
    mode || 'send'
  );

  console.log(
    `[session:prompt_send] Sent prompt to terminal ${terminalSession.id} (maestro: ${maestroSessionId})`
  );
  break;
}
```

This reuses the existing `sendPromptToSession` which already handles:
- **'send' mode:** Writes text via `write_to_session`, waits 30ms, writes `\r` (Enter)
- **'paste' mode:** Writes text via `write_to_session` without Enter

### 6. Session Timeline Event Type

**File:** `maestro-server/src/types.ts` (or wherever `SessionTimelineEventType` is defined)

Add `'prompt_received'` to the timeline event type union if it doesn't already exist, for audit trail purposes.

## Session ID Resolution

Agents know other session IDs through several mechanisms:

| Mechanism | How |
|---|---|
| `MAESTRO_COORDINATOR_SESSION_ID` env var | Worker knows its coordinator |
| `maestro session list --my-workers` | Coordinator lists spawned workers |
| `maestro session list --siblings` | Worker lists peer workers |
| Task docs/metadata | Session IDs stored in task context |

The `targetSessionId` parameter uses the **maestro server session ID** (e.g., `sess_abc123`), NOT the PTY integer ID. This is the same ID space used by `maestro session watch`, etc.

## Validation & Safety

### Server-Side Validation
1. **Session must exist** — 404 if not found
2. **Content must be non-empty string** — 400 if missing/invalid
3. **Mode must be `send` or `paste`** — 400 if invalid

> **Note:** The server no longer rejects prompts based on session status. A session can be `completed` in maestro but still have its terminal open in the UI. The real availability check happens UI-side: the `session:prompt_send` handler only writes to terminals where `!s.exited` (the terminal process is still running). This aligns with the session section's visibility logic — if a session is visible in the UI, it can receive prompts.

### Client-Side Validation
1. **Sender must be in a Maestro session** — requires `MAESTRO_SESSION_ID` env var
2. **Target session ID required** — positional argument

### Safety Considerations
- The `source` parameter on `write_to_session` is set to `'system'` (not `'user'`) to distinguish programmatic input from human keyboard input in recordings
- Timeline events create an audit trail of cross-session prompts
- No arbitrary command execution — this writes to the PTY exactly as a human would type; the receiving agent/shell interprets it normally
- Rate limiting could be added later at the API layer if abuse is a concern

## Verification Plan

1. **Start maestro-server and maestro-ui**
2. **Spawn two Maestro sessions** (Agent A and Agent B) from tasks
3. **From Agent A's CLI**, run:
   ```bash
   maestro session prompt <agentB-session-id> --message "hello from Agent A"
   ```
4. **Verify in Agent B's terminal:**
   - Text "hello from Agent A" appears
   - Enter is pressed (text is submitted)
   - Agent B processes the message as if a user typed it
5. **Test error cases:**
   - Send to a non-existent session → 404
   - Send to a completed session → 409
   - Send from outside a Maestro session → CLI error
   - Send with empty message → 400
6. **Test paste mode:**
   ```bash
   maestro session prompt <agentB-session-id> --message "partial text" --mode paste
   ```
   - Text appears but Enter is NOT pressed

## Files Modified (Summary)

| File | Change |
|---|---|
| `maestro-cli/src/commands/session.ts` | Add `session prompt` subcommand |
| `maestro-server/src/api/sessionRoutes.ts` | Add `POST /sessions/:id/prompt` endpoint |
| `maestro-server/src/domain/events/DomainEvents.ts` | Add `SessionPromptSendEvent` + union/map entries |
| `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts` | Add `'session:prompt_send'` to events array |
| `maestro-ui/src/stores/useMaestroStore.ts` | Add `case 'session:prompt_send'` handler |
| `maestro-server/src/types.ts` | Add `'prompt_received'` timeline event type (if needed) |

## Future Extensions

- **Bidirectional confirmation:** The target session could ACK receipt via a response event
- **Prompt queuing:** If the target session is busy (agent working), queue prompts and deliver when the agent is idle/waiting for input
- **Permission model:** Allow sessions to opt-in/out of receiving external prompts
- **Broadcast prompts:** Send the same prompt to all worker sessions
- **Interactive prompt selection:** Let the sending agent browse active sessions before choosing a target
