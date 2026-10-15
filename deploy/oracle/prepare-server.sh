#!/usr/bin/env bash
# Prepara a VM A1 (Ubuntu 24.04 ARM64) para o MySuperStore. Idempotente.
set -euo pipefail

# 1. Swap de 4G
if ! swapon --show | grep -q '^/swapfile'; then
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 2. Timezone
sudo timedatectl set-timezone America/Sao_Paulo

# 3. Docker CE + compose plugin (repo oficial)
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
fi
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
id -nG ubuntu | grep -qw docker || sudo usermod -aG docker ubuntu

# 4. Atualizações de segurança automáticas
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

# 5. Rotação de logs do Docker
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl restart docker
fi

# 6. Estrutura de diretórios
mkdir -p /home/ubuntu/mysuperstore/releases /home/ubuntu/mysuperstore/shared/certs /home/ubuntu/mysuperstore/shared/backups
chmod 700 /home/ubuntu/mysuperstore/shared

# 7. Redis: overcommit de memória
echo 'vm.overcommit_memory=1' | sudo tee /etc/sysctl.d/99-redis.conf >/dev/null
sudo sysctl --system >/dev/null

sudo docker --version
sudo docker compose version
free -m
