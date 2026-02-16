import { spawn, type ChildProcess } from 'child_process';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import type { MaestroManifest } from '../types/manifest.js';
import { SkillLoader } from './skill-loader.js';
import { WhoamiRenderer } from './whoami-renderer.js';
import { getPermissionsFromManifest } from './command-permissions.js';

/**
 * Result of spawning a Claude session
 */
export interface SpawnResult {
  /** Session ID for this spawn */
  sessionId: string;
  /** Path to the prompt file */
  promptFile: string;
  /** The spawned process */
  process: ChildProcess;
  /** Helper to send input to Claude (when stdio is 'pipe') */
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

  constructor(skillLoader?: SkillLoader) {
    this.skillLoader = skillLoader || new SkillLoader();
  }

  /**
   * Prepare environment variables for Claude session
   *
   * @param manifest - The manifest
   * @param sessionId - Unique session ID
   * @returns Environment variables object
   */
  prepareEnvironment(
    manifest: MaestroManifest,
    sessionId: string
  ): Record<string, string> {
    // Use first task as primary task for single/multi-task sessions
    const primaryTask = manifest.tasks[0];
    const allTaskIds = manifest.tasks.map(t => t.id).join(',');

    const env: Record<string, string> = {
      ...process.env,
      // Maestro context
      MAESTRO_SESSION_ID: sessionId,
      MAESTRO_TASK_IDS: allTaskIds,
      MAESTRO_PROJECT_ID: primaryTask.projectId,
      MAESTRO_MODE: manifest.mode,
      MAESTRO_MANIFEST_PATH: process.env.MAESTRO_MANIFEST_PATH || '',
      // Server URL - explicitly forward so child processes connect to the correct server
      MAESTRO_SERVER_URL: process.env.MAESTRO_SERVER_URL || process.env.MAESTRO_API_URL || '',
      // Primary task metadata (for backward compatibility)
      MAESTRO_TASK_TITLE: primaryTask.title,
      MAESTRO_TASK_PRIORITY: primaryTask.priority || 'medium',
      // All tasks as JSON (for multi-task sessions)
      MAESTRO_ALL_TASKS: JSON.stringify(manifest.tasks),
    };

    // Add acceptance criteria as JSON for hooks to access
    if (primaryTask.acceptanceCriteria && primaryTask.acceptanceCriteria.length > 0) {
      env.MAESTRO_TASK_ACCEPTANCE = JSON.stringify(primaryTask.acceptanceCriteria);
    }

    // Add dependencies if present
    if (primaryTask.dependencies && primaryTask.dependencies.length > 0) {
      env.MAESTRO_TASK_DEPENDENCIES = JSON.stringify(primaryTask.dependencies);
    }

    return env as Record<string, string>;
  }

  /**
   * Get plugin directory for a mode
   *
   * @param mode - The agent mode (execute or coordinate)
   * @returns Path to plugin directory, or null if not found
   */
  getPluginDir(mode: 'execute' | 'coordinate'): string | null {
    try {
      // Get the maestro-cli root directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const cliRoot = join(__dirname, '../..');

      // Construct plugin directory path
      const pluginName = mode === 'execute' ? 'maestro-worker' : 'maestro-orchestrator';
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


    // Add max turns if specified
    if (manifest.session.maxTurns) {
      args.push('--max-turns', manifest.session.maxTurns.toString());
    }

    return args;
  }

  /**
   * Write prompt to temporary file
   *
   * @param prompt - The prompt content
   * @returns Path to the created file
   */
  async writePromptToFile(prompt: string): Promise<string> {
    const randomId = randomBytes(8).toString('hex');
    const fileName = `maestro-prompt-${randomId}.md`;
    const filePath = join(tmpdir(), fileName);

    await writeFile(filePath, prompt, 'utf-8');

    return filePath;
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
    // Split prompt into system (static) and task (dynamic) layers
    const renderer = new WhoamiRenderer();
    const permissions = getPermissionsFromManifest(manifest);
    const systemPrompt = renderer.renderSystemPrompt(manifest, permissions);
    const taskContext = await renderer.renderTaskContext(manifest, sessionId);

    // Prepare environment
    const env = {
      ...this.prepareEnvironment(manifest, sessionId),
      ...(options.env || {}),
    };

    // Build arguments (now async to load skills)
    const args = await this.buildClaudeArgs(manifest);

    // Static mode instructions + commands go into the system prompt
    args.push('--append-system-prompt', systemPrompt);

    // Dynamic task context goes as the user message
    // Append system prompt to initial prompt for debugging (full context visibility)
    const fullInitialPrompt = `${taskContext}\n\n<debug_system_prompt>\n${systemPrompt}\n</debug_system_prompt>`;
    args.push(fullInitialPrompt);

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
      } else {
        console.warn('Cannot send input: stdin is not available (using inherit mode) or process has ended');
      }
    };

    return {
      sessionId,
      promptFile: '', // No longer using a prompt file
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

  /**
   * Clean up temporary files
   *
   * @param promptFile - Path to prompt file to clean up
   */
  async cleanup(promptFile: string): Promise<void> {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(promptFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Default instance
 */
export const defaultSpawner = new ClaudeSpawner();
