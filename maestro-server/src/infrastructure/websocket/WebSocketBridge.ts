import { WebSocketServer, WebSocket } from 'ws';
import { IEventBus } from '../../domain/events/IEventBus';
import { ILogger } from '../../domain/common/ILogger';
import { EventName, TypedEventMap } from '../../domain/events/DomainEvents';

/**
 * Bridges domain events to WebSocket clients.
 * Subscribes to all domain events and broadcasts them to connected clients.
 */
export class WebSocketBridge {
  private logger: ILogger;

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
      'session:task_removed'
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
   * Broadcast a message to all connected WebSocket clients.
   */
  private broadcast(event: string, data: any): void {
    const message = JSON.stringify({
      type: event,
      event,
      data,
      timestamp: Date.now()
    });

    let sent = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    // Only log non-high-frequency events in detail
    const isHighFrequency = ['heartbeat', 'keepalive'].includes(event);
    if (!isHighFrequency) {
      console.log(`📡 Broadcast ${event} → ${sent}/${this.wss.clients.size} clients`);
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
