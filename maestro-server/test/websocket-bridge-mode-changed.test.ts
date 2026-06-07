/**
 * Regression test for BUG-1: session:mode_changed must be forwarded over WebSocket.
 *
 * The route POST /api/sessions/:id/mode emits 'session:mode_changed' on the event bus,
 * but the WebSocketBridge previously did not subscribe to it, so connected clients
 * never received the frame. These tests assert the bridge both subscribes to the
 * event and broadcasts it to a connected client.
 */

import { AddressInfo } from 'net';
import { WebSocketServer, WebSocket } from 'ws';

import { WebSocketBridge } from '../src/infrastructure/websocket/WebSocketBridge';
import { InMemoryEventBus } from '../src/infrastructure/events/InMemoryEventBus';
import { ConsoleLogger } from '../src/infrastructure/common/ConsoleLogger';
import { SessionModeChangedPayload } from '../src/types';

describe('WebSocketBridge — session:mode_changed', () => {
  let wss: WebSocketServer;
  let bridge: WebSocketBridge;
  let eventBus: InMemoryEventBus;
  let port: number;

  beforeEach((done) => {
    const logger = new ConsoleLogger('error');
    eventBus = new InMemoryEventBus(logger);
    wss = new WebSocketServer({ port: 0 }, () => {
      port = (wss.address() as AddressInfo).port;
      done();
    });
    bridge = new WebSocketBridge(wss, eventBus, logger);
  });

  afterEach((done) => {
    bridge.shutdown();
    wss.close(() => done());
  });

  it('subscribes to session:mode_changed on the event bus', () => {
    expect(eventBus.listenerCount('session:mode_changed')).toBe(1);
  });

  it('broadcasts session:mode_changed to a connected client', (done) => {
    const payload: SessionModeChangedPayload = {
      sessionId: 'sess_test_123',
      mode: 'coordinated-coordinator',
      previousMode: 'coordinated-worker',
      changed: true,
      timestamp: Date.now(),
    };

    const client = new WebSocket(`ws://127.0.0.1:${port}`);

    client.on('open', () => {
      eventBus.emit('session:mode_changed', payload);
    });

    client.on('message', (raw) => {
      const batch = JSON.parse(raw.toString());
      const frames = Array.isArray(batch) ? batch : [batch];
      const frame = frames.find((f: any) => f.event === 'session:mode_changed');
      if (!frame) return; // ignore unrelated frames
      try {
        expect(frame.type).toBe('session:mode_changed');
        expect(frame.data).toMatchObject(payload);
        client.close();
        done();
      } catch (err) {
        client.close();
        done(err as Error);
      }
    });

    client.on('error', (err) => done(err));
  });
});
