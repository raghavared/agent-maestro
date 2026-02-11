import { spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import type { MaestroManifest } from '../types/manifest.js';
import type { SpawnResult, SpawnOptions } from './claude-spawner.js';

/**
 * CodexSpawner - Spawns OpenAI Codex CLI sessions with manifests
 *
 * Handles:
 * - Environment variable setup for Maestro context
 * - Codex CLI process spawning
 * - Tmux integration
 */
export class CodexSpawner {
  /**
   * Prepare environment variables for Codex session
   */
  prepareEnvironment(
    manifest: MaestroManifest,
    sessionId: string
  ): Record<string, string> {
    const primaryTask = manifest.tasks[0];
    const allTaskIds = manifest.tasks.map(t => t.id).join(',');

    const env: Record<string, string> = {
      ...process.env,
      MAESTRO_SESSION_ID: sessionId,
      MAESTRO_TASK_IDS: allTaskIds,
      MAESTRO_PROJECT_ID: primaryTask.projectId,
      MAESTRO_ROLE: manifest.role,
      MAESTRO_STRATEGY: manifest.strategy || 'simple',
      MAESTRO_MANIFEST_PATH: process.env.MAESTRO_MANIFEST_PATH || '',
      MAESTRO_SERVER_URL: process.env.MAESTRO_SERVER_URL || process.env.MAESTRO_API_URL || '',
      MAESTRO_TASK_TITLE: primaryTask.title,
      MAESTRO_TASK_PRIORITY: primaryTask.priority || 'medium',
      MAESTRO_ALL_TASKS: JSON.stringify(manifest.tasks),
    };

    if (primaryTask.acceptanceCriteria && primaryTask.acceptanceCriteria.length > 0) {
      env.MAESTRO_TASK_ACCEPTANCE = JSON.stringify(primaryTask.acceptanceCriteria);
    }

    if (primaryTask.dependencies && primaryTask.dependencies.length > 0) {
      env.MAESTRO_TASK_DEPENDENCIES = JSON.stringify(primaryTask.dependencies);
    }

    if (manifest.role === 'orchestrator') {
      env.MAESTRO_ORCHESTRATOR_STRATEGY = manifest.orchestratorStrategy || 'default';
    }

    return env as Record<string, string>;
  }

  /** All supported Codex models */
  static readonly MODELS = [
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
    'gpt-5.1-codex',
    'gpt-5-codex',
    'gpt-5-codex-mini',
  ] as const;

  /**
   * Map manifest model to Codex model string.
   * If the model is already a native Codex model, pass it through.
   * Otherwise map Claude model names to a sensible default.
   */
  private mapModel(model: string): string {
    // Pass through if already a native Codex/OpenAI model
    if (model.startsWith('gpt-')) {
      return model;
    }
    // Map Claude model names to Codex equivalents
    switch (model) {
      case 'opus':
        return 'gpt-5.3-codex';
      case 'sonnet':
        return 'gpt-5.2-codex';
      case 'haiku':
        return 'gpt-5.1-codex-mini';
      default:
        return 'gpt-5.3-codex';
    }
  }

  /**
   * Map manifest permission mode to Codex approval policy
   */
  private mapApprovalPolicy(permissionMode: string): string {
    switch (permissionMode) {
      case 'acceptEdits':
        return 'on-failure';
      case 'readOnly':
        return 'untrusted';
      case 'interactive':
      default:
        return 'untrusted';
    }
  }

  /**
   * Build Codex CLI arguments
   */
  buildCodexArgs(manifest: MaestroManifest): string[] {
    const args: string[] = [];

    // Set model
    const model = this.mapModel(manifest.session.model);
    args.push('--model', model);

    // Set approval policy based on permission mode
    const approval = this.mapApprovalPolicy(manifest.session.permissionMode);
    args.push('--ask-for-approval', approval);

    // Set sandbox mode to danger-full-access
    args.push('--sandbox', 'danger-full-access');

    // Set working directory if specified
    if (manifest.session.workingDirectory) {
      args.push('--cd', manifest.session.workingDirectory);
    }

    return args;
  }

  /**
   * Spawn Codex session in tmux
   */
  async spawnInTmux(
    manifest: MaestroManifest,
    sessionId: string,
    options: SpawnOptions & { tmuxSession: string; tmuxPane?: string }
  ): Promise<SpawnResult> {
    const prompt = 'Run `maestro whoami` to understand your assignment and begin working.';

    const env = {
      ...this.prepareEnvironment(manifest, sessionId),
      ...(options.env || {}),
    };

    const args = this.buildCodexArgs(manifest);
    args.push(prompt);

    const cwd = options.cwd || manifest.session.workingDirectory || process.cwd();

    const codexCommand = `codex ${args.map(arg => {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }).join(' ')}`;

    const tmuxCommands: string[] = [];
    const tmuxTarget = options.tmuxPane
      ? `${options.tmuxSession}:${options.tmuxPane}`
      : options.tmuxSession;

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined && value !== null) {
        tmuxCommands.push(`tmux setenv -t ${tmuxTarget} ${key} "${value.toString().replace(/"/g, '\\"')}"`);
      }
    }

    tmuxCommands.push(`tmux send-keys -t ${tmuxTarget} "cd ${cwd}" C-m`);
    tmuxCommands.push(`tmux send-keys -t ${tmuxTarget} "${codexCommand}" C-m`);

    const tmuxProcess = spawn('sh', ['-c', tmuxCommands.join(' && ')], {
      stdio: 'inherit',
    });

    return new Promise((resolve, reject) => {
      tmuxProcess.on('exit', (code) => {
        if (code === 0) {
          resolve({
            sessionId,
            promptFile: '',
            process: tmuxProcess,
            sendInput: (text: string) => {
              spawn('tmux', ['send-keys', '-t', tmuxTarget, text, 'C-m']);
            },
          });
        } else {
          reject(new Error(`Tmux spawn failed with code ${code}`));
        }
      });
      tmuxProcess.on('error', reject);
    });
  }

  /**
   * Spawn Codex CLI session with manifest
   */
  async spawn(
    manifest: MaestroManifest,
    sessionId: string,
    options: SpawnOptions = {}
  ): Promise<SpawnResult> {
    if (options.tmuxSession) {
      return this.spawnInTmux(manifest, sessionId, {
        ...options,
        tmuxSession: options.tmuxSession,
      });
    }

    const prompt = 'Run `maestro whoami` to understand your assignment and begin working.';

    const env = {
      ...this.prepareEnvironment(manifest, sessionId),
      ...(options.env || {}),
    };

    const args = this.buildCodexArgs(manifest);
    args.push(prompt);

    const cwd = options.cwd || manifest.session.workingDirectory || process.cwd();

    const codexProcess = spawn('codex', args, {
      cwd,
      env,
      stdio: options.interactive ? 'inherit' : 'pipe',
    });

    const sendInput = (text: string) => {
      if (codexProcess.stdin && !codexProcess.stdin.destroyed) {
        codexProcess.stdin.write(text + '\n');
      }
    };

    return {
      sessionId,
      promptFile: '',
      process: codexProcess,
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
