#!/usr/bin/env bash
# Copia o banco do Neon para o Postgres local da VM (rodar NA VM, uma vez).
# Requer: shared/neon.env com NEON_URL=... (chmod 600) e o postgres do compose no ar.
# O neon.env é apagado ao final. O dump fica em shared/backups para auditoria.
set -euo pipefail
umask 077

APP=/home/ubuntu/mysuperstore
NEON_ENV=$APP/shared/neon.env
DUMP=$APP/shared/backups/neon-$(date +%Y%m%d-%H%M%S).dump
[ -f "$NEON_ENV" ] || { echo "Falta $NEON_ENV" >&2; exit 1; }

cid=$(sudo docker compose -p mysuperstore ps -q postgres)
[ -n "$cid" ] || { echo "Postgres do compose não está no ar" >&2; exit 1; }

echo "==> Dump do Neon (pg_dump 18)"
sudo docker run --rm --env-file "$NEON_ENV" postgres:18-alpine \
  sh -c 'pg_dump "$NEON_URL" -Fc --no-owner --no-acl' > "$DUMP"
sudo docker exec -i "$cid" pg_restore --list < "$DUMP" >/dev/null

echo "==> Restore no Postgres local"
sudo docker exec -i "$cid" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --clean --if-exists --exit-on-error' < "$DUMP"

# Conferência: contagem exata de linhas por tabela nos dois lados
SQL="select string_agg(t || '=' || n, ' ' order by t) from (select relname t, (xpath('/row/c/text()', query_to_xml('select count(*) c from public.\"'||relname||'\"', false, true, '')))[1]::text n from pg_stat_user_tables where schemaname='public') s"
neon=$(echo "$SQL" | sudo docker run --rm -i --env-file "$NEON_ENV" postgres:18-alpine sh -c 'psql "$NEON_URL" -tA')
local_=$(echo "$SQL" | sudo docker exec -i "$cid" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA')

if [ "$neon" = "$local_" ]; then
  echo "Contagens idênticas em todas as tabelas ($(echo "$neon" | wc -w) tabelas)."
else
  echo "DIVERGÊNCIA nas contagens:" >&2
  diff <(tr ' ' '\n' <<<"$neon") <(tr ' ' '\n' <<<"$local_") >&2 || true
  exit 1
fi
shred -u "$NEON_ENV" 2>/dev/null || rm -f "$NEON_ENV"
echo "Migração concluída. Dump: $DUMP"
