#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The image runs without privilege escalation; the host prepares its report directory.
mkdir -p docs/evidence
chmod a+rwx docs/evidence
docker compose ps
docker compose exec -T --user hpc master bash -c 'set -euo pipefail; bash scripts/connectivity.sh | tee /reports/connectivity.txt; bash scripts/smoke.sh | tee /reports/smoke.txt; bash scripts/compare.sh | tee /reports/validation.txt'
docker compose stats --no-stream | tee docs/evidence/docker-stats.txt
docker network inspect cultura-chaquena_cluster > docs/evidence/network.json
printf '\nEvidence saved in docs/evidence/. No speedup analysis is performed.\n'
