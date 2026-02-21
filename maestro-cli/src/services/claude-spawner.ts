import { spawn, type ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import type { MaestroManifest } from '../types/manifest.js';
import { SkillLoader } from './skill-loader.js';
import { prepareSpawnerEnvironment } from './spawner-env.js';
import { PromptComposer, type PromptEnvelope } from '../prompting/prompt-composer.js';
import { STDIN_UNAVAILABLE_WARNING } from '../prompts/index.js';

/**
 * Result of spawning an agent session
 */
export interface SpawnResult {
  /** Session ID for this spawn */
  sessionId: string;
  /** The spawned process */
  process: ChildProcess;
  /** Helper to send input to the agent (when stdio is 'pipe') */
  sendInput?: (text: string) => void;
}

/**
 * Options for spawning Claude
 */
export interface SpawnOptions {
  /** Working directory for Claude session */
  cwd?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Whether to inherit stdio (for interactive sessions) */
  interactive?: boolean;
}

/**
 * ClaudeSpawner - Spawns Claude Code sessions with manifests
 *
 * Handles:
 * - Prompt generation from manifests
 * - Environment variable setup
 * - Claude Code process spawning with skills
 * - Maestro hooks injection
 */
export class ClaudeSpawner {
  private skillLoader: SkillLoader;
  private promptComposer: PromptComposer;

  constructor(skillLoader?: SkillLoader) {
    this.skillLoader = skillLoader || new SkillLoader();
    this.promptComposer = new PromptComposer();
  }

  /**
   * Prepare environment variables for Claude session
   */
  prepareEnvironment(
    manifest: MaestroManifest,
    sessionId: string
  ): Record<string, string> {
    return prepareSpawnerEnvironment(manifest, sessionId);
  }

  /**
   * Map manifest permission mode to Claude Code --permission-mode value
   */
  private mapPermissionMode(permissionMode: string): string {
    switch (permissionMode) {
      case 'acceptEdits':
        return 'acceptEdits';
      case 'bypassPermissions':
        return 'bypassPermissions';
      case 'readOnly':
        return 'plan';
      case 'interactive':
      default:
        return 'default';
    }
  }

  /**
   * Get plugin directory for a mode
   *
   * @param mode - The agent mode (execute or coordinate)
   * @returns Path to plugin directory, or null if not found
   */
  getPluginDir(mode: string): string | null {
    try {
      // Get the maestro-cli root directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const cliRoot = join(__dirname, '../..');

      // Construct plugin directory path — worker-type modes use worker plugin, coordinator-type use orchestrator
      const isCoord = mode === 'coordinate' || mode === 'coordinator' || mode === 'coordinated-coordinator';
      const pluginName = isCoord ? 'maestro-orchestrator' : 'maestro-worker';
      const pluginDir = join(cliRoot, 'plugins', pluginName);

      // Check if plugin directory exists
      if (existsSync(pluginDir)) {
        return pluginDir;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Build Claude CLI arguments
   *
   * @param manifest - The manifest
   * @returns Array of CLI arguments
   */
  async buildClaudeArgs(manifest: MaestroManifest): Promise<string[]> {
    const args: string[] = [];

    // Add plugin directory (provides both hooks and skills)
    // Skills in plugins are loaded from the skills/ subdirectory automatically
    const pluginDir = this.getPluginDir(manifest.mode);
    if (pluginDir) {
      args.push('--plugin-dir', pluginDir);
    }

    // Load skills if specified in manifest
    if (manifest.skills && manifest.skills.length > 0) {
      const skillResult = await this.skillLoader.load(manifest.skills);

      // Add each successfully loaded skill
      for (const skillPath of skillResult.loaded) {
        args.push('--plugin-dir', skillPath);
      }

      // Graceful degradation: don't fail on missing/invalid skills
      // They're categorized but not preventing session spawn
    }

    // Add model
    args.push('--model', manifest.session.model);

    // Add permission mode
    if (manifest.session.permissionMode) {
      const claudePermMode = this.mapPermissionMode(manifest.session.permissionMode);
      args.push('--permission-mode', claudePermMode);
    }

    // Add max turns if specified
    if (manifest.session.maxTurns) {
      args.push('--max-turns', manifest.session.maxTurns.toString());
    }

    return args;
  }

  buildPromptEnvelope(
    manifest: MaestroManifest,
    sessionId: string,
  ): PromptEnvelope {
    return this.promptComposer.compose(manifest, { sessionId });
  }


  /**
   * Spawn Claude Code session with manifest
   *
   * @param manifest - The manifest
   * @param sessionId - Unique session ID
   * @param options - Spawn options
   * @returns Spawn result with process and metadata
   */
  async spawn(
    manifest: MaestroManifest,
    sessionId: string,
    options: SpawnOptions = {}
  ): Promise<SpawnResult> {
    const envelope = this.buildPromptEnvelope(manifest, sessionId);
    const systemPrompt = envelope.system;
    const taskContext = envelope.task;

    // Prepare environment
    const env = {
      ...this.prepareEnvironment(manifest, sessionId),
      ...(options.env || {}),
    };

    // Build arguments (now async to load skills)
    const args = await this.buildClaudeArgs(manifest);

    // Static mode instructions + commands go into the system prompt
    args.push('--append-system-prompt', systemPrompt);

    // Dynamic task context goes as the user message (initial prompt)
    args.push(taskContext);

    // Determine working directory
    const cwd = options.cwd || manifest.session.workingDirectory || process.cwd();

    // Spawn Claude process
    const claudeProcess = spawn('claude', args, {
      cwd,
      env,
      stdio: options.interactive ? 'inherit' : 'pipe',
    });

    // Helper to send input to Claude (only works when stdio is 'pipe')
    const sendInput = (text: string) => {
      if (claudeProcess.stdin && !claudeProcess.stdin.destroyed) {
        claudeProcess.stdin.write(text + '\n');
      }
    };

    return {
      sessionId,
      process: claudeProcess,
      sendInput,
    };
  }

  /**
   * Generate unique session ID
   *
   * @returns Unique session ID
   */
  generateSessionId(): string {
    return `session-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

}

/**
 * Default instance
 */
export const defaultSpawner = new ClaudeSpawner();
