# Error Handling Specification

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Status:** Stable

## Overview

The Maestro Server implements a standardized error handling approach across all API endpoints. Errors use consistent response formats, HTTP status codes, and error codes to facilitate client error handling and debugging.

## Standard Error Response Format

### Error Response Structure

All error responses follow this format:

```typescript
interface ErrorResponse {
  error: true;              // Always true for errors
  code: string;             // Machine-readable error code (UPPER_SNAKE_CASE or snake_case)
  message: string;          // Human-readable error message
  details?: any;            // Optional: Additional error context
}
```

### Example Error Response

```json
{
  "error": true,
  "code": "TASK_NOT_FOUND",
  "message": "Task not found",
  "details": {
    "taskId": "tsk_nonexistent"
  }
}
```

## HTTP Status Code Mapping

### Status Codes Used

| Status Code | Category | When Used |
|-------------|----------|-----------|
| `200 OK` | Success | Successful GET, PATCH, DELETE operations |
| `201 Created` | Success | Successful POST creation |
| `400 Bad Request` | Client Error | Invalid request data, validation failures |
| `404 Not Found` | Client Error | Resource not found |
| `500 Internal Server Error` | Server Error | Unexpected server errors, exceptions |

### Status Code Guidelines

#### 400 Bad Request
Used when:
- Required fields are missing
- Field values are invalid (wrong type, format, or value)
- Validation fails
- Resource has dependencies preventing operation

**Examples:**
- Missing required field: `projectId is required`
- Invalid format: `taskIds must be a non-empty array`
- Invalid value: `role must be "worker" or "orchestrator"`
- Dependency conflict: `Cannot delete project with existing tasks`

#### 404 Not Found
Used when:
- Resource with specified ID doesn't exist
- Parent resource doesn't exist

**Examples:**
- `Task not found`
- `Project not found`
- `Session not found`

#### 500 Internal Server Error
Used when:
- Unexpected exception occurs
- External dependency fails (e.g., CLI not found)
- File system operations fail
- JSON parsing fails

**Examples:**
- `Failed to generate manifest: maestro CLI not found`
- `Failed to spawn maestro CLI: spawn maestro ENOENT`
- `Unexpected error during spawn`

## Complete Error Code Catalog

### Validation Errors (400)

| Code | HTTP Status | Message | Used In |
|------|-------------|---------|---------|
| `VALIDATION_ERROR` | 400 | Generic validation failure message | tasks.ts, projects.ts, sessions.ts |
| `missing_project_id` | 400 | `projectId is required` | sessions.ts (spawn) |
| `invalid_task_ids` | 400 | `taskIds must be a non-empty array` | sessions.ts (spawn) |
| `invalid_spawn_source` | 400 | `spawnSource must be "ui" or "session"` | sessions.ts (spawn) |
| `missing_session_id` | 400 | `sessionId is required when spawnSource is "session"` | sessions.ts (spawn) |
| `invalid_role` | 400 | `role must be "worker" or "orchestrator"` | sessions.ts (spawn) |
| `PROJECT_HAS_DEPENDENCIES` | 400 | `Cannot delete project...` | projects.ts (delete) |

### Not Found Errors (404)

| Code | HTTP Status | Message | Used In |
|------|-------------|---------|---------|
| `TASK_NOT_FOUND` | 404 | `Task not found` | tasks.ts (get, update, delete, timeline, children) |
| `task_not_found` | 404 | `Task {taskId} not found` | sessions.ts (spawn) |
| `PROJECT_NOT_FOUND` | 404 | `Project not found` | projects.ts (get, update, delete) |
| `project_not_found` | 404 | `Project {projectId} not found` | sessions.ts (spawn) |
| `SESSION_NOT_FOUND` | 404 | `Session not found` | sessions.ts (get, update, delete) |
| `NOT_FOUND` | 404 | Generic not found message | sessions.ts (task operations) |

### Server Errors (500)

| Code | HTTP Status | Message | Used In |
|------|-------------|---------|---------|
| `INTERNAL_ERROR` | 500 | `[exception message]` | All API routes (catch-all) |
| `manifest_generation_failed` | 500 | `Failed to generate manifest: [details]` | sessions.ts (spawn) |
| `spawn_error` | 500 | `[exception message]` | sessions.ts (spawn) |

## Error Handling Patterns in API Routes

### Pattern 1: Validation Error

```typescript
// Validate required fields
if (!req.body.projectId) {
  return res.status(400).json({
    error: true,
    message: 'projectId is required',
    code: 'VALIDATION_ERROR'
  });
}
```

**Used in:**
- `POST /api/tasks` - Validate projectId and title
- `POST /api/projects` - Validate name
- `POST /api/sessions` - Validate taskIds
- `POST /api/tasks/:id/timeline` - Validate message

### Pattern 2: Resource Not Found

```typescript
// Check if resource exists
const task = storage.getTask(req.params.id);
if (!task) {
  return res.status(404).json({
    error: true,
    message: 'Task not found',
    code: 'TASK_NOT_FOUND'
  });
}
```

**Used in:**
- `GET /api/tasks/:id`
- `GET /api/projects/:id`
- `GET /api/sessions/:id`
- All resource-specific endpoints

### Pattern 3: Storage Method Error

```typescript
try {
  const task = storage.updateTask(req.params.id, req.body);
  res.json(task);
} catch (err: any) {
  // Check for known error messages
  if (err.message === 'Task not found') {
    return res.status(404).json({
      error: true,
      message: 'Task not found',
      code: 'TASK_NOT_FOUND'
    });
  }

  // Generic server error
  res.status(500).json({
    error: true,
    message: err.message,
    code: 'INTERNAL_ERROR'
  });
}
```

**Used in:**
- `PATCH /api/tasks/:id`
- `PUT /api/projects/:id`
- `PATCH /api/sessions/:id`
- All update/delete operations

### Pattern 4: Dependency Error

```typescript
try {
  const result = storage.deleteProject(req.params.id);
  res.json(result);
} catch (err: any) {
  if (err.message === 'Project not found') {
    return res.status(404).json({
      error: true,
      message: err.message,
      code: 'PROJECT_NOT_FOUND'
    });
  }
  if (err.message.includes('Cannot delete project')) {
    return res.status(400).json({
      error: true,
      message: err.message,
      code: 'PROJECT_HAS_DEPENDENCIES'
    });
  }
  res.status(500).json({
    error: true,
    message: err.message,
    code: 'INTERNAL_ERROR'
  });
}
```

**Used in:**
- `DELETE /api/projects/:id`

### Pattern 5: Spawn-Specific Errors

```typescript
// Validate spawn-specific fields
if (spawnSource !== 'ui' && spawnSource !== 'session') {
  return res.status(400).json({
    error: true,
    code: 'invalid_spawn_source',
    message: 'spawnSource must be "ui" or "session"'
  });
}

// Validate parent session when spawnSource is 'session'
if (spawnSource === 'session' && !sessionId) {
  return res.status(400).json({
    error: true,
    code: 'missing_session_id',
    message: 'sessionId is required when spawnSource is "session"'
  });
}

// Verify task exists with details
for (const taskId of taskIds) {
  const task = storage.getTask(taskId);
  if (!task) {
    return res.status(404).json({
      error: true,
      code: 'task_not_found',
      message: `Task ${taskId} not found`,
      details: { taskId }
    });
  }
}

// Manifest generation error
try {
  const result = await generateManifestViaCLI({...});
} catch (manifestError: any) {
  return res.status(500).json({
    error: true,
    code: 'manifest_generation_failed',
    message: `Failed to generate manifest: ${manifestError.message}`
  });
}
```

**Used in:**
- `POST /api/sessions/spawn`

## Error Middleware

The server includes a global error handling middleware that catches unhandled errors:

```typescript
// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: true,
    message: err.message,
    code: 'INTERNAL_ERROR'
  });
});
```

**Location:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/server.ts` (lines 44-51)

**Purpose:**
- Catch errors that bubble up from routes
- Log errors to console
- Return standardized error response
- Prevent server crashes

**Note:** This middleware is registered after all routes using `app.use()`.

## Error Handling by Endpoint

### Tasks API

**File:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/tasks.ts`

#### GET /api/tasks
- `500 INTERNAL_ERROR` - Query or filtering error

#### POST /api/tasks
- `400 VALIDATION_ERROR` - Missing projectId
- `400 VALIDATION_ERROR` - Missing title
- `500 INTERNAL_ERROR` - Creation error

#### GET /api/tasks/:id
- `404 TASK_NOT_FOUND` - Task doesn't exist
- `500 INTERNAL_ERROR` - Query error

#### PATCH /api/tasks/:id
- `404 TASK_NOT_FOUND` - Task doesn't exist
- `500 INTERNAL_ERROR` - Update error

#### DELETE /api/tasks/:id
- `404 TASK_NOT_FOUND` - Task doesn't exist
- `500 INTERNAL_ERROR` - Delete error

#### POST /api/tasks/:id/timeline
- `400 VALIDATION_ERROR` - Missing message
- `404 TASK_NOT_FOUND` - Task doesn't exist
- `500 INTERNAL_ERROR` - Update error

#### GET /api/tasks/:id/children
- `404 TASK_NOT_FOUND` - Parent task doesn't exist
- `500 INTERNAL_ERROR` - Query error

### Projects API

**File:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/projects.ts`

#### GET /api/projects
- `500 INTERNAL_ERROR` - Query error

#### POST /api/projects
- `400 VALIDATION_ERROR` - Missing name
- `500 INTERNAL_ERROR` - Creation error

#### GET /api/projects/:id
- `404 PROJECT_NOT_FOUND` - Project doesn't exist
- `500 INTERNAL_ERROR` - Query error

#### PUT /api/projects/:id
- `404 PROJECT_NOT_FOUND` - Project doesn't exist
- `500 INTERNAL_ERROR` - Update error

#### DELETE /api/projects/:id
- `404 PROJECT_NOT_FOUND` - Project doesn't exist
- `400 PROJECT_HAS_DEPENDENCIES` - Project has tasks or sessions
- `500 INTERNAL_ERROR` - Delete error

### Sessions API

**File:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/sessions.ts`

#### POST /api/sessions
- `400 VALIDATION_ERROR` - Missing taskIds
- `500 INTERNAL_ERROR` - Creation error

#### GET /api/sessions
- `500 INTERNAL_ERROR` - Query or filtering error

#### GET /api/sessions/:id
- `404 SESSION_NOT_FOUND` - Session doesn't exist
- `500 INTERNAL_ERROR` - Query error

#### PATCH /api/sessions/:id
- `404 SESSION_NOT_FOUND` - Session doesn't exist
- `500 INTERNAL_ERROR` - Update error

#### DELETE /api/sessions/:id
- `404 SESSION_NOT_FOUND` - Session doesn't exist
- `500 INTERNAL_ERROR` - Delete error

#### POST /api/sessions/:id/tasks/:taskId
- `404 NOT_FOUND` - Session or task doesn't exist
- `500 INTERNAL_ERROR` - Update error

#### DELETE /api/sessions/:id/tasks/:taskId
- `404 NOT_FOUND` - Session or task doesn't exist
- `500 INTERNAL_ERROR` - Update error

#### POST /api/sessions/spawn
- `400 missing_project_id` - Missing projectId
- `400 invalid_task_ids` - Invalid or empty taskIds
- `400 invalid_spawn_source` - Invalid spawnSource value
- `400 invalid_role` - Invalid role value
- `404 task_not_found` - Task doesn't exist (includes details)
- `404 project_not_found` - Project doesn't exist
- `500 manifest_generation_failed` - CLI manifest generation failed
- `500 spawn_error` - Unexpected spawn error

### Skills API

**File:** `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/skills.ts`

#### GET /api/skills
- Returns `[]` on error (no explicit error response)

**Note:** The skills endpoint doesn't return error responses, instead returning an empty array if the skills directory is missing or cannot be read. This is intentional to prevent blocking the UI.

## Client Error Handling Patterns

### TypeScript Client Example

```typescript
interface ApiError {
  error: true;
  code: string;
  message: string;
  details?: any;
}

async function spawnSession(payload: SpawnSessionPayload) {
  try {
    const response = await fetch('http://localhost:3000/api/sessions/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error: ApiError = await response.json();

      // Handle specific error codes
      switch (error.code) {
        case 'missing_project_id':
          throw new Error('Project ID is required');

        case 'task_not_found':
          throw new Error(`Task ${error.details?.taskId} not found`);

        case 'manifest_generation_failed':
          throw new Error(`Manifest generation failed: ${error.message}`);

        case 'INTERNAL_ERROR':
          throw new Error(`Server error: ${error.message}`);

        default:
          throw new Error(error.message);
      }
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to spawn session:', err);
    throw err;
  }
}
```

### Error Code Categorization

```typescript
// Check if error is a validation error
function isValidationError(code: string): boolean {
  return [
    'VALIDATION_ERROR',
    'missing_project_id',
    'invalid_task_ids',
    'invalid_spawn_source',
    'invalid_role'
  ].includes(code);
}

// Check if error is a not found error
function isNotFoundError(code: string): boolean {
  return [
    'TASK_NOT_FOUND',
    'task_not_found',
    'PROJECT_NOT_FOUND',
    'project_not_found',
    'SESSION_NOT_FOUND',
    'NOT_FOUND'
  ].includes(code);
}

// Check if error is a server error
function isServerError(code: string): boolean {
  return [
    'INTERNAL_ERROR',
    'manifest_generation_failed',
    'spawn_error'
  ].includes(code);
}

// Check if error is retryable
function isRetryableError(code: string): boolean {
  return [
    'INTERNAL_ERROR',
    'spawn_error'
  ].includes(code);
}
```

## Logging

### Error Logging

All errors are logged to the console:

```typescript
// In error middleware
console.error('Server error:', err);

// In spawn endpoint
console.error('\n' + '='.repeat(80));
console.error('❌ SESSION SPAWN ERROR');
console.error('='.repeat(80));
console.error(`Error: ${err.message}`);
console.error(`Stack: ${err.stack}`);
console.error('='.repeat(80) + '\n');

// In CLI integration
console.error(`\n   ❌ MANIFEST GENERATION FAILED:`);
console.error(`      • Exit code: ${code}`);
console.error(`      • Stderr:\n${stderr}`);
console.error(`      • Stdout:\n${stdout}`);
```

### Warning Logging

Non-fatal issues are logged as warnings:

```typescript
// Skills loading
console.warn(`Skill not found: ${skillName} (looked in ${skillPath})`);
console.warn(`Manifest not found for skill: ${skillName}`);
console.warn(`Instructions not found for skill: ${skillName}`);
console.warn(`Missing dependency: ${skill.manifest.name} requires ${dep}`);
console.warn(`[Skills API] Failed to load skill ${id}:`, err);

// Skills directory
console.warn(`Skills directory not found: ${SKILLS_DIR}`);
```

## Best Practices

### For API Developers

1. **Always include error code** - Every error response must have a `code` field
2. **Use consistent error codes** - UPPER_SNAKE_CASE for general codes, snake_case for specific codes
3. **Provide helpful messages** - Messages should clearly explain what went wrong
4. **Include details when available** - Add `details` object for context (e.g., taskId, projectId)
5. **Log errors** - Always log errors to console for debugging
6. **Use appropriate HTTP status** - Match status code to error type
7. **Handle known exceptions** - Check for specific error messages and provide appropriate codes
8. **Catch all exceptions** - Use try/catch blocks and error middleware

### For Client Developers

1. **Check response status** - Inspect HTTP status code
2. **Parse error response** - Extract `error`, `code`, `message`, `details`
3. **Handle specific error codes** - Switch on `code` for specific handling
4. **Display user-friendly messages** - Transform technical errors into user-facing messages
5. **Log errors** - Log full error details for debugging
6. **Implement retry logic** - Retry on retryable errors (INTERNAL_ERROR, spawn_error)
7. **Validate before sending** - Validate inputs client-side to prevent validation errors
8. **Handle network errors** - Catch network/fetch errors separately

## Error Code Naming Conventions

### UPPER_SNAKE_CASE Codes
Used for general, reusable error codes:
- `VALIDATION_ERROR`
- `TASK_NOT_FOUND`
- `PROJECT_NOT_FOUND`
- `SESSION_NOT_FOUND`
- `PROJECT_HAS_DEPENDENCIES`
- `INTERNAL_ERROR`
- `NOT_FOUND`

### snake_case Codes
Used for specific, context-dependent error codes:
- `missing_project_id`
- `invalid_task_ids`
- `invalid_spawn_source`
- `invalid_role`
- `task_not_found` (with details)
- `project_not_found` (in spawn context)
- `manifest_generation_failed`
- `spawn_error`

**Guideline:** Use UPPER_SNAKE_CASE for codes shared across endpoints, snake_case for endpoint-specific codes.

## Future Improvements

### Structured Error Details

Consider expanding the `details` object for better client handling:

```typescript
interface ErrorDetails {
  field?: string;           // Field that caused error
  value?: any;              // Invalid value
  expected?: string;        // Expected value/format
  constraint?: string;      // Constraint that was violated
  resource?: {              // Resource context
    type: string;           // 'task', 'project', 'session'
    id: string;             // Resource ID
  };
  retryable?: boolean;      // Whether error is retryable
  retryAfter?: number;      // Suggested retry delay (ms)
}
```

### Error Code Registry

Consider maintaining a central error code registry:

```typescript
// errors.ts
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  // ... all error codes
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### Typed Error Responses

Consider using TypeScript for type-safe error responses:

```typescript
interface ErrorResponse<T = any> {
  error: true;
  code: ErrorCode;
  message: string;
  details?: T;
}

function createError<T>(
  code: ErrorCode,
  message: string,
  details?: T
): ErrorResponse<T> {
  return { error: true, code, message, details };
}
```

## Related Specifications

- **[08-SESSION-SPAWNING-SPECIFICATION.md](./08-SESSION-SPAWNING-SPECIFICATION.md)** - Spawn error scenarios
- **[06-CLI-INTEGRATION-SPECIFICATION.md](./06-CLI-INTEGRATION-SPECIFICATION.md)** - CLI error handling
- **[01-API-OVERVIEW.md](./01-API-OVERVIEW.md)** - General API patterns

## Implementation Reference

**Error Middleware:**
- File: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/server.ts` (lines 44-51)

**Error Handling Examples:**
- Tasks API: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/tasks.ts`
- Projects API: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/projects.ts`
- Sessions API: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/sessions.ts`
- Skills API: `/Users/subhang/Desktop/Projects/agents-ui/maestro-server/src/api/skills.ts`

**Complete Error Code List:**
See "Complete Error Code Catalog" section above for all error codes, status codes, messages, and locations.
