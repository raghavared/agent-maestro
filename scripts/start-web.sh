#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Maestro Web UI launcher
#
# Builds the browser SPA (maestro-ui) + the server, then runs the server under
# Node with server-hosted PTYs enabled. The server serves the SPA from its own
# origin, so the browser talks same-origin for REST, WS, and PTY streaming —
# making both session SPAWN and RESUME work in the browser.
#
# Notes:
#   - Runs the server under `node` (NOT bun): node-pty's onData doesn't fire
#     under bun, which would break the server-hosted terminals.
#   - MAESTRO_PTY_HOST=server is what makes spawn/resume start the agent PTY
#     server-side instead of relying on the Tauri desktop host.
#
# Env overrides:
#   PORT          server + UI port            (default 4570)
#   HOST          bind address                (default 0.0.0.0)
#   DATA_DIR      data directory              (default ~/.maestro/data)
#   SESSION_DIR   session directory           (default ~/.maestro/sessions)
#   SKIP_BUILD=1  skip the UI + server build  (default: build both)
# ============================================================================

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-4570}"
HOST="${HOST:-0.0.0.0}"
DATA_DIR="${DATA_DIR:-$HOME/.maestro/data}"
SESSION_DIR="${SESSION_DIR:-$HOME/.maestro/sessions}"
UI_URL="http://localhost:${PORT}"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  # tsc may exit non-zero on pre-existing type warnings (e.g. node-pty types)
  # while still emitting valid JS, so we verify the build OUTPUT exists rather
  # than trusting the exit code. A truly failed build (no output) aborts.
  echo "[1/3] Building browser UI (maestro-ui -> dist)..."
  ( cd maestro-ui && bun run build ) || echo "  (UI build reported issues; checking output...)"
  if [ ! -f maestro-ui/dist/index.html ]; then
    echo "ERROR: UI build produced no maestro-ui/dist/index.html. Aborting." >&2
    exit 1
  fi

  echo "[2/3] Building server (maestro-server -> dist)..."
  ( cd maestro-server && bun run build ) || echo "  (server build reported issues; checking output...)"
  if [ ! -f maestro-server/dist/server.js ]; then
    echo "ERROR: server build produced no maestro-server/dist/server.js. Aborting." >&2
    echo "  Hint: run 'bun install' at the repo root (node-pty may be missing)." >&2
    exit 1
  fi
else
  echo "Skipping build (SKIP_BUILD=1)."
  if [ ! -f maestro-ui/dist/index.html ]; then
    echo "  WARNING: maestro-ui/dist/index.html not found — the browser UI won't be served."
    echo "  Run without SKIP_BUILD once to build it."
  fi
fi

echo ""
echo "=========================================================="
echo "  Maestro Web UI is starting."
echo ""
echo "  Open in your browser:  ${UI_URL}"
echo ""
echo "  Data:    ${DATA_DIR}"
echo "  Session: ${SESSION_DIR}"
echo "=========================================================="
echo ""

exec env \
  PORT="$PORT" \
  HOST="$HOST" \
  MAESTRO_PTY_HOST=server \
  SERVER_URL="$UI_URL" \
  DATA_DIR="$DATA_DIR" \
  SESSION_DIR="$SESSION_DIR" \
  NODE_ENV=production \
  node maestro-server/dist/server.js
