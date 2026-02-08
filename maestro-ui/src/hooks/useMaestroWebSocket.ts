import { useEffect, useRef, useCallback, useState } from 'react';
import type { MaestroTask, MaestroSession } from '../app/types/maestro';
import { WS_URL } from '../utils/serverConfig';

// Global singleton WebSocket instance (shared across all hook instances)
let globalWs: WebSocket | null = null;
let globalConnecting = false;
let globalListeners: Set<(event: MessageEvent) => void> = new Set();
let globalReconnectTimeout: number | null = null;
let globalReconnectAttempts = 0;

// WebSocket event types
type WebSocketEvent =
    | { event: 'task:created'; data: MaestroTask }
    | { event: 'task:updated'; data: MaestroTask }
    | { event: 'task:deleted'; data: { id: string } }
    | { event: 'session:created'; data: any }  // Can be Session or spawn data
    | { event: 'session:updated'; data: MaestroSession }
    | { event: 'session:deleted'; data: { id: string } }
    // PHASE IV-A: New bidirectional relationship events
    | { event: 'session:task_added'; data: { sessionId: string; taskId: string } }
    | { event: 'session:task_removed'; data: { sessionId: string; taskId: string } }
    | { event: 'task:session_added'; data: { taskId: string; sessionId: string } }
    | { event: 'task:session_removed'; data: { taskId: string; sessionId: string } }
    | { event: 'subtask:created'; data: { taskId: string; subtask: any } }
    | { event: 'subtask:updated'; data: { taskId: string; subtask: any } }
    | { event: 'subtask:deleted'; data: { taskId: string; subtaskId: string } };

export type MaestroWebSocketCallbacks = {
    onTaskCreated?: (task: MaestroTask) => void;
    onTaskUpdated?: (task: MaestroTask) => void;
    onTaskDeleted?: (data: { id: string }) => void;
    onSessionCreated?: (data: any) => void;  // Can be Session or spawn data
    onSessionUpdated?: (session: MaestroSession) => void;
    onSessionDeleted?: (data: { id: string }) => void;
    // PHASE IV-A: New bidirectional relationship callbacks
    onSessionTaskAdded?: (data: { sessionId: string; taskId: string }) => void;
    onSessionTaskRemoved?: (data: { sessionId: string; taskId: string }) => void;
    onTaskSessionAdded?: (data: { taskId: string; sessionId: string }) => void;
    onTaskSessionRemoved?: (data: { taskId: string; sessionId: string }) => void;
    onSubtaskCreated?: (data: { taskId: string; subtask: any }) => void;
    onSubtaskUpdated?: (data: { taskId: string; subtask: any }) => void;
    onSubtaskDeleted?: (data: { taskId: string; subtaskId: string }) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
};

/**
 * React hook for Maestro WebSocket connection
 * 
 * Connects to the Maestro server WebSocket and handles real-time events.
 * Automatically reconnects on disconnection with exponential backoff.
 */
export function useMaestroWebSocket(callbacks: MaestroWebSocketCallbacks = {}) {
    const [connected, setConnected] = useState(globalWs?.readyState === WebSocket.OPEN);
    const callbacksRef = useRef(callbacks);
    const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);

    // Update callbacks ref when they change
    useEffect(() => {
        callbacksRef.current = callbacks;
    }, [callbacks]);

    const connectGlobal = useCallback(() => {
        // Prevent duplicate connections
        if (globalConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) {
            console.log('[Maestro WebSocket] Already connected or connecting (global), skipping');
            return;
        }

        globalConnecting = true;

        // Clean up existing connection
        if (globalWs) {
            console.log('[Maestro WebSocket] Closing existing global connection');
            globalWs.close();
            globalWs = null;
        }

        try {
            console.log('[Maestro WebSocket] Creating global singleton connection to', WS_URL);
            const ws = new WebSocket(WS_URL);
            globalWs = ws;

            ws.onopen = () => {
                console.log('[Maestro WebSocket] Global connection established');
                setConnected(true);
                globalConnecting = false;
                globalReconnectAttempts = 0;
            };

            ws.onmessage = (event) => {
                // Broadcast to all registered listeners
                globalListeners.forEach(listener => listener(event));
            };

            ws.onerror = (error) => {
                console.error('[Maestro WebSocket] Error:', error);
            };

            ws.onclose = () => {
                console.log('[Maestro WebSocket] Global connection closed');
                setConnected(false);
                globalConnecting = false;
                globalWs = null;

                // Attempt to reconnect with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), 30000);

                console.log(`[Maestro WebSocket] Reconnecting in ${delay}ms (attempt ${globalReconnectAttempts + 1})`);

                if (globalReconnectTimeout) {
                    clearTimeout(globalReconnectTimeout);
                }

                globalReconnectTimeout = window.setTimeout(() => {
                    globalReconnectAttempts++;
                    connectGlobal();
                }, delay);
            };
        } catch (error) {
            console.error('[Maestro WebSocket] Failed to create WebSocket:', error);
            globalConnecting = false;
        }
    }, []);

    // Register message listener and connect
    useEffect(() => {
        console.log('[Maestro WebSocket] Hook instance mounting - registering listener');

        // Create listener for this hook instance
        const listener = (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data) as WebSocketEvent;
                console.log('[Maestro WebSocket] Received:', message.event, message.data);

                const callbacks = callbacksRef.current;
                switch (message.event) {
                    case 'task:created':
                        callbacks.onTaskCreated?.(message.data);
                        break;
                    case 'task:updated':
                        callbacks.onTaskUpdated?.(message.data);
                        break;
                    case 'task:deleted':
                        callbacks.onTaskDeleted?.(message.data);
                        break;
                    case 'session:created':
                        callbacks.onSessionCreated?.(message.data);
                        break;
                    case 'session:updated':
                        callbacks.onSessionUpdated?.(message.data);
                        break;
                    case 'session:deleted':
                        callbacks.onSessionDeleted?.(message.data);
                        break;
                    case 'session:task_added':
                        callbacks.onSessionTaskAdded?.(message.data);
                        break;
                    case 'session:task_removed':
                        callbacks.onSessionTaskRemoved?.(message.data);
                        break;
                    case 'task:session_added':
                        callbacks.onTaskSessionAdded?.(message.data);
                        break;
                    case 'task:session_removed':
                        callbacks.onTaskSessionRemoved?.(message.data);
                        break;
                    case 'subtask:created':
                        callbacks.onSubtaskCreated?.(message.data);
                        break;
                    case 'subtask:updated':
                        callbacks.onSubtaskUpdated?.(message.data);
                        break;
                    case 'subtask:deleted':
                        callbacks.onSubtaskDeleted?.(message.data);
                        break;
                }
            } catch (error) {
                console.error('[Maestro WebSocket] Failed to parse message:', error);
            }
        };

        listenerRef.current = listener;
        globalListeners.add(listener);
        console.log('[Maestro WebSocket] Total listeners registered:', globalListeners.size);

        // Connect to global WebSocket if not already connected
        connectGlobal();

        // Cleanup on unmount
        return () => {
            console.log('[Maestro WebSocket] Hook instance unmounting - unregistering listener');
            if (listenerRef.current) {
                globalListeners.delete(listenerRef.current);
                console.log('[Maestro WebSocket] Total listeners remaining:', globalListeners.size);
            }

            // Only close connection if no more listeners
            if (globalListeners.size === 0) {
                console.log('[Maestro WebSocket] No more listeners - closing global connection');
                if (globalReconnectTimeout) {
                    clearTimeout(globalReconnectTimeout);
                    globalReconnectTimeout = null;
                }
                if (globalWs) {
                    globalWs.close();
                    globalWs = null;
                }
                globalConnecting = false;
            }
        };
    }, [connectGlobal]);

    return { connected };
}
