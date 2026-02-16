import { WebSocketServer, WebSocket } from 'ws';
import { IEventBus } from '../../domain/events/IEventBus';
import { ILogger } from '../../domain/common/ILogger';
import { EventName, TypedEventMap } from '../../domain/events/DomainEvents';

/**
 * Bridges domain events to WebSocket clients.
 * Subscribes to all domain events and broadcasts them to connected clients.
 *
 * Clients can send a `subscribe` message with `sessionIds` to receive only
 * events related to those sessions (used by `maestro session watch`).
 * Clients without a subscription receive ALL events (backward compatible).
 */
export class WebSocketBridge {
  private logger: ILogger;
  /** Per-client session subscription filters. Clients not in this map get all events. */
  private subscriptions = new Map<WebSocket, Set<string>>();

  constructor(
    private wss: WebSocketServer,
    private eventBus: IEventBus,
    logger: ILogger
  ) {
    this.logger = logger;
    this.setupEventHandlers();
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const origin = req.headers.origin || 'unknown';
      const remoteAddr = req.socket.remoteAddress || 'unknown';
      console.log(`🔌 WebSocket client connected (origin=${origin}, addr=${remoteAddr}, total=${this.wss.clients.size})`);

      ws.on('close', (code, reason) => {
        this.subscriptions.delete(ws);
        console.log(`🔌 WebSocket client disconnected (origin=${origin}, code=${code}, total=${this.wss.clients.size})`);
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket client error:', error);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (err) {
          this.logger.warn('Failed to parse WebSocket message');
        }
      });
    });
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    // Handle ping/pong
    if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    // Handle subscribe — client wants events filtered to specific session IDs
    if (message.type === 'subscribe' && Array.isArray(message.sessionIds)) {
      const ids = new Set<string>(message.sessionIds.filter((id: any) => typeof id === 'string'));
      this.subscriptions.set(ws, ids);
      console.log(`🔌 WebSocket client subscribed to ${ids.size} session(s): ${[...ids].join(', ')}`);
      ws.send(JSON.stringify({ type: 'subscribed', sessionIds: [...ids], timestamp: Date.now() }));
      return;
    }

    // Handle unsubscribe — client goes back to receiving all events
    if (message.type === 'unsubscribe') {
      this.subscriptions.delete(ws);
      ws.send(JSON.stringify({ type: 'unsubscribed', timestamp: Date.now() }));
      return;
    }

    // Log other messages (but filter out high-frequency ones)
    const isHighFrequency = ['heartbeat', 'keepalive'].includes(message.type);
    if (!isHighFrequency) {
      this.logger.debug('Received WebSocket message', { type: message.type });
    }
  }

  private setupEventHandlers(): void {
    // List of all domain events to bridge
    const events: EventName[] = [
      'project:created',
      'project:updated',
      'project:deleted',
      'task:created',
      'task:updated',
      'task:deleted',
      'task:session_added',
      'task:session_removed',
      'session:created',
      'session:spawn',
      'session:updated',
      'session:deleted',
      'session:task_added',
      'session:task_removed',
      // Notification events
      'notify:task_completed',
      'notify:task_failed',
      'notify:task_blocked',
      'notify:task_session_completed',
      'notify:task_session_failed',
      'notify:session_completed',
      'notify:session_failed',
      'notify:needs_input',
      'notify:progress',
      'session:modal',
      'session:modal_action',
      'session:modal_closed',
      // Mail events
      'mail:received',
      'mail:deleted'
    ];

    // Subscribe to each event
    for (const event of events) {
      this.eventBus.on(event, (data) => {
        this.broadcast(event, data);
      });
    }

    this.logger.info(`WebSocket bridge subscribed to ${events.length} events`);
  }

  /**
   * Extract the session ID from an event payload, if present.
   */
  private extractSessionId(data: any): string | undefined {
    if (!data) return undefined;
    // Direct session ID field
    if (data.sessionId) return data.sessionId;
    // Session object with id field (session:updated, session:created, etc.)
    if (data.id && typeof data.status === 'string') return data.id;
    // Spawn event
    if (data.session?.id) return data.session.id;
    return undefined;
  }

  /**
   * Broadcast a message to connected WebSocket clients.
   * Clients with a subscription filter only receive events matching their session IDs.
   */
  private broadcast(event: string, data: any): void {
    const message = JSON.stringify({
      type: event,
      event,
      data,
      timestamp: Date.now()
    });

    const eventSessionId = this.extractSessionId(data);

    let sent = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;

      // If client has a subscription, check if this event matches
      const sub = this.subscriptions.get(client);
      if (sub && eventSessionId && !sub.has(eventSessionId)) {
        return; // skip — event not for a subscribed session
      }

      client.send(message);
      sent++;
    });

    // Only log non-high-frequency events in detail
    const isHighFrequency = ['heartbeat', 'keepalive'].includes(event);
    if (!isHighFrequency) {
      console.log(`📡 Broadcast ${event} → ${sent}/${this.wss.clients.size} clients`);
    }
    // Extra logging for notify events
    if (event.startsWith('notify:')) {
      console.log(`🔔 [WebSocketBridge] NOTIFY broadcast: ${event} → ${sent}/${this.wss.clients.size} clients, data=${JSON.stringify(data)}`);
    }
  }

  /**
   * Get the count of connected clients.
   */
  getClientCount(): number {
    return this.wss.clients.size;
  }

  /**
   * Get status of all connected clients.
   */
  getClientStatus(): Array<{ readyState: number; readyStateText: string }> {
    const clients: Array<{ readyState: number; readyStateText: string }> = [];
    this.wss.clients.forEach((client) => {
      clients.push({
        readyState: client.readyState,
        readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][client.readyState]
      });
    });
    return clients;
  }
}
