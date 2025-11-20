#!/usr/bin/env bash
set -euo pipefail

LOG_PATH=${LOG_PATH:-/logs/app.log}

mkdir -p "$(dirname "$LOG_PATH")"

if [ -t 1 ]; then
  # TTY available: keep colors on console, write stripped copy to file.
  npm run start:example 2>&1 \
    | tee >(sed -u -r 's/\x1B\[[0-9;]*[A-Za-z]//g' > "$LOG_PATH")
else
  # No TTY (e.g., non-interactive run): just write stripped log.
  npm run start:example 2>&1 | sed -u -r 's/\x1B\[[0-9;]*[A-Za-z]//g' > "$LOG_PATH"
fi
