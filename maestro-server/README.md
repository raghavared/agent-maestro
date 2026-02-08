# Maestro Server

Backend server for the Maestro multi-agent orchestration system. Provides task management, WebSocket communication, and API endpoints.

## Features

- **Task Management API** - RESTful endpoints for creating, updating, and querying tasks
- **WebSocket Support** - Real-time bidirectional communication for live updates
- **Session Management** - Persistent session state and coordination
- **Task Orchestration** - Handle task dependencies and execution flow

## Quick Start

### Prerequisites

- Node.js v18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start
```

### Development Mode

```bash
# Build and run with auto-reload
npm run dev

# Watch mode (rebuild on changes)
npm run watch
```

## API Endpoints

### Tasks

- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Sessions

- `GET /api/sessions` - List active sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `DELETE /api/sessions/:id` - Close session

### WebSocket

Connect to `ws://localhost:PORT` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  // Subscribe to task updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'tasks'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## Configuration

Environment variables:

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: localhost)
- `NODE_ENV` - Environment mode (development/production)

## Project Structure

```
maestro-server/
├── src/
│   ├── server.ts        # Main server entry point
│   ├── routes/          # API route handlers
│   ├── websocket/       # WebSocket handlers
│   ├── models/          # Data models
│   └── utils/           # Utility functions
├── test/                # Test files
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

## Documentation

For detailed API documentation and architecture, see [./docs/](./docs/)

## License

AGPL-3.0-only - See LICENSE file in root directory
