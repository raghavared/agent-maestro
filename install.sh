#!/bin/bash
set -e

# ============================================================
#  Agent Maestro — One-shot installer
#  Usage:  git clone <repo> && cd agent-maestro && ./install.sh
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Agent Maestro"
APP_BUNDLE="${APP_NAME}.app"
PROD_APP_NAME="Maestro Prod"
PROD_APP_BUNDLE="${PROD_APP_NAME}.app"
TAURI_BUILD_DIR="maestro-ui/src-tauri/target/release/bundle/macos"
BUILD_OUTPUT="${ROOT_DIR}/${TAURI_BUILD_DIR}/${APP_BUNDLE}"
PROD_BUILD_OUTPUT="${ROOT_DIR}/${TAURI_BUILD_DIR}/${PROD_APP_BUNDLE}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

step=0
total_steps=9

banner() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║       Agent Maestro — Installer          ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
  echo ""
}

info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
success() { echo -e "${GREEN}✔${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
fail()    { echo -e "${RED}✖${NC}  $1"; exit 1; }

step() {
  step=$((step + 1))
  echo ""
  echo -e "${GREEN}[$step/$total_steps]${NC} $1"
  echo "────────────────────────────────────────────"
}

# ----------------------------------------------------------
banner

# ----------------------------------------------------------
step "Stopping running Maestro instances"
# ----------------------------------------------------------

# Kill any running Maestro Prod or Agent Maestro processes
pkill -f "Maestro Prod" 2>/dev/null && success "Killed running Maestro Prod" || info "No running Maestro Prod found"
pkill -f "Agent Maestro" 2>/dev/null && success "Killed running Agent Maestro" || info "No running Agent Maestro found"
pkill -f "maestro-server" 2>/dev/null && success "Killed running maestro-server" || info "No running maestro-server found"
sleep 1

# ----------------------------------------------------------
step "Cleaning old builds and binaries"
# ----------------------------------------------------------

# Remove old .app from /Applications
if [ -d "/Applications/${PROD_APP_BUNDLE}" ]; then
  rm -rf "/Applications/${PROD_APP_BUNDLE}"
  success "Removed /Applications/${PROD_APP_BUNDLE}"
fi
if [ -d "/Applications/${APP_BUNDLE}" ]; then
  rm -rf "/Applications/${APP_BUNDLE}"
  success "Removed /Applications/${APP_BUNDLE}"
fi

# Remove old sidecar binary
if [ -f "${ROOT_DIR}/maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin" ]; then
  rm -f "${ROOT_DIR}/maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin"
  success "Removed old sidecar binary"
fi

# Remove old Tauri build output
if [ -d "${ROOT_DIR}/maestro-ui/src-tauri/target/release/bundle" ]; then
  rm -rf "${ROOT_DIR}/maestro-ui/src-tauri/target/release/bundle"
  success "Removed old Tauri bundle artifacts"
fi

# Remove old compiled dist directories for a fresh build
rm -rf "${ROOT_DIR}/maestro-server/dist"
rm -rf "${ROOT_DIR}/maestro-cli/dist"
rm -rf "${ROOT_DIR}/maestro-ui/dist"
success "Cleaned compiled output (dist) directories"

# ----------------------------------------------------------
step "Checking system prerequisites"
# ----------------------------------------------------------

# --- Xcode Command Line Tools ---
if xcode-select -p &>/dev/null; then
  success "Xcode Command Line Tools installed"
else
  info "Installing Xcode Command Line Tools (this may take a few minutes)..."
  xcode-select --install 2>/dev/null || true
  # Wait for the install to finish
  until xcode-select -p &>/dev/null; do
    sleep 5
  done
  success "Xcode Command Line Tools installed"
fi

# --- Homebrew (needed for Node if missing) ---
if command -v brew &>/dev/null; then
  success "Homebrew found"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  success "Homebrew installed"
fi

# --- Node.js ---
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    success "Node.js $(node -v) found"
  else
    warn "Node.js $(node -v) is too old (need v20+). Upgrading..."
    brew install node@22
    brew link --overwrite node@22
    success "Node.js $(node -v) installed"
  fi
else
  info "Installing Node.js..."
  brew install node@22
  brew link --overwrite node@22
  success "Node.js $(node -v) installed"
fi

# --- npm ---
if command -v npm &>/dev/null; then
  success "npm $(npm -v) found"
else
  fail "npm not found even after Node.js install. Please install Node.js manually."
fi

# --- Bun ---
if command -v bun &>/dev/null; then
  success "Bun $(bun --version) found"
else
  info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  # Add bun to PATH for current session
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  success "Bun $(bun --version) installed"
fi

# --- Rust toolchain ---
if command -v rustc &>/dev/null && command -v cargo &>/dev/null; then
  success "Rust $(rustc --version | awk '{print $2}') found"
else
  info "Installing Rust toolchain via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  success "Rust $(rustc --version | awk '{print $2}') installed"
fi

# ----------------------------------------------------------
step "Installing dependencies (monorepo workspaces)"
# ----------------------------------------------------------

cd "$ROOT_DIR"
bun install
success "All workspace dependencies installed"

# ----------------------------------------------------------
step "Building maestro-server"
# ----------------------------------------------------------

cd "$ROOT_DIR/maestro-server"
bun run build
cd "$ROOT_DIR"
success "Server TypeScript compiled"

# ----------------------------------------------------------
step "Creating server sidecar binary"
# ----------------------------------------------------------

cd "$ROOT_DIR/maestro-server"
bun run build:binary
cd "$ROOT_DIR"

if [ -f "maestro-ui/src-tauri/binaries/maestro-server-aarch64-apple-darwin" ]; then
  success "Server sidecar binary created"
else
  fail "Server binary was not created. Check maestro-server/package.json build:binary script."
fi

# ----------------------------------------------------------
step "Building & installing maestro-cli globally"
# ----------------------------------------------------------

cd "$ROOT_DIR/maestro-cli"
bun run build

cd "$ROOT_DIR/maestro-cli"
chmod +x bin/maestro.js
npm install -g .
cd "$ROOT_DIR"

# Configure CLI to point to prod server
CONFIG_DIR="$HOME/.maestro"
mkdir -p "$CONFIG_DIR"
echo "MAESTRO_API_URL=http://localhost:2357" > "$CONFIG_DIR/config"

if command -v maestro &>/dev/null; then
  success "maestro CLI installed globally"
else
  warn "maestro CLI installed but not on PATH. You may need to restart your terminal."
fi

# ----------------------------------------------------------
step "Building Tauri desktop app"
# ----------------------------------------------------------

cd "$ROOT_DIR/maestro-ui"

# Build the frontend + Tauri app with prod config (bundles the server sidecar)
# Only build .app bundle — skip DMG to avoid bundle_dmg.sh failures
VITE_API_URL=http://localhost:2357/api VITE_WS_URL=ws://localhost:2357 \
  bunx tauri build --features custom-protocol --config src-tauri/tauri.conf.prod.json --bundles app
cd "$ROOT_DIR"

# The prod config names the app "Maestro Prod"; rename to "Agent Maestro"
if [ -d "$PROD_BUILD_OUTPUT" ]; then
  # Rename to "Agent Maestro" for user-facing install
  FINAL_OUTPUT="${ROOT_DIR}/${TAURI_BUILD_DIR}/${APP_BUNDLE}"
  if [ -d "$FINAL_OUTPUT" ]; then
    rm -rf "$FINAL_OUTPUT"
  fi
  mv "$PROD_BUILD_OUTPUT" "$FINAL_OUTPUT"
  BUILD_OUTPUT="$FINAL_OUTPUT"
  success "Tauri app built: ${APP_BUNDLE}"
elif [ -d "$BUILD_OUTPUT" ]; then
  success "Tauri app built: ${APP_BUNDLE}"
else
  fail "Tauri build output not found. Check the build logs above."
fi

# ----------------------------------------------------------
step "Installing Agent Maestro"
# ----------------------------------------------------------

echo ""
echo -e "  The ${GREEN}${APP_BUNDLE}${NC} has been built successfully."
echo ""
echo "  Opening the build folder so you can drag it to Applications..."
echo ""

# Open Finder with the .app selected
open -R "$BUILD_OUTPUT"

echo -e "  ${YELLOW}→ Drag '${APP_NAME}' into your Applications folder.${NC}"
echo ""

# ----------------------------------------------------------
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Installation complete!              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  What was installed:"
echo "    • Node.js dependencies    (monorepo workspaces)"
echo "    • maestro-server           (sidecar binary)"
echo "    • maestro CLI              (global command)"
echo "    • Agent Maestro.app        (Tauri desktop app)"
echo ""
echo "  Next steps:"
echo "    1. Drag Agent Maestro to /Applications in the Finder window"
echo "    2. Open Agent Maestro from Applications"
echo "    3. Run 'maestro' in any terminal to use the CLI"
echo ""
