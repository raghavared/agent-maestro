"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDataDir = void 0;
exports.waitFor = waitFor;
exports.wait = wait;
exports.createTestProject = createTestProject;
exports.createTestTask = createTestTask;
exports.createTestSession = createTestSession;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Test helper utilities
 */
class TestDataDir {
    constructor() {
        // Use a unique test directory for each test run
        this.testDir = path.join(os.tmpdir(), `maestro-test-${Date.now()}`);
    }
    getPath() {
        return this.testDir;
    }
    async cleanup() {
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
        }
        catch (err) {
            // Ignore cleanup errors
        }
    }
}
exports.TestDataDir = TestDataDir;
/**
 * Wait for a condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
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
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Create test project data
 */
function createTestProject(overrides = {}) {
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
function createTestTask(projectId, overrides = {}) {
    return {
        projectId,
        title: 'Test Task',
        description: 'Test task description',
        priority: 'medium',
        ...overrides
    };
}
/**
 * Create test session data
 */
function createTestSession(projectId, taskIds, overrides = {}) {
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
//# sourceMappingURL=helpers.js.map