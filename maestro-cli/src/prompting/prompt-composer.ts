import type { MaestroManifest, AgentMode } from '../types/manifest.js';
import { PromptBuilder } from '../services/prompt-builder.js';
import { config } from '../config.js';
import { normalizeManifest } from './manifest-normalizer.js';
import { resolveCapabilitySet, type CapabilityFlags } from './capability-policy.js';
import { renderCommandSurface } from './command-surface-renderer.js';
import {
  REFERENCE_TASKS_INSTRUCTION,
  REFERENCE_TASKS_STEP_GET,
  REFERENCE_TASKS_STEP_DOCS,
} from '../prompts/index.js';

export interface PromptEnvelope {
  system: string;
  task: string;
  metadata: {
    mode: AgentMode;
    commandCount: number;
    capabilityFlags: CapabilityFlags;
  };
}

export interface PromptRuntimeContext {
  sessionId?: string;
}

export class PromptComposer {
  private readonly promptBuilder: PromptBuilder;

  constructor() {
    this.promptBuilder = new PromptBuilder();
  }

  compose(manifest: MaestroManifest, runtime: PromptRuntimeContext = {}): PromptEnvelope {
    const enforceIdentityContract = config.promptIdentityV2;
    const normalizedResult = normalizeManifest(manifest, {
      coordinatorSelfIdentityPolicy: enforceIdentityContract
        ? config.promptIdentityCardinalityPolicy
        : 'permissive',
    });
    if (enforceIdentityContract && normalizedResult.errors.length > 0) {
      throw new Error(`Manifest normalization failed: ${normalizedResult.errors.join(' | ')}`);
    }
    const normalized = normalizedResult.manifest;
    const capabilities = resolveCapabilitySet(normalized, {
      isMasterSession: normalized.isMaster || config.isMaster,
    });

    const compactCommandSurface = renderCommandSurface(normalized.mode, capabilities, { compact: true });
    const systemPrompt = this.injectSystemBlocks(
      this.promptBuilder.buildSystemXml(normalized),
      this.renderCapabilitySummary(capabilities.capabilities),
      this.wrapCommandsReference(compactCommandSurface),
    );

    const taskPrompt = this.injectTaskBlocks(
      this.promptBuilder.buildTaskXml(normalized),
      this.renderSessionContext(normalized, runtime.sessionId),
      this.renderReferenceTaskIds(normalized.referenceTaskIds || []),
    );

    return {
      system: systemPrompt,
      task: taskPrompt,
      metadata: {
        mode: normalized.mode,
        commandCount: capabilities.allowedCommands.length,
        capabilityFlags: capabilities.capabilities,
      },
    };
  }

  private injectSystemBlocks(systemXml: string, capabilityBlock: string, commandsBlock: string): string {
    return systemXml.replace(
      '</maestro_system_prompt>',
      `${capabilityBlock}\n${commandsBlock}\n</maestro_system_prompt>`,
    );
  }

  private injectTaskBlocks(taskXml: string, sessionContextBlock: string, referenceTasksBlock: string): string {
    // Ensure session context is injected exactly once from the composer runtime context.
    const taskWithoutSessionContext = taskXml.replace(/\s*<session_context>[\s\S]*?<\/session_context>/g, '');
    const additions = [sessionContextBlock, referenceTasksBlock].filter(Boolean).join('\n');

    if (!additions) {
      return taskWithoutSessionContext;
    }

    return taskWithoutSessionContext.replace(
      '</maestro_task_prompt>',
      `${additions}\n</maestro_task_prompt>`,
    );
  }

  private wrapCommandsReference(commandSurface: string): string {
    const lines = commandSurface.split('\n');
    const body = lines.map((line) => `    ${line}`).join('\n');
    return `  <commands_reference>\n${body}\n  </commands_reference>`;
  }

  private renderCapabilitySummary(flags: CapabilityFlags): string {
    const lines: string[] = ['  <capability_summary>'];

    const orderedKeys = Object.keys(flags)
      .filter((key) => Boolean(flags[key as keyof CapabilityFlags]))
      .sort();
    for (const key of orderedKeys) {
      lines.push(`    <capability name="${this.esc(key)}" enabled="true" />`);
    }

    lines.push('  </capability_summary>');
    return lines.join('\n');
  }

  private renderSessionContext(manifest: MaestroManifest, sessionId?: string): string {
    const lines: string[] = ['  <session_context>'];

    const resolvedSessionId = sessionId || process.env.MAESTRO_SESSION_ID;
    const projectId = manifest.tasks[0]?.projectId;

    if (resolvedSessionId) {
      lines.push(`    <session_id>${this.esc(resolvedSessionId)}</session_id>`);
    }
    if (projectId) {
      lines.push(`    <project_id>${this.esc(projectId)}</project_id>`);
    }
    lines.push(`    <mode>${this.esc(manifest.mode)}</mode>`);
    lines.push('  </session_context>');

    return lines.join('\n');
  }

  private renderReferenceTaskIds(referenceTaskIds: string[]): string {
    if (referenceTaskIds.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('  <reference_tasks>');
    lines.push(`    <instruction>${REFERENCE_TASKS_INSTRUCTION}</instruction>`);
    lines.push('    <steps>');
    lines.push(`      <step>${REFERENCE_TASKS_STEP_GET}</step>`);
    lines.push(`      <step>${REFERENCE_TASKS_STEP_DOCS}</step>`);
    lines.push('    </steps>');
    lines.push('    <task_ids>');

    for (const taskId of referenceTaskIds) {
      lines.push(`      <task_id>${this.esc(taskId)}</task_id>`);
    }

    lines.push('    </task_ids>');
    lines.push('  </reference_tasks>');

    return lines.join('\n');
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
