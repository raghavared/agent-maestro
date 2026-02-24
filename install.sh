#!/bin/bash
set -euo pipefail

# ============================================================
#  Maestro — Local Build & Install
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
die()     { error "$1"; exit 1; }

# ── Resolve repo root ─────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

INSTALL_DIR="${MAESTRO_INSTALL:-$HOME/.maestro}"
APP_NAME="Maestro"
APP_BUNDLE="${APP_NAME}.app"
APP_BUNDLE_DIR="maestro-ui/src-tauri/target/release/bundle/macos"
SIDE_CAR_BIN="maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin"
SERVER_BIN="maestro-server/dist/bin/maestro-server"
CLI_BUNDLE="maestro-cli/dist/bundle.cjs"

hash_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

require_file() {
  [ -f "$1" ] || die "Expected file not found: $1"
}

require_dir() {
  [ -d "$1" ] || die "Expected directory not found: $1"
}

# ── Check/Install Xcode Command Line Tools ────────────────

info "Checking for Xcode Command Line Tools..."
if ! xcode-select -p &>/dev/null; then
  warn "Xcode Command Line Tools not found."
  info "Triggering installation dialog — complete it, then re-run this script."
  xcode-select --install 2>/dev/null || true
  exit 1
fi
success "Xcode Command Line Tools found"

# ── Install bun if missing ────────────────────────────────

info "Checking for bun..."
if ! command -v bun >/dev/null 2>&1; then
  info "bun not found — installing..."
  curl -fsSL https://bun.sh/install | bash
  # Make bun available in the current shell session
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
  command -v bun >/dev/null 2>&1 || die "bun installation failed. Install manually: https://bun.sh"
  success "bun installed: $(bun --version)"
else
  # Ensure bun home is in PATH in case the shell rc wasn't sourced
  if [ -d "${HOME}/.bun/bin" ]; then
    export PATH="${HOME}/.bun/bin:${PATH}"
  fi
  success "bun found: $(bun --version)"
fi

# ── Install Rust/Cargo if missing (required for Tauri) ────

info "Checking for Rust/Cargo..."
# Source cargo env in case Rust is installed but not in the current PATH
if [ -f "${HOME}/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "${HOME}/.cargo/env"
fi
if ! command -v cargo >/dev/null 2>&1; then
  info "Rust/Cargo not found — installing via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck disable=SC1091
  source "${HOME}/.cargo/env"
  command -v cargo >/dev/null 2>&1 || die "Rust installation failed. Install manually: https://rustup.rs"
  success "Rust installed: $(rustc --version)"
else
  success "Rust found: $(rustc --version)"
fi

# Ensure the Apple Silicon target is present (required for Tauri on ARM Macs)
info "Ensuring Rust target aarch64-apple-darwin..."
rustup target add aarch64-apple-darwin 2>/dev/null || true
success "Rust target aarch64-apple-darwin ready"

# ── Clean stale build outputs ─────────────────────────────

printf "\n"
info "Cleaning stale build outputs..."
rm -rf maestro-ui/dist
rm -rf maestro-ui/src-tauri/target/release/bundle
rm -f maestro-ui/src-tauri/binaries/maestro-server-*
rm -rf maestro-server/dist
rm -rf maestro-cli/dist
success "Stale outputs removed"

# ── Confirm ───────────────────────────────────────────────

printf "\n"
info "This will build Maestro from source and install:"
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
(cd maestro-server && bun run build:binary:darwin-arm64)
success "Server built"

# ── Step 3: Build CLI ─────────────────────────────────────

printf "\n"
info "[3/6] Building CLI..."
bun run build:cli
(cd maestro-cli && bun run bundle)
success "CLI built"

# ── Step 4: Build UI + Tauri desktop app ──────────────────

printf "\n"
info "[4/6] Building UI and desktop app (Tauri)..."
bun run build:ui
cd maestro-ui
VITE_API_URL=http://localhost:2357/api VITE_WS_URL=ws://localhost:2357 \
  bunx tauri build --features custom-protocol --config src-tauri/tauri.conf.prod.json
cd "$REPO_DIR"
success "Desktop app built"

# ── Step 5: Install CLI + server to ~/.maestro/bin ────────

printf "\n"
info "[5/6] Installing CLI and server to $(echo "$INSTALL_DIR/bin" | sed "s|$HOME|~|")..."
mkdir -p "${INSTALL_DIR}/bin"

# Server binary (standalone)
require_file "$SERVER_BIN"
cp "$SERVER_BIN" "${INSTALL_DIR}/bin/maestro-server"

# CLI: copy bundle and create shell wrapper (more reliable than pkg binary)
mkdir -p "${INSTALL_DIR}/cli"
require_file "$CLI_BUNDLE"
cp "$CLI_BUNDLE" "${INSTALL_DIR}/cli/bundle.cjs"
cat > "${INSTALL_DIR}/bin/maestro" << 'WRAPPER'
#!/bin/bash
# Use bun if available, fall back to node
if command -v bun >/dev/null 2>&1; then
  exec bun "$HOME/.maestro/cli/bundle.cjs" "$@"
elif command -v node >/dev/null 2>&1; then
  exec node "$HOME/.maestro/cli/bundle.cjs" "$@"
else
  echo "Error: neither bun nor node found in PATH" >&2
  exit 1
fi
WRAPPER

chmod +x "${INSTALL_DIR}/bin/"* 2>/dev/null || true
success "Installed binaries to $(echo "$INSTALL_DIR/bin" | sed "s|$HOME|~|")"

# ── Step 6: Install .app to /Applications ─────────────────

printf "\n"
info "[6/6] Installing desktop app to /Applications..."

require_dir "$APP_BUNDLE_DIR"

APP_CANDIDATES=()
while IFS= read -r -d '' app_path; do
  APP_CANDIDATES+=("$app_path")
done < <(find "$APP_BUNDLE_DIR" -maxdepth 1 -type d -name "*.app" -print0)
if [ "${#APP_CANDIDATES[@]}" -eq 0 ]; then
  die "No .app bundle found in ${APP_BUNDLE_DIR}"
fi
if [ "${#APP_CANDIDATES[@]}" -gt 1 ]; then
  die "Multiple .app bundles found in ${APP_BUNDLE_DIR}; expected exactly one."
fi

TAURI_APP="${APP_CANDIDATES[0]}"
APP_DEST="/Applications/$(basename "$TAURI_APP")"

# Remove legacy/stale app bundles
for LEGACY_APP in "Agent Maestro.app" "Maestro Prod.app" "Maestro.app" "$(basename "$TAURI_APP")"; do
  if [ -d "/Applications/${LEGACY_APP}" ]; then
    rm -rf "/Applications/${LEGACY_APP}"
  fi
done

cp -R "$TAURI_APP" "$APP_DEST"
success "Installed $(basename "$TAURI_APP") to /Applications"

APP_EXEC="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "${TAURI_APP}/Contents/Info.plist" 2>/dev/null || true)"
if [ -z "$APP_EXEC" ]; then
  APP_EXEC="$(find "${TAURI_APP}/Contents/MacOS" -maxdepth 1 -type f -perm -111 -print | head -n 1 | xargs -I{} basename "{}")"
fi
[ -n "$APP_EXEC" ] || die "Unable to determine app executable in ${TAURI_APP}/Contents/MacOS"
BUILD_APP_EXEC="${TAURI_APP}/Contents/MacOS/${APP_EXEC}"
INSTALLED_APP_EXEC="${APP_DEST}/Contents/MacOS/${APP_EXEC}"
require_file "$BUILD_APP_EXEC"
require_file "$INSTALLED_APP_EXEC"

# ── Clear stale WebView cache ─────────────────────────────
# macOS WKWebView aggressively caches frontend assets; without
# clearing, the app may render an older UI after a rebuild.

APP_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${TAURI_APP}/Contents/Info.plist" 2>/dev/null || true)"
if [ -n "$APP_ID" ]; then
  for CACHE_DIR in \
    "$HOME/Library/WebKit/${APP_ID}" \
    "$HOME/Library/Caches/${APP_ID}"; do
    if [ -d "$CACHE_DIR" ]; then
      rm -rf "$CACHE_DIR"
    fi
  done
  success "Cleared WebView cache for ${APP_ID}"
fi

# ── Create config ──────────────────────────────────────────

CONFIG_FILE="${INSTALL_DIR}/config"
if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p "$INSTALL_DIR"
  cat > "$CONFIG_FILE" <<EOF
# Maestro configuration
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
        printf '\n# Maestro\n%s\n' "$EXPORT_LINE" >> "$SHELL_RC"
        success "Added $(echo "$BIN_DIR" | sed "s|$HOME|~|") to PATH in $(echo "$SHELL_RC" | sed "s|$HOME|~|")"
      fi
    fi
    ;;
esac

# ── Done ──────────────────────────────────────────────────

printf "\n"
printf "${GREEN}${BOLD}Maestro has been built and installed!${RESET}\n"
printf "\n"
printf "  ${DIM}CLI${RESET}         $(echo "${INSTALL_DIR}/bin/maestro" | sed "s|$HOME|~|")\n"
printf "  ${DIM}Server${RESET}      $(echo "${INSTALL_DIR}/bin/maestro-server" | sed "s|$HOME|~|")\n"
printf "  ${DIM}Desktop${RESET}     /Applications/$(basename "${TAURI_APP:-$APP_BUNDLE}")\n"
printf "  ${DIM}Config${RESET}      $(echo "${INSTALL_DIR}/config" | sed "s|$HOME|~|")\n"
printf "\n"

info "Verifying installed artifacts..."
require_file "$SIDE_CAR_BIN"
CLI_HASH_BUILD="$(hash_file "$CLI_BUNDLE")"
CLI_HASH_INSTALLED="$(hash_file "${INSTALL_DIR}/cli/bundle.cjs")"
SERVER_HASH_BUILD="$(hash_file "$SERVER_BIN")"
SERVER_HASH_INSTALLED="$(hash_file "${INSTALL_DIR}/bin/maestro-server")"
APP_HASH_BUILD="$(hash_file "$BUILD_APP_EXEC")"
APP_HASH_INSTALLED="$(hash_file "$INSTALLED_APP_EXEC")"

if [ "$CLI_HASH_BUILD" != "$CLI_HASH_INSTALLED" ]; then
  die "CLI bundle hash mismatch after install."
fi
if [ "$SERVER_HASH_BUILD" != "$SERVER_HASH_INSTALLED" ]; then
  die "Server binary hash mismatch after install."
fi
if [ "$APP_HASH_BUILD" != "$APP_HASH_INSTALLED" ]; then
  die "App binary hash mismatch after install."
fi
success "Installed artifacts match build outputs"

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

info "Opening installed app..."
open "$APP_DEST"
