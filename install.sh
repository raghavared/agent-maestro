#!/bin/bash
set -e

# ============================================================
#  Agent Maestro — Local Build & Install
#  Run from the repo root: ./install.sh
# ============================================================

# ── Color helpers ──────────────────────────────────────────

BOLD=""
DIM=""
RED=""
GREEN=""
YELLOW=""
BLUE=""
RESET=""

if [ -t 1 ] && [ -z "${CI:-}" ]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  RESET='\033[0m'
fi

info()    { printf "${BLUE}info${RESET}  %s\n" "$1"; }
success() { printf "${GREEN}done${RESET}  %s\n" "$1"; }
warn()    { printf "${YELLOW}warn${RESET}  %s\n" "$1"; }
error()   { printf "${RED}error${RESET} %s\n" "$1" >&2; }

# ── Resolve repo root ─────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

INSTALL_DIR="${MAESTRO_INSTALL:-$HOME/.maestro}"
APP_NAME="Agent Maestro"
APP_BUNDLE="${APP_NAME}.app"

# ── Check dependencies ────────────────────────────────────

info "Checking build dependencies..."

MISSING=""

if ! command -v bun >/dev/null 2>&1; then
  MISSING="${MISSING}  - bun (https://bun.sh)\n"
fi

if ! command -v cargo >/dev/null 2>&1; then
  MISSING="${MISSING}  - cargo/rustc (https://rustup.rs)\n"
fi

if ! command -v node >/dev/null 2>&1; then
  MISSING="${MISSING}  - node (https://nodejs.org)\n"
fi

if [ -n "$MISSING" ]; then
  error "Missing required build tools:"
  printf "$MISSING"
  exit 1
fi

success "All build dependencies found"

# ── Confirm ───────────────────────────────────────────────

printf "\n"
info "This will build Agent Maestro from source and install:"
info "  CLI + Server  → ${BOLD}$(echo "$INSTALL_DIR/bin" | sed "s|$HOME|~|")${RESET}"
info "  Desktop app   → ${BOLD}/Applications/${APP_BUNDLE}${RESET}"
printf "\n"

if [ "${1:-}" != "-y" ] && [ "${1:-}" != "--yes" ]; then
  printf "  Continue? [Y/n] "
  read -r REPLY </dev/tty || REPLY="y"
  case "$REPLY" in
    [nN]*) info "Cancelled."; exit 0 ;;
  esac
fi

# ── Step 1: Install dependencies ──────────────────────────

printf "\n"
info "[1/6] Installing dependencies..."
bun install
success "Dependencies installed"

# ── Step 2: Build server ──────────────────────────────────

printf "\n"
info "[2/6] Building server..."
bun run build:server
(cd maestro-server && bun run build:binary)
success "Server built"

# ── Step 3: Build CLI ─────────────────────────────────────

printf "\n"
info "[3/6] Building CLI..."
bun run build:cli
(cd maestro-cli && bun run bundle)
success "CLI built"

# ── Step 4: Build Tauri desktop app ───────────────────────

printf "\n"
info "[4/6] Building desktop app (Tauri)..."
cd maestro-ui
VITE_API_URL=http://localhost:2357/api VITE_WS_URL=ws://localhost:2357 \
  bunx tauri build --features custom-protocol --config src-tauri/tauri.conf.prod.json
cd "$REPO_DIR"
success "Desktop app built"

# ── Step 5: Install CLI + server to ~/.maestro/bin ────────

printf "\n"
info "[5/6] Installing CLI and server to $(echo "$INSTALL_DIR/bin" | sed "s|$HOME|~|")..."
mkdir -p "${INSTALL_DIR}/bin"

# Server binary from the Tauri sidecar build
if [ -f "maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin" ]; then
  cp "maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin" "${INSTALL_DIR}/bin/maestro-server"
elif [ -f "maestro-server/dist/bin/maestro-server" ]; then
  cp "maestro-server/dist/bin/maestro-server" "${INSTALL_DIR}/bin/maestro-server"
fi

# CLI: copy bundle and create shell wrapper (more reliable than pkg binary)
mkdir -p "${INSTALL_DIR}/cli"
if [ -f "maestro-cli/dist/bundle.cjs" ]; then
  cp "maestro-cli/dist/bundle.cjs" "${INSTALL_DIR}/cli/bundle.cjs"
  cat > "${INSTALL_DIR}/bin/maestro" << 'WRAPPER'
#!/bin/bash
exec node "$HOME/.maestro/cli/bundle.cjs" "$@"
WRAPPER
fi

chmod +x "${INSTALL_DIR}/bin/"* 2>/dev/null || true
success "Installed binaries to $(echo "$INSTALL_DIR/bin" | sed "s|$HOME|~|")"

# ── Step 6: Install .app to /Applications ─────────────────

printf "\n"
info "[6/6] Installing desktop app to /Applications..."

TAURI_APP="maestro-ui/src-tauri/target/release/bundle/macos/Maestro Prod.app"

if [ ! -d "$TAURI_APP" ]; then
  # Try the non-prod name
  TAURI_APP="maestro-ui/src-tauri/target/release/bundle/macos/${APP_BUNDLE}"
fi

if [ -d "$TAURI_APP" ]; then
  APP_DEST="/Applications/$(basename "$TAURI_APP")"
  if [ -d "$APP_DEST" ]; then
    rm -rf "$APP_DEST"
  fi
  cp -R "$TAURI_APP" "$APP_DEST"
  success "Installed $(basename "$TAURI_APP") to /Applications"
else
  warn "Desktop app bundle not found. You may need to copy it manually."
  warn "Check: maestro-ui/src-tauri/target/release/bundle/macos/"
fi

# ── Create config ──────────────────────────────────────────

CONFIG_FILE="${INSTALL_DIR}/config"
if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p "$INSTALL_DIR"
  cat > "$CONFIG_FILE" <<EOF
# Agent Maestro configuration
MAESTRO_API_URL=http://localhost:2357
EOF
  success "Created config at $(echo "$CONFIG_FILE" | sed "s|$HOME|~|")"
fi

# ── Update PATH ────────────────────────────────────────────

BIN_DIR="${INSTALL_DIR}/bin"
EXPORT_LINE="export PATH=\"${BIN_DIR}:\$PATH\""

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    ;;
  *)
    CURRENT_SHELL="$(basename "${SHELL:-/bin/sh}")"
    case "$CURRENT_SHELL" in
      zsh)  SHELL_RC="$HOME/.zshrc" ;;
      bash) SHELL_RC="${HOME}/.bashrc" ; [ ! -f "$SHELL_RC" ] && SHELL_RC="$HOME/.bash_profile" ;;
      fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
      *)    SHELL_RC="" ;;
    esac

    if [ -n "$SHELL_RC" ]; then
      if ! grep -qF "$BIN_DIR" "$SHELL_RC" 2>/dev/null; then
        printf '\n# Agent Maestro\n%s\n' "$EXPORT_LINE" >> "$SHELL_RC"
        success "Added $(echo "$BIN_DIR" | sed "s|$HOME|~|") to PATH in $(echo "$SHELL_RC" | sed "s|$HOME|~|")"
      fi
    fi
    ;;
esac

# ── Done ──────────────────────────────────────────────────

printf "\n"
printf "${GREEN}${BOLD}Agent Maestro has been built and installed!${RESET}\n"
printf "\n"
printf "  ${DIM}CLI${RESET}         $(echo "${INSTALL_DIR}/bin/maestro" | sed "s|$HOME|~|")\n"
printf "  ${DIM}Server${RESET}      $(echo "${INSTALL_DIR}/bin/maestro-server" | sed "s|$HOME|~|")\n"
printf "  ${DIM}Desktop${RESET}     /Applications/$(basename "${TAURI_APP:-$APP_BUNDLE}")\n"
printf "  ${DIM}Config${RESET}      $(echo "${INSTALL_DIR}/config" | sed "s|$HOME|~|")\n"
printf "\n"

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    ;;
  *)
    info "Restart your shell or run:"
    printf "\n"
    printf "  export PATH=\"%s:\$PATH\"\n" "$BIN_DIR"
    printf "\n"
    ;;
esac

info "Then run:"
printf "\n"
printf "  maestro --help\n"
printf "\n"
