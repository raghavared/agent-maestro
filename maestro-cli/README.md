# Maestro CLI

Command-line interface for the Maestro multi-agent orchestration system. Interact with Maestro agents, manage tasks, and control sessions from your terminal.

## Features

- **Task Management** - Create, list, update, and delete tasks
- **Session Control** - Start, stop, and monitor agent sessions
- **Agent Orchestration** - Coordinate multiple agents from the command line
- **Server Integration** - Connect to maestro-server for centralized management
- **Rich CLI Output** - Colorful tables, spinners, and formatted output

## Installation

### Global Installation

```bash
# Install globally
npm install -g @maestro/cli

# Or link for development
cd maestro-cli
npm install
npm run build
npm link
```

### Local Development

```bash
cd maestro-cli
npm install
npm run build
npm start
```

## Quick Start

```bash
# Check installation
maestro --version

# Get help
maestro --help

# List all tasks
maestro tasks list

# Create a new task
maestro tasks create "Implement feature X"

# Start an agent session
maestro agent start --type worker

# Check agent status
maestro agent status
```

## Commands

### Tasks

```bash
# List all tasks
maestro tasks list

# Create a task
maestro tasks create "Task description"

# Get task details
maestro tasks get <task-id>

# Update task status
maestro tasks update <task-id> --status completed

# Delete task
maestro tasks delete <task-id>
```

### Agents

```bash
# Start an agent
maestro agent start [--type orchestrator|worker]

# List running agents
maestro agent list

# Stop an agent
maestro agent stop <agent-id>

# Check agent status
maestro agent status <agent-id>
```

### Sessions

```bash
# List sessions
maestro session list

# Create new session
maestro session create [--name <name>]

# Get session details
maestro session get <session-id>

# Close session
maestro session close <session-id>
```

### Server

```bash
# Connect to server
maestro server connect <url>

# Check server status
maestro server status

# Disconnect
maestro server disconnect
```

## Configuration

### Configuration File

Create `~/.maestro/config.json`:

```json
{
  "server": {
    "url": "http://localhost:3000",
    "apiKey": "your-api-key"
  },
  "cli": {
    "colorOutput": true,
    "defaultAgent": "worker"
  }
}
```

### Environment Variables

- `MAESTRO_SERVER_URL` - Server URL (overrides config)
- `MAESTRO_API_KEY` - API key for authentication
- `MAESTRO_DEBUG` - Enable debug logging

## Project Structure

```
maestro-cli/
├── bin/
│   └── maestro.js       # CLI entry point
├── src/
│   ├── index.ts         # Main CLI logic
│   ├── commands/        # Command implementations
│   ├── utils/           # Utility functions
│   └── api/             # API client
├── tests/               # Test files
├── dist/                # Compiled JavaScript (generated)
├── package.json
└── tsconfig.json
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running Locally

```bash
# Build and run
npm run build
node dist/index.js --help

# Or use npm start
npm start -- --help
```

## Examples

### Task Management Workflow

```bash
# Create a task
maestro tasks create "Build authentication system"

# List tasks
maestro tasks list

# Update task
maestro tasks update task-123 --status in_progress

# Mark as complete
maestro tasks update task-123 --status completed
```

### Agent Orchestration

```bash
# Start orchestrator
maestro agent start --type orchestrator

# Start workers
maestro agent start --type worker --count 3

# Check status
maestro agent list

# Stop all agents
maestro agent stop --all
```

## Documentation

For detailed documentation, see the [main Maestro documentation](../maestro-docs/)

## License

AGPL-3.0-only - See LICENSE file in root directory
