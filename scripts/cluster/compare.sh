#!/usr/bin/env bash
set -euo pipefail
cd /opt/cultura
input=/opt/cultura/data/demo-input.json
/usr/bin/time -v -o /reports/sequential.memory.txt bin/batch seq "$input" > /reports/sequential.json 2>/reports/sequential.process.txt
for threads in 1 2; do
  OMP_NUM_THREADS="$threads" OMP_DYNAMIC=false /usr/bin/time -v -o "/reports/openmp-$threads.memory.txt" bin/batch omp "$input" > "/reports/openmp-$threads.json" 2>"/reports/openmp-$threads.process.txt"
done
for ranks in 1 3; do
  hosts=master:1
  if [[ "$ranks" == 3 ]]; then hosts=master:1,worker1:1,worker2:1; fi
  /usr/bin/time -v -o "/reports/mpi-$ranks.memory.txt" mpirun --host "$hosts" --map-by ppr:1:node --mca btl_tcp_if_include eth0 --mca oob_tcp_if_include eth0 -np "$ranks" bin/batch-mpi mpi "$input" > "/reports/mpi-$ranks.json" 2>"/reports/mpi-$ranks.process.txt"
done
python3 scripts/validate.py
printf '\n=== Initial maximum RSS per executing process (KiB) ===\n'
for file in /reports/*.process.txt; do printf '%s\n' "$file"; cat "$file"; done
printf '\nGNU time reports are in /reports/*.memory.txt (MPI launcher RSS is NOT total cluster RSS).\n'
