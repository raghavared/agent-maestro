# Maestro Server - Configuration Specification

**Version:** 2.0.0
**Last Updated:** 2026-02-08
**Purpose:** Define all configuration options and environment variables

---

## Configuration Philosophy

Maestro Server follows a **zero-configuration** approach with sensible defaults:

- **No config files** - All configuration via environment variables
- **Convention over configuration** - Smart defaults for local development
- **Override via environment** - Environment variables override defaults
- **No runtime reconfiguration** - Configuration set at startup only
- **Centralized Config class** - All config loaded and validated in `Config` class

---

## Config Class

All configuration is managed by the `Config` class (`src/infrastructure/config/Config.ts`). It:

1. Loads all environment variables at construction time
2. Applies sensible defaults
3. Validates configuration values (throws `ConfigError` on invalid config)
4. Provides readonly accessors for all config values
5. Supports `~` expansion in paths

```typescript
export class Config implements Readonly<ConfigOptions> {
  constructor() {
    this.config = this.loadFromEnvironment();
    this.validate();
  }

  // Readonly accessors
  get port(): number;
  get host(): string;
  get serverUrl(): string;
  get dataDir(): string;
  get sessionDir(): string;
  get skillsDir(): string;
  get database(): DatabaseConfig;
  get manifestGenerator(): ManifestGeneratorConfig;
  get cors(): CorsConfig;
  get debug(): boolean;
  get log(): LogConfig;
  get nodeEnv(): 'development' | 'production' | 'test';

  // Helper methods
  get isDevelopment(): boolean;
  get isProduction(): boolean;
  get isTest(): boolean;

  static fromObject(overrides: Partial<ConfigOptions>): Config;
  toJSON(): ConfigOptions;
  toString(): string;
}
```

### ConfigOptions Interface

```typescript
interface ConfigOptions {
  // Server
  port: number;
  host: string;
  serverUrl: string;

  // Storage paths
  dataDir: string;
  sessionDir: string;
  skillsDir: string;

  // Database
  database: DatabaseConfig;

  // Features
  manifestGenerator: ManifestGeneratorConfig;
  cors: CorsConfig;

  // Operational
  debug: boolean;
  log: LogConfig;

  // Environment
  nodeEnv: 'development' | 'production' | 'test';
}
```

---

## Environment Variables

### Core Server Configuration

#### PORT
**Purpose:** HTTP server listening port
**Type:** Number
**Default:** `3000`
**Required:** No

```bash
PORT=8080 npm start
```

**Impact:**
- HTTP server listens on this port
- WebSocket server attached to same port
- Health check available at `http://localhost:{PORT}/health`
- API available at `http://localhost:{PORT}/api/*`

**Validation:** Must be between 1 and 65535

---

#### HOST
**Purpose:** HTTP server bind address
**Type:** String
**Default:** `0.0.0.0`
**Required:** No

```bash
HOST=127.0.0.1 npm start
```

**Impact:**
- Determines which network interfaces the server listens on
- `0.0.0.0` listens on all interfaces
- `127.0.0.1` listens only on localhost

---

#### SERVER_URL
**Purpose:** Server URL for manifest generation and CLI communication
**Type:** String (URL)
**Default:** `http://localhost:{PORT}`
**Required:** No

```bash
SERVER_URL=https://maestro.example.com npm start
```

**Impact:**
- Passed to CLI during manifest generation
- Included in session environment variables as `MAESTRO_SERVER_URL`
- Used by spawned CLI sessions to communicate back

---

### Storage Configuration

#### DATA_DIR
**Purpose:** Root directory for persistent storage
**Type:** String (path, supports `~`)
**Default:** `~/.maestro/data`
**Required:** No

```bash
DATA_DIR=/var/lib/maestro/data npm start
```

**Impact:**
- Storage creates subdirectories: `projects/`, `tasks/`, `sessions/`, `queues/`, `templates/`
- All entity JSON files written here
- Directory created recursively if doesn't exist

**Validation:** Must be valid directory path, write permissions required

---

#### SESSION_DIR
**Purpose:** Directory for CLI-generated session manifests
**Type:** String (path, supports `~`)
**Default:** `~/.maestro/sessions`
**Required:** No

```bash
SESSION_DIR=/var/lib/maestro/sessions npm start
```

**Impact:**
- Session manifest files written here as `{session-id}/manifest.json`
- Used by CLI to locate manifest when spawning sessions

---

#### SKILLS_DIR
**Purpose:** Directory containing skill definitions
**Type:** String (path, supports `~`)
**Default:** `~/.agents-ui/maestro-skills`
**Required:** No

```bash
SKILLS_DIR=/opt/maestro/skills npm start
```

**Impact:**
- Skills loaded from subdirectories in this path
- Each subdirectory should contain `manifest.json` and `skill.md`

---

### Database Configuration

#### DATABASE_TYPE
**Purpose:** Storage backend type
**Type:** `'filesystem'` | `'postgres'`
**Default:** `filesystem`
**Required:** No

```bash
DATABASE_TYPE=postgres npm start
```

**Impact:**
- `filesystem`: Uses FileSystem repositories (JSON files)
- `postgres`: Would use PostgreSQL repositories (not yet implemented)

**Validation:** Must be `"filesystem"` or `"postgres"`

---

#### DATABASE_URL
**Purpose:** PostgreSQL connection URL
**Type:** String (URL)
**Default:** None
**Required:** Only when `DATABASE_TYPE=postgres`

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/maestro npm start
```

**Format:** `postgres://user:password@host:port/database?ssl=true&max=10`

**Parsed Fields:**
- `host` - Database host
- `port` - Database port (default: 5432)
- `database` - Database name
- `user` - Username
- `password` - Password
- `ssl` - Enable SSL (query param)
- `max` - Max connections (query param, default: 10)

**Validation:** Must be valid URL. Throws `ConfigError` if invalid.

---

### Manifest Generator Configuration

#### MANIFEST_GENERATOR
**Purpose:** Manifest generation strategy
**Type:** `'cli'` | `'server'`
**Default:** `cli`
**Required:** No

```bash
MANIFEST_GENERATOR=server npm start
```

**Impact:**
- `cli`: Uses `maestro manifest generate` CLI command (current)
- `server`: Would use server-side generation (not yet implemented)

**Validation:** Must be `"cli"` or `"server"`

---

#### MAESTRO_CLI_PATH
**Purpose:** Path to the maestro CLI binary
**Type:** String
**Default:** `maestro`
**Required:** No

```bash
MAESTRO_CLI_PATH=/usr/local/bin/maestro npm start
```

**Impact:**
- Used as the binary name/path when spawning CLI for manifest generation
- Default `maestro` relies on PATH resolution

---

### CORS Configuration

#### CORS_ENABLED
**Purpose:** Enable/disable CORS middleware
**Type:** Boolean (string)
**Default:** `true` (enabled unless explicitly `'false'`)
**Required:** No

```bash
CORS_ENABLED=false npm start
```

---

#### CORS_ORIGINS
**Purpose:** Allowed CORS origins
**Type:** Comma-separated string
**Default:** `*` (all origins)
**Required:** No

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:3001 npm start
```

---

#### CORS_CREDENTIALS
**Purpose:** Allow credentials in CORS requests
**Type:** Boolean (string)
**Default:** `false`
**Required:** No

```bash
CORS_CREDENTIALS=true npm start
```

---

### Logging Configuration

#### LOG_LEVEL
**Purpose:** Minimum log level
**Type:** `'error'` | `'warn'` | `'info'` | `'debug'`
**Default:** `info`
**Required:** No

```bash
LOG_LEVEL=debug npm start
```

**Validation:** Must be one of: `error`, `warn`, `info`, `debug`

---

#### LOG_FORMAT
**Purpose:** Log output format
**Type:** `'json'` | `'pretty'`
**Default:** `pretty`
**Required:** No

```bash
LOG_FORMAT=json npm start
```

---

#### LOG_FILE
**Purpose:** File path for log output
**Type:** String (path)
**Default:** None (console only)
**Required:** No

```bash
LOG_FILE=/var/log/maestro.log npm start
```

---

#### DEBUG
**Purpose:** Enable verbose debug logging
**Type:** Boolean (string)
**Default:** `false`
**Required:** No

```bash
DEBUG=true npm start
```

**Impact:**
- Enables additional debug-level log output
- Shows WebSocket broadcast details

---

### Environment

#### NODE_ENV
**Purpose:** Runtime environment
**Type:** `'development'` | `'production'` | `'test'`
**Default:** `development`
**Required:** No

```bash
NODE_ENV=production npm start
```

**Validation:** Must be one of: `development`, `production`, `test`

**Impact:**
- Affects error detail verbosity
- Config provides `isDevelopment`, `isProduction`, `isTest` helper getters

---

## Configuration Sub-Interfaces

### DatabaseConfig

```typescript
interface DatabaseConfig {
  type: 'filesystem' | 'postgres';
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
  };
}
```

### CorsConfig

```typescript
interface CorsConfig {
  enabled: boolean;
  origins: string[];
  credentials?: boolean;
}
```

### ManifestGeneratorConfig

```typescript
interface ManifestGeneratorConfig {
  type: 'cli' | 'server';
  cliPath?: string;
}
```

### LogConfig

```typescript
interface LogConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'pretty';
  file?: string;
}
```

---

## Configuration Validation

The `Config.validate()` method checks:

1. **Port range** - Must be 1-65535
2. **Database type** - Must be `filesystem` or `postgres`
3. **Postgres URL** - Required when `DATABASE_TYPE=postgres`
4. **Manifest generator** - Must be `cli` or `server`
5. **Log level** - Must be `error`, `warn`, `info`, or `debug`
6. **Node env** - Must be `development`, `production`, or `test`

Invalid configuration throws `ConfigError` (HTTP 500).

---

## Environment Variable Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `SERVER_URL` | `http://localhost:{PORT}` | Public server URL |
| `DATA_DIR` | `~/.maestro/data` | Data storage root |
| `SESSION_DIR` | `~/.maestro/sessions` | Manifest storage |
| `SKILLS_DIR` | `~/.agents-ui/maestro-skills` | Skills directory |
| `DATABASE_TYPE` | `filesystem` | Storage backend |
| `DATABASE_URL` | - | PostgreSQL URL |
| `MANIFEST_GENERATOR` | `cli` | Manifest strategy |
| `MAESTRO_CLI_PATH` | `maestro` | CLI binary path |
| `CORS_ENABLED` | `true` | Enable CORS |
| `CORS_ORIGINS` | `*` | Allowed origins |
| `CORS_CREDENTIALS` | `false` | Allow credentials |
| `LOG_LEVEL` | `info` | Min log level |
| `LOG_FORMAT` | `pretty` | Log format |
| `LOG_FILE` | - | Log file path |
| `DEBUG` | `false` | Debug logging |
| `NODE_ENV` | `development` | Runtime env |

---

## Configuration Examples

### Development (defaults)
```bash
npm run dev
# Equivalent to:
PORT=3000 HOST=0.0.0.0 DATA_DIR=~/.maestro/data NODE_ENV=development npm run dev
```

### Development (verbose)
```bash
PORT=3000 DEBUG=true LOG_LEVEL=debug npm run dev
```

### Production
```bash
PORT=3000 \
  NODE_ENV=production \
  DATA_DIR=/var/lib/maestro/data \
  SESSION_DIR=/var/lib/maestro/sessions \
  SERVER_URL=https://maestro.example.com \
  CORS_ORIGINS=https://maestro.example.com \
  LOG_FORMAT=json \
  LOG_FILE=/var/log/maestro.log \
  npm start
```

### With PostgreSQL (future)
```bash
DATABASE_TYPE=postgres \
  DATABASE_URL=postgres://maestro:secret@localhost:5432/maestro?ssl=true \
  npm start
```

---

## Session Environment Variables

When spawning sessions, the server injects these environment variables:

| Variable | Description |
|----------|-------------|
| `MAESTRO_SESSION_ID` | Session ID |
| `MAESTRO_MANIFEST_PATH` | Path to generated manifest file |
| `MAESTRO_SERVER_URL` | Server URL for API calls |
| `MAESTRO_STRATEGY` | Worker strategy (`simple`, `queue`, `tree`) |

These are set in the session's `env` field and passed via the `session:spawn` WebSocket event.

---

**Related:** `01-SYSTEM-OVERVIEW.md`, `11-DEPLOYMENT-SPECIFICATION.md`
