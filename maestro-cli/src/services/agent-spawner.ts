import type { MaestroManifest, AgentTool } from '../types/manifest.js';
import { ClaudeSpawner, type SpawnResult, type SpawnOptions } from './claude-spawner.js';
import { CodexSpawner } from './codex-spawner.js';
import { GeminiSpawner } from './gemini-spawner.js';
import { randomBytes } from 'crypto';

/**
 * Common spawner interface that both ClaudeSpawner and CodexSpawner implement
 */
export interface IAgentSpawner {
  spawn(manifest: MaestroManifest, sessionId: string, options?: SpawnOptions): Promise<SpawnResult>;
  prepareEnvironment(manifest: MaestroManifest, sessionId: string): Record<string, string>;
  generateSessionId(): string;
}

// Re-export shared environment preparation utility
export { prepareSpawnerEnvironment } from './spawner-env.js';

/**
 * AgentSpawner - Factory that creates the appropriate spawner based on the manifest's agentTool
 *
 * Defaults to ClaudeSpawner when agentTool is not specified.
 */
export class AgentSpawner implements IAgentSpawner {
  private claudeSpawner: ClaudeSpawner;
  private codexSpawner: CodexSpawner;
  private geminiSpawner: GeminiSpawner;

  constructor() {
    this.claudeSpawner = new ClaudeSpawner();
    this.codexSpawner = new CodexSpawner();
    this.geminiSpawner = new GeminiSpawner();
  }

  /**
   * Get the appropriate spawner for a manifest
   */
  private getSpawner(manifest: MaestroManifest): ClaudeSpawner | CodexSpawner | GeminiSpawner {
    const agentTool = manifest.agentTool || 'claude-code';

    switch (agentTool) {
      case 'codex':
        return this.codexSpawner;
      case 'gemini':
        return this.geminiSpawner;
      case 'claude-code':
      default:
        return this.claudeSpawner;
    }
  }

  /**
   * Get the display name for the agent tool
   */
  static getToolDisplayName(agentTool?: AgentTool): string {
    switch (agentTool) {
      case 'codex':
        return 'OpenAI Codex';
      case 'gemini':
        return 'Google Gemini';
      case 'claude-code':
      default:
        return 'Claude Code';
    }
  }

  /**
   * Spawn an agent session using the appropriate tool
   */
  async spawn(
    manifest: MaestroManifest,
    sessionId: string,
    options: SpawnOptions = {}
  ): Promise<SpawnResult> {
    const spawner = this.getSpawner(manifest);
    return spawner.spawn(manifest, sessionId, options);
  }

  /**
   * Prepare environment variables
   */
  prepareEnvironment(
    manifest: MaestroManifest,
    sessionId: string
  ): Record<string, string> {
    const spawner = this.getSpawner(manifest);
    return spawner.prepareEnvironment(manifest, sessionId);
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `session-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }
}

/**
 * Default instance
 */
export const defaultAgentSpawner = new AgentSpawner();
