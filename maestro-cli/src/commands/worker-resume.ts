import { api } from '../api.js';
import { ClaudeSpawner } from '../services/claude-spawner.js';
import { spawnWithUlimit } from '../services/spawn-with-ulimit.js';
import { readManifestFromEnv } from '../services/manifest-reader.js';
import { getPermissionsFromManifest, setCachedPermissions } from '../services/command-permissions.js';
import type { MaestroManifest } from '../types/manifest.js';

/**
 * If `claude --resume` exits (non-zero) within this window, we assume the
 * conversation could not be restored — most commonly because the session never
 * produced a checkpoint (e.g. it was still spawning when it died). In that case
 * we transparently fall back to a fresh start that reuses the same session id.
 */
const RESUME_FAILURE_WINDOW_MS = 4000;

/**
 * WorkerResumeCommand - Resume a previously stopped/crashed Claude session.
 *
 * Reads MAESTRO_SESSION_ID and MAESTRO_CLAUDE_SESSION_ID from the environment,
 * marks the session as working, and runs `claude --resume <claudeSessionId>`
 * with the full launch config (skills, model, permission mode) reapplied from
 * the manifest.
 *
 * Resume is idempotent across session states: if the conversation cannot be
 * resumed (no checkpoint yet — typical for sessions that died while spawning),
 * it falls back to a fresh init start using the same session id so the agent
 * still launches with its tasks and context.
 */
export class WorkerResumeCommand {
  private spawner = new ClaudeSpawner();
  private fellBack = false;

  private debug(message: string): void {
    if (process.env.MAESTRO_DEBUG === 'true') {
      console.error(message);
    }
  }

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

      // Mark session as working (best-effort; non-fatal)
      try {
        await api.patch(`/api/sessions/${sessionId}`, { status: 'working' });
      } catch (err: unknown) {
        this.debug(`[worker-resume] Failed to update session status: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Read the manifest so we can reapply the full launch config on resume and
      // have a real manifest available for the fresh-start fallback.
      let manifest: MaestroManifest | null = null;
      const manifestResult = await readManifestFromEnv();
      if (manifestResult.success && manifestResult.manifest) {
        manifest = manifestResult.manifest;
        // Refresh cached command permissions so CLI hooks gate correctly.
        try {
          setCachedPermissions(getPermissionsFromManifest(manifest));
        } catch (err: unknown) {
          this.debug(`[worker-resume] Failed to cache permissions: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        this.debug(`[worker-resume] Manifest unavailable, using minimal resume args: ${manifestResult.error || 'unknown'}`);
      }

      // Build resume args: full launch config + --resume, or a minimal set when
      // the manifest could not be read.
      let args: string[];
      if (manifest) {
        args = await this.spawner.buildResumeArgs(manifest, claudeSessionId);
      } else {
        args = ['--resume', claudeSessionId];
        const mode = process.env.MAESTRO_MODE || 'worker';
        const pluginDir = this.spawner.getPluginDir(mode);
        if (pluginDir) {
          args.push('--plugin-dir', pluginDir);
        }
      }

      const startedAt = Date.now();
      const claudeProcess = spawnWithUlimit('claude', args, {
        env: { ...process.env } as Record<string, string>,
        stdio: 'inherit',
      });

      claudeProcess.on('exit', (code) => {
        const elapsedMs = Date.now() - startedAt;
        this.debug(`[worker-resume] Claude (resume) exited with code ${code} after ${elapsedMs}ms`);

        const resumeFailedFast = code !== 0 && elapsedMs < RESUME_FAILURE_WINDOW_MS;
        if (resumeFailedFast && manifest && !this.fellBack) {
          this.fellBack = true;
          this.debug('[worker-resume] Resume failed fast; falling back to fresh start with same session id');
          void this.freshStart(manifest, sessionId);
        }
      });
    } catch (error: unknown) {
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

  /**
   * Fall back to a fresh Claude start that reuses the same Claude session id
   * (via --session-id, from the env that the spawner reads). This re-injects the
   * system prompt and task context so the agent resumes work even without a
   * restorable conversation checkpoint.
   */
  private async freshStart(manifest: MaestroManifest, sessionId: string): Promise<void> {
    try {
      const spawnResult = await this.spawner.spawn(manifest, sessionId, { interactive: true });
      spawnResult.process.on('exit', (code: number | null) => {
        this.debug(`[worker-resume] Claude (fresh start) exited with code ${code}`);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to start session: ${message}`);
      process.exit(1);
    }
  }
}
