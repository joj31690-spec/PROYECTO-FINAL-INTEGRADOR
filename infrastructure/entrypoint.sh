#!/usr/bin/env bash
set -euo pipefail
mkdir -p /run/sshd /cluster/ssh
# A volume-local lock prevents simultaneous key generation by the three nodes.
exec 9>/cluster/ssh/init.lock
flock 9
if [[ ! -s /cluster/ssh/id_ed25519 ]]; then
  ssh-keygen -q -t ed25519 -N '' -f /cluster/ssh/id_ed25519
fi
cp /cluster/ssh/id_ed25519.pub /cluster/ssh/authorized_keys
touch /cluster/ssh/known_hosts
chown -R hpc:hpc /cluster/ssh
chmod 700 /cluster/ssh
chmod 600 /cluster/ssh/id_ed25519 /cluster/ssh/authorized_keys
chmod 644 /cluster/ssh/id_ed25519.pub /cluster/ssh/known_hosts
flock -u 9
exec 9>&-
# Generate distinct active host keys for each container, outside Git.
ssh-keygen -A
exec /usr/sbin/sshd -D -e
