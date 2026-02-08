# Deployment Guide

## Overview

Production deployment with Docker, environment configuration, and health monitoring.

**Goal:** Deploy Maestro to production with minimal manual intervention.

**Estimated Effort:** 6-8 hours

---

## Docker Setup (3 hours)

### Maestro Server Dockerfile

**File:** `maestro-server/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start server
CMD ["node", "dist/index.js"]
```

### Docker Compose

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  maestro-server:
    build: ./maestro-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  maestro-ui:
    build: .
    ports:
      - "5173:5173"
    depends_on:
      - maestro-server
    environment:
      - VITE_API_URL=http://localhost:3000
    restart: unless-stopped
```

---

## Environment Configuration (1 hour)

### Environment Files

**File:** `.env.production`

```env
# Maestro Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# WebSocket
WS_PORT=3000

# CORS
CORS_ORIGIN=http://localhost:5173

# Database (if using external DB later)
# DATABASE_URL=postgresql://...
```

**File:** `maestro-server/.env.example`

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
```

### Configuration Loader

**File:** `maestro-server/src/config.ts`

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};
```

---

## Health Checks (1 hour)

### Health Endpoint

**File:** `maestro-server/src/api/health.ts`

```typescript
import express from 'express';
import { db } from '../db';

const router = express.Router();

router.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: db.tasks.size >= 0 ? 'ok' : 'error',
      websocket: 'ok' // Add actual check
    }
  };

  const statusCode = health.services.database === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/metrics', (req, res) => {
  res.json({
    tasks: {
      total: db.tasks.size,
      byStatus: {} // Calculate from tasks
    },
    sessions: {
      active: Array.from(db.sessions.values()).filter(s => s.status === 'active').length
    },
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

export default router;
```

### Healthcheck Script

**File:** `maestro-server/healthcheck.js`

```javascript
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.error('Health check failed:', err);
  process.exit(1);
});

request.end();
```

---

## Build Optimization (1 hour)

### Production Build

**File:** `vite.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@xterm/xterm']
        }
      }
    }
  }
});
```

**File:** `maestro-server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "tests"]
}
```

---

## Deployment Scripts (2 hours)

### Production Deployment

**File:** `scripts/deploy-production.sh`

```bash
#!/bin/bash

set -e

echo "🚀 Deploying to production..."

# Build Docker images
echo "📦 Building images..."
docker-compose build

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start new containers
echo "▶️  Starting new containers..."
docker-compose up -d

# Wait for health check
echo "🏥 Waiting for health check..."
sleep 5

# Verify health
HEALTH=$(curl -s http://localhost:3000/health | jq -r '.status')
if [ "$HEALTH" = "ok" ]; then
  echo "✅ Deployment successful!"
else
  echo "❌ Health check failed!"
  exit 1
fi

echo "📊 Metrics:"
curl -s http://localhost:3000/metrics | jq '.'
```

Make executable:
```bash
chmod +x scripts/deploy-production.sh
```

### Rollback Script

**File:** `scripts/rollback.sh`

```bash
#!/bin/bash

set -e

echo "⏪ Rolling back to previous version..."

# Pull previous image tag
PREVIOUS_TAG=$(git describe --abbrev=0 HEAD^)
echo "Rolling back to tag: $PREVIOUS_TAG"

# Checkout previous version
git checkout $PREVIOUS_TAG

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

echo "✅ Rollback complete"
```

---

## Monitoring & Logging (1 hour)

### Logging

**File:** `maestro-server/src/logger.ts`

```typescript
import winston from 'winston';
import { config } from './config';

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});
```

Use in code:

```typescript
import { logger } from './logger';

logger.info('Server started', { port: config.port });
logger.error('Failed to create task', { error: err.message });
```

---

## Deployment Checklist

- [ ] Create Dockerfile for maestro-server
- [ ] Create docker-compose.yml
- [ ] Add environment configuration
- [ ] Implement /health endpoint
- [ ] Implement /metrics endpoint
- [ ] Create healthcheck.js script
- [ ] Optimize production build
- [ ] Create deploy-production.sh script
- [ ] Create rollback.sh script
- [ ] Set up logging with winston
- [ ] Test Docker build and run
- [ ] Test health checks
- [ ] Document deployment process

---

## Production Readiness

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review complete
- [ ] Environment variables configured
- [ ] Secrets stored securely

### Post-Deployment
- [ ] Health check responding
- [ ] Logs being written
- [ ] Metrics accessible
- [ ] All services running

---

**Implementation Status:** 📋 Ready to Implement
**Dependencies:** All modules (deploy after testing complete)
**Enables:** Production deployment, Automated rollback
