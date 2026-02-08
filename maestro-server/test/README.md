# Maestro Server Test Suite

Comprehensive test suite for the Maestro Server REST API and WebSocket functionality.

## Test Coverage

### API Tests

**Projects API (`projects.test.ts`):**
- ✅ Create project
- ✅ List projects
- ✅ Get project by ID
- ✅ Update project
- ✅ Delete project
- ✅ Validation (missing name)
- ✅ Dependency checks (cannot delete project with tasks)

**Tasks API (`tasks.test.ts`):**
- ✅ Create task
- ✅ List tasks with filters (projectId, status, parentId)
- ✅ Get task by ID
- ✅ Update task (status, fields)
- ✅ Add timeline events
- ✅ Delete task
- ✅ Get child tasks
- ✅ Hierarchical tasks (parent-child relationships)
- ✅ Status transitions (pending → in_progress → completed)
- ✅ Automatic timestamp setting (startedAt, completedAt)

**Sessions API (`sessions.test.ts`):**
- ✅ Create session
- ✅ List sessions with filters (projectId, taskId, active)
- ✅ Get session by ID
- ✅ Update session
- ✅ Delete session
- ✅ Spawn session
- ✅ Add task to session (bidirectional)
- ✅ Remove task from session (bidirectional)
- ✅ Backward compatibility (taskId → taskIds)
- ✅ Task-session relationship maintenance

### WebSocket Tests (`websocket.test.ts`)

**Connection:**
- ✅ Establish WebSocket connection
- ✅ Multiple concurrent clients

**Project Events:**
- ✅ `project:created`
- ✅ `project:updated`
- ✅ `project:deleted`

**Task Events:**
- ✅ `task:created`
- ✅ `task:updated`
- ✅ `task:deleted`

**Session Events:**
- ✅ `session:created`
- ✅ `session:updated`
- ✅ `session:deleted`
- ✅ `session:spawn_request`

**Bidirectional Relationship Events:**
- ✅ `session:task_added` + `task:session_added`
- ✅ `session:task_removed` + `task:session_removed`

**Broadcasting:**
- ✅ Events broadcast to all connected clients

## Running Tests

### Prerequisites

Install dependencies:
```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test -- projects.test.ts
npm test -- tasks.test.ts
npm test -- sessions.test.ts
npm test -- websocket.test.ts
```

### Run Specific Test Suite

```bash
npm test -- --testNamePattern="Projects API"
npm test -- --testNamePattern="POST /api/projects"
```

## Test Structure

```
test/
├── README.md              # This file
├── helpers.ts             # Test utilities and helpers
├── projects.test.ts       # Projects API tests
├── tasks.test.ts          # Tasks API tests
├── sessions.test.ts       # Sessions API tests
├── websocket.test.ts      # WebSocket event tests
└── test-websocket.js      # Manual WebSocket test client
```

## Test Helpers

The `helpers.ts` file provides:

- `TestDataDir` - Isolated test data directory for each test
- `waitFor()` - Wait for async conditions
- `wait()` - Simple delay
- `createTestProject()` - Generate test project data
- `createTestTask()` - Generate test task data
- `createTestSession()` - Generate test session data

## Test Isolation

Each test:
- Uses an isolated data directory (`/tmp/maestro-test-{timestamp}`)
- Cleans up after itself
- Does not affect other tests or production data

## Coverage Report

After running `npm run test:coverage`, view the HTML coverage report:

```bash
open coverage/index.html
```

## Debugging Tests

### Enable Verbose Output

Tests run with `--verbose` by default (configured in jest.config.js).

### Debug Single Test

```bash
npm test -- --testNamePattern="should create a new project"
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## Writing New Tests

### Example Test Structure

```typescript
import request from 'supertest';
import express from 'express';
import Storage from '../src/storage';
import { TestDataDir, createTestProject } from './helpers';

describe('My Feature', () => {
  let app: express.Application;
  let storage: Storage;
  let testDataDir: TestDataDir;

  beforeEach(async () => {
    testDataDir = new TestDataDir();
    storage = new Storage(testDataDir.getPath());
    await new Promise(resolve => setTimeout(resolve, 100));

    app = express();
    app.use(express.json());

    const router = require('../src/api/myrouter')(storage);
    app.use('/api', router);
  });

  afterEach(async () => {
    await testDataDir.cleanup();
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toMatchObject({ ... });
  });
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Known Issues

None at this time.

## Future Enhancements

- [ ] Add performance tests (load testing)
- [ ] Add end-to-end tests (full workflows)
- [ ] Add mutation testing
- [ ] Add API contract tests
- [ ] Add stress tests for WebSocket broadcasting

---

**Test Suite Status:** ✅ Complete
**Last Updated:** February 2, 2026
