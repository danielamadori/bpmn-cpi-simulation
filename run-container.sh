#!/usr/bin/env bash
set -e

PORT="${1:-8081}"

# check if port is available
if command -v nc >/dev/null; then
  if nc -z localhost "$PORT" 2>/dev/null; then
    echo "Port $PORT is already in use."
    echo "Use: $0 <port> to specify a different host port."
    exit 1
  fi
fi

docker build -t bpmn-cpi-simulation .
docker run --rm -it -p "$PORT":8080 bpmn-cpi-simulation
