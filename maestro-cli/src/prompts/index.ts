/**
 * Maestro CLI Prompts
 *
 * Central location for all prompt strings, English text, and tokens
 * sent to AI agents or displayed to users. Organized by module:
 *
 * - identity:        Agent role/identity instructions
 * - workflow-phases:  Workflow phase instructions for all modes/strategies
 * - commands:         Command descriptions, syntax, and reference text
 * - reference-tasks:  Reference task fetch instructions
 * - errors:           Error messages and suggestions
 * - session-brief:    Session brief display labels
 * - spawner:          Agent-tool-specific prompt wrappers
 */

export * from './identity.js';
export * from './workflow-phases.js';
export * from './commands.js';
export * from './reference-tasks.js';
export * from './errors.js';
export * from './session-brief.js';
export * from './spawner.js';
