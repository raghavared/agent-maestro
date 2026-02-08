# WebSocket Reliability Implementation

## Overview

Improve WebSocket connection handling with automatic reconnection, visual indicators, and message queueing.

**Goal:** Ensure reliable real-time sync even with network issues.

**Estimated Effort:** 6-8 hours

---

## Implementation

### 1. Auto-Reconnection (2 hours)

**File:** `src/hooks/useMaestroWebSocket.ts`

```typescript
import { useEffect, useRef, useState } from 'react';

export function useMaestroWebSocket(url: string) {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const baseDelay = 1000; // 1 second

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('reconnecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onclose = () => {
      console.log('❌ WebSocket disconnected');
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  };

  const scheduleReconnect = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = baseDelay * Math.pow(2, reconnectAttempts.current);
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectAttempts.current += 1;
      connect();
    }, delay);
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [url]);

  return { ws: wsRef.current, status };
}
```

---

### 2. Visual Indicators (2 hours)

**File:** `src/components/ConnectionStatus.tsx`

```typescript
import { useMaestroWebSocket } from '../hooks/useMaestroWebSocket';

export function ConnectionStatus() {
  const { status } = useMaestroWebSocket('ws://localhost:3000');

  const statusConfig = {
    connected: { color: 'green', icon: '🟢', text: 'Connected' },
    disconnected: { color: 'red', icon: '🔴', text: 'Disconnected' },
    reconnecting: { color: 'yellow', icon: '🟡', text: 'Reconnecting...' }
  };

  const config = statusConfig[status];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>{config.icon}</span>
      <span style={{ color: config.color }}>{config.text}</span>
    </div>
  );
}
```

**Integration:** Add to `App.tsx` header

```typescript
<header>
  <h1>Maestro</h1>
  <ConnectionStatus />
</header>
```

---

### 3. Message Queueing (2 hours)

**File:** `src/contexts/MaestroContext.tsx`

```typescript
const messageQueue = useRef<any[]>([]);

const sendMessage = (message: any) => {
  if (wsClient?.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(message));
  } else {
    // Queue message for later
    messageQueue.current.push(message);
    console.log('📤 Message queued (offline):', message.type);
  }
};

// When reconnected, flush queue
useEffect(() => {
  if (status === 'connected' && messageQueue.current.length > 0) {
    console.log(`📤 Flushing ${messageQueue.current.length} queued messages`);
    messageQueue.current.forEach((msg) => {
      wsClient?.send(JSON.stringify(msg));
    });
    messageQueue.current = [];
  }
}, [status, wsClient]);
```

---

### 4. Heartbeat/Ping-Pong (1 hour)

**Client:**

```typescript
useEffect(() => {
  if (!wsClient || status !== 'connected') return;

  const pingInterval = setInterval(() => {
    if (wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000); // Ping every 30 seconds

  return () => clearInterval(pingInterval);
}, [wsClient, status]);
```

**Server:** `maestro-server/src/websocket.ts`

```typescript
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
  }
});
```

---

## Testing (1 hour)

### Manual Test

1. Start server and UI
2. Stop server (simulate disconnection)
3. Verify UI shows "Disconnected" status
4. Create a task (should queue)
5. Restart server
6. Verify reconnection and queued message sent

### Automated Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMaestroWebSocket } from './useMaestroWebSocket';

describe('WebSocket Reconnection', () => {
  it('should reconnect after disconnection', async () => {
    const { result } = renderHook(() => useMaestroWebSocket('ws://localhost:3000'));

    // Simulate disconnection
    result.current.ws?.close();

    await waitFor(() => {
      expect(result.current.status).toBe('reconnecting');
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    }, { timeout: 10000 });
  });
});
```

---

## Checklist

- [ ] Implement auto-reconnection with exponential backoff
- [ ] Add connection status to hook
- [ ] Create `ConnectionStatus` component
- [ ] Add visual indicator to UI header
- [ ] Implement message queueing
- [ ] Flush queue on reconnection
- [ ] Add heartbeat ping/pong
- [ ] Test manual disconnection/reconnection
- [ ] Write automated tests

---

**Implementation Status:** 📋 Ready to Implement
**Dependencies:** None
**Enables:** Reliable real-time sync
