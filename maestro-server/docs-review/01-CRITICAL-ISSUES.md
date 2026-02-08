# Critical Issues - Maestro Server

**Priority:** 🔴 CRITICAL
**Risk Level:** SYSTEM COMPROMISE, DATA LOSS
**Action Required:** FIX IMMEDIATELY before any production deployment

---

## Overview

These issues represent **existential threats** to system security and data integrity. Any ONE of these could result in:
- Complete system compromise
- Total data loss
- Security breaches
- Legal liability

**⚠️ DO NOT deploy to production until ALL critical issues are resolved.**

---

## CRITICAL-01: No Authentication 🔴

### Severity: CRITICAL
**Impact:** Anyone can access the server
**Exploitability:** Trivial
**Data at Risk:** ALL

### Problem

```typescript
// src/server.ts - NO authentication middleware
app.use(cors());
app.use(express.json());
// Routes are wide open ⚠️
app.use('/api', tasksRouter);
```

**Current State:**
- No user login
- No password checking
- No token validation
- No session management
- Anyone on network can access ALL data

### Attack Scenario

```bash
# Attacker on same network
curl http://localhost:3000/api/projects
# Gets ALL projects from ALL users

curl -X DELETE http://localhost:3000/api/projects/proj_123
# Deletes any project without authentication

curl -X POST http://localhost:3000/api/sessions/spawn \
  -d '{"projectId":"proj_123","taskIds":["task_001"]}'
# Spawns sessions on victim's machine
```

### Impact

- **Confidentiality:** 100% breach (all data accessible)
- **Integrity:** 100% compromise (can modify/delete anything)
- **Availability:** 100% risk (can delete everything)

### Evidence in Code

**No auth middleware anywhere:**
- `src/server.ts:19-21` - No auth before routes
- `src/api/*.ts` - No auth checks in any endpoint
- `src/websocket.ts:7` - WebSocket connections unauthenticated

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 1 week

### Recommended Solution

```typescript
// Add JWT authentication
import jwt from 'jsonwebtoken';

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Apply to all API routes
app.use('/api', requireAuth, tasksRouter);
```

### Testing

```bash
# Before fix - succeeds (BAD)
curl http://localhost:3000/api/projects

# After fix - fails with 401 (GOOD)
curl http://localhost:3000/api/projects
# Returns: {"error": "No token provided"}

# With token - succeeds (GOOD)
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/projects
```

---

## CRITICAL-02: No Authorization 🔴

### Severity: CRITICAL
**Impact:** Users can access/modify other users' data
**Exploitability:** Trivial
**Data at Risk:** ALL cross-user data

### Problem

Even IF authentication were added, there's no authorization:

```typescript
// src/api/projects.ts - No ownership checking
router.delete('/projects/:id', async (req: Request, res: Response) => {
  const result = storage.deleteProject(req.params.id);
  // ⚠️ No check if this user owns the project!
  res.json(result);
});
```

**Current State:**
- No concept of "owner"
- No permission checking
- Any authenticated user can access ANY data
- Horizontal privilege escalation trivial

### Attack Scenario

```bash
# User Alice (alice@example.com) authenticates
# Gets token: eyJhbGci...

# Alice gets her projects
curl -H "Authorization: Bearer <alice-token>" \
  http://localhost:3000/api/projects
# Returns: [{"id": "proj_alice_001", ...}, ...]

# Alice ALSO gets Bob's projects (BAD!)
curl -H "Authorization: Bearer <alice-token>" \
  http://localhost:3000/api/projects
# Returns ALL projects, including Bob's

# Alice deletes Bob's project (BAD!)
curl -X DELETE -H "Authorization: Bearer <alice-token>" \
  http://localhost:3000/api/projects/proj_bob_123
# Succeeds - Bob's data is deleted
```

### Impact

- **Multi-tenancy:** Impossible (users see each other's data)
- **Privacy:** None (no data isolation)
- **Compliance:** GDPR/HIPAA violations

### Evidence in Code

**No authorization checks:**
- `src/api/projects.ts` - No owner field or checks
- `src/api/tasks.ts` - No task ownership validation
- `src/api/sessions.ts` - No session ownership validation
- `src/types.ts` - No userId field in any entity

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 1 week

### Recommended Solution

```typescript
// Update types to include ownership
interface Project {
  id: string;
  userId: string;  // ← Add this
  name: string;
  // ...
}

// Authorization middleware
function requireOwnership(req: Request, res: Response, next: NextFunction) {
  const entity = storage.getProject(req.params.id);

  if (!entity) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (entity.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

// Apply to routes
router.delete('/projects/:id', requireAuth, requireOwnership, async (req, res) => {
  const result = storage.deleteProject(req.params.id);
  res.json(result);
});

// Filter lists by user
router.get('/projects', requireAuth, async (req, res) => {
  const projects = storage.listProjects()
    .filter(p => p.userId === req.user.id);  // ← Add this
  res.json(projects);
});
```

---

## CRITICAL-03: No Input Validation 🔴

### Severity: CRITICAL
**Impact:** Injection attacks, data corruption
**Exploitability:** Easy
**Data at Risk:** ALL

### Problem

```typescript
// src/api/tasks.ts - No validation
router.post('/tasks', async (req: Request, res: Response) => {
  // ⚠️ req.body is used directly without validation
  const task = storage.createTask(req.body);
  res.status(201).json(task);
});
```

**Current State:**
- No input sanitization
- No type checking
- No length limits
- No format validation
- Direct use of user input

### Attack Scenarios

**1. Path Traversal:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Hack","workingDir":"../../../../etc/passwd"}'
# Could read sensitive files when project is used
```

**2. Command Injection:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj_123","title":""; rm -rf /; echo "'}'
# If title is ever used in shell command, this executes
```

**3. JSON Injection:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj_123","title":"Hack","status":"completed","completedAt":9999999999999}'
# Bypass business logic by setting internal fields
```

**4. Buffer Overflow:**
```bash
# Send 10MB title
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"proj_123\",\"title\":\"$(python3 -c 'print(\"A\"*10000000)')\"}"
# Could crash server or cause OOM
```

### Impact

- **Code Injection:** Possible if fields used in shell commands
- **Data Corruption:** Invalid data stored to disk
- **DoS:** Large inputs crash server
- **Logic Bypass:** Set internal fields directly

### Evidence in Code

**No validation anywhere:**
- `src/api/projects.ts:22-32` - No validation on create
- `src/api/tasks.ts:32-59` - Minimal validation (only required fields)
- `src/api/sessions.ts:8-28` - No validation on session create
- `src/api/subtasks.ts:9-48` - No validation on subtask

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 3-5 days

### Recommended Solution

```typescript
import { z } from 'zod';

// Define validation schemas
const CreateTaskSchema = z.object({
  projectId: z.string().regex(/^proj_\d+_[a-z0-9]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  // Explicitly deny internal fields
  id: z.undefined(),
  createdAt: z.undefined(),
  sessionIds: z.undefined(),
  status: z.undefined()
});

// Validation middleware
function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors
        });
      }
      next(err);
    }
  };
}

// Apply to routes
router.post('/tasks', validateBody(CreateTaskSchema), async (req, res) => {
  const task = storage.createTask(req.body);
  res.status(201).json(task);
});
```

---

## CRITICAL-04: No Rate Limiting 🔴

### Severity: CRITICAL
**Impact:** Denial of Service attacks
**Exploitability:** Trivial
**Data at Risk:** Service availability

### Problem

```typescript
// src/server.ts - No rate limiting
app.use(cors());
app.use(express.json());
// ⚠️ Unlimited requests allowed
```

### Attack Scenario

```bash
# Flood server with requests
while true; do
  curl -X POST http://localhost:3000/api/tasks \
    -H "Content-Type: application/json" \
    -d '{"projectId":"proj_123","title":"Flood"}' &
done
# Server becomes unresponsive
```

**Impact:**
- Server CPU at 100%
- Memory exhaustion
- Disk fills up with task files
- Legitimate users locked out

### Evidence in Code

- `src/server.ts` - No rate limiting middleware
- No request throttling anywhere
- Unlimited WebSocket connections

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 1 day

### Recommended Solution

```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

// Strict limit for expensive operations
const spawnLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 spawns per minute
  message: 'Spawn rate limit exceeded'
});

app.use('/api', apiLimiter);
app.use('/api/sessions/spawn', spawnLimiter);
```

---

## CRITICAL-05: Race Conditions in File Writes 🔴

### Severity: CRITICAL
**Impact:** Data corruption, data loss
**Exploitability:** Medium (requires concurrent requests)
**Data at Risk:** ANY entity being updated

### Problem

```typescript
// src/storage.ts:142-180 - Race condition
async save(): Promise<void> {
  // ⚠️ Multiple concurrent calls can interleave writes
  for (const task of this.tasks.values()) {
    await fs.writeFile(
      path.join(projectTasksDir, `${task.id}.json`),
      JSON.stringify(task, null, 2)
    );
  }
}
```

**Scenario:**
1. Request A calls `updateTask()` → saves to disk
2. Request B calls `updateTask()` → saves to disk (before A finishes)
3. Both writes happen concurrently
4. File contents are corrupted or one update is lost

### Race Condition Timeline

```
Time  Request A              Request B              Disk State
0     updateTask(id, {a:1})
1     Read task from memory
2     Modify: task.a = 1     updateTask(id, {b:2})
3     Write to disk starts   Read task from memory
4     Writing...             Modify: task.b = 2
5     Write completes        Write to disk starts
6     Disk: {a:1}            Writing...
7                            Write completes
8                            Disk: {b:2}  ← Lost update A!
```

### Impact

- **Data Loss:** Updates silently lost
- **Corruption:** Partial writes if process crashes during save
- **Inconsistency:** Memory state != disk state

### Evidence in Code

- `src/storage.ts:142` - No file locking
- `src/storage.ts:322` - `updateTask()` calls `save()` without lock
- `src/storage.ts:438` - `updateSession()` calls `save()` without lock

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 2-3 days

### Recommended Solution

```typescript
import { Mutex } from 'async-mutex';

class Storage extends EventEmitter {
  private saveMutex = new Mutex();

  async save(): Promise<void> {
    // Acquire lock before saving
    const release = await this.saveMutex.acquire();

    try {
      // Write all data atomically
      for (const project of this.projects.values()) {
        const tempFile = `${filePath}.tmp`;
        await fs.writeFile(tempFile, JSON.stringify(project, null, 2));
        await fs.rename(tempFile, filePath); // Atomic rename
      }
    } finally {
      release(); // Always release lock
    }
  }
}
```

---

## CRITICAL-06: No Backup/Recovery 🔴

### Severity: CRITICAL
**Impact:** Permanent data loss
**Exploitability:** N/A (operational failure)
**Data at Risk:** ALL

### Problem

```typescript
// src/storage.ts - No backup mechanism
async save(): Promise<void> {
  // ⚠️ Overwrites existing files without backup
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
```

**Current State:**
- No automatic backups
- No point-in-time recovery
- No corruption detection
- No recovery tools

### Failure Scenarios

**1. Disk Failure:**
- Hard drive fails
- ALL data lost permanently
- No recovery possible

**2. Accidental Deletion:**
```bash
rm -rf ~/.maestro/data
# All projects, tasks, sessions gone forever
```

**3. File Corruption:**
```bash
# Power outage during save()
# Files are half-written
# JSON parsing fails
# Data unrecoverable
```

**4. Bug-Induced Deletion:**
```typescript
// Bug in code accidentally deletes data
storage.deleteProject(project.id); // Oops, wrong project!
// Permanent - no undo
```

### Impact

- **Data Loss:** Permanent, unrecoverable
- **Business Impact:** Lost work, lost history
- **Trust:** Users lose confidence

### Evidence in Code

- No backup code anywhere in `src/storage.ts`
- No versioning of files
- No WAL (Write-Ahead Log)
- No snapshots

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 3-5 days

### Recommended Solution

```typescript
class Storage extends EventEmitter {
  async save(): Promise<void> {
    const timestamp = Date.now();

    // Create backup before saving
    const backupDir = path.join(this.dataDir, 'backups', timestamp.toString());
    await fs.mkdir(backupDir, { recursive: true });

    // Copy current data to backup
    await fs.cp(
      path.join(this.dataDir, 'projects'),
      path.join(backupDir, 'projects'),
      { recursive: true }
    );

    // Save new data
    // ... existing save logic

    // Keep only last 10 backups
    await this.cleanupOldBackups(10);
  }

  async restore(timestamp: number): Promise<void> {
    const backupDir = path.join(this.dataDir, 'backups', timestamp.toString());

    if (!await fs.exists(backupDir)) {
      throw new Error('Backup not found');
    }

    // Restore from backup
    await fs.cp(backupDir, this.dataDir, { recursive: true });
    await this.load();
  }
}
```

---

## CRITICAL-07: Secrets in Logs 🔴

### Severity: CRITICAL
**Impact:** Credential exposure
**Exploitability:** Easy (log files often world-readable)
**Data at Risk:** Credentials, tokens, sensitive data

### Problem

```typescript
// src/storage.ts - Logs everything
console.log(`Loaded ${this.sessions.size} sessions`);
// ⚠️ Session might contain env vars with secrets

// src/api/sessions.ts
console.log(`Spawn request for session ${session.id}`);
console.log(`   Skills: ${skillsToUse.join(', ')}`);
// ⚠️ Could log sensitive session data
```

### Attack Scenario

```bash
# Session created with API key in env
POST /api/sessions
{
  "env": {
    "OPENAI_API_KEY": "sk-1234567890abcdef",  ← Secret!
    "DATABASE_PASSWORD": "super_secret"       ← Secret!
  }
}

# Server logs to server.log
cat maestro-server/server.log
# Contains: Session created: {"env":{"OPENAI_API_KEY":"sk-1234..."}}

# Attacker gets read access to log file
# Now has all API keys and passwords
```

### Impact

- **Credential Theft:** API keys, passwords exposed
- **Account Compromise:** Stolen credentials used to access services
- **Financial Loss:** Stolen API keys run up bills

### Evidence in Code

- `src/storage.ts` - Logs loaded sessions (may contain secrets)
- `src/api/sessions.ts:217` - Logs session details
- No log sanitization anywhere

### Fix Priority: **IMMEDIATE** ⚡

**Estimated Fix Time:** 1-2 days

### Recommended Solution

```typescript
// Sanitize sensitive data before logging
function sanitizeForLogging(obj: any): any {
  const sanitized = { ...obj };

  const SENSITIVE_KEYS = ['password', 'token', 'key', 'secret', 'api_key'];

  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '***REDACTED***';
    }

    if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}

// Use in logging
console.log('Session created:', sanitizeForLogging(session));
// Output: {"env":{"OPENAI_API_KEY":"***REDACTED***"}}
```

---

## Summary of Critical Issues

| ID | Issue | Risk | Fix Time | Priority |
|----|-------|------|----------|----------|
| CRITICAL-01 | No Authentication | System Compromise | 1 week | 1 |
| CRITICAL-02 | No Authorization | Data Breach | 1 week | 1 |
| CRITICAL-03 | No Input Validation | Injection Attacks | 3-5 days | 2 |
| CRITICAL-04 | No Rate Limiting | DoS Attacks | 1 day | 3 |
| CRITICAL-05 | Race Conditions | Data Corruption | 2-3 days | 4 |
| CRITICAL-06 | No Backup | Permanent Data Loss | 3-5 days | 5 |
| CRITICAL-07 | Secrets in Logs | Credential Theft | 1-2 days | 6 |

**Total Fix Time:** ~3 weeks with 1 engineer

---

## Implementation Order

1. **Week 1:** Authentication (CRITICAL-01) + Authorization (CRITICAL-02)
2. **Week 2:** Input Validation (CRITICAL-03) + Rate Limiting (CRITICAL-04)
3. **Week 3:** Race Conditions (CRITICAL-05) + Backup (CRITICAL-06) + Log Sanitization (CRITICAL-07)

---

## Acceptance Criteria

Before deploying to production, ALL of these must be true:

- [ ] Authentication enforced on ALL endpoints
- [ ] Authorization checks in ALL CRUD operations
- [ ] Input validation on ALL user inputs
- [ ] Rate limiting on ALL endpoints
- [ ] File writes are atomic with locking
- [ ] Automated backups running every hour
- [ ] Secrets redacted from ALL logs
- [ ] Security audit passed
- [ ] Penetration testing completed

---

**Next:** [02-HIGH-PRIORITY-ISSUES.md](./02-HIGH-PRIORITY-ISSUES.md)
