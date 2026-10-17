# Subir uma loja nova do zero

Cada cliente recebe **uma instalação própria** do MySuperStore (domínio, banco, conta Efí e marca dele), saindo
do mesmo código da `master`. Nada de código é editado: a loja inteira sai de um arquivo YAML.
Tempo estimado da loja de teste no ar: ~2 h (sem esperar aprovação de Efí/DNS).

**Peças:** backend Django em Docker numa VM Oracle (Always Free) com Postgres, Redis, Celery e Caddy (HTTPS);
frontend Next.js na Vercel.

---

## 1. Pré-requisitos

- [ ] Repositório clonado, branch `master` atualizada, Python 3.11+ com `pyyaml` (`pip install pyyaml`).
- [ ] VM Ubuntu 24.04 na Oracle Cloud **Always Free** (nunca conta PAYG), IP público, porta 80/443 liberada,
      chave SSH em `~/.ssh/oracle_key` (usuário `ubuntu`). Os scripts atuais assumem **uma loja por VM**.
- [ ] Acesso ao time da Maldivas Tech na Vercel.
- [ ] Do cliente: conta Efí (PJ ou PF), e-mail da dona, CEP de origem dos envios, fotos **reais** das peças,
      razão social/nome, CPF/CNPJ, endereço e e-mail de contato (rodapé legal).

## 2. YAML da loja e envs

```bash
mkdir -p deploy/stores
cp deploy/store.example.yaml deploy/stores/<slug>.yaml
```

Edite `deploy/stores/<slug>.yaml` (a pasta `deploy/stores/` é ignorada pelo git: pode ter segredos).
Campo vazio ou ausente = padrão do código; `"-"` = esconder o trecho. As 5 cores principais são
`bg`, `primary`, `accent`, `dark` e `text`. Para começar, `domains.api` pode ser `https://api-<slug>.<IP>.sslip.io`.

```bash
python scripts/new_store_env.py deploy/stores/<slug>.yaml --out deploy/stores/<slug>/
```

Gera `frontend.env` (NEXT_PUBLIC_*), `backend.env.prod` e `deploy.env` (API_DOMAIN). `DJANGO_SECRET_KEY`,
`POSTGRES_PASSWORD` e `EFI_WEBHOOK_SECRET` são criados na hora; o script nunca imprime valores e não sobrescreve
nada sem `--force`. **Ao regerar uma loja já no ar, sempre** passe o `.env.prod` em uso:

```bash
python scripts/new_store_env.py deploy/stores/<slug>.yaml --out deploy/stores/<slug>/ --force \
  --keep deploy/stores/<slug>/backend.env.prod
```

(trocar a senha do banco depois do primeiro deploy derruba a conexão).

## 3. Backend na VM

1. Preparar a VM (Docker, swap 4G, fuso, atualizações automáticas), uma única vez:
   ```bash
   scp -i ~/.ssh/oracle_key deploy/oracle/prepare-server.sh ubuntu@<IP>:
   ssh -i ~/.ssh/oracle_key ubuntu@<IP> "bash prepare-server.sh && mkdir -p ~/mysuperstore/shared/certs"
   ```
2. Copiar envs e certificados Efí (`.p12` do app API Pix: homologação e produção):
   ```bash
   scp -i ~/.ssh/oracle_key deploy/stores/<slug>/backend.env.prod ubuntu@<IP>:mysuperstore/shared/.env.prod
   scp -i ~/.ssh/oracle_key deploy/stores/<slug>/deploy.env ubuntu@<IP>:mysuperstore/shared/deploy.env
   scp -i ~/.ssh/oracle_key homologacao.p12 producao.p12 ubuntu@<IP>:mysuperstore/shared/certs/
   ```
3. Deploy (Git Bash, raiz do repo, na `master` sem alterações pendentes):
   ```bash
   bash deploy/oracle/deploy.sh <IP>
   ```
   Builda a imagem, roda as migrations, sobe api/worker/beat/postgres/redis/caddy, emite o HTTPS do
   `API_DOMAIN` e termina com `OK: https://<API_DOMAIN>/api/health/`.
4. Backup diário do banco: instale `deploy/oracle/mysuperstore-backup.service` e `.timer` (systemd) com
   `deploy/oracle/backup-db.sh` (confirmar o passo a passo na VM).

## 4. Dona da loja

Na VM:

```bash
cd ~/mysuperstore/current/deploy/oracle
set -a && . ~/mysuperstore/shared/deploy.env && set +a
sudo -E docker compose run --rm api python manage.py bootstrap_store \
  --email <email-da-dona> --store-name "<Nome da Loja>" --slug <slug> --origin-cep <CEP> --admin
```

Cria a conta já ativa e **sem senha** (a dona cria a dela em "Esqueci minha senha" no site) e a loja aprovada,
recebendo direto na conta Efí da instalação, em destaque na home, sem comissão. `--admin` libera `/admin`
(sem ele, só o painel `/seller`). Pode rodar de novo: só ajusta o que mudou.

## 5. Frontend na Vercel

1. Novo projeto no time da Maldivas Tech, importando o repositório, **Root Directory = `frontend`**, branch `master`.
2. Settings → Environment Variables (Production): cole o conteúdo de `frontend.env`.
   (`NEXT_PUBLIC_STORE_MODE=single` vai aqui; `STORE_MODE=single` vai no backend — os dois já saem do script.)
3. Deploy: `npx vercel deploy --prod` (ou pelo painel). `NEXT_PUBLIC_*` só valem depois de um build novo.
4. Fotos da marca: URL absoluta no YAML (ex.: Cloudinary) ou arquivos em `frontend/public/brand/<slug>/`.
   Só fotos reais das peças do cliente.
5. Volte ao YAML, ajuste `domains.frontend` para a URL final, regere com `--keep` e repita o passo 3.2 + deploy
   (o backend precisa da URL certa em `CORS_ALLOWED_ORIGINS` e `FRONTEND_URL`).

## 6. Efí (conta do cliente)

- App **API Pix**: certificado `.p12`, chave Pix, escopos de cobrança Pix e webhook.
- App **API Cobranças**: cartão (só OAuth).
- Em `backend.env` do YAML: `EFI_ENV` (`sandbox` primeiro), `EFI_PIX_CLIENT_ID_HOMOL`/`_PROD`,
  `EFI_PIX_CLIENT_SECRET_HOMOL`/`_PROD`, `EFI_COBRANCAS_CLIENT_ID_HOMOL`/`_PROD`,
  `EFI_COBRANCAS_CLIENT_SECRET_HOMOL`/`_PROD`, `EFI_PIX_KEY`, `EFI_ACCOUNT_IDENTIFIER`.
- Em `frontend.env` do YAML: `NEXT_PUBLIC_EFI_ACCOUNT_IDENTIFIER` (mesmo valor; sem ele o cartão não tokeniza).
- Registrar o webhook (usa o `EFI_WEBHOOK_SECRET` gerado):
  ```bash
  sudo -E docker compose run --rm api python manage.py register_efi_webhook     --url https://<API_DOMAIN>/api/v1/payments/efi-webhook/
  sudo -E docker compose run --rm api python manage.py register_efi_webhook --show   # conferir
  ```
- Só troque para `EFI_ENV=production` depois da compra-teste em sandbox.

## 7. Frete

- **Fixo** (mais simples): `SHIPPING_MODE=flat`, `FLAT_SHIPPING_PRICE`, `FREE_SHIPPING_MIN` — o servidor decide.
  Ajuste também `store.announcement` ("Frete grátis acima de R$ …").
- **Melhor Envio**: `SHIPPING_MODE=melhor_envio`, `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET`,
  `MELHOR_ENVIO_REDIRECT_URI`, `MELHOR_ENVIO_ENVIRONMENT` e o token `MELHOR_ENVIO_TOKEN` obtido com
  `python manage.py melhor_envio_token --auth-url` (abrir a URL, autorizar) e depois `--code <code do redirect>`.
  Vale 30 dias; renovar com `--refresh <refresh_token>`. Rode no container (`sudo -E docker compose run --rm api …`).

## 8. E-mail e chat

- SMTP (obrigatório para recuperação de senha): `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
  `MAIL_USE_TLS`, `MAIL_DEFAULT_SENDER`.
- Chat IA (opcional): `GEMINI_API_KEY`; o texto da loja vem de `store.about`. Base de conhecimento própria:
  `ASSISTANT_KNOWLEDGE_FILE` (caminho dentro do container; sem ele, usa a do Ateliê — troque antes de ligar o chat).

## 9. Domínio próprio

- Frontend: Vercel → Settings → Domains.
- API: registro **A** `api.<domínio>` → IP da VM; troque `domains.api` (e `domains.frontend`) no YAML,
  regere com `--keep`, recopie `.env.prod` e `deploy.env` e rode `deploy.sh` de novo. Atualize as envs na Vercel e redeploye.

## 10. Checklist de go-live

- [ ] `https://<API_DOMAIN>/api/health/` responde OK.
- [ ] Home com nome, cores, fotos e textos do cliente; nenhum texto do Ateliê sobrando.
- [ ] Modo `single`: sem "Venda seu artesanato", sem "Ateliês parceiros"; `/vender`, `/white-label` e
      `/seller/onboarding` voltam para `/`; rodapé mostra "Feito por Maldivas Tech" com link para https://maldivastech.dev.
- [ ] Rodapé legal com razão social, CPF/CNPJ, endereço e e-mail (`store.legal`).
- [ ] Dona criou a senha por "Esqueci minha senha" e entrou no painel.
- [ ] Peças reais cadastradas com fotos; frete calculado no carrinho.
- [ ] Compra-teste Pix em sandbox aprovada pelo webhook; estorno pelo painel.
- [ ] Cartão em sandbox tokenizando (identificador de conta certo).
- [ ] Backup do banco agendado.

## 11. Nunca faça

- Commitar `deploy/stores/` ou qualquer `.env` com segredo; mostrar segredos em chat, print ou log.
- Usar conta PAYG na Oracle.
- Fazer deploy fora da `master` ou com alterações não commitadas.
- Regerar envs de loja no ar sem `--keep`.
- Inventar produto, avaliação, depoimento, urgência ou selo no site.
