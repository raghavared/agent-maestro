# Install Guide

> **Fastest path:** `./install.sh` on macOS — builds everything in one step

---

## Prerequisites

| Requirement | Full Install | Server-Only | Docker |
|-------------|:---:|:---:|:---:|
| **Node.js 18+** | Required | Required | - |
| **bun** | Auto-installed | Auto-installed | - |
| **Rust + Cargo** | Required | - | - |
| **Xcode CLI Tools** | Required | Required | - |
| **Docker** | - | - | Required |
| **Anthropic API Key** | Required | Required | Required |

Make sure `ANTHROPIC_API_KEY` is set in your shell environment:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Add it to your `~/.zshrc` or `~/.bashrc` for persistence.

---

## Method 1: Full Install (Recommended)

Builds the server, CLI, and desktop app from source.

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
./install.sh
```

### What happens

```
info  Checking for Xcode Command Line Tools...
done  Xcode Command Line Tools found
info  Checking for bun...
done  bun found: 1.1.38
info  Checking for Node.js and npm...
done  Node.js found: v22.14.0
done  npm found: 10.9.2
info  Checking for Rust/Cargo...
done  Rust found: rustc 1.83.0

info  This will build Maestro from source and install:
info    CLI + Server  → ~/.maestro/bin
info    Desktop app   → /Applications/Maestro.app

  Continue? [Y/n]

info  [1/6] Installing dependencies...
done  Dependencies installed

info  [2/6] Building server...
done  Server built

info  [3/6] Building CLI...
done  CLI built

info  [4/6] Building UI and desktop app (Tauri)...
done  Desktop app built

info  [5/6] Installing CLI and server to ~/.maestro/bin...
done  Installed binaries to ~/.maestro/bin

info  [6/6] Installing desktop app to /Applications...
done  Installed Maestro.app to /Applications
```

### What gets installed

| Component | Location |
|-----------|----------|
| CLI | `~/.maestro/bin/maestro` |
| Server binary | `~/.maestro/bin/maestro-server` |
| Desktop app | `/Applications/Maestro.app` |
| Config | `~/.maestro/config` |
| Data directory | `~/.maestro/data/` |

The installer adds `~/.maestro/bin` to your PATH via `~/.zshrc` (or `~/.bashrc`).

### Verify

```bash
maestro --version
maestro-server &
curl -s http://localhost:2357/health
```

```json
{"status":"ok","timestamp":1709640001000,"uptime":1.023}
```

> **Tip:** Pass `-y` to skip the confirmation prompt: `./install.sh -y`

---

## Method 2: Server-Only (No Desktop App)

Skips the Tauri desktop app. No Rust toolchain needed — just Node.js and bun.

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
./install.sh --server-only
```

```
info  [1/4] Installing dependencies...
done  Dependencies installed

info  [2/4] Building server...
done  Server built

info  [3/4] Building CLI...
done  CLI built

info  [4/4] Installing CLI and server to ~/.maestro/bin...
done  Installed binaries to ~/.maestro/bin

Maestro has been built and installed!

  CLI         ~/.maestro/bin/maestro
  Server      ~/.maestro/bin/maestro-server
```

Everything works the same — you just use the CLI instead of the desktop app. See the [CLI-only Quickstart](quickstart-cli-only.md).

---

## Method 3: Docker

Run the Maestro server in a container — works on any platform with Docker.

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
docker compose up
```

The server starts on port 2357. Data is persisted to a Docker volume.

Point the CLI at the Docker server:

```bash
export MAESTRO_API_URL=http://localhost:2357
```

> **Note:** The CLI still needs to be installed locally (or run via `npx`). Docker runs the server only.

---

## Method 4: Development Mode

For contributors or those who want to modify Maestro:

```bash
git clone https://github.com/subhangR/agent-maestro.git
cd agent-maestro
bun install     # Install all dependencies
```

Run the server in development mode (port 3000):

```bash
bun run dev:server
```

Run everything (server + desktop app) in dev mode:

```bash
bun run dev:all
```

Build all packages:

```bash
bun run build:all
```

### Development Ports

| Environment | Port |
|-------------|------|
| Development | 3000 |
| Production (installed) | 2357 |

---

## Method 5: Manual Install (Step by Step)

If you need fine-grained control over each component:

### 1. Build the server

```bash
cd maestro-server
bun install
bun run build
```

Start it:

```bash
PORT=2357 DATA_DIR=~/.maestro/data SESSION_DIR=~/.maestro/sessions \
  NODE_ENV=production node dist/server.js
```

### 2. Build the CLI

```bash
cd maestro-cli
bun install
bun run build
bun run bundle
```

The bundled CLI is at `maestro-cli/dist/bundle.cjs`. Run it with:

```bash
bun maestro-cli/dist/bundle.cjs --help
```

Or copy it to your PATH:

```bash
mkdir -p ~/.maestro/bin ~/.maestro/cli
cp maestro-cli/dist/bundle.cjs ~/.maestro/cli/bundle.cjs

# Create wrapper script
cat > ~/.maestro/bin/maestro << 'EOF'
#!/bin/sh
exec bun "$HOME/.maestro/cli/bundle.cjs" "$@"
EOF
chmod +x ~/.maestro/bin/maestro
```

### 3. Build the desktop app (optional, requires Rust)

```bash
cd maestro-ui
bun install
bun run build       # Builds the Tauri app
```

The `.app` bundle is in `maestro-ui/src-tauri/target/release/bundle/macos/`.

---

## Configuration

After install, the config file is at `~/.maestro/config`:

```
MAESTRO_API_URL=http://localhost:2357
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAESTRO_API_URL` | `http://localhost:2357` | Server URL |
| `MAESTRO_PROJECT_ID` | *(none)* | Default project for CLI commands |
| `MAESTRO_SESSION_ID` | *(auto)* | Set automatically in sessions |
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |

---

## Data Storage

All Maestro data lives in `~/.maestro/`:

```
~/.maestro/
├── config                        # Server URL config
├── bin/
│   ├── maestro                   # CLI wrapper script
│   └── maestro-server            # Server binary
├── cli/
│   └── bundle.cjs                # Bundled CLI
├── data/
│   ├── projects/<id>.json        # Project records
│   ├── tasks/<id>.json           # Task records
│   ├── sessions/<id>.json        # Session records
│   ├── task-lists/<id>.json      # Task list records
│   ├── team-members/<pid>.json   # Team member records (per project)
│   ├── teams/<pid>.json          # Team records (per project)
│   └── orderings/                # UI ordering data
└── sessions/<id>/
    └── manifest.json             # Session manifest files
```

No database. Everything is plain JSON files on disk.

---

## Troubleshooting

### `command not found: maestro`

The installer adds `~/.maestro/bin` to your PATH in `~/.zshrc`. Reload your shell:

```bash
source ~/.zshrc
```

Or add it manually:

```bash
export PATH="$HOME/.maestro/bin:$PATH"
```

### Server won't start / port in use

Check if something is already running on port 2357:

```bash
lsof -i :2357
```

Kill it or use a different port:

```bash
PORT=2358 maestro-server
```

### Rust not found (full install)

Install Rust via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Or skip the desktop app entirely with `./install.sh --server-only`.

### Health check fails

Make sure the server is running:

```bash
maestro-server &
curl http://localhost:2357/health
```

Expected response:

```json
{"status":"ok","timestamp":...,"uptime":...}
```

---

## Uninstall

Remove all Maestro components:

```bash
# Remove binaries and data
rm -rf ~/.maestro

# Remove desktop app
rm -rf /Applications/Maestro.app

# Remove PATH entry from ~/.zshrc (edit manually)
```

---

## Next Steps

- **[Quickstart: Your First Task](quickstart-first-task.md)** — Get Claude working in 5 minutes
- **[Quickstart: CLI Only](quickstart-cli-only.md)** — Terminal-first workflow
- **[Quickstart: Desktop App](quickstart-desktop-app.md)** — Visual walkthrough
