#!/bin/bash
# Wrapper for Playwright + Electron 41 compatibility.
# Electron 41 (Node.js 24) rejects --remote-debugging-port as unknown flag.
# This wrapper filters it out before passing args to the packaged Electron binary.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON="$SCRIPT_DIR/../out/GitSmith-linux-x64/gitsmith"

if [ ! -f "$ELECTRON" ]; then
  echo "ERROR: Packaged app not found at $ELECTRON" >&2
  echo "Run 'npm run package' before E2E tests." >&2
  exit 1
fi

ARGS=()
for arg in "$@"; do
  case "$arg" in
    --remote-debugging-port=*) ;; # skip — rejected by Node.js 24
    *) ARGS+=("$arg") ;;
  esac
done

exec "$ELECTRON" "${ARGS[@]}"
