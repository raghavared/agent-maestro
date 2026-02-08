# Testing Strategy

## Overview

Comprehensive testing approach covering unit, integration, and E2E tests with CI/CD pipeline.

**Goal:** Achieve 80%+ test coverage and catch regressions early.

**Estimated Effort:** 10-12 hours

---

## Test Pyramid

```
       /\
      /  \      E2E Tests (10%)
     /    \     - Full orchestration flow
    /------\    - Multi-client sync
   /        \
  /  Integration (30%)
 /    - API endpoints
/      - WebSocket events
--------------------------
    Unit Tests (60%)
    - Validation logic
    - Error handling
    - Business logic
```

---

## Unit Tests (4 hours)

### CLI Validation

**File:** `maestro-cli/tests/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateTaskId, validateStatus } from '../src/utils/validation';

describe('Validation', () => {
  it('should validate task IDs', () => {
    expect(validateTaskId('t123', [])).toBe('t123');
    expect(() => validateTaskId('invalid!', [])).toThrow();
  });

  it('should use context when ID missing', () => {
    expect(validateTaskId(undefined, ['t1'])).toBe('t1');
  });
});
```

### Database Operations

**File:** `maestro-server/tests/db.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';

describe('Database', () => {
  beforeEach(() => {
    db.tasks.clear();
  });

  it('should add subtask to task', () => {
    const task = db.createTask({ title: 'Test', projectId: 'p1' });
    const subtask = db.addSubtask(task.id, { title: 'Subtask 1' });

    expect(subtask.taskId).toBe(task.id);
    expect(task.subtasks).toHaveLength(1);
  });
});
```

---

## Integration Tests (4 hours)

### API Endpoints

**File:** `maestro-server/tests/api.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('Tasks API', () => {
  it('should create a task', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test Task', projectId: 'p1' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test Task');
  });

  it('should list tasks', async () => {
    const response = await request(app).get('/api/tasks?projectId=p1');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

### WebSocket Events

**File:** `maestro-server/tests/websocket.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';

describe('WebSocket Events', () => {
  let ws: WebSocket;

  beforeAll((done) => {
    ws = new WebSocket('ws://localhost:3000');
    ws.on('open', done);
  });

  afterAll(() => {
    ws.close();
  });

  it('should receive task:created event', (done) => {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'task:created') {
        expect(message.data).toHaveProperty('id');
        done();
      }
    });

    // Trigger event by creating a task
    fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', projectId: 'p1' })
    });
  });
});
```

---

## E2E Tests (4 hours)

### Full Orchestration Flow

**File:** `tests/e2e/orchestration.spec.ts` (using Playwright or Cypress)

```typescript
import { test, expect } from '@playwright/test';

test('full orchestration workflow', async ({ page }) => {
  // 1. Open Maestro UI
  await page.goto('http://localhost:5173');

  // 2. Create a task via UI
  await page.click('button:has-text("Create Task")');
  await page.fill('input[name="title"]', 'Test Orchestration');
  await page.click('button:has-text("Create")');

  // 3. Verify task appears in list
  await expect(page.locator('text=Test Orchestration')).toBeVisible();

  // 4. Use CLI to spawn worker (via terminal automation)
  // ... (This requires terminal automation or mocking)

  // 5. Verify worker session appears in UI
  // ...

  // 6. Complete task via CLI
  // ...

  // 7. Verify task marked complete in UI
  await expect(page.locator('.task-status:has-text("completed")')).toBeVisible();
});
```

---

## CI/CD Setup (2 hours)

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          npm install
          cd maestro-server && npm install
          cd ../maestro-cli && npm install

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: cd maestro-server && npm test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Build
        run: npm run build
```

---

## Coverage Configuration

**File:** `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
```

---

## Test Checklist

### Unit Tests
- [ ] CLI validation functions
- [ ] CLI error handling
- [ ] Database operations (CRUD)
- [ ] Skill loader functions

### Integration Tests
- [ ] Task API endpoints (CRUD)
- [ ] Session API endpoints
- [ ] Subtask API endpoints
- [ ] WebSocket event broadcasting

### E2E Tests
- [ ] Full task lifecycle (create → assign → complete)
- [ ] Multi-client synchronization
- [ ] Session spawning workflow
- [ ] WebSocket reconnection

### CI/CD
- [ ] GitHub Actions workflow configured
- [ ] Tests run on PRs
- [ ] Coverage reporting enabled
- [ ] Build verification

---

**Implementation Status:** 📋 Ready to Implement
**Dependencies:** All modules (should be implemented last)
**Enables:** Confidence in code quality, Catch regressions early
