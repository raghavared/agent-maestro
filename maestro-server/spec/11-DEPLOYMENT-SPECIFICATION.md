# Maestro Server - Deployment Specification

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Purpose:** Define runtime requirements and deployment procedures

---

## Runtime Requirements

### Node.js Environment
- **Node.js:** >= 16.x (tested on 16.x, 18.x, 20.x)
- **npm:** >= 8.x
- **TypeScript:** ^5.0.0 (dev dependency)

### System Requirements
- **OS:** macOS, Linux, Windows (cross-platform)
- **Memory:** 256MB minimum, 512MB recommended
- **Disk:** 100MB + data storage
- **Network:** Port 3000 (or custom via PORT env)

---

## Dependencies

### Production Dependencies
```json
{
  "express": "^4.18.2",
  "ws": "^8.14.2",
  "cors": "^2.8.5"
}
```

### External Dependencies
- **Maestro CLI:** Required for manifest generation
  - Install: `npm install -g maestro-cli`
  - Must be in PATH
  - Used by spawn endpoint

---

## Directory Requirements

### Storage Directory
**Path:** `~/.maestro/data/` (or DATA_DIR env)
**Structure:**
```
~/.maestro/
└── data/
    ├── projects/
    ├── tasks/
    └── sessions/
```

### Manifest Directory
**Path:** `~/.maestro/sessions/`
**Created by:** CLI during manifest generation

### Skills Directory
**Path:** `~/.agents-ui/maestro-skills/`
**Contains:** Skill definitions (manifest.json, skill.md)

---

## Development Setup

### Install Dependencies
```bash
cd maestro-server
npm install
```

### Build TypeScript
```bash
npm run build
```

### Start Development Server
```bash
npm run dev
```

### Run Production Build
```bash
npm start
```

---

## Production Deployment

### Systemd Service (Linux)
```ini
[Unit]
Description=Maestro Server
After=network.target

[Service]
Type=simple
User=maestro
WorkingDirectory=/opt/maestro-server
Environment=PORT=3000
Environment=DATA_DIR=/var/lib/maestro/data
Environment=SERVER_URL=https://maestro.example.com
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
ENV PORT=3000
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Startup Sequence

1. Load environment variables
2. Initialize Express app
3. Initialize Storage (create directories, load data)
4. Register API routes
5. Start HTTP server
6. Attach WebSocket server
7. Register event listeners
8. Log "Server running"

**Duration:** < 1 second

---

## Graceful Shutdown

### SIGINT Handler (src/server.ts:64-105)
```javascript
process.on('SIGINT', async () => {
  // 1. Close WebSocket connections
  // 2. Close WebSocket server
  // 3. Save storage to disk
  // 4. Close HTTP server
  // 5. Exit process
});
```

**Timeout:** 5 seconds (force exit if hangs)

---

## Health Monitoring

### Health Check Endpoint
```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1738713600000,
  "uptime": 123.456
}
```

---

## Production Considerations

### Reverse Proxy (nginx)
```nginx
server {
    listen 443 ssl;
    server_name maestro.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Database Migration
**Current:** File-based storage
**Future:** PostgreSQL
- See `spec-review/02-DECOUPLING-PLAN.md`
- Requires storage layer refactoring

### Authentication
**Current:** None
**Future:** JWT tokens
- See `spec-review/01-CURRENT-ISSUES.md`

---

**Related:** `10-CONFIGURATION-SPECIFICATION.md`, `spec-review/03-REFACTORING-ROADMAP.md`
