import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { readFileSync } from 'fs';

// Load env vars from CWD .env
dotenv.config();

// Try to load from home dir config (staging first if detected, then prod)
const isStaging = process.env.SESSION_DIR?.includes('maestro-staging') ||
                  process.env.DATA_DIR?.includes('maestro-staging') ||
                  process.env.MAESTRO_SERVER_URL?.includes('3002');
if (isStaging) {
  dotenv.config({ path: path.join(os.homedir(), '.maestro-staging', 'config') });
}
dotenv.config({ path: path.join(os.homedir(), '.maestro', 'config') });

/**
 * Read server URL from the data dir's server-url file (written by server on startup).
 * Only works when DATA_DIR is set — otherwise returns null to avoid cross-environment confusion.
 */
function discoverServerUrl(): string | null {
  const rawDataDir = process.env.DATA_DIR;
  if (!rawDataDir) return null;

  const dataDir = rawDataDir.startsWith('~')
    ? path.join(os.homedir(), rawDataDir.slice(1))
    : rawDataDir;

  try {
    return readFileSync(path.join(dataDir, 'server-url'), 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

export const config = {
  get apiUrl() {
    return process.env.MAESTRO_SERVER_URL || process.env.MAESTRO_API_URL || discoverServerUrl() || 'http://localhost:3000';
  },
  get isOffline() {
    return !process.env.MAESTRO_SERVER_URL && !process.env.MAESTRO_API_URL;
  },
  get projectId() {
    return process.env.MAESTRO_PROJECT_ID;
  },
  get sessionId() {
    return process.env.MAESTRO_SESSION_ID;
  },
  get taskIds() {
    return process.env.MAESTRO_TASK_IDS ? process.env.MAESTRO_TASK_IDS.split(',').filter(Boolean) : [];
  },
  get strategy() {
    return (process.env.MAESTRO_STRATEGY || 'simple') as 'simple' | 'queue';
  },
  get retries() {
    return parseInt(process.env.MAESTRO_RETRIES || '3', 10);
  },
  get retryDelay() {
    return parseInt(process.env.MAESTRO_RETRY_DELAY || '1000', 10);
  },
  get debug() {
    return process.env.MAESTRO_DEBUG === 'true';
  },
  get orchestratorStrategy() {
    return (process.env.MAESTRO_ORCHESTRATOR_STRATEGY || 'default') as 'default' | 'intelligent-batching' | 'dag';
  }
};
