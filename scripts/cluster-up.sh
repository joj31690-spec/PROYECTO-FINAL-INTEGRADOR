#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d --build --wait
printf '\nCultura Chaqueña: http://localhost:8080\n'
