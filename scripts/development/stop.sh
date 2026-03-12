#!/usr/bin/env bash
# Stop the svelte-gridlite-kit development server
set -euo pipefail

# Find and kill vite dev server processes for this project
PIDS=$(pgrep -f "vite.*svelte-gridlite-kit" 2>/dev/null || true)

if [ -z "$PIDS" ]; then
  echo "No dev server running."
  exit 0
fi

echo "Stopping dev server (PIDs: $PIDS)..."
kill $PIDS 2>/dev/null || true
echo "Stopped."
