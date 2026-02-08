import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

// Load env vars
dotenv.config();

// Try to load from home dir config
dotenv.config({ path: path.join(os.homedir(), '.maestro', 'config') });

export const config = {
  get apiUrl() {
    return process.env.MAESTRO_API_URL || process.env.MAESTRO_SERVER_URL || 'http://localhost:3000';
  },
  get isOffline() {
    return !process.env.MAESTRO_API_URL && !process.env.MAESTRO_SERVER_URL;
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
  }
};
