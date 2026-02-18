import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import type { MaestroManifest } from '../types/manifest.js';
import type { SpawnResult, SpawnOptions } from './claude-spawner.js';
import { WhoamiRenderer } from './whoami-renderer.js';
import { getPermissionsFromManifest } from './command-permissions.js';
import { prepareSpawnerEnvironment } from './spawner-env.js';
import { buildGeminiStructuredPrompt } from '../prompts/index.js';

/**
 * GeminiSpawner - Spawns Google Gemini CLI sessions with manifests
 *
 * Handles:
 * - Environment variable setup for Maestro context
 * - Gemini CLI process spawning
 */
export class GeminiSpawner {
  /**
   * Prepare environment variables for Gemini session
   */
  prepareEnvironment(
    manifest: MaestroManifest,
    sessionId: string
  ): Record<string, string> {
    return prepareSpawnerEnvironment(manifest, sessionId);
  }

  /** All supported Gemini models */
  static readonly MODELS = [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ] as const;

  /**
   * Map manifest model to Gemini model string.
   * If the model is already a native Gemini model, pass it through.
   * Otherwise map Claude model names to a sensible default.
   */
  private mapModel(model: string): string {
    // Pass through if already a native Gemini model
    if (model.startsWith('gemini-')) {
      return model;
    }
    // Map Claude model names to Gemini equivalents
    switch (model) {
      case 'opus':
        return 'gemini-3-pro-preview';
      case 'sonnet':
        return 'gemini-2.5-pro';
      case 'haiku':
        return 'gemini-2.5-flash';
      default:
        return 'gemini-3-pro-preview';
    }
  }

  /**
   * Map manifest permission mode to Gemini approval mode
   */
  private mapApprovalMode(permissionMode: string): string {
    switch (permissionMode) {
      case 'acceptEdits':
        return 'yolo';
      case 'readOnly':
        return 'plan';
      case 'interactive':
      default:
        return 'default';
    }
  }

  /**
   * Build Gemini CLI arguments
   */
  buildGeminiArgs(manifest: MaestroManifest): string[] {
    const args: string[] = [];

    // Set model
    const model = this.mapModel(manifest.session.model);
    args.push('--model', model);

    // Set approval mode based on permission mode
    const approvalMode = this.mapApprovalMode(manifest.session.permissionMode);
    args.push('--approval-mode', approvalMode);

    return args;
  }

  /**
   * Spawn Gemini CLI session with manifest
   */
  async spawn(
    manifest: MaestroManifest,
    sessionId: string,
    options: SpawnOptions = {}
  ): Promise<SpawnResult> {
    // Split prompt into system (static) and task (dynamic) layers
    const renderer = new WhoamiRenderer();
    const permissions = getPermissionsFromManifest(manifest);
    const systemPrompt = renderer.renderSystemPrompt(manifest, permissions);
    const taskContext = await renderer.renderTaskContext(manifest, sessionId);

    const env = {
      ...this.prepareEnvironment(manifest, sessionId),
      ...(options.env || {}),
    };

    const args = this.buildGeminiArgs(manifest);

    // Gemini doesn't have a separate system prompt flag, so we concatenate
    // with clear section headers for better organization
    args.push('--prompt', buildGeminiStructuredPrompt(systemPrompt, taskContext));

    const cwd = options.cwd || manifest.session.workingDirectory || process.cwd();

    const geminiProcess = spawn('gemini', args, {
      cwd,
      env,
      stdio: options.interactive ? 'inherit' : 'pipe',
    });

    const sendInput = (text: string) => {
      if (geminiProcess.stdin && !geminiProcess.stdin.destroyed) {
        geminiProcess.stdin.write(text + '\n');
      }
    };

    return {
      sessionId,
      process: geminiProcess,
      sendInput,
    };
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `session-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }
}
