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

export const webTerminal: TerminalTransport = {
  createSession(_opts: CreateSessionOpts): Promise<TerminalSessionInfo> {
    throw new Error('webTerminal.createSession not implemented — filled in by W3 terminal transport');
  },

  write(_id: string, _data: string, _source?: string): Promise<void> {
    throw new Error('webTerminal.write not implemented — filled in by W3 terminal transport');
  },

  resize(_id: string, _cols: number, _rows: number): Promise<void> {
    throw new Error('webTerminal.resize not implemented — filled in by W3 terminal transport');
  },

  closeSession(_id: string): Promise<void> {
    throw new Error('webTerminal.closeSession not implemented — filled in by W3 terminal transport');
  },

  onOutput(_handler: (id: string, data: string) => void): Promise<Unlisten> {
    return Promise.resolve(() => {});
  },

  onExit(_handler: (id: string, exitCode?: number | null) => void): Promise<Unlisten> {
    return Promise.resolve(() => {});
  },
};
