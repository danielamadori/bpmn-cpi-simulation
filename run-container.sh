#!/usr/bin/env bash
set -e

PORT="${1:-8081}"
CONTAINER_NAME="${CONTAINER_NAME:-bpmn-cpi-simulation}"

# check if port is available
if command -v nc >/dev/null; then
  if nc -z localhost "$PORT" 2>/dev/null; then
    echo "Port $PORT is already in use."
    echo "Use: $0 <port> to specify a different host port."
    exit 1
  fi
fi

docker build -t bpmn-cpi-simulation .

LOG_DIR="${LOG_DIR:-$(pwd)/logs}"

mkdir -p "$LOG_DIR"

# Remove any previous container with the same name to avoid conflicts.
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run --rm -it --name "$CONTAINER_NAME" -p "$PORT":8080 -v "$LOG_DIR":/logs bpmn-cpi-simulation
