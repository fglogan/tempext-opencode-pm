#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +"%Y-%m-%d")
MONTH=$(date +"%Y-%m")
mkdir -p docs/logs/${MONTH}
FILE="docs/logs/${MONTH}/log-${DATE}.md"
if [ ! -f "$FILE" ]; then
  cat > "$FILE" <<EOF
# ${DATE}

## Inputs

## Decisions

## Tasks Moved

## Events

## Links
EOF
  echo "Created $FILE"
else
  echo "Exists $FILE"
fi