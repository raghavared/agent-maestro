import { ClaudeSpawner } from '../src/services/claude-spawner.js';
import type { MaestroManifest } from '../src/types/manifest.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the example manifest
const manifestPath = join(__dirname, 'worker-with-hooks.json');
const manifest: MaestroManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Create spawner
const spawner = new ClaudeSpawner();

// Test plugin directory detection
console.log('\n=== Plugin Directory Detection ===');
const workerPluginDir = spawner.getPluginDir('worker');
const orchestratorPluginDir = spawner.getPluginDir('orchestrator');
console.log('Worker plugin dir:', workerPluginDir);
console.log('Orchestrator plugin dir:', orchestratorPluginDir);

// Test Claude arguments with hooks
console.log('\n=== Claude Arguments (with hooks) ===');
const args = spawner.buildClaudeArgs(manifest);
console.log('Args:', args.join(' '));

// Test environment variables with hooks
console.log('\n=== Environment Variables (with hooks) ===');
const env = spawner.prepareEnvironment(manifest, 'test-session-123');
console.log('MAESTRO_SESSION_ID:', env.MAESTRO_SESSION_ID);
console.log('MAESTRO_TASK_IDS:', env.MAESTRO_TASK_IDS);
console.log('MAESTRO_PROJECT_ID:', env.MAESTRO_PROJECT_ID);
console.log('MAESTRO_MODE:', env.MAESTRO_MODE);
console.log('MAESTRO_TASK_ACCEPTANCE:', env.MAESTRO_TASK_ACCEPTANCE);
console.log('MAESTRO_TASK_NOTES:', env.MAESTRO_TASK_NOTES);
console.log('MAESTRO_TASK_DEPENDENCIES:', env.MAESTRO_TASK_DEPENDENCIES);

// Test without hooks
console.log('\n=== Claude Arguments (without hooks) ===');
const manifestWithoutHooks = { ...manifest, enableHooks: false };
const argsNoHooks = spawner.buildClaudeArgs(manifestWithoutHooks);
console.log('Args:', argsNoHooks.join(' '));

console.log('\n=== Environment Variables (without hooks) ===');
const envNoHooks = spawner.prepareEnvironment(manifestWithoutHooks, 'test-session-456');
console.log('MAESTRO_SESSION_ID:', envNoHooks.MAESTRO_SESSION_ID);
console.log('MAESTRO_TASK_ACCEPTANCE:', envNoHooks.MAESTRO_TASK_ACCEPTANCE || '(not set)');
console.log('MAESTRO_TASK_NOTES:', envNoHooks.MAESTRO_TASK_NOTES || '(not set)');
console.log('MAESTRO_TASK_DEPENDENCIES:', envNoHooks.MAESTRO_TASK_DEPENDENCIES || '(not set)');

console.log('\n✅ Hooks integration test complete!\n');
