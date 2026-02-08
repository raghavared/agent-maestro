# Medium Priority Issues - Maestro Server

**Priority:** 🟡 MEDIUM
**Risk Level:** CODE QUALITY, MAINTAINABILITY, OBSERVABILITY
**Action Required:** Fix before team scaling and production operations

---

## Overview

These issues don't immediately threaten security or data integrity, but significantly impact:
- Development velocity
- Debugging efficiency
- Operational excellence
- Team scalability
- Long-term maintainability

**Required before:** Team growth, production operations, long-term maintenance

---

## MEDIUM-01: No Logging Framework 🟡

### Severity: MEDIUM
**Impact:** Poor debugging, no audit trail, compliance gaps
**Current State:** `console.log` only

### Problem

```typescript
// src/storage.ts - Basic console.log
console.log(`Loaded ${this.projects.size} projects`);
console.log(`Loaded ${this.tasks.size} tasks`);

// src/server.ts
console.log('🚀 Maestro Server running on http://localhost:${PORT}');

// src/websocket.ts
console.log('✅ WebSocket client connected. Total clients:', clients.size + 1);
```

**Missing:**
- No log levels (DEBUG, INFO, WARN, ERROR)
- No structured logging (JSON format)
- No log rotation
- No log aggregation
- No correlation IDs
- No context tracking

### Impact

- **Debugging:** Hard to filter relevant logs
- **Production:** Cannot change log level without restart
- **Compliance:** No audit trail for GDPR/SOC2
- **Monitoring:** Cannot parse logs programmatically

### Recommended Solution

```typescript
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'maestro-server' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Use throughout codebase
logger.info('Server started', { port: PORT });
logger.error('Failed to save data', { error: err.message, stack: err.stack });
logger.debug('Task created', { taskId: task.id, projectId: task.projectId });
```

**Fix Time:** 2-3 days

---

## MEDIUM-02: No Metrics/Monitoring 🟡

### Severity: MEDIUM
**Impact:** No visibility into system health, performance, usage
**Current State:** No metrics collection

### Problem

**No visibility into:**
- Request count/rate
- Response times (p50, p95, p99)
- Error rates
- Memory usage trends
- WebSocket connection count
- File system usage
- Task/session counts over time

### Impact

- **Performance:** Cannot identify bottlenecks
- **Capacity Planning:** Don't know when to scale
- **SLA:** Cannot measure uptime/reliability
- **Alerting:** No proactive issue detection

### Recommended Solution

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const tasksTotal = new Gauge({
  name: 'maestro_tasks_total',
  help: 'Total number of tasks',
  labelNames: ['status']
});

const websocketConnections = new Gauge({
  name: 'websocket_connections',
  help: 'Number of active WebSocket connections'
});

// Middleware to track requests
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, req.route?.path || req.path, res.statusCode).inc();
  });

  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Update task metrics periodically
setInterval(() => {
  const tasks = storage.listTasks();
  tasksTotal.labels('pending').set(tasks.filter(t => t.status === 'pending').length);
  tasksTotal.labels('in_progress').set(tasks.filter(t => t.status === 'in_progress').length);
  tasksTotal.labels('completed').set(tasks.filter(t => t.status === 'completed').length);
}, 10000);
```

**Fix Time:** 2-3 days setup + ongoing

---

## MEDIUM-03: Zero Test Coverage 🟡

### Severity: MEDIUM
**Impact:** Regression bugs, low confidence in changes, slow development
**Current State:** No tests

### Problem

```bash
maestro-server/
├── src/
│   └── ...
└── test/
    └── (empty directory)
```

**No tests for:**
- API endpoints
- Storage layer
- WebSocket events
- Error handling
- Edge cases

### Impact

- **Regressions:** Changes break existing features
- **Refactoring:** Afraid to change code
- **Onboarding:** New devs break things
- **Documentation:** Code behavior unclear

### Recommended Solution

```typescript
// test/api/tasks.test.ts
import request from 'supertest';
import { app, storage } from '../src/server';

describe('Tasks API', () => {
  beforeEach(async () => {
    await storage.clear(); // Clear test data
  });

  describe('POST /api/tasks', () => {
    it('creates a task with valid data', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          projectId: 'proj_123',
          title: 'Test Task',
          priority: 'high'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        projectId: 'proj_123',
        title: 'Test Task',
        priority: 'high',
        status: 'pending'
      });
      expect(response.body.id).toMatch(/^task_/);
    });

    it('returns 400 for missing title', async () => {
      await request(app)
        .post('/api/tasks')
        .send({
          projectId: 'proj_123'
        })
        .expect(400);
    });

    it('returns 400 for missing projectId', async () => {
      await request(app)
        .post('/api/tasks')
        .send({
          title: 'Test Task'
        })
        .expect(400);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns task by ID', async () => {
      const task = await storage.createTask({
        projectId: 'proj_123',
        title: 'Test Task'
      });

      const response = await request(app)
        .get(`/api/tasks/${task.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: task.id,
        title: 'Test Task'
      });
    });

    it('returns 404 for non-existent task', async () => {
      await request(app)
        .get('/api/tasks/task_nonexistent')
        .expect(404);
    });
  });
});
```

**Coverage Goals:**
- Unit tests: 80%+ coverage
- Integration tests: All API endpoints
- E2E tests: Critical workflows (session spawn)

**Fix Time:** 3-4 weeks (ongoing)

---

## MEDIUM-04: No CI/CD Pipeline 🟡

### Severity: MEDIUM
**Impact:** Manual deployment, no automated testing, slow releases
**Current State:** Manual `npm run build && npm start`

### Problem

**Missing:**
- Automated testing on PR
- Automated builds
- Automated deployments
- Code quality checks
- Security scanning
- Dependency updates

### Impact

- **Bugs:** Broken code reaches production
- **Slow Releases:** Manual process is tedious
- **Human Error:** Forgot to run tests
- **Security:** Vulnerabilities not caught

### Recommended Solution

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

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
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run tests
        run: npm test

      - name: Check coverage
        run: npm run test:coverage

      - name: Build
        run: npm run build

  security:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Run security audit
        run: npm audit

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

**Fix Time:** 1-2 days setup

---

## MEDIUM-05: No API Versioning 🟡

### Severity: MEDIUM
**Impact:** Breaking changes break clients
**Current State:** No version in URLs

### Problem

```typescript
// src/server.ts - No versioning
app.use('/api', tasksRouter);  // ⚠️ No version

// If we change response format, all clients break
```

### Impact

- **Breaking Changes:** Cannot evolve API
- **Client Updates:** Must update all clients simultaneously
- **Backward Compatibility:** Cannot maintain old versions

### Recommended Solution

```typescript
// Version in URL
app.use('/api/v1', tasksRouter);
app.use('/api/v2', tasksRouterV2); // New version

// Or version in header
app.use('/api', (req, res, next) => {
  const version = req.headers['api-version'] || '1';

  if (version === '1') {
    return tasksRouterV1(req, res, next);
  } else if (version === '2') {
    return tasksRouterV2(req, res, next);
  } else {
    return res.status(400).json({ error: 'Unsupported API version' });
  }
});
```

**Fix Time:** 1 day

---

## Additional Medium Priority Issues

### MEDIUM-06: No WebSocket Compression 🟡
**Impact:** High bandwidth usage
**Fix:** Enable permessage-deflate extension
**Time:** 1 hour

### MEDIUM-07: No Hot Reload for Skills 🟡
**Impact:** Must restart server to update skills
**Fix:** Watch skill directory for changes
**Time:** 1-2 days

### MEDIUM-08: Minimal Skills Validation 🟡
**Impact:** Broken skills crash server
**Fix:** Validate manifest.json schema
**Time:** 1 day

### MEDIUM-09: No Error Tracking Service 🟡
**Impact:** Errors go unnoticed
**Fix:** Integrate Sentry
**Time:** 1 day

### MEDIUM-10: No Request ID Tracking 🟡
**Impact:** Cannot trace request across logs
**Fix:** Add correlation ID middleware
**Time:** 1 day

### MEDIUM-11: No Graceful Degradation 🟡
**Impact:** Hard failures instead of degraded service
**Fix:** Circuit breakers, fallbacks
**Time:** 3-5 days

### MEDIUM-12: No Feature Flags 🟡
**Impact:** Cannot toggle features without deploy
**Fix:** Add feature flag service
**Time:** 2-3 days

### MEDIUM-13: No Environment Config Management 🟡
**Impact:** Hard-coded values, no secrets management
**Fix:** Use dotenv + secrets manager
**Time:** 1-2 days

### MEDIUM-14: No Performance Profiling 🟡
**Impact:** Cannot identify slow code
**Fix:** Add profiling endpoints
**Time:** 1 day

### MEDIUM-15: No Documentation Generation 🟡
**Impact:** API docs get out of sync
**Fix:** OpenAPI/Swagger spec + generation
**Time:** 2-3 days

---

## Summary Table

| ID | Issue | Impact | Fix Time | Value |
|----|-------|--------|----------|-------|
| MED-01 | No Logging Framework | Poor debugging | 2-3 days | High |
| MED-02 | No Metrics | No visibility | 2-3 days | High |
| MED-03 | No Tests | Regressions | 3-4 weeks | High |
| MED-04 | No CI/CD | Manual process | 1-2 days | High |
| MED-05 | No API Versioning | Breaking changes | 1 day | Medium |
| MED-06 | No WS Compression | High bandwidth | 1 hour | Low |
| MED-07 | No Hot Reload | Restart required | 1-2 days | Low |
| MED-08 | No Skill Validation | Crashes | 1 day | Medium |
| MED-09 | No Error Tracking | Silent failures | 1 day | High |
| MED-10 | No Request IDs | Hard to trace | 1 day | Medium |
| MED-11 | No Graceful Degradation | Hard failures | 3-5 days | Medium |
| MED-12 | No Feature Flags | Deploy for toggles | 2-3 days | Low |
| MED-13 | No Config Mgmt | Hard-coded values | 1-2 days | Medium |
| MED-14 | No Profiling | Cannot optimize | 1 day | Low |
| MED-15 | No Doc Generation | Stale docs | 2-3 days | Low |

**Total Fix Time:** ~6-8 weeks with 1 engineer

---

## Quick Wins (< 1 day each)

Priority order for quick improvements:

1. **MED-06: WebSocket Compression** (1 hour)
2. **MED-05: API Versioning** (1 day)
3. **MED-08: Skill Validation** (1 day)
4. **MED-09: Error Tracking** (1 day)
5. **MED-10: Request ID Tracking** (1 day)
6. **MED-14: Performance Profiling** (1 day)

**Total:** ~5 days for significant improvements

---

## Long-Term Investments

Worth the time investment:

1. **MED-03: Test Suite** - Pays dividends in velocity
2. **MED-01: Logging Framework** - Essential for production
3. **MED-02: Metrics/Monitoring** - Essential for operations
4. **MED-04: CI/CD Pipeline** - Speeds up development

---

**Next:** [04-SECURITY-REVIEW.md](./04-SECURITY-REVIEW.md)
