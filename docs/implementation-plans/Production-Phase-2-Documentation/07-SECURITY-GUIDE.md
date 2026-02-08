# Security Guide - Hooks Integration

**Version:** 1.0
**Date:** 2026-02-01

---

## Security Overview

Hooks integration introduces **external code execution** (bash scripts) and **webhook endpoints** that must be secured properly.

### Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Malicious hook input | Low | High | Input validation |
| Command injection | Medium | Critical | Proper escaping |
| Webhook flooding | Medium | Medium | Rate limiting |
| Unauthorized access | Low | High | Authentication |
| Information disclosure | Medium | Medium | Sanitization |
| DoS via hooks | Low | Medium | Timeouts |

---

## Input Validation

### Webhook Endpoint Security

**File:** `maestro-server/src/api/webhooks.ts`

```typescript
// Validate session ID format (UUID)
if (!/^[a-f0-9-]{36}$/.test(session_id)) {
  return res.status(400).json({
    error: true,
    message: 'Invalid session ID format'
  });
}

// Validate hook event name (whitelist)
const VALID_EVENTS = [
  'SessionStart',
  'SessionEnd',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'PreToolUse',
  'PermissionRequest',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'PreCompact',
  'UserPromptSubmit'
];

if (!VALID_EVENTS.includes(hook_event_name)) {
  return res.status(400).json({
    error: true,
    message: 'Invalid hook event name'
  });
}

// Validate tool names (if applicable)
if (tool_name) {
  const VALID_TOOLS = [
    'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
    'WebFetch', 'WebSearch', 'Task', 'NotebookEdit'
  ];
  if (!VALID_TOOLS.includes(tool_name)) {
    return res.status(400).json({
      error: true,
      message: 'Invalid tool name'
    });
  }
}

// Sanitize string inputs (max length)
if (typeof message === 'string') {
  message = message.substring(0, 1000);
}
```

---

## Command Injection Prevention

### Protected Files (Never Access)

Block access to sensitive files in PreToolUse hook:

```bash
#!/bin/bash
# Block dangerous file access
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

PROTECTED_PATTERNS=(
  "\.env"
  "\.git/"
  "credentials"
  "secrets"
  "private.*key"
  ".*\.pem$"
  ".*\.key$"
  "config/database\.yml"
  "\.aws/credentials"
  "\.ssh/"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if echo "$FILE_PATH" | grep -qE "$pattern"; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Protected file: $FILE_PATH\"}}"
    exit 0
  fi
done
```

### Dangerous Commands (Block)

```bash
#!/bin/bash
# Block dangerous bash commands
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

DANGEROUS_PATTERNS=(
  "rm -rf"
  "sudo"
  "eval"
  "chmod 777"
  "--force"
  "curl.*\|.*bash"
  "wget.*\|.*sh"
  "> /dev/sda"
  "dd if="
  "mkfs"
  "fork.*bomb"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Dangerous command blocked: $COMMAND\"}}"
    exit 0
  fi
done
```

---

## Shell Script Security

### Secure Defaults

**Always use in hook scripts:**

```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'        # Safe word splitting
```

### Proper Variable Quoting

```bash
# CORRECT - quotes protect against injection
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
curl -X POST "$API_URL/webhook" -d "$INPUT"

# WRONG - vulnerable to injection
SESSION_ID=$(echo $INPUT | jq -r .session_id)
curl -X POST $API_URL/webhook -d $INPUT
```

### Use jq for JSON Parsing

```bash
# CORRECT - use jq
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

# WRONG - string manipulation vulnerable
TOOL=$(echo "$INPUT" | grep -oP '"tool_name":"?\K[^"]+')
```

### Validate Before Use

```bash
# Validate session ID format
if ! echo "$SESSION_ID" | grep -qE '^[a-f0-9-]{36}$'; then
  echo "Invalid session ID format" >&2
  exit 1
fi

# Validate URL format
if ! echo "$API_URL" | grep -qE '^https?://'; then
  echo "Invalid API URL" >&2
  exit 1
fi
```

---

## Rate Limiting

### Webhook Endpoint

```typescript
import rateLimit from 'express-rate-limit';

const hookLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 1000,            // 1000 requests per minute per IP
  message: {
    error: true,
    message: 'Too many hook events. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/hook-event', hookLimiter, async (req, res) => {
  // Handler...
});
```

### Per-Session Rate Limiting

```typescript
const sessionRateLimits = new Map<string, { count: number; resetTime: number }>();

router.post('/hook-event', (req, res, next) => {
  const { session_id } = req.body;
  const now = Date.now();
  
  const limit = sessionRateLimits.get(session_id);
  if (limit) {
    if (now < limit.resetTime) {
      if (limit.count >= 100) {  // Max 100 events per second per session
        return res.status(429).json({
          error: true,
          message: 'Session rate limit exceeded'
        });
      }
      limit.count++;
    } else {
      sessionRateLimits.set(session_id, { count: 1, resetTime: now + 1000 });
    }
  } else {
    sessionRateLimits.set(session_id, { count: 1, resetTime: now + 1000 });
  }
  
  next();
}, async (req, res) => {
  // Handler...
});
```

---

## Authentication

### API Key Authentication (Recommended)

**Server:**

```typescript
const HOOK_API_KEY = process.env.MAESTRO_HOOK_KEY || generateSecureKey();

router.post('/hook-event', (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${HOOK_API_KEY}`) {
    return res.status(401).json({
      error: true,
      message: 'Unauthorized'
    });
  }
  
  next();
}, async (req, res) => {
  // Handler...
});

function generateSecureKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

**Hook Script:**

```bash
#!/bin/bash
# Get API key from environment (set at session spawn)
API_KEY=${MAESTRO_HOOK_KEY:-}

if [ -z "$API_KEY" ]; then
  echo "MAESTRO_HOOK_KEY not set" >&2
  exit 1
fi

curl -X POST "$API_URL/webhooks/hook-event" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d "$INPUT"
```

**Set at session spawn:**

```typescript
// maestro-server/src/api/sessions.ts
envVars: {
  MAESTRO_SESSION_ID: session.id,
  MAESTRO_TASK_IDS: taskIds.join(','),
  MAESTRO_API_URL: 'http://localhost:3000',
  MAESTRO_HOOK_KEY: process.env.MAESTRO_HOOK_KEY
}
```

---

## Data Sanitization

### Sanitize Before Storing

```typescript
function sanitizeHookEvent(event: any): any {
  return {
    session_id: String(event.session_id).substring(0, 100),
    hook_event_name: String(event.hook_event_name).substring(0, 50),
    tool_name: event.tool_name ? String(event.tool_name).substring(0, 50) : undefined,
    message: event.message ? String(event.message).substring(0, 1000) : undefined,
    // Remove sensitive fields
    tool_input: sanitizeToolInput(event.tool_input),
    // Keep other fields within limits
  };
}

function sanitizeToolInput(input: any): any {
  if (!input) return undefined;
  
  // Remove environment variables if present
  delete input.env;
  delete input.environment;
  
  // Truncate file paths
  if (input.file_path) {
    input.file_path = String(input.file_path).substring(0, 500);
  }
  
  // Truncate commands
  if (input.command) {
    input.command = String(input.command).substring(0, 1000);
  }
  
  return input;
}
```

### Sanitize Before UI Display

```typescript
// In React component
function sanitizeForDisplay(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 500);  // Limit length
}

// Use in JSX
<p>{sanitizeForDisplay(activity.description)}</p>
```

---

## Timeout Protection

### Curl Timeouts in Hooks

```bash
curl -X POST "$API_URL/webhooks/hook-event" \
  -d "$INPUT" \
  --max-time 5 \        # Timeout after 5 seconds
  --connect-timeout 2 \ # Connection timeout 2 seconds
  --retry 0 \           # No retries
  --silent
```

### Server Request Timeouts

```typescript
import timeout from 'connect-timeout';

app.use('/api/webhooks', timeout('10s'));

router.post('/hook-event', (req, res) => {
  if (req.timedout) {
    return res.status(408).json({ error: true, message: 'Request timeout' });
  }
  // Handler...
});
```

---

## Logging Security

### What to Log

**DO log:**
- Session IDs (for correlation)
- Hook event types
- Tool names
- Timestamps
- Error messages
- Rate limit violations

**DON'T log:**
- File contents
- Command outputs
- Environment variables
- API keys or secrets
- User passwords (should never be in hooks anyway)
- Full file paths (could expose directory structure)

### Secure Logging

```typescript
function logHookEvent(event: any) {
  console.log({
    timestamp: new Date().toISOString(),
    event: 'hook_received',
    session_id: event.session_id,
    hook_event_name: event.hook_event_name,
    tool_name: event.tool_name,
    // DON'T log: tool_input, tool_response
  });
}
```

---

## Environment Security

### Secure Environment Variables

```bash
# In hook scripts - validate before use
API_URL=${MAESTRO_API_URL:-}
if [ -z "$API_URL" ]; then
  echo "MAESTRO_API_URL not set" >&2
  exit 1
fi

# Validate format
if ! echo "$API_URL" | grep -qE '^https?://localhost:[0-9]+$'; then
  echo "Invalid API URL format" >&2
  exit 1
fi
```

### Don't Hardcode Secrets

```bash
# WRONG - secret in script
API_KEY="abc123secret"

# RIGHT - from environment
API_KEY=${MAESTRO_HOOK_KEY:-}
```

---

## Access Control

### Session Isolation

Ensure sessions can only access their own data:

```typescript
router.post('/hook-event', async (req, res) => {
  const { session_id } = req.body;
  const maestroSession = storage.findSessionByClaudeId(session_id);
  
  if (!maestroSession) {
    // Unknown session - reject
    return res.status(403).json({
      error: true,
      message: 'Session not authorized'
    });
  }
  
  // Only allow access to tasks assigned to this session
  const allowedTaskIds = maestroSession.taskIds;
  
  // Process event...
});
```

---

## Security Checklist

### Server

- [ ] Input validation on all webhook fields
- [ ] Rate limiting implemented
- [ ] Authentication (API key) enabled
- [ ] Timeouts configured
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured securely
- [ ] HTTPS in production
- [ ] CORS configured properly

### Hook Scripts

- [ ] `set -euo pipefail` in all scripts
- [ ] Proper variable quoting
- [ ] Input validation
- [ ] Use jq for JSON parsing
- [ ] Timeouts on curl commands
- [ ] No hardcoded secrets
- [ ] File permissions (chmod 755, owned by user)

### UI

- [ ] Sanitize data before display
- [ ] XSS protection enabled
- [ ] No eval() or innerHTML with untrusted data
- [ ] WebSocket connection over WSS in production

---

## Incident Response

### If Compromised

1. **Immediately:**
   - Disable webhook endpoint
   - Revoke API keys
   - Check logs for suspicious activity

2. **Investigate:**
   - Review recent hook events
   - Check for unauthorized access
   - Identify attack vector

3. **Remediate:**
   - Patch vulnerabilities
   - Rotate API keys
   - Update security measures

4. **Prevent:**
   - Add monitoring alerts
   - Improve validation
   - Review security practices

---

## Production Hardening

### Additional Measures

1. **Firewall:** Restrict webhook endpoint to localhost only
2. **VPN:** Require VPN for hook access
3. **Encryption:** Use WSS and HTTPS
4. **Monitoring:** Alert on suspicious patterns
5. **Auditing:** Log all hook events for forensics

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01

