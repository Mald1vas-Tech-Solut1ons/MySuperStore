#!/usr/bin/env bash
# Dump diário do Postgres (formato custom), validado e com retenção.
set -euo pipefail
umask 077

APP_DIR=/home/ubuntu/mysuperstore
BACKUP_DIR=$APP_DIR/shared/backups
KEEP_DAYS=${KEEP_DAYS:-7}

cid=$(sudo docker compose -p mysuperstore ps -q postgres)
[ -n "$cid" ] || { echo "Container postgres não encontrado" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/mysuperstore-$(date +%Y%m%d-%H%M%S).dump"
sudo docker exec "$cid" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$out.tmp"

if ! sudo docker exec -i "$cid" pg_restore --list < "$out.tmp" >/dev/null; then
  rm -f "$out.tmp"
  echo "Dump inválido, descartado" >&2
  exit 1
fi
mv "$out.tmp" "$out"

find "$BACKUP_DIR" -name 'mysuperstore-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "Backup OK: $out ($(du -h "$out" | cut -f1))"
