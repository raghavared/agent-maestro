/**
 * Test helper utilities
 */
export declare class TestDataDir {
    private testDir;
    constructor();
    getPath(): string;
    cleanup(): Promise<void>;
}
/**
 * Wait for a condition to be true
 */
export declare function waitFor(condition: () => boolean | Promise<boolean>, timeout?: number, interval?: number): Promise<void>;
/**
 * Wait for a specific time
 */
export declare function wait(ms: number): Promise<void>;
/**
 * Create test project data
 */
export declare function createTestProject(overrides?: any): any;
/**
 * Create test task data
 */
export declare function createTestTask(projectId: string, overrides?: any): any;
/**
 * Create test session data
 */
export declare function createTestSession(projectId: string, taskIds: string[], overrides?: any): any;
//# sourceMappingURL=helpers.d.ts.map