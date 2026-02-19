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
const workerPluginDir = spawner.getPluginDir('worker');
const orchestratorPluginDir = spawner.getPluginDir('orchestrator');

// Test Claude arguments with hooks
const args = spawner.buildClaudeArgs(manifest);

// Test environment variables with hooks
const env = spawner.prepareEnvironment(manifest, 'test-session-123');

// Test without hooks
const manifestWithoutHooks = { ...manifest, enableHooks: false };
const argsNoHooks = spawner.buildClaudeArgs(manifestWithoutHooks);

const envNoHooks = spawner.prepareEnvironment(manifestWithoutHooks, 'test-session-456');
