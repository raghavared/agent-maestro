import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Test helper utilities
 */

export class TestDataDir {
  private testDir: string;

  constructor() {
    // Use a unique test directory for each test run
    this.testDir = path.join(os.tmpdir(), `maestro-test-${Date.now()}`);
  }

  getPath(): string {
    return this.testDir;
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Wait for a specific time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test project data
 */
export function createTestProject(overrides: any = {}) {
  return {
    name: 'Test Project',
    workingDir: '/tmp/test-project',
    description: 'Test project description',
    ...overrides
  };
}

/**
 * Create test task data
 */
export function createTestTask(projectId: string, overrides: any = {}) {
  return {
    projectId,
    title: 'Test Task',
    description: 'Test task description',
    priority: 'medium' as const,
    ...overrides
  };
}

/**
 * Create test session data
 */
export function createTestSession(projectId: string, taskIds: string[], overrides: any = {}) {
  return {
    projectId,
    taskIds,
    name: 'Test Session',
    metadata: {
      skills: ['test-skill']
    },
    ...overrides
  };
}
