#!/bin/bash
set -e

# Navigate to maestro-cli directory
cd "$(dirname "$0")/../maestro-cli"

echo "Building Maestro CLI..."
bun install
bun run build
bun run bundle

# Ensure binary is executable
chmod +x bin/maestro.js

echo "Deploying Maestro CLI globally..."
# Using sudo might be required depending on user setup, 
# but npm install -g . is the standard way to deploy local package
npm install -g .

# Keep ~/.maestro wrapper installs in sync (install.sh path).
# Some environments resolve `maestro` from ~/.maestro/bin/maestro, which executes
# ~/.maestro/cli/bundle.cjs directly.
MAESTRO_HOME="$HOME/.maestro"
MAESTRO_CLI_DIR="$MAESTRO_HOME/cli"
MAESTRO_BIN_DIR="$MAESTRO_HOME/bin"

mkdir -p "$MAESTRO_CLI_DIR"
cp dist/bundle.cjs "$MAESTRO_CLI_DIR/bundle.cjs"

mkdir -p "$MAESTRO_BIN_DIR"
cat > "$MAESTRO_BIN_DIR/maestro" << 'WRAPPER'
#!/bin/bash
exec node "$HOME/.maestro/cli/bundle.cjs" "$@"
WRAPPER
chmod +x "$MAESTRO_BIN_DIR/maestro"

# Configure CLI to default to prod server
CONFIG_DIR="$MAESTRO_HOME"
mkdir -p "$CONFIG_DIR"
echo "MAESTRO_API_URL=http://localhost:2357" > "$CONFIG_DIR/config"

echo "✅ Maestro CLI built and deployed successfully!"
echo "CLI configured to connect to prod server at http://localhost:2357"
echo "You can now run 'maestro' from any terminal."
