import type { MaestroManifest } from '../types/manifest.js';
import { readManifestFromEnv } from '../services/manifest-reader.js';
import { AgentSpawner } from '../services/agent-spawner.js';
import { api } from '../api.js';
import { randomBytes } from 'crypto';
import {
  MANIFEST_PATH_NOT_SET,
  MANIFEST_NOT_FOUND_PREFIX,
  MANIFEST_NOT_FOUND_HINT,
  INVALID_MANIFEST_PREFIX,
  INVALID_MANIFEST_HINT,
  WRONG_MODE_ORCHESTRATOR_PREFIX,
  WRONG_MODE_ORCHESTRATOR_HINT,
} from '../prompts/index.js';

/**
 * OrchestratorInitCommand - Initialize an orchestrator session from a manifest
 *
 * Reads manifest from MAESTRO_MANIFEST_PATH environment variable,
 * validates it's an orchestrator manifest, and spawns the configured agent tool.
 */
export class OrchestratorInitCommand {
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
      throw new Error(MANIFEST_PATH_NOT_SET);
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
   * Validate that manifest is for coordinate mode
   */
  validateOrchestratorManifest(manifest: MaestroManifest): boolean {
    return manifest.mode === 'coordinate';
  }

  /**
   * Format error message
   */
  formatError(errorType: string, details?: string): string {
    switch (errorType) {
      case 'manifest_not_found':
        return `${MANIFEST_NOT_FOUND_PREFIX}${details}\n\n${MANIFEST_NOT_FOUND_HINT}`;

      case 'invalid_manifest':
        return `${INVALID_MANIFEST_PREFIX}${details}\n\n${INVALID_MANIFEST_HINT}`;

      case 'wrong_mode':
        return `${WRONG_MODE_ORCHESTRATOR_PREFIX}${details}\n\n${WRONG_MODE_ORCHESTRATOR_HINT}`;

      default:
        return `Error: ${details}`;
    }
  }

  /**
   * Auto-update session status to working (does NOT touch user status)
   */
  private async autoUpdateSessionStatus(manifest: MaestroManifest, sessionId: string): Promise<void> {
    try {
      for (const task of manifest.tasks) {
        // Update task's main status to in_progress
        try {
          await api.patch(`/api/tasks/${task.id}`, {
            status: 'in_progress',
          });
        } catch {
          // Task might not exist on server yet, skip
        }

        // Update task's per-session status to working
        try {
          await api.patch(`/api/tasks/${task.id}`, {
            sessionStatus: 'working',
            updateSource: 'session',
            sessionId,
          });
        } catch {
          // Task might not exist on server yet, skip
        }
      }
    } catch {
      // Don't fail init on status update errors
    }
  }

  /**
   * Execute the orchestrator init command
   */
  async execute(): Promise<void> {
    try {
      // Step 1: Get manifest path
      const manifestPath = this.getManifestPath();

      // Step 2: Read and validate manifest
      const result = await readManifestFromEnv();

      if (!result.success || !result.manifest) {
        throw new Error(this.formatError('manifest_not_found', manifestPath));
      }

      const manifest = result.manifest;

      // Step 3: Validate mode
      if (!this.validateOrchestratorManifest(manifest)) {
        throw new Error(this.formatError('wrong_mode', manifest.mode));
      }

      // Step 4: Get session ID
      const sessionId = this.getSessionId();

      // Step 5: Auto-update session status to working
      await this.autoUpdateSessionStatus(manifest, sessionId);

      // Step 6: Spawn agent
      const spawnResult = await this.spawner.spawn(manifest, sessionId, {
        interactive: true,
      });

      // Wait for process to exit
      spawnResult.process.on('exit', async (code) => {
        // Clean up manifest file (disabled for debugging)
        // try {
        //   const { unlink } = await import('fs/promises');
        //   const manifestPath = process.env.MAESTRO_MANIFEST_PATH;
        //   if (manifestPath) {
        //     await unlink(manifestPath);
        //     console.log('Cleaned up manifest file');
        //   }
        // } catch (error) {
        //   // Ignore cleanup errors
        // }
      });

    } catch (error: any) {
      process.exit(1);
    }
  }
}
