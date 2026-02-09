import type { MaestroManifest } from '../types/manifest.js';
import { readManifestFromEnv } from '../services/manifest-reader.js';
import { ClaudeSpawner } from '../services/claude-spawner.js';
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
 * validates it's a worker manifest, and spawns Claude Code.
 */
export class WorkerInitCommand {
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
   * Validate that manifest is for worker role
   */
  validateWorkerManifest(manifest: MaestroManifest): boolean {
    return manifest.role === 'worker';
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
        return `Wrong role for worker init: ${details}\n\n` +
          'This command requires a manifest with role="worker". ' +
          'For orchestrator sessions, use the orchestrator init command.';

      default:
        return `Error: ${details}`;
    }
  }

  /**
   * Auto-update session status to working (does NOT touch user status)
   */
  private async autoUpdateSessionStatus(manifest: MaestroManifest, sessionId: string): Promise<void> {
    try {
      // Update the SESSION status from 'spawning' to 'running'
      console.log(`[worker-init] Registering session with server...`);
      console.log(`[worker-init]    PATCH /api/sessions/${sessionId} -> status: 'running'`);
      await api.patch(`/api/sessions/${sessionId}`, {
        status: 'running',
      });
      console.log(`[worker-init]    Session status updated: spawning -> running`);

      for (const task of manifest.tasks) {
        // Update task's main status to in_progress
        try {
          console.log(`[worker-init]    PATCH /api/tasks/${task.id} -> status: 'in_progress'`);
          await api.patch(`/api/tasks/${task.id}`, {
            status: 'in_progress',
          });
          console.log(`[worker-init]    Task ${task.id} status updated to 'in_progress'`);
        } catch (err: any) {
          console.warn(`[worker-init]    Failed to update task ${task.id} status: ${err.message}`);
        }

        // Update task's per-session status to working
        try {
          console.log(`[worker-init]    PATCH /api/tasks/${task.id} -> taskSessionStatuses[${sessionId}]: 'working'`);
          await api.patch(`/api/tasks/${task.id}`, {
            sessionStatus: 'working',
            updateSource: 'session',
            sessionId,
          });
          console.log(`[worker-init]    Task ${task.id} taskSessionStatuses[${sessionId}] updated to 'working'`);
        } catch (err: any) {
          console.warn(`[worker-init]    Failed to update task ${task.id} session status: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[worker-init]    Failed to update session status: ${err.message}`);
    }
  }

  /**
   * Execute the worker init command
   */
  async execute(): Promise<void> {
    console.log('══════════════════════════════════════════════════════════');
    console.log(' Maestro Worker Init');
    console.log('══════════════════════════════════════════════════════════\n');

    // Log server connection info for debugging environment routing
    console.log(`[worker-init] Server URL env: MAESTRO_SERVER_URL=${process.env.MAESTRO_SERVER_URL || '(not set)'}`);
    console.log(`[worker-init] Server URL env: MAESTRO_API_URL=${process.env.MAESTRO_API_URL || '(not set)'}`);
    console.log(`[worker-init] DATA_DIR=${process.env.DATA_DIR || '(not set)'}`);
    console.log(`[worker-init] Resolved API URL: ${api.getBaseUrl()}`);

    try {
      // Step 1: Get manifest path
      console.log('[worker-init] Step 1/7: Reading manifest from environment...');
      const manifestPath = this.getManifestPath();
      console.log(`[worker-init]    MAESTRO_MANIFEST_PATH = ${manifestPath}`);

      // Step 2: Read and validate manifest
      console.log('[worker-init] Step 2/7: Parsing manifest...');
      const result = await readManifestFromEnv();

      if (!result.success || !result.manifest) {
        throw new Error(this.formatError('manifest_not_found', manifestPath));
      }

      const manifest = result.manifest;
      console.log(`[worker-init]    Role: ${manifest.role}`);
      console.log(`[worker-init]    Strategy: ${manifest.strategy || 'simple'}`);
      console.log(`[worker-init]    Model: ${manifest.session.model}`);
      console.log(`[worker-init]    Max turns: ${manifest.session.maxTurns || 'unlimited'}`);
      console.log(`[worker-init]    Working directory: ${manifest.session.workingDirectory || process.cwd()}`);
      console.log(`[worker-init]    Tasks: ${manifest.tasks.length}`);

      // Step 3: Validate role
      console.log('[worker-init] Step 3/7: Validating worker role...');
      if (!this.validateWorkerManifest(manifest)) {
        throw new Error(this.formatError('wrong_role', manifest.role));
      }
      console.log(`[worker-init]    Role "${manifest.role}" validated`);

      // Step 4: Load command permissions from manifest
      console.log('[worker-init] Step 4/7: Loading command permissions...');
      const permissions = getPermissionsFromManifest(manifest);
      setCachedPermissions(permissions);
      console.log(`[worker-init]    Allowed commands: ${permissions.allowedCommands.length}`);
      console.log(`[worker-init]    Hidden commands: ${permissions.hiddenCommands.length}`);

      // Show task information
      console.log('[worker-init] Task details:');
      const primaryTask = manifest.tasks[0];
      manifest.tasks.forEach((task, idx) => {
        const label = idx === 0 ? 'Primary' : `Task ${idx + 1}`;
        console.log(`[worker-init]    ${label}: ${task.title} (${task.id})`);
        console.log(`[worker-init]       Project: ${task.projectId}`);
        console.log(`[worker-init]       Priority: ${task.priority || 'medium'}`);
        if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
          console.log(`[worker-init]       Acceptance criteria: ${task.acceptanceCriteria.length}`);
        }
        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`[worker-init]       Dependencies: ${task.dependencies.join(', ')}`);
        }
      });
      if (manifest.skills && manifest.skills.length > 0) {
        console.log(`[worker-init]    Skills: ${manifest.skills.join(', ')}`);
      }

      // Step 5: Get session ID
      console.log('[worker-init] Step 5/7: Resolving session ID...');
      const sessionId = this.getSessionId();
      const sessionIdSource = process.env.MAESTRO_SESSION_ID ? 'env (MAESTRO_SESSION_ID)' : 'generated';
      console.log(`[worker-init]    Session ID: ${sessionId}`);
      console.log(`[worker-init]    Source: ${sessionIdSource}`);

      // Step 6: Register session with server
      console.log('[worker-init] Step 6/7: Registering session with server...');
      await this.autoUpdateSessionStatus(manifest, sessionId);

      // Step 7: Spawn Claude
      console.log('[worker-init] Step 7/7: Spawning Claude Code process...');

      const spawnResult = await this.spawner.spawn(manifest, sessionId, {
        interactive: true,
      });

      const pid = spawnResult.process.pid;
      console.log(`[worker-init] Claude Code spawned (PID: ${pid})`);
      console.log('[worker-init] Worker session started successfully');
      console.log('══════════════════════════════════════════════════════════\n');

      // Wait for process to exit
      spawnResult.process.on('exit', async (code) => {
        console.log(`\n[worker-init] Claude Code process exited (PID: ${pid}, code: ${code})`);
        console.log(`[worker-init] Session ${sessionId} ended`);
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
