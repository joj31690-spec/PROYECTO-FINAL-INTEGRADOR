#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T --user hpc master bash /opt/cultura/scripts/connectivity.sh
