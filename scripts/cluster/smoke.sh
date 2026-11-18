#!/usr/bin/env bash
set -euo pipefail
for host in master worker1 worker2; do
  printf '\n=== Toolchain on %s ===\n' "$host"
  ssh "$host" 'gcc --version | head -n 1; g++ --version | head -n 1; mpirun --version | head -n 1; OMP_NUM_THREADS=2 /opt/cultura/bin/smoke-openmp'
done
mpirun --host master:1,worker1:1,worker2:1 --map-by ppr:1:node --mca btl_tcp_if_include eth0 --mca oob_tcp_if_include eth0 -np 3 /opt/cultura/bin/smoke-mpi
