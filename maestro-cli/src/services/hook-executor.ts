import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Result of executing a hook
 */
export interface HookResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

/**
 * Options for executing hooks
 */
export interface HookOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Stop executing remaining hooks if one fails */
  stopOnError?: boolean;
}

/**
 * HookExecutor - Executes shell commands (hooks) at lifecycle points
 *
 * Supports pre-init and post-exit hooks from skills.
 */
export class HookExecutor {
  /**
   * Execute a single hook command
   *
   * @param command - Shell command to execute
   * @param options - Execution options
   * @returns Hook execution result
   */
  async executeHook(command: string, options: HookOptions = {}): Promise<HookResult> {
    // Handle empty command
    if (!command || command.trim() === '') {
      return {
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      };
    }

    try {
      const execOptions: any = {
        shell: '/bin/bash',
        env: {
          ...process.env,
          ...(options.env || {}),
        },
      };

      if (options.cwd) {
        execOptions.cwd = options.cwd;
      }

      if (options.timeout) {
        execOptions.timeout = options.timeout;
      }

      const { stdout, stderr } = await execAsync(command, execOptions);

      return {
        success: true,
        exitCode: 0,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
      };
    } catch (error: any) {
      // Command failed or timed out
      const exitCode = error.code || error.signal || 1;
      const isTimeout = error.killed && error.signal === 'SIGTERM';

      return {
        success: false,
        exitCode: typeof exitCode === 'number' ? exitCode : 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        error: isTimeout
          ? 'Command execution timeout'
          : error.message || 'Command execution failed',
      };
    }
  }

  /**
   * Execute multiple hooks in sequence
   *
   * @param commands - Array of shell commands to execute
   * @param options - Execution options
   * @returns Array of hook execution results
   */
  async executeHooks(
    commands: string[],
    options: HookOptions = {}
  ): Promise<HookResult[]> {
    const results: HookResult[] = [];

    for (const command of commands) {
      const result = await this.executeHook(command, options);
      results.push(result);

      // Stop on first error if requested
      if (options.stopOnError && !result.success) {
        break;
      }
    }

    return results;
  }


  /**
   * Check if any hooks failed
   *
   * @param results - Array of hook results
   * @returns true if any hook failed
   */
  hasFailures(results: HookResult[]): boolean {
    return results.some(result => !result.success);
  }

  /**
   * Get all failed hooks from results
   *
   * @param results - Array of hook results
   * @returns Array of failed hook results
   */
  getFailures(results: HookResult[]): HookResult[] {
    return results.filter(result => !result.success);
  }
}

/**
 * Default instance
 */
export const defaultHookExecutor = new HookExecutor();
