# Global Options

Every `maestro` command accepts these global flags. They must appear **before** the subcommand.

## Syntax

```
maestro [global-options] <command> [command-options]
```

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Output results as JSON (machine-readable, scriptable) |
| `--server <url>` | string | `MAESTRO_API_URL` or `http://localhost:3000` | Override Maestro Server URL for this invocation |
| `--project <id>` | string | `MAESTRO_PROJECT_ID` | Override the Project ID context |
| `--version` | boolean | — | Print the CLI version and exit |
| `--help` | boolean | — | Show help for any command |

## Examples

### JSON output for scripting

```bash
maestro --json task list
```

```json
[
  {
    "id": "task_abc123",
    "title": "Implement auth module",
    "status": "in_progress",
    "priority": "high",
    "projectId": "proj_xyz789"
  }
]
```

### Override server URL

```bash
maestro --server http://remote-server:3000 project list
```

### Override project context

```bash
maestro --project proj_abc123 task list
```

### Check CLI version

```bash
maestro --version
```

```
1.0.0
```

### Get help for any command

```bash
maestro --help
maestro task --help
maestro session spawn --help
```

## Notes

- `--json` suppresses spinners and progress indicators, outputting only valid JSON to stdout.
- When `--server` is provided, it takes precedence over the `MAESTRO_API_URL` environment variable.
- When `--project` is provided, it takes precedence over the `MAESTRO_PROJECT_ID` environment variable.

## Related Commands

- [`maestro whoami`](./12-utility-commands.md) — Show current context including project, session, and permissions
- [`maestro commands`](./12-utility-commands.md) — Show allowed commands for the current session
