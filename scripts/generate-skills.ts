import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SKILLS_DIR = join(homedir(), '.agents-ui', 'maestro-skills');

const maestroCliManifest = {
  name: 'maestro-cli',
  version: '1.0.0',
  description: 'Base CLI interface for interacting with the Maestro orchestration system',
  author: 'Maestro Team',
  type: 'system' as const,
  assignTo: ['all'],
  priority: 100,
  capabilities: [
    'task_management',
    'session_info',
    'subtask_management',
    'status_reporting'
  ],
  dependencies: [],
  config: {
    outputMode: 'auto',
    verbosity: 'normal'
  }
};

const maestroWorkerManifest = {
  name: 'maestro-worker',
  version: '1.0.0',
  description: 'Execution agent for implementing tasks assigned by the orchestrator',
  author: 'Maestro Team',
  type: 'role' as const,
  assignTo: ['worker'],
  priority: 50,
  capabilities: [
    'implementation',
    'testing',
    'debugging',
    'progress_reporting'
  ],
  dependencies: ['maestro-cli'],
  config: {
    autoStart: true,
    reportingInterval: 'frequent'
  }
};

const maestroOrchestratorManifest = {
  name: 'maestro-orchestrator',
  version: '1.0.0',
  description: 'Planning and delegation agent for managing project workflows',
  author: 'Maestro Team',
  type: 'role' as const,
  assignTo: ['orchestrator'],
  priority: 50,
  capabilities: [
    'planning',
    'decomposition',
    'delegation',
    'monitoring'
  ],
  dependencies: ['maestro-cli'],
  config: {
    delegationMode: 'spawn',
    monitoringEnabled: true
  }
};

// Read the skill instructions from files or embed them here
const skillsData = {
  'maestro-cli': {
    manifest: maestroCliManifest
  },
  'maestro-worker': {
    manifest: maestroWorkerManifest
  },
  'maestro-orchestrator': {
    manifest: maestroOrchestratorManifest
  }
};

// Create directories and manifests
for (const [name, data] of Object.entries(skillsData)) {
  const skillDir = join(SKILLS_DIR, name);
  mkdirSync(skillDir, { recursive: true });

  const manifestPath = join(skillDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(data.manifest, null, 2));
}
