#!/bin/bash

# Navigate to the repository root
ROOT_DIR="$(dirname "$0")/.."
cd "$ROOT_DIR" || exit 1

# Prefer local virtualenv if present, otherwise fall back to system python
VENV_PY="$ROOT_DIR/agent/.venv/bin/python"
if [ -x "$VENV_PY" ]; then
  PYTHON_BIN="$VENV_PY"
else
  PYTHON_BIN="$(command -v python)"
fi

HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}

exec "$PYTHON_BIN" -m uvicorn agent.agent:app --host "$HOST" --port "$PORT" "$@"
