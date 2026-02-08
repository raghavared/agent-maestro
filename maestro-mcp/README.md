# Maestro MCP Server

MCP (Model Context Protocol) server that exposes Maestro CLI commands as tools for Claude Code integration.

## What This Does

This MCP server acts as a bridge between Claude Code and your Maestro CLI:

```
Claude Code → MCP Server → Maestro CLI → Maestro Server → Maestro UI
            (calls tools)  (exec commands) (REST/WebSocket)
```

When Claude needs to interact with Maestro, it discovers and calls MCP tools, which execute the actual Maestro CLI commands.

## Installation

### 1. Install Dependencies

```bash
cd maestro-mcp-server
npm install
```

### 2. Add to Claude Code

```bash
# Add with default configuration
claude mcp add --transport stdio maestro \
  -- node /Users/subhang/Desktop/Projects/agents-ui/maestro-mcp-server/index.js

# Or with environment variables
claude mcp add --transport stdio maestro \
  --env MAESTRO_API_URL="http://localhost:3000" \
  --env MAESTRO_PROJECT_ID="proj_123" \
  -- node /Users/subhang/Desktop/Projects/agents-ui/maestro-mcp-server/index.js
```

### 3. Verify Installation

```bash
# List MCP servers
claude mcp list

# Check that maestro is listed
```

## Available Tools

The MCP server exposes these Maestro CLI commands as tools:

### Task Management

- **maestro_task_create** - Create a new task
- **maestro_task_list** - List all tasks
- **maestro_task_get** - Get task details
- **maestro_task_update** - Update task properties
- **maestro_task_delete** - Delete a task
- **maestro_task_start** - Mark task as in_progress
- **maestro_task_complete** - Mark task as completed

### Subtask Management

- **maestro_subtask_create** - Create a subtask

### Progress Tracking

- **maestro_update** - Log a progress message

### Session Management

- **maestro_session_list** - List sessions

### Project Status

- **maestro_status** - Show project summary
- **maestro_whoami** - Show current context

## Usage Examples

Once installed, you can ask Claude Code to interact with Maestro:

### Creating Tasks

```
> Create a new task titled "Fix authentication bug" with high priority

Behind the scenes:
Claude calls: maestro_task_create({
  title: "Fix authentication bug",
  priority: "high"
})
```

### Listing Tasks

```
> Show me all in-progress tasks

Behind the scenes:
Claude calls: maestro_task_list({
  status: "in_progress"
})
```

### Updating Tasks

```
> Mark task task_abc123 as completed

Behind the scenes:
Claude calls: maestro_task_complete({
  taskId: "task_abc123"
})
```

### Project Status

```
> What's the status of my Maestro project?

Behind the scenes:
Claude calls: maestro_status()
```

## Environment Variables

- **MAESTRO_API_URL** - Maestro server URL (default: http://localhost:3000)
- **MAESTRO_PROJECT_ID** - Default project ID for operations
- **MAESTRO_SESSION_ID** - Current session ID (for context-aware operations)
- **MAESTRO_TASK_IDS** - Current task IDs (comma-separated)

## How It Works

1. **Discovery**: Claude Code calls `tools/list` to discover available Maestro tools
2. **Invocation**: When Claude needs to use a tool, it calls `tools/call` with tool name and arguments
3. **Execution**: The MCP server constructs a Maestro CLI command and executes it
4. **Response**: CLI output is parsed (JSON if possible) and returned to Claude
5. **Integration**: Changes appear in Maestro UI via WebSocket real-time updates

## Project Structure

```
maestro-mcp-server/
├── index.js          # MCP server implementation
├── package.json      # Dependencies
└── README.md         # This file
```

## Troubleshooting

### MCP Server Not Starting

Check that Node.js can execute the server:

```bash
node /path/to/maestro-mcp-server/index.js
# Should output: "Maestro MCP Server running on stdio"
```

### Tools Not Appearing in Claude Code

Verify the MCP server is registered:

```bash
claude mcp list
claude mcp get maestro
```

### Maestro CLI Errors

Test the Maestro CLI directly:

```bash
cd maestro-cli
node dist/index.js task list --json
```

### Wrong Project Context

Set the project ID explicitly:

```bash
claude mcp add --transport stdio maestro \
  --env MAESTRO_PROJECT_ID="your_project_id" \
  -- node /path/to/index.js
```

Or use `--project` flag in Claude Code:

```
> --project proj_123 create a task titled "Test"
```

## Sharing with Team (.mcp.json)

To share this MCP server with your team, add it to project scope:

```bash
# In your project directory
claude mcp add --transport stdio maestro \
  --scope project \
  -- node maestro-mcp-server/index.js
```

This creates `.mcp.json`:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["maestro-mcp-server/index.js"],
      "env": {
        "MAESTRO_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Commit this file so team members can use the same MCP server.

## Development

### Testing Individual Tools

```bash
# Set environment variables
export MAESTRO_API_URL="http://localhost:3000"
export MAESTRO_PROJECT_ID="proj_test"

# Run the server (it will wait for stdio input)
node index.js

# Send a tools/list request (JSON-RPC)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node index.js

# Send a tools/call request
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"maestro_whoami","arguments":{}}}' | node index.js
```

### Adding New Tools

1. Add the tool definition to `tools/list` handler
2. Add the execution logic to `tools/call` switch statement
3. Test with Claude Code

## License

Same as parent project.
