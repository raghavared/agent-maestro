import type { MaestroManifest } from '../types/manifest.js';
import { readManifestFromEnv } from '../services/manifest-reader.js';
import { AgentSpawner } from '../services/agent-spawner.js';
import { api } from '../api.js';
import { randomBytes } from 'crypto';
import {
  getPermissionsFromManifest,
  setCachedPermissions,
  type CommandPermissions
} from '../services/command-permissions.js';

/**
 * WorkerInitCommand - Initialize a worker session from a manifest
 *
 * Reads manifest from MAESTRO_MANIFEST_PATH environment variable,
 * validates it's a worker manifest, and spawns the configured agent tool.
 */
export class WorkerInitCommand {
  private spawner: AgentSpawner;

  constructor() {
    this.spawner = new AgentSpawner();
  }

  /**
   * Get manifest path from environment
   */
  getManifestPath(): string {
    const path = process.env.MAESTRO_MANIFEST_PATH;

    if (!path) {
      throw new Error(
        'MAESTRO_MANIFEST_PATH environment variable not set. ' +
          'This variable should point to the manifest JSON file.'
      );
    }

    return path;
  }

  /**
   * Get or generate session ID
   */
  getSessionId(): string {
    const envSessionId = process.env.MAESTRO_SESSION_ID;

    if (envSessionId) {
      return envSessionId;
    }

    // Generate new session ID
    return `session-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

  /**
   * Validate that manifest is for execute mode
   */
  validateWorkerManifest(manifest: MaestroManifest): boolean {
    return manifest.mode === 'execute';
  }

  /**
   * Format error message
   */
  formatError(errorType: string, details?: string): string {
    switch (errorType) {
      case 'manifest_not_found':
        return `Manifest file not found: ${details}\n\n` +
          'Please ensure the MAESTRO_MANIFEST_PATH environment variable ' +
          'points to a valid manifest file.';

      case 'invalid_manifest':
        return `Invalid manifest: ${details}\n\n` +
          'Please check that the manifest file follows the correct schema.';

      case 'wrong_mode':
        return `Wrong mode for worker init: ${details}\n\n` +
          'This command requires a manifest with mode="execute". ' +
          'For coordinate sessions, use the orchestrator init command.';

      default:
        return `Error: ${details}`;
    }
  }

  /**
   * Auto-update session status to working (does NOT touch user status)
   */
  private async autoUpdateSessionStatus(manifest: MaestroManifest, sessionId: string): Promise<void> {
    try {
      // Update the SESSION status from 'spawning' to 'working'
      await api.patch(`/api/sessions/${sessionId}`, {
        status: 'working',
      });

      for (const task of manifest.tasks) {
        // Update task's main status to in_progress
        try {
          await api.patch(`/api/tasks/${task.id}`, {
            status: 'in_progress',
          });
        } catch (err: any) {
          // Silent failure
        }

        // Update task's per-session status to working
        try {
          await api.patch(`/api/tasks/${task.id}`, {
            sessionStatus: 'working',
            updateSource: 'session',
            sessionId,
          });
        } catch (err: any) {
          // Silent failure
        }
      }
    } catch (err: any) {
      // Silent failure
    }
  }

  /**
   * Execute the worker init command
   */
  async execute(): Promise<void> {
    try {
      // Get manifest path
      const manifestPath = this.getManifestPath();

      // Read and validate manifest
      const result = await readManifestFromEnv();

      if (!result.success || !result.manifest) {
        throw new Error(this.formatError('manifest_not_found', manifestPath));
      }

      const manifest = result.manifest;

      // Validate mode
      if (!this.validateWorkerManifest(manifest)) {
        throw new Error(this.formatError('wrong_mode', manifest.mode));
      }

      // Load command permissions from manifest
      const permissions = getPermissionsFromManifest(manifest);
      setCachedPermissions(permissions);

      // Get session ID
      const sessionId = this.getSessionId();

      // Register session with server
      await this.autoUpdateSessionStatus(manifest, sessionId);

      // Spawn Claude
      const spawnResult = await this.spawner.spawn(manifest, sessionId, {
        interactive: true,
      });

      // Wait for process to exit
      const pid = spawnResult.process.pid;
      spawnResult.process.on('exit', async (code) => {
        // Silent exit
      });

    } catch (error: any) {
      console.error(`\n[worker-init] FATAL: Failed to initialize worker session`);
      console.error(`[worker-init] Error: ${error.message}`);
      if (error.stack) {
        console.error(`[worker-init] Stack: ${error.stack}`);
      }
      process.exit(1);
    }
  }
}
