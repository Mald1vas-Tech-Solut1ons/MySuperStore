#!/usr/bin/env bash
# Publica o commit atual (HEAD) na VM Oracle.
# Uso (Git Bash, na raiz do repo): bash deploy/oracle/deploy.sh <IP>
set -euo pipefail

HOST="${1:-${HOST:-}}"
[ -n "$HOST" ] || { echo "Uso: bash deploy/oracle/deploy.sh <IP>" >&2; exit 1; }
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oracle_key}"
APP=/home/ubuntu/mysuperstore
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$HOST")

if [ "${ALLOW_DIRTY:-0}" != "1" ] && { ! git diff --quiet || ! git diff --cached --quiet; }; then
  echo "Há alterações não commitadas (use ALLOW_DIRTY=1 para ignorar)." >&2
  exit 1
fi

RELEASE="$(git rev-parse --short=12 HEAD)"
echo "==> Release $RELEASE"
"${SSH[@]}" "mkdir -p '$APP/releases/$RELEASE'"
git archive --format=tar.gz HEAD | "${SSH[@]}" "tar -xzf - -C '$APP/releases/$RELEASE'"

"${SSH[@]}" "RELEASE='$RELEASE' APP='$APP' bash -s" <<'REMOTE'
set -euo pipefail
cd "$APP/releases/$RELEASE/deploy/oracle"
set -a; . "$APP/shared/deploy.env"; set +a
export RELEASE API_DOMAIN
# COMPOSE_FILE (lido pelo compose), API_SVC e DEP_SVCS vêm do deploy.env
API_SVC=${API_SVC:-api}
DEP_SVCS=${DEP_SVCS:-postgres redis}
export COMPOSE_FILE=${COMPOSE_FILE:-compose.yml}

wait_healthy() {
  for _ in $(seq 1 60); do
    cid="$(sudo -E docker compose ps -q "$1" 2>/dev/null || true)"
    if [ -n "$cid" ] && [ "$(sudo docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null)" = healthy ]; then
      return 0
    fi
    sleep 5
  done
  echo "$1 não ficou healthy" >&2; return 1
}

echo "==> Build"
sudo -E docker compose build "$API_SVC"
# latest = release ativa (comandos manuais de compose sem RELEASE usam esta tag)
sudo docker tag "mysuperstore-backend:$RELEASE" mysuperstore-backend:latest
sudo -E docker compose up -d $DEP_SVCS
for svc in $DEP_SVCS; do wait_healthy "$svc"; done
echo "==> Migrations"
sudo -E docker compose run --rm -T --no-deps "$API_SVC" python manage.py migrate --noinput </dev/null
echo "==> Subindo stack"
sudo -E docker compose up -d --remove-orphans
ln -sfn "$APP/releases/$RELEASE" "$APP/current"

# Mantém a release atual + 5 anteriores
cd "$APP/releases"
ls -1dt -- */ | sed 's:/*$::' | grep -vxF "$RELEASE" | tail -n +6 | while read -r old; do rm -rf -- "$old"; done
REMOTE

API_DOMAIN="$("${SSH[@]}" "grep ^API_DOMAIN= $APP/shared/deploy.env | cut -d= -f2" | tr -d '\r')"
for _ in $(seq 1 30); do
  if curl -fsS "https://$API_DOMAIN/api/health/" >/dev/null 2>&1; then
    echo "OK: https://$API_DOMAIN/api/health/"
    exit 0
  fi
  sleep 5
done
echo "Smoke test falhou. Últimos logs da api:" >&2
"${SSH[@]}" "cd $APP/current/deploy/oracle && set -a && . $APP/shared/deploy.env && set +a && sudo -E docker compose logs --tail 80" >&2 || true
exit 1
