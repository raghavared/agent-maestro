#!/bin/bash

# Test script to verify environment variables are passed correctly
# Usage: ./test-env-vars.sh

echo "Testing environment variable passing..."
echo ""

# Test 1: Check if maestro CLI is accessible
echo "1. Checking maestro CLI..."
which maestro
if [ $? -ne 0 ]; then
    echo "❌ maestro CLI not found in PATH"
    exit 1
fi
echo "✅ maestro CLI found: $(which maestro)"
echo ""

# Test 2: Check if server is running
echo "2. Checking maestro-server..."
curl -s http://localhost:3000/api/projects > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ maestro-server not responding"
    echo "   Start it with: cd maestro-server && npm start"
    exit 1
fi
echo "✅ maestro-server is running"
echo ""

# Test 3: Test maestro CLI with env vars manually
echo "3. Testing maestro CLI with environment variables..."
export MAESTRO_SESSION_ID="test-session-123"
export MAESTRO_MANIFEST_PATH="/tmp/test-manifest.json"
export MAESTRO_SERVER_URL="http://localhost:3000"

# Create a test manifest
cat > /tmp/test-manifest.json <<EOF
{
  "manifestVersion": "1.0",
  "role": "worker",
  "session": {
    "id": "test-session-123",
    "model": "claude-sonnet-4"
  },
  "tasks": [],
  "skills": [],
  "server": {
    "url": "http://localhost:3000"
  }
}
EOF

echo "Running: maestro worker init"
echo "Env vars set:"
echo "  MAESTRO_SESSION_ID=$MAESTRO_SESSION_ID"
echo "  MAESTRO_MANIFEST_PATH=$MAESTRO_MANIFEST_PATH"
echo "  MAESTRO_SERVER_URL=$MAESTRO_SERVER_URL"
echo ""

# This should work if env vars are respected
maestro worker init 2>&1 | head -20

echo ""
echo "Test complete!"
