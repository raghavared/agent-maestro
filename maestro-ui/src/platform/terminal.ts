// W3 (terminal /pty) fills the web impl here.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Event as TauriEvent } from '@tauri-apps/api/event';
import type { TerminalTransport, CreateSessionOpts, Unlisten } from './types';
import type { TerminalSessionInfo } from '../app/types/session';

export const tauriTerminal: TerminalTransport = {
  createSession(opts: CreateSessionOpts): Promise<TerminalSessionInfo> {
    return invoke<TerminalSessionInfo>('create_session', {
      name: opts.name,
      command: opts.command,
      cwd: opts.cwd,
      envVars: opts.envVars,
      persistent: opts.persistent,
      persistId: opts.persistId,
    });
  },

  write(id: string, data: string, source = 'user'): Promise<void> {
    return invoke('write_to_session', { id, data, source });
  },

  resize(id: string, cols: number, rows: number): Promise<void> {
    return invoke('resize_session', { id, cols, rows });
  },

  closeSession(id: string): Promise<void> {
    return invoke('close_session', { id });
  },

  async onOutput(handler: (id: string, data: string) => void): Promise<Unlisten> {
    type Payload = { id: string; data?: unknown };
    return listen<Payload>('pty-output', (event: TauriEvent<Payload>) => {
      const { id, data } = event.payload;
      if (typeof data === 'string') {
        handler(id, data);
      } else if (data instanceof Uint8Array) {
        handler(id, new TextDecoder().decode(data));
      } else if (data instanceof ArrayBuffer) {
        handler(id, new TextDecoder().decode(new Uint8Array(data)));
      } else if (Array.isArray(data) && data.every((x) => typeof x === 'number')) {
        handler(id, new TextDecoder().decode(new Uint8Array(data as number[])));
      }
    });
  },

  async onExit(handler: (id: string, exitCode?: number | null) => void): Promise<Unlisten> {
    type ExitPayload = { id: string; exit_code?: number | null };
    return listen<ExitPayload>('pty-exit', (event: TauriEvent<ExitPayload>) => {
      handler(event.payload.id, event.payload.exit_code);
    });
  },
};

// ── webTerminal: per-session WebSocket transport to /pty ──────────────────
import { PTY_WS_URL } from '../utils/serverConfig';

const _sockets = new Map<string, WebSocket>();
const _pendingSends = new Map<string, Array<string | Uint8Array>>();
const _outputHandlers: Array<(id: string, data: string) => void> = [];
const _exitHandlers: Array<(id: string, exitCode?: number | null) => void> = [];
const _decoder = new TextDecoder();

function _ensureSocket(id: string): WebSocket {
  const existing = _sockets.get(id);
  if (
    existing &&
    existing.readyState !== WebSocket.CLOSED &&
    existing.readyState !== WebSocket.CLOSING
  ) {
    return existing;
  }

  const ws = new WebSocket(`${PTY_WS_URL}?sessionId=${encodeURIComponent(id)}`);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    const pending = _pendingSends.get(id);
    if (pending) {
      for (const frame of pending) ws.send(frame);
      _pendingSends.delete(id);
    }
  };

  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; exitCode?: number | null };
        if (msg.type === 'exit') {
          for (const h of _exitHandlers) h(id, msg.exitCode ?? null);
          return;
        }
      } catch {
        // not a control frame — fall through to PTY output
      }
      for (const h of _outputHandlers) h(id, ev.data as string);
    } else {
      const text = _decoder.decode(new Uint8Array(ev.data as ArrayBuffer));
      for (const h of _outputHandlers) h(id, text);
    }
  };

  ws.onclose = () => {
    _sockets.delete(id);
  };

  _sockets.set(id, ws);
  return ws;
}

function _sendFrame(id: string, frame: string | Uint8Array): void {
  const ws = _sockets.get(id);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(frame);
    return;
  }
  // Queue for when the socket opens (resize may arrive before onopen fires)
  const queue = _pendingSends.get(id) ?? [];
  queue.push(frame);
  _pendingSends.set(id, queue);
}

export const webTerminal: TerminalTransport = {
  createSession(opts: CreateSessionOpts): Promise<TerminalSessionInfo> {
    const id = opts.maestroSessionId ?? opts.persistId;
    _ensureSocket(id);
    return Promise.resolve({
      id,
      name: opts.name ?? '',
      command: opts.command ?? '',
      cwd: opts.cwd ?? null,
    });
  },

  write(id: string, data: string, _source?: string): Promise<void> {
    _sendFrame(id, new TextEncoder().encode(data));
    return Promise.resolve();
  },

  resize(id: string, cols: number, rows: number): Promise<void> {
    _sendFrame(id, JSON.stringify({ type: 'resize', cols, rows }));
    return Promise.resolve();
  },

  closeSession(id: string): Promise<void> {
    const ws = _sockets.get(id);
    if (ws) {
      ws.close();
      _sockets.delete(id);
    }
    _pendingSends.delete(id);
    return Promise.resolve();
  },

  onOutput(handler: (id: string, data: string) => void): Promise<Unlisten> {
    _outputHandlers.push(handler);
    return Promise.resolve(() => {
      const idx = _outputHandlers.indexOf(handler);
      if (idx >= 0) _outputHandlers.splice(idx, 1);
    });
  },

  onExit(handler: (id: string, exitCode?: number | null) => void): Promise<Unlisten> {
    _exitHandlers.push(handler);
    return Promise.resolve(() => {
      const idx = _exitHandlers.indexOf(handler);
      if (idx >= 0) _exitHandlers.splice(idx, 1);
    });
  },
};
