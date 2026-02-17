#!/bin/sh
set -eu

# ============================================================
#  Agent Maestro — Universal Installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/subhangR/agent-maestro/main/install.sh | bash
# ============================================================

main() {

# ── Color helpers ──────────────────────────────────────────

BOLD=""
DIM=""
RED=""
GREEN=""
YELLOW=""
BLUE=""
RESET=""

setup_colors() {
  if [ -t 1 ] && [ -z "${CI:-}" ]; then
    BOLD='\033[1m'
    DIM='\033[2m'
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    RESET='\033[0m'
  fi
}

info() {
  printf "${BLUE}info${RESET}  %s\n" "$1"
}

success() {
  printf "${GREEN}done${RESET}  %s\n" "$1"
}

warn() {
  printf "${YELLOW}warn${RESET}  %s\n" "$1"
}

error() {
  printf "${RED}error${RESET} %s\n" "$1" >&2
}

tildify() {
  case "$1" in
    "$HOME"*) printf "~%s" "${1#"$HOME"}" ;;
    *) printf "%s" "$1" ;;
  esac
}

# ── Defaults ───────────────────────────────────────────────

INSTALL_DIR="${MAESTRO_INSTALL:-$HOME/.maestro}"
VERSION="${MAESTRO_VERSION:-latest}"
NO_DESKTOP=0
NO_MODIFY_PATH=0
YES=0

REPO="subhangR/agent-maestro"
GITHUB_API="https://api.github.com/repos/${REPO}/releases/latest"
GITHUB_DOWNLOAD="https://github.com/${REPO}/releases/download"

# ── Parse arguments ────────────────────────────────────────

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --no-desktop)
        NO_DESKTOP=1
        ;;
      --no-modify-path)
        NO_MODIFY_PATH=1
        ;;
      -y|--yes)
        YES=1
        ;;
      -v=*|--version=*)
        VERSION="${1#*=}"
        ;;
      *)
        error "Unknown argument: $1"
        exit 1
        ;;
    esac
    shift
  done
}

# ── CI detection ───────────────────────────────────────────

detect_ci() {
  if [ -n "${CI:-}" ]; then
    NO_MODIFY_PATH=1
    NO_DESKTOP=1
    YES=1
  fi
}

# ── Platform detection ─────────────────────────────────────

detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin)
      PLATFORM="darwin"
      # Rosetta 2 detection
      if [ "$ARCH" = "x86_64" ]; then
        TRANSLATED="$(sysctl -n sysctl.proc_translated 2>/dev/null || echo "0")"
        if [ "$TRANSLATED" = "1" ]; then
          info "Rosetta 2 detected, using native arm64 binary"
          ARCH="arm64"
        fi
      fi
      ;;
    Linux)
      PLATFORM="linux"
      ;;
    *)
      error "Unsupported operating system: $OS"
      error "Agent Maestro currently supports macOS (Darwin) and Linux."
      exit 1
      ;;
  esac

  case "$ARCH" in
    arm64|aarch64)
      ARCH="arm64"
      ;;
    x86_64)
      ARCH="x64"
      ;;
    *)
      error "Unsupported architecture: $ARCH"
      error "Agent Maestro currently supports arm64/aarch64 and x86_64."
      exit 1
      ;;
  esac

  TARGET="${PLATFORM}-${ARCH}"

  # Validate supported targets
  case "$TARGET" in
    darwin-arm64|darwin-x64|linux-x64)
      ;;
    *)
      error "Unsupported platform/architecture combination: $TARGET"
      error "Supported targets: darwin-arm64, darwin-x64, linux-x64"
      exit 1
      ;;
  esac

  info "Detected platform: ${TARGET}"
}

# ── Dependency checks ──────────────────────────────────────

HAS_CURL=0
HAS_WGET=0

check_dependencies() {
  if command -v curl >/dev/null 2>&1; then
    HAS_CURL=1
  fi
  if command -v wget >/dev/null 2>&1; then
    HAS_WGET=1
  fi
  if [ "$HAS_CURL" = "0" ] && [ "$HAS_WGET" = "0" ]; then
    error "Either curl or wget is required but neither was found."
    exit 1
  fi
  if ! command -v tar >/dev/null 2>&1; then
    error "tar is required but was not found."
    exit 1
  fi
}

# ── HTTP helpers ───────────────────────────────────────────

http_get() {
  # $1 = URL, $2 = output file (optional, omit for stdout)
  if [ "$HAS_CURL" = "1" ]; then
    if [ -n "${2:-}" ]; then
      curl -fsSL "$1" -o "$2"
    else
      curl -fsSL "$1"
    fi
  else
    if [ -n "${2:-}" ]; then
      wget -qO "$2" "$1"
    else
      wget -qO- "$1"
    fi
  fi
}

# ── Resolve version ───────────────────────────────────────

resolve_version() {
  if [ "$VERSION" = "latest" ]; then
    info "Resolving latest version from GitHub..."
    RELEASE_JSON="$(http_get "$GITHUB_API")"
    VERSION="$(printf '%s' "$RELEASE_JSON" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
    if [ -z "$VERSION" ]; then
      error "Failed to resolve latest version from GitHub Releases API."
      error "URL: $GITHUB_API"
      exit 1
    fi
  fi
  info "Installing Agent Maestro version: ${VERSION}"
}

# ── SHA256 verification ───────────────────────────────────

compute_sha256() {
  # $1 = file path, prints checksum to stdout
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    warn "Neither sha256sum nor shasum found; skipping checksum verification."
    echo ""
  fi
}

verify_checksum() {
  # $1 = archive file, $2 = archive filename, $3 = temp dir
  CHECKSUMS_URL="${GITHUB_DOWNLOAD}/${VERSION}/checksums.txt"
  CHECKSUMS_FILE="${3}/checksums.txt"

  info "Downloading checksums..."
  if http_get "$CHECKSUMS_URL" "$CHECKSUMS_FILE" 2>/dev/null; then
    EXPECTED="$(grep "$2" "$CHECKSUMS_FILE" | cut -d' ' -f1 | head -1)"
    if [ -z "$EXPECTED" ]; then
      warn "No checksum found for $2 in checksums.txt; skipping verification."
      return
    fi
    ACTUAL="$(compute_sha256 "$1")"
    if [ -z "$ACTUAL" ]; then
      return
    fi
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      error "SHA256 checksum mismatch for $2"
      error "  Expected: $EXPECTED"
      error "  Actual:   $ACTUAL"
      exit 1
    fi
    success "SHA256 checksum verified"
  else
    warn "Could not download checksums.txt; skipping verification."
  fi
}

# ── Temp directory with cleanup ────────────────────────────

TMPDIR_INSTALL=""

setup_tmpdir() {
  TMPDIR_INSTALL="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR_INSTALL"' EXIT INT TERM
}

# ── Download & install CLI + server ────────────────────────

install_cli_server() {
  ARCHIVE_NAME="maestro-${TARGET}.tar.gz"
  ARCHIVE_URL="${GITHUB_DOWNLOAD}/${VERSION}/${ARCHIVE_NAME}"
  ARCHIVE_PATH="${TMPDIR_INSTALL}/${ARCHIVE_NAME}"

  info "Downloading ${ARCHIVE_NAME}..."
  http_get "$ARCHIVE_URL" "$ARCHIVE_PATH"
  success "Downloaded ${ARCHIVE_NAME}"

  verify_checksum "$ARCHIVE_PATH" "$ARCHIVE_NAME" "$TMPDIR_INSTALL"

  info "Extracting to $(tildify "${INSTALL_DIR}")..."
  mkdir -p "${INSTALL_DIR}/bin"
  tar -xzf "$ARCHIVE_PATH" -C "${INSTALL_DIR}/bin"
  chmod +x "${INSTALL_DIR}/bin/"* 2>/dev/null || true
  success "Installed CLI and server to $(tildify "${INSTALL_DIR}/bin")"
}

# ── Download & install desktop app ─────────────────────────

install_desktop() {
  if [ "$NO_DESKTOP" = "1" ]; then
    info "Skipping desktop app installation (--no-desktop)"
    return
  fi

  mkdir -p "${INSTALL_DIR}/apps"

  case "$PLATFORM" in
    darwin)
      install_desktop_macos
      ;;
    linux)
      install_desktop_linux
      ;;
  esac
}

install_desktop_macos() {
  DESKTOP_ARCHIVE="maestro-desktop-${TARGET}.tar.gz"
  DESKTOP_URL="${GITHUB_DOWNLOAD}/${VERSION}/${DESKTOP_ARCHIVE}"
  DESKTOP_PATH="${TMPDIR_INSTALL}/${DESKTOP_ARCHIVE}"

  info "Downloading desktop app (${DESKTOP_ARCHIVE})..."
  http_get "$DESKTOP_URL" "$DESKTOP_PATH"
  success "Downloaded ${DESKTOP_ARCHIVE}"

  verify_checksum "$DESKTOP_PATH" "$DESKTOP_ARCHIVE" "$TMPDIR_INSTALL"

  info "Extracting desktop app..."
  tar -xzf "$DESKTOP_PATH" -C "${INSTALL_DIR}/apps"
  success "Extracted desktop app to $(tildify "${INSTALL_DIR}/apps")"

  # Attempt to copy .app to /Applications
  APP_BUNDLE="$(find "${INSTALL_DIR}/apps" -maxdepth 1 -name '*.app' -type d | head -1)"
  if [ -n "$APP_BUNDLE" ]; then
    APP_NAME="$(basename "$APP_BUNDLE")"
    if [ -w "/Applications" ]; then
      if [ -d "/Applications/${APP_NAME}" ]; then
        rm -rf "/Applications/${APP_NAME}"
      fi
      cp -R "$APP_BUNDLE" "/Applications/${APP_NAME}"
      success "Installed ${APP_NAME} to /Applications"
    else
      warn "Cannot write to /Applications. You can manually copy:"
      warn "  cp -R \"$(tildify "$APP_BUNDLE")\" /Applications/"
    fi
    printf "\n"
    info "macOS Gatekeeper note: If the app is blocked on first launch, run:"
    info "  xattr -cr /Applications/${APP_NAME}"
    printf "\n"
  fi
}

install_desktop_linux() {
  DESKTOP_ARCHIVE="maestro-desktop-${TARGET}.AppImage"
  DESKTOP_URL="${GITHUB_DOWNLOAD}/${VERSION}/${DESKTOP_ARCHIVE}"
  DESKTOP_PATH="${INSTALL_DIR}/apps/maestro-desktop.AppImage"

  info "Downloading desktop app (AppImage)..."
  http_get "$DESKTOP_URL" "$DESKTOP_PATH"
  chmod +x "$DESKTOP_PATH"
  success "Installed AppImage to $(tildify "$DESKTOP_PATH")"

  verify_checksum "$DESKTOP_PATH" "$DESKTOP_ARCHIVE" "$TMPDIR_INSTALL"

  # Create .desktop entry
  DESKTOP_ENTRY_DIR="${HOME}/.local/share/applications"
  mkdir -p "$DESKTOP_ENTRY_DIR"
  DESKTOP_FILE="${DESKTOP_ENTRY_DIR}/agent-maestro.desktop"

  cat > "$DESKTOP_FILE" <<DESKTOP_EOF
[Desktop Entry]
Name=Agent Maestro
Comment=Agent Maestro Desktop App
Exec=${DESKTOP_PATH}
Terminal=false
Type=Application
Categories=Development;Utility;
StartupWMClass=agent-maestro
DESKTOP_EOF

  success "Created desktop entry at $(tildify "$DESKTOP_FILE")"
}

# ── Create config ──────────────────────────────────────────

create_config() {
  CONFIG_FILE="${INSTALL_DIR}/config"
  if [ ! -f "$CONFIG_FILE" ]; then
    mkdir -p "$INSTALL_DIR"
    cat > "$CONFIG_FILE" <<CONFIG_EOF
# Agent Maestro configuration
# This file is created on first install and preserved on upgrades.
MAESTRO_API_URL=http://localhost:2357
CONFIG_EOF
    success "Created config at $(tildify "$CONFIG_FILE")"
  else
    info "Config already exists at $(tildify "$CONFIG_FILE"); preserving."
  fi
}

# ── Update PATH ────────────────────────────────────────────

update_path() {
  if [ "$NO_MODIFY_PATH" = "1" ]; then
    info "Skipping PATH modification (--no-modify-path)"
    return
  fi

  BIN_DIR="${INSTALL_DIR}/bin"
  EXPORT_LINE="export PATH=\"${BIN_DIR}:\$PATH\""
  FISH_LINE="set -gx PATH \"${BIN_DIR}\" \$PATH"

  # Check if already in PATH
  case ":${PATH}:" in
    *":${BIN_DIR}:"*)
      info "$(tildify "$BIN_DIR") is already in PATH"
      return
      ;;
  esac

  UPDATED_SHELL=""

  # Detect current shell
  CURRENT_SHELL="$(basename "${SHELL:-/bin/sh}")"

  case "$CURRENT_SHELL" in
    zsh)
      SHELL_RC="$HOME/.zshrc"
      if [ -f "$SHELL_RC" ] && grep -qF "$BIN_DIR" "$SHELL_RC" 2>/dev/null; then
        info "PATH entry already exists in $(tildify "$SHELL_RC")"
      else
        printf '\n# Agent Maestro\n%s\n' "$EXPORT_LINE" >> "$SHELL_RC"
        UPDATED_SHELL="$SHELL_RC"
      fi
      ;;
    bash)
      # Prefer .bashrc, fall back to .bash_profile
      if [ -f "$HOME/.bashrc" ]; then
        SHELL_RC="$HOME/.bashrc"
      else
        SHELL_RC="$HOME/.bash_profile"
      fi
      if [ -f "$SHELL_RC" ] && grep -qF "$BIN_DIR" "$SHELL_RC" 2>/dev/null; then
        info "PATH entry already exists in $(tildify "$SHELL_RC")"
      else
        printf '\n# Agent Maestro\n%s\n' "$EXPORT_LINE" >> "$SHELL_RC"
        UPDATED_SHELL="$SHELL_RC"
      fi
      ;;
    fish)
      SHELL_RC="$HOME/.config/fish/config.fish"
      mkdir -p "$(dirname "$SHELL_RC")"
      if [ -f "$SHELL_RC" ] && grep -qF "$BIN_DIR" "$SHELL_RC" 2>/dev/null; then
        info "PATH entry already exists in $(tildify "$SHELL_RC")"
      else
        printf '\n# Agent Maestro\n%s\n' "$FISH_LINE" >> "$SHELL_RC"
        UPDATED_SHELL="$SHELL_RC"
      fi
      ;;
    *)
      warn "Unknown shell: $CURRENT_SHELL"
      warn "Manually add to your shell config: $EXPORT_LINE"
      return
      ;;
  esac

  if [ -n "$UPDATED_SHELL" ]; then
    success "Added $(tildify "$BIN_DIR") to PATH in $(tildify "$UPDATED_SHELL")"
  fi
}

# ── Confirmation prompt ────────────────────────────────────

confirm_install() {
  if [ "$YES" = "1" ]; then
    return
  fi

  printf "\n"
  info "Agent Maestro will be installed to: ${BOLD}$(tildify "$INSTALL_DIR")${RESET}"
  if [ "$NO_DESKTOP" = "0" ]; then
    info "Desktop app will also be installed."
  fi
  printf "\n"
  printf "  Continue? [Y/n] "
  read -r REPLY </dev/tty || REPLY="y"
  case "$REPLY" in
    [nN]*)
      info "Installation cancelled."
      exit 0
      ;;
  esac
}

# ── Print success ──────────────────────────────────────────

print_success() {
  printf "\n"
  printf "${GREEN}${BOLD}Agent Maestro has been installed!${RESET}\n"
  printf "\n"
  printf "  ${DIM}Location${RESET}    $(tildify "$INSTALL_DIR")\n"
  printf "  ${DIM}CLI${RESET}         $(tildify "${INSTALL_DIR}/bin")/maestro\n"
  printf "  ${DIM}Server${RESET}      $(tildify "${INSTALL_DIR}/bin")/maestro-server\n"

  if [ "$NO_DESKTOP" = "0" ]; then
    case "$PLATFORM" in
      darwin)
        printf "  ${DIM}Desktop${RESET}     /Applications/Agent Maestro.app\n"
        ;;
      linux)
        printf "  ${DIM}Desktop${RESET}     $(tildify "${INSTALL_DIR}/apps")/maestro-desktop.AppImage\n"
        ;;
    esac
  fi

  printf "  ${DIM}Config${RESET}      $(tildify "${INSTALL_DIR}/config")\n"
  printf "  ${DIM}Version${RESET}     %s\n" "$VERSION"
  printf "\n"

  # Check if a new shell is needed
  BIN_DIR="${INSTALL_DIR}/bin"
  case ":${PATH}:" in
    *":${BIN_DIR}:"*)
      ;;
    *)
      info "To get started, restart your shell or run:"
      printf "\n"
      printf "  export PATH=\"%s:\$PATH\"\n" "$BIN_DIR"
      printf "\n"
      ;;
  esac

  info "Then run:"
  printf "\n"
  printf "  maestro --help\n"
  printf "\n"
}

# ── Main flow ──────────────────────────────────────────────

setup_colors
parse_args "$@"
detect_ci
detect_platform
check_dependencies
resolve_version
setup_tmpdir
confirm_install
install_cli_server
install_desktop
create_config
update_path
print_success

}

main "$@"
