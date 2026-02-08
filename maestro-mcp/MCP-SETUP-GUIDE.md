# Maestro MCP Integration Guide

This guide explains how to integrate your Maestro CLI with Claude Code using the Model Context Protocol (MCP).

## Overview

```
┌─────────────────────────────────────────────────────┐
│                 Claude Code                         │
│  "Create a task to fix authentication bug"         │
└────────────────┬────────────────────────────────────┘
                 │ Discovers MCP tools
                 ▼
┌─────────────────────────────────────────────────────┐
│          Maestro MCP Server                         │
│  - maestro_task_create                              │
│  - maestro_task_list                                │
│  - maestro_task_update                              │
│  - maestro_status                                   │
│  - etc.                                             │
└────────────────┬────────────────────────────────────┘
                 │ Executes CLI commands
                 ▼
┌─────────────────────────────────────────────────────┐
│          Maestro CLI                                │
│  maestro task create "Fix auth bug" --priority high │
└────────────────┬────────────────────────────────────┘
                 │ REST API + JSON output
                 ▼
┌─────────────────────────────────────────────────────┐
│          Maestro Server                             │
│  POST /api/tasks                                    │
└────────────────┬────────────────────────────────────┘
                 │ WebSocket broadcast
                 ▼
┌─────────────────────────────────────────────────────┐
│          Maestro UI                                 │
│  Task appears in real-time!                        │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Node.js** v18+ installed
2. **Maestro CLI** built (`cd maestro-cli && npm run build`)
3. **Maestro Server** running on `http://localhost:3000`
4. **Claude Code** installed ([claude.ai/code](https://claude.ai/code))

## Setup Steps

### Step 1: Build Maestro CLI

First, fix the TypeScript errors in the CLI and build it:

```bash
cd maestro-cli
npm run build
```

If you get errors about `manifest.task` vs `manifest.tasks`, fix those first.

### Step 2: Test Maestro CLI

Verify the CLI works:

```bash
cd maestro-cli
node dist/index.js --help
node dist/index.js task list --json
```

### Step 3: Install MCP Server Dependencies

```bash
cd maestro-mcp-server
npm install
```

### Step 4: Add MCP Server to Claude Code

#### Option A: Local Scope (Personal)

```bash
# Navigate to your project
cd /Users/subhang/Desktop/Projects/agents-ui

# Add the MCP server
claude mcp add --transport stdio maestro \
  --env MAESTRO_API_URL="http://localhost:3000" \
  --env MAESTRO_PROJECT_ID="your_project_id" \
  -- node "$(pwd)/maestro-mcp-server/index.js"
```

#### Option B: Project Scope (Team Shared)

The project already has `.mcp.json` configured:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["maestro-mcp-server/index.js"],
      "env": {
        "MAESTRO_API_URL": "http://localhost:3000",
        "MAESTRO_PROJECT_ID": ""
      }
    }
  }
}
```

Just commit this file and team members can use it automatically.

### Step 5: Verify Installation

```bash
# List all MCP servers
claude mcp list

# Get details about maestro server
claude mcp get maestro

# Should show:
# Name: maestro
# Transport: stdio
# Command: node maestro-mcp-server/index.js
# Status: Available
```

### Step 6: Start Using in Claude Code

Now you can interact with Maestro directly from Claude Code:

```bash
# Start Claude Code in your project
cd /Users/subhang/Desktop/Projects/agents-ui
claude

# Check available MCP servers
> /mcp

# Now ask Claude to interact with Maestro
> Create a new task titled "Implement user authentication" with high priority

# Claude will automatically discover and call:
# maestro_task_create({
#   title: "Implement user authentication",
#   priority: "high"
# })

# List all tasks
> Show me all tasks in the project

# Claude calls: maestro_task_list()

# Mark a task as completed
> Mark task task_abc123 as completed

# Claude calls: maestro_task_complete({ taskId: "task_abc123" })
```

## Available MCP Tools

Your MCP server exposes these tools:

### Task Management

| Tool | Description | Usage Example |
|------|-------------|---------------|
| `maestro_task_create` | Create a new task | "Create a task to fix the login bug" |
| `maestro_task_list` | List all tasks | "Show me all high priority tasks" |
| `maestro_task_get` | Get task details | "Get details for task task_123" |
| `maestro_task_update` | Update task properties | "Update task task_123 status to in_progress" |
| `maestro_task_delete` | Delete a task | "Delete task task_123" |
| `maestro_task_start` | Mark as in_progress | "Start working on task task_123" |
| `maestro_task_complete` | Mark as completed | "Complete task task_123" |

### Subtask Management

| Tool | Description | Usage Example |
|------|-------------|---------------|
| `maestro_subtask_create` | Create a subtask | "Create subtask under task_123 to write tests" |

### Progress Tracking

| Tool | Description | Usage Example |
|------|-------------|---------------|
| `maestro_update` | Log progress message | "Log progress: completed authentication module" |

### Session Management

| Tool | Description | Usage Example |
|------|-------------|---------------|
| `maestro_session_list` | List sessions | "Show active sessions" |

### Project Status

| Tool | Description | Usage Example |
|------|-------------|---------------|
| `maestro_status` | Project summary | "What's the status of the project?" |
| `maestro_whoami` | Current context | "Show my Maestro context" |

## Usage Examples

### Creating Tasks

```
You: Create a task titled "Fix authentication bug" with description "Users can't log in with OAuth" and high priority

Claude discovers maestro_task_create tool
Claude calls:
  maestro_task_create({
    title: "Fix authentication bug",
    description: "Users can't log in with OAuth",
    priority: "high"
  })

MCP Server executes:
  maestro task create "Fix authentication bug" --desc "Users can't log in with OAuth" --priority high --json

Maestro CLI calls:
  POST http://localhost:3000/api/tasks

Task appears in Maestro UI immediately!
```

### Listing Tasks

```
You: Show me all in-progress tasks

Claude: maestro_task_list({ status: "in_progress" })
MCP Server: maestro task list --status in_progress --json
Returns: [{ id: "task_1", title: "...", status: "in_progress", ... }]
```

### Marking Tasks Complete

```
You: Mark task task_abc123 as completed

Claude: maestro_task_complete({ taskId: "task_abc123" })
MCP Server: maestro task-complete task_abc123 --json
Updates the task status to "completed"
```

### Checking Project Status

```
You: What's the current status of my Maestro project?

Claude: maestro_status()
MCP Server: maestro status --json
Returns:
{
  "project": "proj_123",
  "tasks": {
    "total": 15,
    "byStatus": {
      "pending": 5,
      "in_progress": 7,
      "completed": 3
    }
  },
  "sessions": { "active": 2 }
}

Claude: "Your project has 15 tasks: 5 pending, 7 in progress, and 3 completed. There are 2 active sessions."
```

## Integration Benefits

1. **Natural Language Interface**: Create and manage tasks using conversational language
2. **Real-Time Sync**: Changes appear in Maestro UI via WebSocket instantly
3. **Context Aware**: Claude understands your project and suggests relevant actions
4. **Automation**: Claude can manage complex workflows (create task → start session → track progress)
5. **Team Collaboration**: Same MCP server works for all team members

## Troubleshooting

### MCP Server Not Found

```bash
# Check if server is registered
claude mcp list

# If not found, add it again
claude mcp add --transport stdio maestro \
  -- node /full/path/to/maestro-mcp-server/index.js
```

### Maestro CLI Errors

```bash
# Test CLI directly
cd maestro-cli
node dist/index.js task list --json

# If it fails, rebuild:
npm run build
```

### Wrong Project Context

Set `MAESTRO_PROJECT_ID` when adding the MCP server:

```bash
claude mcp add --transport stdio maestro \
  --env MAESTRO_PROJECT_ID="proj_your_actual_project_id" \
  -- node maestro-mcp-server/index.js
```

### Server Not Starting

```bash
# Check server can run
node maestro-mcp-server/index.js
# Should output: "Maestro MCP Server running on stdio"

# Check dependencies installed
cd maestro-mcp-server && npm install
```

### Tools Not Appearing

In Claude Code, check MCP status:

```
> /mcp
```

You should see "maestro" server listed with its tools.

## Advanced Usage

### Multiple Projects

You can add multiple Maestro servers for different projects:

```bash
# Project 1
claude mcp add --transport stdio maestro-project1 \
  --env MAESTRO_PROJECT_ID="proj_1" \
  -- node maestro-mcp-server/index.js

# Project 2
claude mcp add --transport stdio maestro-project2 \
  --env MAESTRO_PROJECT_ID="proj_2" \
  -- node maestro-mcp-server/index.js
```

### Custom Environment Variables

```bash
claude mcp add --transport stdio maestro \
  --env MAESTRO_API_URL="http://localhost:3000" \
  --env MAESTRO_PROJECT_ID="proj_123" \
  --env MAESTRO_SESSION_ID="sess_456" \
  --env MAESTRO_TASK_IDS="task_1,task_2" \
  -- node maestro-mcp-server/index.js
```

### Remote Server

If your Maestro server is remote:

```bash
claude mcp add --transport stdio maestro \
  --env MAESTRO_API_URL="https://maestro.example.com" \
  -- node maestro-mcp-server/index.js
```

## Next Steps

1. **Extend MCP Server**: Add more Maestro CLI commands as MCP tools
2. **Create Skills**: Package common workflows as Claude Code skills
3. **Add Resources**: Expose project files and docs via MCP resources
4. **Build Prompts**: Define MCP prompts for common operations

## Documentation

- **MCP Specification**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Claude Code MCP Docs**: Use the `claude-code-guide` skill
- **Maestro CLI Docs**: See `maestro-cli/README.md`
- **MCP Server Code**: See `maestro-mcp-server/index.js`

## Support

If you encounter issues:

1. Check Maestro Server is running (`curl http://localhost:3000/api/health`)
2. Verify CLI works (`maestro task list --json`)
3. Test MCP server manually (see `maestro-mcp-server/README.md`)
4. Check Claude Code logs (`claude --verbose`)

Happy orchestrating! 🎵
