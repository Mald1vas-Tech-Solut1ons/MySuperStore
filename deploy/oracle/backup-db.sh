#!/usr/bin/env bash
# Dump diário do Postgres (formato custom), validado e com retenção.
set -euo pipefail
umask 077

APP_DIR=/home/ubuntu/mysuperstore
BACKUP_DIR=$APP_DIR/shared/backups
KEEP_DAYS=${KEEP_DAYS:-7}

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/mysuperstore-$(date +%Y%m%d-%H%M%S).dump"

if [ -f "$APP_DIR/shared/pg.env" ]; then
  # Modo Micro: banco no Postgres da VM privada, via túnel 172.18.0.1:15432
  PG=(sudo docker run --rm -i --network oracle_default --env-file "$APP_DIR/shared/pg.env" postgres:18-alpine)
  "${PG[@]}" pg_dump -h 172.18.0.1 -p 15432 -U mysuperstore -d mysuperstore -Fc > "$out.tmp"
  check() { "${PG[@]}" pg_restore --list; }
else
  cid=$(sudo docker compose -p mysuperstore ps -q postgres)
  [ -n "$cid" ] || { echo "Container postgres não encontrado" >&2; exit 1; }
  sudo docker exec "$cid" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$out.tmp"
  check() { sudo docker exec -i "$cid" pg_restore --list; }
fi

if ! check < "$out.tmp" >/dev/null; then
  rm -f "$out.tmp"
  echo "Dump inválido, descartado" >&2
  exit 1
fi
mv "$out.tmp" "$out"

find "$BACKUP_DIR" -name 'mysuperstore-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "Backup OK: $out ($(du -h "$out" | cut -f1))"
