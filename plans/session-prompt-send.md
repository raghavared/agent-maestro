# Plan: Send Prompts to Running Terminal Sessions via WebSocket

## Context

When a Claude Code session is running in a terminal and waiting for user input, there's currently no way to send a prompt to it programmatically. The only way to input text is through direct keyboard interaction in the xterm.js terminal. This change adds a `session:prompt_send` event so that any client (CLI, API, external tool) can send a prompt to a running terminal via `POST /api/sessions/:id/prompt`, which the server broadcasts to the UI, which then writes it into the correct terminal's PTY.

## Event Flow

```
Client (CLI/API/Agent)
  → POST /api/sessions/:id/prompt { content, mode? }
  → Server validates session, emits 'session:prompt_send'
  → WebSocketBridge broadcasts to UI
  → useMaestroStore receives event
  → Resolves maestroSessionId → terminal sessionId
  → Calls sendPromptToSession() → Tauri write_to_session → PTY
```

## Changes

### 1. Add `session:prompt_send` domain event
**File:** `maestro-server/src/domain/events/DomainEvents.ts`

- Add `SessionPromptSendEvent` interface with `data: { sessionId, content, mode }`
- Add to `DomainEvent` union type
- Add to `TypedEventMap`: `'session:prompt_send': { sessionId: string; content: string; mode: 'send' | 'paste' }`

### 2. Add REST endpoint
**File:** `maestro-server/src/api/sessionRoutes.ts`

- Add `POST /sessions/:id/prompt` endpoint
- Validate `content` (required string) and `mode` (optional, defaults to `'send'`)
- Verify session exists via `sessionService.getSession()`
- Emit `session:prompt_send` via `eventBus.emit()`

### 3. Register event in WebSocket bridge
**File:** `maestro-server/src/infrastructure/websocket/WebSocketBridge.ts`

- Add `'session:prompt_send'` to the `events` array (line 66-81) — 1-line change

### 4. Handle event in UI
**File:** `maestro-ui/src/stores/useMaestroStore.ts`

- Add `case 'session:prompt_send'` in the `handleMessage` switch (after line 130)
- Find terminal session where `s.maestroSessionId === data.sessionId`
- Call `useSessionStore.getState().sendPromptToSession(terminalSession.id, { content }, mode)`
- Reuses existing `sendPromptToSession` — no changes needed to useSessionStore

## Verification

1. Start maestro-server and maestro-ui
2. Spawn a Claude Code session from a task (creates terminal with `maestroSessionId`)
3. Send prompt via curl:
   ```bash
   curl -X POST http://localhost:3000/api/sessions/<maestro-session-id>/prompt \
     -H 'Content-Type: application/json' \
     -d '{"content": "hello world"}'
   ```
4. Verify the text appears in the terminal and is submitted (typed + enter)
5. Test `mode: "paste"` to verify text is inserted without enter
