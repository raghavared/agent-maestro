import type { MaestroManifest } from '../types/manifest.js';
import { readManifestFromEnv } from '../services/manifest-reader.js';
import { ClaudeSpawner } from '../services/claude-spawner.js';
import { api } from '../api.js';
import { randomBytes } from 'crypto';

/**
 * OrchestratorInitCommand - Initialize an orchestrator session from a manifest
 *
 * Reads manifest from MAESTRO_MANIFEST_PATH environment variable,
 * validates it's an orchestrator manifest, and spawns Claude Code.
 */
export class OrchestratorInitCommand {
  private spawner: ClaudeSpawner;

  constructor() {
    this.spawner = new ClaudeSpawner();
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
   * Validate that manifest is for orchestrator role
   */
  validateOrchestratorManifest(manifest: MaestroManifest): boolean {
    return manifest.role === 'orchestrator';
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

      case 'wrong_role':
        return `Wrong role for orchestrator init: ${details}\n\n` +
          'This command requires a manifest with role="orchestrator". ' +
          'For worker sessions, use the worker init command.';

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
        // Update session status via server API
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
    console.log('Initializing Maestro Orchestrator Session\n');

    try {
      // Step 1: Get manifest path
      console.log('Reading manifest...');
      const manifestPath = this.getManifestPath();
      console.log(`   Manifest: ${manifestPath}`);

      // Step 2: Read and validate manifest
      const result = await readManifestFromEnv();

      if (!result.success || !result.manifest) {
        throw new Error(this.formatError('manifest_not_found', manifestPath));
      }

      const manifest = result.manifest;

      // Step 3: Validate role
      if (!this.validateOrchestratorManifest(manifest)) {
        throw new Error(this.formatError('wrong_role', manifest.role));
      }

      // Show task information
      const primaryTask = manifest.tasks[0];
      if (manifest.tasks.length === 1) {
        console.log(`   Task: ${primaryTask.title} (${primaryTask.id})`);
      } else {
        console.log(`   Tasks: ${manifest.tasks.length} tasks`);
        console.log(`   Primary: ${primaryTask.title} (${primaryTask.id})`);
        manifest.tasks.slice(1).forEach((task, idx) => {
          console.log(`   Task ${idx + 2}: ${task.title} (${task.id})`);
        });
      }
      console.log(`   Project: ${primaryTask.projectId}`);
      if (manifest.skills && manifest.skills.length > 0) {
        console.log(`   Skills: ${manifest.skills.join(', ')}`);
      }
      console.log('');

      // Step 4: Get session ID
      const sessionId = this.getSessionId();
      console.log(`   Session ID: ${sessionId}\n`);

      // Step 5: Auto-update session status to working
      await this.autoUpdateSessionStatus(manifest, sessionId);

      // Step 6: Spawn Claude
      console.log('Spawning Claude Code session...\n');

      const spawnResult = await this.spawner.spawn(manifest, sessionId, {
        interactive: true,
      });

      console.log('Orchestrator session started successfully!\n');

      // Wait for process to exit
      spawnResult.process.on('exit', async (code) => {
        console.log(`\nOrchestrator session exited with code ${code}`);

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
      console.error(`\nFailed to initialize orchestrator session:\n`);
      console.error(error.message);
      process.exit(1);
    }
  }
}
