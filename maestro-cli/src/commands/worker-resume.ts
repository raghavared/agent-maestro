import { api } from '../api.js';
import { ClaudeSpawner } from '../services/claude-spawner.js';
import { spawnWithUlimit } from '../services/spawn-with-ulimit.js';

/**
 * WorkerResumeCommand - Resume a previously completed/stopped/failed Claude session
 *
 * Reads MAESTRO_SESSION_ID and MAESTRO_CLAUDE_SESSION_ID from environment,
 * updates session status to working, and spawns `claude --resume <claudeSessionId>`.
 */
export class WorkerResumeCommand {
  async execute(): Promise<void> {
    try {
      const sessionId = process.env.MAESTRO_SESSION_ID;
      const claudeSessionId = process.env.MAESTRO_CLAUDE_SESSION_ID;

      if (!sessionId) {
        throw new Error('MAESTRO_SESSION_ID environment variable not set');
      }
      if (!claudeSessionId) {
        throw new Error('MAESTRO_CLAUDE_SESSION_ID environment variable not set');
      }

      // Update session status to working
      try {
        await api.patch(`/api/sessions/${sessionId}`, {
          status: 'working',
        });
      } catch (err: unknown) {
        if (process.env.MAESTRO_DEBUG === 'true') {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[worker-resume] Failed to update session status: ${message}`);
        }
      }

      // Build Claude args for resume
      const args: string[] = ['--resume', claudeSessionId];

      // Add plugin directory for hooks
      const mode = process.env.MAESTRO_MODE || 'worker';
      const spawner = new ClaudeSpawner();
      const pluginDir = spawner.getPluginDir(mode);
      if (pluginDir) {
        args.push('--plugin-dir', pluginDir);
      }

      // Spawn claude with resume flag
      const claudeProcess = spawnWithUlimit('claude', args, {
        env: { ...process.env } as Record<string, string>,
        stdio: 'inherit',
      });

      claudeProcess.on('exit', (code) => {
        if (process.env.MAESTRO_DEBUG === 'true') {
          console.error(`[worker-resume] Claude exited with code ${code}`);
        }
      });

    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error || 'Unknown worker resume error');
      if (message) {
        console.error(message);
      }
      if (process.env.MAESTRO_DEBUG === 'true' && error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}
