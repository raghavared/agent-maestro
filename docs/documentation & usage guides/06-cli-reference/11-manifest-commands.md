# Manifest Commands

Generate manifest files for spawning agent sessions. Manifests contain all the configuration and context needed to initialize a Claude, Codex, or Gemini session.

Manifests are typically generated automatically during the spawn flow, but this command allows manual generation for debugging and advanced workflows.

## maestro manifest generate

Generate a manifest file from task and project data.

### Syntax

```
maestro manifest generate --mode <mode> --project-id <id> --task-ids <ids> --output <path> [options]
```

### Arguments

None.

### Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--mode <mode>` | string | **Required** | Agent mode: `worker`, `coordinator`, `coordinated-worker`, `coordinated-coordinator` (legacy `execute`/`coordinate` also accepted) |
| `--project-id <id>` | string | **Required** | Project ID |
| `--task-ids <ids>` | string | **Required** | Comma-separated task IDs |
| `--output <path>` | string | **Required** | Output file path for the manifest JSON |
| `--skills <skills>` | string | `maestro-worker` | Comma-separated skill names to include |
| `--model <model>` | string | `sonnet` | Model to use (e.g. `sonnet`, `opus`, `haiku`, or native model names like `gpt-5.3-codex`, `gemini-3-pro-preview`) |
| `--agent-tool <tool>` | string | `claude-code` | Agent tool: `claude-code`, `codex`, or `gemini` |
| `--reference-task-ids <ids>` | string | — | Comma-separated reference task IDs for additional context |
| `--team-member-id <id>` | string | — | Team member ID for this session (single identity) |
| `--team-member-ids <ids>` | string | — | Comma-separated team member IDs (for coordinate mode, multi-identity) |

### Example

```bash
maestro manifest generate \
  --mode worker \
  --project-id proj_1770533548982_3bgiz \
  --task-ids task_abc123,task_def456 \
  --skills maestro-worker,react-frontend \
  --model opus \
  --agent-tool claude-code \
  --team-member-id tm_pro_001 \
  --output ~/.maestro/sessions/sess_new/manifest.json
```

This writes the manifest to the specified output path and exits with code 0 on success.

### Generated Manifest Structure

```json
{
  "manifestVersion": "1.0",
  "mode": "worker",
  "tasks": [
    {
      "id": "task_abc123",
      "title": "Build authentication module",
      "description": "Implement JWT-based auth",
      "acceptanceCriteria": ["All endpoints return proper auth errors"],
      "projectId": "proj_1770533548982_3bgiz",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "priority": "high"
    }
  ],
  "session": {
    "model": "opus",
    "permissionMode": "acceptEdits",
    "thinkingMode": "auto",
    "workingDirectory": "/Users/dev/projects/maestro"
  },
  "skills": ["maestro-worker", "react-frontend"],
  "teamMemberId": "tm_pro_001",
  "teamMemberName": "Pro",
  "teamMemberAvatar": "🤖",
  "teamMemberIdentity": "You are a senior full-stack developer."
}
```

### Environment Variables Used

The manifest generator also reads these environment variables when present:

| Variable | Description |
|----------|-------------|
| `MAESTRO_COORDINATOR_SESSION_ID` | Auto-derives coordinated mode when spawned by a coordinator |
| `MAESTRO_INITIAL_DIRECTIVE` | JSON string with initial directive (subject, message, fromSessionId) |
| `MAESTRO_IS_MASTER` | Set to `true` to include master project data in manifest |
| `MAESTRO_PERMISSION_MODE` | Override permission mode at session level |
| `MAESTRO_MEMBER_OVERRIDES` | JSON string of per-member launch overrides |
| `MAESTRO_DEBUG` | Set to `true` for verbose error output with stack traces |

### Related Commands

- `maestro session spawn` — Spawn a session (generates manifest automatically)
- `maestro debug-prompt` — View the rendered prompt from a manifest
