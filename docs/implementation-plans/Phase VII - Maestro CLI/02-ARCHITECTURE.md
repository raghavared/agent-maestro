# Phase VII Architecture

## Technology Stack

- **Runtime:** Node.js (matches the rest of the stack)
- **Framework:** `Commander.js` (standard, robust argument parsing)
- **HTTP Client:** `fetch` (native) or `axios`
- **Output:** `chalk` (colors), `cli-table3` (tables), `ora` (spinners)
- **Distribution:** NPM package (local or registry)

---

## Context Injection

When the Agents UI spawns a terminal session (Phase VI), it injects environment variables. The CLI reads these to set defaults.

### Environment Variables

| Variable | Description | CLI Default Behavior |
| :--- | :--- | :--- |
| `MAESTRO_API_URL` | URL of Maestro Server | Defaults to `http://localhost:3000` |
| `MAESTRO_PROJECT_ID` | Current Project ID | Used for `task create`, `task list` |
| `MAESTRO_SESSION_ID` | Current Session ID | Used for session-relative commands |
| `MAESTRO_TASK_IDS` | Comma-separated Task IDs | Used for "current task" context |

### Configuration Precedence
1.  **Command Line Flags:** `--server http://...` (Highest)
2.  **Environment Variables:** `MAESTRO_API_URL`
3.  **Config File:** `~/.maestro/config.json` (User preferences)
4.  **Defaults:** `http://localhost:3000` (Lowest)

---

## Request Flow

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │ args  │                 │ JSON  │                 │
│  Terminal/LLM   ├──────►│   Maestro CLI   ├──────►│  Maestro Server │
│                 │       │                 │ HTTP  │                 │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │  StdOut (JSON/Text)     │                         │
         ◄─────────────────────────┘                         │
                                   ◄─────────────────────────┘
                                      Response (JSON)
```

## Error Handling Strategy

### 1. Connection Errors
If the server is unreachable:
- **Human Mode:** Show a friendly "Is the server running?" message with specific troubleshooting steps.
- **JSON Mode:** Return a JSON error object: `{"error": "connection_refused", "message": "..."}`.

### 2. Validation Errors
If arguments are missing:
- **Human Mode:** Print help text usage.
- **JSON Mode:** Return `{"error": "invalid_arguments", "details": [...]}`.

### 3. API Errors
If the server returns 4xx/5xx:
- Pass through the error message from the server, wrapping it in the appropriate output format.

---

## Security

- **Localhost Binding:** Initially, the CLI assumes local operation.
- **No Auth (Phase 1):** Since it runs locally, no complex auth is needed yet.
- **Future Auth:** API Keys or Session Tokens header support if remote access is added.
