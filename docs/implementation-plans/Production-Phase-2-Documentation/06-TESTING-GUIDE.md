# Testing Guide

**Version:** 1.0
**Date:** 2026-02-01

---

## Testing Strategy

### Levels of Testing

1. **Unit Tests** - Individual components and functions
2. **Integration Tests** - Webhook + WebSocket flow
3. **End-to-End Tests** - Full user journey
4. **Manual Tests** - Visual verification

---

## Unit Tests

### Test Webhook Endpoint

**File:** `maestro-server/tests/webhooks.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, storage } from '../src/index';

describe('POST /api/webhooks/hook-event', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should accept valid SessionStart event', async () => {
    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        session_id: 'claude-123',
        hook_event_name: 'SessionStart',
        source: 'startup'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should accept valid PostToolUse event', async () => {
    // Create session and map
    const session = storage.createSession({
      projectId: 'p1',
      taskIds: ['t1'],
      name: 'Test'
    });
    storage.mapClaudeSession('claude-123', session.id);

    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        session_id: 'claude-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'test.ts' }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify tool metrics updated
    const metrics = storage.getToolMetrics(session.id);
    expect(metrics).toContainEqual({ tool: 'Read', uses: 1 });
  });

  it('should reject missing required fields', async () => {
    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        // Missing session_id and hook_event_name
        tool_name: 'Read'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(true);
  });

  it('should handle unknown sessions gracefully', async () => {
    const response = await request(app)
      .post('/api/webhooks/hook-event')
      .send({
        session_id: 'unknown-session',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read'
      });

    expect(response.status).toBe(200);
    expect(response.body.ignored).toBe(true);
  });
});
```

### Test Storage Methods

```typescript
describe('Storage hook methods', () => {
  it('should map Claude session to Maestro session', () => {
    storage.mapClaudeSession('claude-123', 's1');
    const session = storage.findSessionByClaudeId('claude-123');
    expect(session?.id).toBe('s1');
  });

  it('should track tool usage metrics', () => {
    storage.incrementToolUsage('s1', 'Read');
    storage.incrementToolUsage('s1', 'Read');
    storage.incrementToolUsage('s1', 'Write');

    const metrics = storage.getToolMetrics('s1');
    expect(metrics).toContainEqual({ tool: 'Read', uses: 2 });
    expect(metrics).toContainEqual({ tool: 'Write', uses: 1 });
  });

  it('should add timeline events to tasks', () => {
    const task = storage.createTask({
      projectId: 'p1',
      title: 'Test'
    });

    storage.addTaskTimelineEvent(task.id, {
      type: 'tool_use',
      message: 'Read file.ts',
      sessionId: 's1'
    });

    const updated = storage.getTask(task.id);
    expect(updated.timeline).toHaveLength(1);
    expect(updated.timeline[0].message).toBe('Read file.ts');
  });
});
```

---

## Integration Tests

### Test Webhook → WebSocket Flow

```typescript
import { WebSocket } from 'ws';

describe('Webhook to WebSocket integration', () => {
  let ws: WebSocket;

  beforeEach((done) => {
    ws = new WebSocket('ws://localhost:3000');
    ws.on('open', done);
  });

  afterEach(() => {
    ws.close();
  });

  it('should broadcast hook events to WebSocket clients', (done) => {
    // Create session
    const session = storage.createSession({
      projectId: 'p1',
      taskIds: ['t1'],
      name: 'Test'
    });
    storage.mapClaudeSession('claude-123', session.id);

    // Listen for WebSocket event
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.event === 'hook:tool_use') {
        expect(message.data.sessionId).toBe(session.id);
        expect(message.data.activity.tool).toBe('Read');
        done();
      }
    });

    // Send webhook request
    request(app)
      .post('/api/webhooks/hook-event')
      .send({
        session_id: 'claude-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: 'test.ts' }
      })
      .end();
  });
});
```

---

## End-to-End Tests

### Manual Test Flow

**Prerequisites:**
- Maestro server running
- UI running
- Claude Code installed

**Test Cases:**

#### Test 1: Session Lifecycle

1. Create task "Test hooks integration"
2. Spawn session for task
3. **Expected:** Session status → "🟢 Active"
4. **Expected:** Timeline shows "Session started"
5. In Claude session, run `/exit`
6. **Expected:** Session status → "✓ Completed"
7. **Expected:** Duration displayed

**Pass/Fail:** ✅ / ❌

---

#### Test 2: Real-Time Activity Feed

1. Create task "Test activity"
2. Spawn session
3. In Claude: "Read the package.json file"
4. **Expected:** Activity feed shows "Reading package.json" within 100ms
5. In Claude: "List all .ts files"
6. **Expected:** Activity feed shows "Executed: ls *.ts"
7. In Claude: "Create a test file"
8. **Expected:** Activity feed shows "Created test.txt"

**Pass/Fail:** ✅ / ❌

---

#### Test 3: Pending Action Badge

1. Create task "Test blocking"
2. Spawn session
3. In Claude: "Delete all node_modules"
4. **Expected:** "⚠️ Blocked" badge appears
5. **Expected:** Modal/message shows blocked operation
6. Approve or deny
7. **Expected:** Badge clears when resumed

**Pass/Fail:** ✅ / ❌

---

#### Test 4: Tool Usage Analytics

1. Create task "Test metrics"
2. Spawn session
3. In Claude: Perform various operations
   - Read 3 files
   - Write 2 files
   - Run 1 bash command
4. **Expected:** Tool usage chart shows:
   - Read: 3
   - Write: 2
   - Bash: 1

**Pass/Fail:** ✅ / ❌

---

#### Test 5: Error Handling

1. Create task "Test errors"
2. Spawn session
3. In Claude: "Run `npm test` (assuming tests fail)"
4. **Expected:** Error toast appears
5. **Expected:** Timeline shows "❌ npm test failed"
6. **Expected:** Error details available

**Pass/Fail:** ✅ / ❌

---

#### Test 6: Timeline Accuracy

1. Create task "Test timeline"
2. Spawn session
3. Perform sequence:
   - Read file A
   - Edit file B
   - Run command C
   - Read file D
4. **Expected:** Timeline shows all 4 events in order
5. **Expected:** Timestamps accurate
6. **Expected:** Session start/end events present

**Pass/Fail:** ✅ / ❌

---

## Performance Tests

### Latency Test

**Goal:** Verify hook events reach UI within 100ms

**Method:**
1. Add timestamp to hook script:
   ```bash
   echo "{\"client_timestamp\": $(date +%s%3N)}" | jq -s '.[0] * .[1]' - <(cat)
   ```
2. In UI, compare `client_timestamp` to `Date.now()`
3. Measure difference

**Success Criteria:** < 100ms average latency

---

### Load Test

**Goal:** Verify system handles rapid tool use

**Method:**
1. Spawn session
2. In Claude: Execute loop that triggers many tool calls rapidly
3. Monitor:
   - Server CPU/memory
   - WebSocket message queue
   - UI responsiveness

**Success Criteria:**
- Server handles 100+ events/second
- No dropped events
- UI remains responsive

---

## Regression Tests

After any changes, verify:

- [ ] All existing features still work
- [ ] No performance degradation
- [ ] No new console errors
- [ ] WebSocket connection stable
- [ ] No memory leaks

---

## Test Automation

### Run Unit Tests

```bash
cd maestro-server
npm test
```

### Run Integration Tests

```bash
npm run test:integration
```

### Run E2E Tests (Playwright)

```bash
cd ..
npm run test:e2e
```

---

## Debugging Tests

### Enable Verbose Logging

```bash
DEBUG=maestro:* npm test
```

### Run Single Test

```bash
npm test -- webhooks.test.ts
```

### View Coverage

```bash
npm run test:coverage
```

---

## Continuous Integration

### GitHub Actions Workflow

**.github/workflows/test.yml**

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd maestro-server && npm install
          cd .. && npm install
      
      - name: Run unit tests
        run: cd maestro-server && npm test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Check coverage
        run: cd maestro-server && npm run test:coverage
```

---

## Test Checklist

Before merging to main:

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual E2E tests completed
- [ ] Performance tests meet criteria
- [ ] No regressions found
- [ ] Test coverage > 80%
- [ ] CI pipeline green

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01

