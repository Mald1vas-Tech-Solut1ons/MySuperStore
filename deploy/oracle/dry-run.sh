#!/usr/bin/env bash
# Confere o acesso à VM Oracle sem alterar nada: SSH, releases, current,
# containers do MySuperStore e /api/health/. Só leitura.
# Uso (Git Bash, na raiz do repo): bash deploy/oracle/dry-run.sh <IP>
set -euo pipefail

HOST="${1:-${HOST:-}}"
[ -n "$HOST" ] || { echo "Uso: bash deploy/oracle/dry-run.sh <IP>" >&2; exit 1; }
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oracle_key}"
APP=/home/ubuntu/mysuperstore
read -r -a SSH_OPTS_ARR <<<"${SSH_OPTS:--o StrictHostKeyChecking=accept-new}"
SSH=(ssh -i "$SSH_KEY" "${SSH_OPTS_ARR[@]}" "ubuntu@$HOST")

echo "==> Release que seria publicada: $(git rev-parse --short=12 HEAD)"

"${SSH[@]}" "APP='$APP' bash -s" <<'REMOTE'
set -euo pipefail
echo "==> SSH ok: $(hostname)"
for f in deploy.env .env.prod; do
  if [ -f "$APP/shared/$f" ]; then echo "shared/$f: presente"; else echo "shared/$f: AUSENTE" >&2; exit 1; fi
done
echo "==> current -> $(readlink "$APP/current" || echo '(sem symlink)')"
echo "==> Releases (mais nova primeiro)"
ls -1t "$APP/releases"
echo "==> Containers do projeto mysuperstore"
sudo docker ps -a --filter label=com.docker.compose.project=mysuperstore \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
echo "==> Recursos"
free -m | sed -n '1,2p'
df -h / | tail -n 1
REMOTE

API_DOMAIN="$("${SSH[@]}" "grep ^API_DOMAIN= $APP/shared/deploy.env | cut -d= -f2" | tr -d '\r')"
if curl -fsS "https://$API_DOMAIN/api/health/" >/dev/null; then
  echo "OK: https://$API_DOMAIN/api/health/"
else
  echo "FALHOU: https://$API_DOMAIN/api/health/" >&2
  # HEALTH_REQUIRED=0: só avisa (antes de um deploy que pode consertar a API)
  if [ "${HEALTH_REQUIRED:-1}" = "1" ]; then exit 1; fi
fi
