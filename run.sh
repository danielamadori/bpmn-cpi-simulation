#!/usr/bin/env bash
set -e

PORT="8080"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [-p|--port <port>]"
      echo "Default port: 8080"
      exit 1
      ;;
  esac
done

CONTAINER_NAME="${CONTAINER_NAME:-bpmn-cpi-simulation}"

# check if port is available (nc present in most dev setups)
if command -v nc >/dev/null; then
  if nc -z localhost "$PORT" 2>/dev/null; then
    echo "Port $PORT is already in use."
    echo "Use: $0 -p <port> to specify a different host port."
    exit 1
  fi
fi

docker build -t bpmn-cpi-simulation .

LOG_DIR="${LOG_DIR:-$(pwd)/logs}"

mkdir -p "$LOG_DIR"

# Remove any previous container with the same name to avoid conflicts.
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run --rm -it --name "$CONTAINER_NAME" -p "$PORT":8080 -v "$LOG_DIR":/logs bpmn-cpi-simulation
