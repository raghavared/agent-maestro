# Maestro Server - Configuration Specification

**Version:** 1.0.0
**Last Updated:** 2026-02-04
**Purpose:** Define all configuration options and environment variables

---

## Configuration Philosophy

Maestro Server follows a **zero-configuration** approach with sensible defaults:

- **No config files** - All configuration via environment variables
- **Convention over configuration** - Smart defaults for local development
- **Override via environment** - Environment variables override defaults
- **No runtime reconfiguration** - Configuration set at startup only

---

## Environment Variables

### Core Server Configuration

#### PORT
**Purpose:** HTTP server listening port
**Type:** Number
**Default:** `3000`
**Required:** No
**Location:** `src/server.ts:7`

```bash
# Default
PORT=3000 npm start

# Custom port
PORT=8080 npm start
```

**Impact:**
- HTTP server listens on this port
- WebSocket server attached to same port
- Health check available at `http://localhost:{PORT}/health`
- API available at `http://localhost:{PORT}/api/*`

**Validation:** Must be valid port number (1-65535)

---

#### DATA_DIR
**Purpose:** Root directory for persistent storage
**Type:** String (absolute path)
**Default:** `~/.maestro/data`
**Required:** No
**Location:** `src/storage.ts:27`

```bash
# Default
npm start
# Uses: /Users/username/.maestro/data

# Custom directory
DATA_DIR=/var/lib/maestro npm start
```

**Impact:**
- Storage creates subdirectories: `projects/`, `tasks/`, `sessions/`
- All entity JSON files written here
- Directory created recursively if doesn't exist

**Validation:** Must be valid directory path, write permissions required

---

#### SERVER_URL
**Purpose:** Server URL for manifest generation and CLI communication
**Type:** String (URL)
**Default:** `http://localhost:3000`
**Required:** No
**Location:** `src/api/sessions.ts:478`

```bash
# Default (local development)
npm start

# Custom URL (production)
SERVER_URL=https://maestro.example.com npm start
```

**Impact:**
- Passed to CLI during manifest generation
- Included in session environment variables
- Used by spawned CLI sessions to communicate back

---

#### DEBUG
**Purpose:** Enable verbose debug logging
**Type:** Boolean
**Default:** `false`
**Required:** No
**Location:** `src/websocket.ts:42`

```bash
DEBUG=true npm start
```

---

## Configuration Examples

### Development
```bash
PORT=3000 DATA_DIR=~/.maestro/data DEBUG=true npm run dev
```

### Production
```bash
PORT=3000 DATA_DIR=/var/lib/maestro/data SERVER_URL=https://maestro.example.com npm start
```

---

**Related:** `11-DEPLOYMENT-SPECIFICATION.md`
