import { Command } from 'commander';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { readManifestFromEnv } from '../services/manifest-reader.js';
import { AgentSpawner } from '../services/agent-spawner.js';
import { config } from '../config.js';

const exec = promisify(execCallback);

/**
 * Check if a tmux session exists
 */
async function tmuxSessionExists(sessionName: string): Promise<boolean> {
  try {
    await exec(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a shared tmux session for multi-agent coordination
 */
async function createSharedSession(sessionName: string, opts: any) {
  try {
    // Check if session already exists
    const exists = await tmuxSessionExists(sessionName);
    if (exists) {
      console.log(`Tmux session '${sessionName}' already exists.`);
      console.log(`Use: tmux attach-session -t ${sessionName}`);
      return;
    }

    // Create new detached session
    const { stdout } = await exec(`tmux new-session -d -s ${sessionName} -P -F '#{session_name}'`);
    const createdSession = stdout.trim();

    console.log(`Created tmux session: ${createdSession}`);
    console.log(`\nTo attach to this session, run:`);
    console.log(`  tmux attach-session -t ${createdSession}`);
    console.log(`\nTo spawn agents in this session, use:`);
    console.log(`  maestro coordinate spawn-pane --session ${createdSession}`);
  } catch (error: any) {
    console.error('Failed to create tmux session:', error.message);
    process.exit(1);
  }
}

/**
 * Spawn an agent in a new tmux pane
 */
async function spawnInPane(opts: any) {
  try {
    const sessionName = opts.session;
    if (!sessionName) {
      console.error('Error: --session is required');
      process.exit(1);
    }

    // Check if session exists
    const exists = await tmuxSessionExists(sessionName);
    if (!exists) {
      console.error(`Error: Tmux session '${sessionName}' does not exist.`);
      console.log(`Create it first with: maestro coordinate shared-session ${sessionName}`);
      process.exit(1);
    }

    // Read manifest
    const manifestResult = await readManifestFromEnv();
    if (!manifestResult.success || !manifestResult.manifest) {
      console.error('Error: No manifest available. This command must be run from within a Maestro session.');
      process.exit(1);
    }

    const manifest = manifestResult.manifest;

    // Create a new pane
    const splitDirection = opts.vertical ? '-v' : '-h';
    const { stdout } = await exec(`tmux split-window ${splitDirection} -t ${sessionName} -P -F '#{pane_id}'`);
    const paneId = stdout.trim();

    console.log(`Created new pane: ${paneId}`);

    // Spawn agent in the new pane
    const spawner = new AgentSpawner();
    const sessionId = spawner.generateSessionId();

    await spawner.spawn(manifest, sessionId, {
      tmuxSession: sessionName,
      tmuxPane: paneId,
      cwd: opts.cwd || manifest.session.workingDirectory || process.cwd(),
    });

    console.log(`Spawned agent in pane ${paneId}`);
    console.log(`Session ID: ${sessionId}`);
  } catch (error: any) {
    console.error('Failed to spawn agent in pane:', error.message);
    process.exit(1);
  }
}

/**
 * Register coordinate commands for multi-agent coordination
 */
export function registerCoordinateCommands(program: Command) {
  const coordinate = program
    .command('coordinate')
    .description('Multi-agent coordination commands for tmux');

  // shared-session subcommand
  coordinate
    .command('shared-session <session-name>')
    .description('Create a shared tmux session for multi-agent coordination')
    .action(async (sessionName: string, cmdOpts: any) => {
      await createSharedSession(sessionName, cmdOpts);
    });

  // spawn-pane subcommand
  coordinate
    .command('spawn-pane')
    .description('Spawn an agent in a new tmux pane')
    .option('-s, --session <name>', 'Tmux session name (required)')
    .option('-v, --vertical', 'Split vertically instead of horizontally')
    .option('--cwd <path>', 'Working directory for the agent')
    .action(async (cmdOpts: any) => {
      await spawnInPane(cmdOpts);
    });
}
