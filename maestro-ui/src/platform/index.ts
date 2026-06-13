import { IS_TAURI } from './detect';
import { tauriTerminal, webTerminal } from './terminal';

export const platform = {
  isTauri: IS_TAURI,
  terminal: IS_TAURI ? tauriTerminal : webTerminal,
} as const;

export { IS_TAURI, isTauri } from './detect';
