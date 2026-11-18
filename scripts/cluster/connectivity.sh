#!/usr/bin/env bash
set -euo pipefail
cd /opt/cultura
nodes=(master worker1 worker2)
# Trust bootstrap is explicit and confined to this isolated demo network.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
for host in "${nodes[@]}"; do
  getent hosts "$host"
  ssh-keyscan -T 5 -t ed25519 "$host" >>"$tmp" 2>/dev/null
done
sort -u "$tmp" > /cluster/ssh/known_hosts
for source in "${nodes[@]}"; do
  for target in "${nodes[@]}"; do
    ssh "$source" "getent hosts '$target' >/dev/null && ping -c 1 -W 3 '$target' >/dev/null && ssh '$target' hostname" | tr -d '\r' | grep -Fx "$target"
    printf 'PASS DNS + ping + SSH: %s -> %s\n' "$source" "$target"
  done
done
printf 'CONNECTIVITY PASS: 9/9 routes, including 6/6 inter-node routes.\n'
