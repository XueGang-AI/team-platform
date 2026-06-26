#!/usr/bin/env bash
set -euo pipefail

screen -S team-platform-api -X quit >/dev/null 2>&1 || true
screen -S team-platform-web -X quit >/dev/null 2>&1 || true

echo "team-platform web/api sessions stopped"
