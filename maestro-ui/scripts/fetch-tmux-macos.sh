#!/bin/bash
set -e

# Script to fetch tmux binaries for macOS (both ARM64 and x86_64)
# Uses Homebrew to download pre-built bottles

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/../src-tauri/bin"

echo "Fetching tmux binaries for macOS..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Error: Homebrew is required but not installed."
    echo "Please install Homebrew from https://brew.sh"
    exit 1
fi

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Fetching tmux bottles from Homebrew..."

# Fetch ARM64 bottle (arm64_sonoma)
echo "Downloading ARM64 bottle..."
brew fetch --force --bottle-tag=arm64_sonoma tmux > /dev/null 2>&1

# Fetch x86_64 bottle (sonoma)
echo "Downloading x86_64 bottle..."
brew fetch --force --bottle-tag=sonoma tmux > /dev/null 2>&1

# Get the cache directory
CACHE_DIR="$(brew --cache)/downloads"

# Find the bottle files
ARM64_BOTTLE=$(ls -t "$CACHE_DIR"/*tmux*.arm64_sonoma.bottle.tar.gz 2>/dev/null | head -1)
X86_64_BOTTLE=$(ls -t "$CACHE_DIR"/*tmux*.sonoma.bottle.tar.gz 2>/dev/null | grep -v arm64 | head -1)

if [ -z "$ARM64_BOTTLE" ]; then
    echo "Error: ARM64 bottle not found in cache"
    exit 1
fi

if [ -z "$X86_64_BOTTLE" ]; then
    echo "Error: x86_64 bottle not found in cache"
    exit 1
fi

# Extract ARM64 binary
echo "Extracting ARM64 binary..."
cd "$TEMP_DIR"
tar -xzf "$ARM64_BOTTLE"
ARM64_BIN=$(find . -path "*/bin/tmux" -type f | head -1)
if [ -z "$ARM64_BIN" ]; then
    echo "Error: ARM64 tmux binary not found in bottle"
    exit 1
fi
cp "$ARM64_BIN" "$BIN_DIR/tmux-aarch64-apple-darwin"
chmod +x "$BIN_DIR/tmux-aarch64-apple-darwin"
echo "✓ ARM64 binary installed"

# Clean up and extract x86_64 binary
rm -rf "$TEMP_DIR"/*
echo "Extracting x86_64 binary..."
tar -xzf "$X86_64_BOTTLE"
X86_64_BIN=$(find . -path "*/bin/tmux" -type f | head -1)
if [ -z "$X86_64_BIN" ]; then
    echo "Error: x86_64 tmux binary not found in bottle"
    exit 1
fi
cp "$X86_64_BIN" "$BIN_DIR/tmux-x86_64-apple-darwin"
chmod +x "$BIN_DIR/tmux-x86_64-apple-darwin"
echo "✓ x86_64 binary installed"

# Verify binaries
echo ""
echo "Verifying binaries..."
file "$BIN_DIR/tmux-aarch64-apple-darwin" | grep -q "arm64" && echo "✓ ARM64 binary verified"
file "$BIN_DIR/tmux-x86_64-apple-darwin" | grep -q "x86_64" && echo "✓ x86_64 binary verified"

echo ""
echo "✓ All tmux binaries have been downloaded successfully!"
echo "  - $BIN_DIR/tmux-aarch64-apple-darwin"
echo "  - $BIN_DIR/tmux-x86_64-apple-darwin"
