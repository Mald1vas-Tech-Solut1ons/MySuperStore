# 🚀 MySuperStore — Deploy

Produção: frontend Next.js na Vercel + backend em uma VM Oracle Cloud Always Free, via Docker Compose. Substitui o antigo Railway (backend) + Neon (Postgres); `railway.toml` foi removido.

## 1. Arquitetura

```
Vercel (Next.js) — https://mysuperstore-lime.vercel.app
        │ HTTPS / WSS
        ▼
┌──────────── VM Oracle Always Free (sa-saopaulo-1) ─────────────┐
│ VM.Standard.A1.Flex · ARM64 · 2 OCPU · 12 GB · Ubuntu 24.04    │
│                                                                │
│  caddy ── HTTPS automático (Let's Encrypt)                     │
│    │      mysuperstore-api.<IP>.sslip.io                       │
│    ├── api      Django ASGI (daphne): HTTP + WebSocket         │
│    ├── worker   Celery                                         │
│    ├── beat     Celery beat (PIX pendentes 5 min, repasses 30) │
│    ├── redis    7                                              │
│    └── postgres 18                                             │
└────────────────────────────────────────────────────────────────┘
Integrações externas: Cloudinary (mídia) · Efí (PIX/cartão) · Melhor Envio
```

A mesma conta Oracle hospeda o MercadinhoSys em duas VMs E2.1.Micro — **não mexer nelas**.

Layout no servidor:

```
/home/ubuntu/mysuperstore/
├── releases/<sha>
├── current -> release ativa
└── shared/{.env.prod, deploy.env, certs/, backups/}
```

SSH: usuário `ubuntu`, chave `ssh-key-2026-10-05` (cópia local em `~/.ssh/oracle_key`).

## 2. Primeira instalação

1. **Criar a VM** — no OCI Cloud Shell, rodar `bash cloudshell-create-a1.sh`. Reaproveita a sub-rede pública `mercadinhosys-publica` (80/443 já liberadas) e tenta de novo se faltar capacidade. Se nunca houver capacidade, converter a conta para Pay As You Go (recursos Always Free continuam grátis).
2. **Preparar o servidor**: `ssh -i ~/.ssh/oracle_key ubuntu@<IP> 'bash -s' < deploy/oracle/prepare-server.sh`
3. **Gerar o ambiente** (local): `python deploy/oracle/build-env.py --ip <IP> --src .env --out <pasta-temporária>`. Troca banco, Redis, domínios e `DJANGO_SECRET_KEY`; mantém as integrações. Em reinstalações use `--keep <.env.prod atual>` para preservar a senha do Postgres.
4. **Enviar** `.env.prod`, `deploy.env` para `shared/` e os certificados Efí para `shared/certs/` como `homologacao.p12` e `producao.p12`; `chmod 600` em tudo.
5. **Deploy**: `bash deploy/oracle/deploy.sh <IP>` — envia `git archive` do HEAD para `releases/<sha>`, build, migrate, up, symlink `current`, mantém 5 releases e faz smoke test em `/api/health/`.
6. **Migrar dados do Neon** (uma vez, na VM): criar `shared/neon.env` com `NEON_URL=...` (chmod 600) e rodar `~/mysuperstore/current/deploy/oracle/migrate-from-neon.sh`. Faz `pg_dump` → `pg_restore`, compara a contagem de linhas de todas as tabelas e apaga a credencial do Neon. Depois rodar `migrate` de novo e `docker compose up -d`.
7. **Backup**: copiar `mysuperstore-backup.service`/`.timer` para `/etc/systemd/system/` e `sudo systemctl enable --now mysuperstore-backup.timer`.
8. **Vercel** — definir as variáveis e fazer redeploy (`NEXT_PUBLIC_*` são embutidas no build):
   ```
   NEXT_PUBLIC_API_URL=https://<API_DOMAIN>/api/v1
   NEXT_PUBLIC_WS_URL=wss://<API_DOMAIN>
   NEXT_PUBLIC_IS_DEBUG=false
   NEXT_PUBLIC_VAPID_PUBLIC_KEY / NEXT_PUBLIC_EFI_ACCOUNT_IDENTIFIER / NEXT_PUBLIC_GOOGLE_CLIENT_ID
   ```

## 3. Deploy do dia a dia

```bash
bash deploy/oracle/deploy.sh <IP>
```

## 4. Operação

```bash
cd ~/mysuperstore/current/deploy/oracle && set -a && . ~/mysuperstore/shared/deploy.env && set +a
sudo -E docker compose ps
sudo -E docker compose logs -f api
sudo -E docker compose exec api python manage.py shell
sudo -E docker compose restart api worker beat
```

Saúde: `GET /api/health/` (checa o banco; 503 se estiver fora).

> **Nunca** usar `docker compose down -v` — apaga os volumes (Postgres, Redis, certificados TLS).

## 5. Backup e restauração

- `backup-db.sh` (timer diário 03:00 São Paulo): `pg_dump -Fc` validado com `pg_restore --list`, retenção de 7 dias em `shared/backups`.
- Restaurar: `sudo docker exec -i <container-postgres> sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < shared/backups/<arquivo>.dump`

## 6. Pendências

- Registrar o webhook Efí em `https://<API_DOMAIN>/api/v1/payments/efi-webhook/`.
- Cópia externa dos backups (ex.: OCI Object Storage, 20 GB grátis).
- Domínio próprio no lugar do `sslip.io` (ajustar `deploy.env`, `DJANGO_ALLOWED_HOSTS` e Vercel).
- Vercel Hobby não permite uso comercial — avaliar plano Pro ou servir o Next.js na própria VM.
