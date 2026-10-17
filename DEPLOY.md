# 🚀 MySuperStore — Deploy

Produção: frontend Next.js na Vercel + backend em uma VM Oracle Cloud Always Free, via Docker Compose. Substitui o antigo Railway (backend) + Neon (Postgres); `railway.toml` foi removido.

## 0. Topologia atual: VMs Micro compartilhadas (em produção)

A A1.Flex (ARM grátis) não pôde ser criada: São Paulo sem capacidade (`Out of host capacity`). O plano A1 (`compose.yml`, seções 1–5) fica para quando houver capacidade. Hoje o MySuperStore roda nas 2 VMs `VM.Standard.E2.1.Micro` (1 GB RAM cada, Always Free) que também hospedam o MercadinhoSys e o maldivas-leads.

| VM | Endereço | Hospeda |
| --- | --- | --- |
| `mercadinhosys-prod` | 144.22.151.18 (pública) | MySuperStore (API/worker/Redis), MercadinhoSys, maldivas-leads, Caddy |
| `mercadinhosys-db-candidate` | 10.0.0.84 (privada, sem internet) | Postgres 15 do MercadinhoSys + banco/role `mysuperstore` |

Containers na VM pública (`deploy/oracle/compose.micro.yml`, rede externa `oracle_default`; prefixo `mss-` para não colidir com os aliases `api`/`redis`/`postgres` do MercadinhoSys):

| Container | Descrição | Limite |
| --- | --- | --- |
| `mysuperstore-api` | Django ASGI via daphne (HTTP + WebSocket) | 320 MB |
| `mysuperstore-worker` | Celery com beat embutido, pool `solo` (um processo) | 320 MB |
| `mysuperstore-redis` | Redis, `maxmemory` 24 MB | 48 MB |

**HTTPS:** bloco `mysuperstore-api.144.22.151.18.sslip.io` no Caddyfile do MercadinhoSys (`~/mercadinhosys/infra/oracle/Caddyfile`, container `oracle-caddy-1`) → `mysuperstore-api:8000`. Backup do Caddyfile anterior em `~/mysuperstore/shared/backups`. O bloco também está no repositório local do MercadinhoSys (`infra/oracle/Caddyfile`) e **precisa ser commitado lá**, senão um release do MercadinhoSys apaga a rota. Reload: `sudo docker exec oracle-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

**Banco:** database `mysuperstore` + role `mysuperstore` (sem superusuário, `CONNECTION LIMIT 10`) no Postgres 15 da VM privada. `REVOKE CONNECT ... FROM PUBLIC` em `mysuperstore` e `mercadinhosys`: o role do MySuperStore não conecta no banco do MercadinhoSys. Acesso pelo túnel SSH já existente (`mercadinhosys-db-tunnel`, `172.18.0.1:15432 → 10.0.0.84:5432`), `sslmode=disable` (o túnel já cifra).

**Dados:** migrados do Neon (PG18) com `pg_dump` plano, sem a linha `SET transaction_timeout` (inexistente no PG15). Conferência linha a linha: 52 tabelas idênticas, 668 linhas.

**Memória:** VM pública tinha 317 MB disponíveis; desligados ModemManager, fwupd, udisks2 e rpcbind (fecha também a porta 111) → 357 MB. VM do banco: 535 MB disponíveis.

**Ambiente e deploy:**

```bash
python deploy/oracle/build-env.py --ip 144.22.151.18 --src .env --out <pasta> --micro --db-pass-file <senha-do-role>
bash deploy/oracle/deploy.sh 144.22.151.18
```

O `deploy.env` do modo micro define `COMPOSE_FILE=compose.micro.yml`, `API_SVC=mss-api`, `DEP_SVCS=mss-redis`.

**Riscos:** tudo divide 1 GB com o MercadinhoSys; o túnel SSH é ponto único de falha dos dois sistemas; `max_connections` do Postgres é 25 no total; o `backup-db.sh` do modo A1 não se aplica aqui. Migrar para A1 quando houver capacidade (`cloudshell-create-a1.sh`).

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

## 3. Deploy do dia a dia: automático pelo GitHub Actions

Todo push ou merge na `master` que mexa em `backend/**`, `deploy/oracle/**` ou no próprio workflow dispara o [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml). Ele roda o mesmo `deploy/oracle/deploy.sh` do deploy manual: `git archive` do commit → `releases/<sha>` → build → migrate → up → symlink `current` → smoke test em `/api/health/`. Mudança só no frontend não dispara nada aqui; a Vercel cuida dela.

- **Um deploy por vez** (`concurrency: deploy-backend-oracle`). O deploy em andamento nunca é cancelado. Se chegarem vários pushes enquanto isso, o GitHub deixa na fila só o mais recente, que já contém os outros.
- **Não afeta o MercadinhoSys.** O compose tem `name: mysuperstore`, então `--remove-orphans` e `up` só tocam os containers `mysuperstore-*`.
- **Logs.** O repositório é público, e o log do Actions também. Por isso o CI não imprime os logs da aplicação quando o smoke test falha (`PRINT_REMOTE_LOGS=0`); veja-os na VM (seção 4). Nenhum secret é impresso.
- O deploy manual continua valendo: `bash deploy/oracle/deploy.sh 144.22.151.18`. Não rode um manual enquanto o do CI estiver rodando.

### 3.1 Cadastrar os secrets (uma vez)

Sem eles o job falha no passo "Configurar SSH", antes de encostar na VM.

1. **Chave SSH dedicada ao CI** (recomendado: dá para revogar sem mexer na sua). Precisa ser sem senha, porque o CI não tem como digitá-la.
   ```bash
   ssh-keygen -t ed25519 -N "" -C "github-actions-mysuperstore" -f ~/.ssh/mss_deploy_gha
   ssh -i ~/.ssh/oracle_key ubuntu@144.22.151.18 'cat >> ~/.ssh/authorized_keys' < ~/.ssh/mss_deploy_gha.pub
   ssh -i ~/.ssh/mss_deploy_gha ubuntu@144.22.151.18 true
   ```
   Atenção: o usuário `ubuntu` tem `sudo`, então essa chave dá controle total da VM (que também roda o MercadinhoSys). Guarde-a só no secret e apague a cópia local depois do cadastro, se quiser. Para revogar, remova a linha `github-actions-mysuperstore` do `~/.ssh/authorized_keys` da VM.
2. **known_hosts** (fixa a identidade do servidor; o CI recusa um host com chave diferente):
   ```bash
   ssh-keyscan -t ed25519 144.22.151.18 > /tmp/oracle_known_hosts
   ssh-keygen -lf /tmp/oracle_known_hosts
   ```
   O fingerprint precisa ser `SHA256:fKw6pCr3cNWBGAi9uel5nABUvf+u4r9QmGYL4D7hlic`. É o mesmo que já está no `known_hosts` de quem fez os deploys manuais (`ssh-keygen -F 144.22.151.18 -l`) e o que a VM informa em `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. Se for diferente, **não cadastre** e investigue.
3. **Cadastrar no GitHub:**
   ```bash
   gh secret set ORACLE_SSH_KEY --repo Mald1vas-Tech-Solut1ons/MySuperStore < ~/.ssh/mss_deploy_gha
   gh secret set ORACLE_KNOWN_HOSTS --repo Mald1vas-Tech-Solut1ons/MySuperStore < /tmp/oracle_known_hosts
   gh variable set ORACLE_HOST --repo Mald1vas-Tech-Solut1ons/MySuperStore --body 144.22.151.18
   rm /tmp/oracle_known_hosts
   ```
   Opcional, mas mais seguro: cadastrar os dois secrets com `--env production` e, em *Settings → Environments → production → Deployment branches*, liberar só a `master`. Assim nenhum workflow de outra branch consegue ler a chave. O job já roda no environment `production`.

Ordem sugerida: cadastrar os secrets → rodar o dry-run (3.2) → fazer o merge. O merge do PR que cria o workflow já dispara um deploy, porque ele mexe em `deploy/oracle/`.

### 3.2 Dry-run (conferir sem publicar)

Só leitura: testa SSH e known_hosts, confere se `shared/deploy.env` e `shared/.env.prod` existem, lista as releases, mostra para onde aponta `current`, os containers `mysuperstore-*`, memória e disco, e chama `/api/health/`.

```bash
gh workflow run deploy-backend.yml --repo Mald1vas-Tech-Solut1ons/MySuperStore -f mode=dry-run
gh run watch --repo Mald1vas-Tech-Solut1ons/MySuperStore
```

Ou pela interface: *Actions → Deploy backend (Oracle) → Run workflow*. O botão só aparece depois que o workflow estiver na `master`. Antes disso, rode o mesmo teste localmente: `bash deploy/oracle/dry-run.sh 144.22.151.18`. O modo `deploy` manual só é aceito na `master`.

### 3.3 Rollback

**Rápido (na VM):** volta o symlink e a imagem para a release anterior. As imagens de cada release ficam como `mysuperstore-backend:<sha>`.

```bash
APP=~/mysuperstore
ls -1t $APP/releases                 # mais nova primeiro
readlink $APP/current                # release com problema
PREV=<sha-da-release-anterior>
cd $APP/releases/$PREV/deploy/oracle
set -a; . $APP/shared/deploy.env; set +a
export RELEASE=$PREV
sudo docker image inspect mysuperstore-backend:$PREV >/dev/null || sudo -E docker compose build mss-api
sudo docker tag mysuperstore-backend:$PREV mysuperstore-backend:latest
sudo -E docker compose up -d --remove-orphans
ln -sfn $APP/releases/$PREV $APP/current
curl -fsS https://mysuperstore-api.144.22.151.18.sslip.io/api/health/
```

- **Migrations não voltam sozinhas.** Se a release ruim aplicou uma migration que o código antigo não aguenta, desfaça-a **antes** de trocar o symlink, a partir da pasta da release *nova* (o código antigo não conhece o arquivo da migration): `sudo -E docker compose run --rm -T --no-deps mss-api python manage.py migrate <app> <migration_anterior>`. Isso pode apagar dados, então faça backup do banco antes.
- **Torne o rollback permanente na master.** O próximo push na `master` publica a `master` de novo. Faça `git revert` do commit problemático e mergeie; o CI publica a versão corrigida. Se o problema não envolve banco, esse caminho sozinho já é o rollback (leva o tempo de um build).

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
