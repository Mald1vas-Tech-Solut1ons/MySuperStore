<div align="center">

# 🛒 MySuperStore

### Marketplace multi-vendedor headless — pagamentos reais via PIX/cartão, split automático e frete integrado

[![Django](https://img.shields.io/badge/Django-5.1-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.15-A30000?logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Efí](https://img.shields.io/badge/Efí_Bank-PIX_+_Cartão-F36F21)](https://sejaefi.com.br/)
[![Melhor Envio](https://img.shields.io/badge/Melhor_Envio-Frete-0CA678)](https://melhorenvio.com.br/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

*Vários vendedores, um carrinho, pagamento dividido automaticamente entre as lojas — PIX e cartão pelo Efí Bank, frete pelo Melhor Envio, com estorno e cancelamento.*

</div>

---

## 📖 Sobre

O **MySuperStore** é um marketplace **multi-vendedor** (estilo Mercado Livre / Amazon) com arquitetura **headless**: um backend Django REST desacoplado de um frontend Next.js 15. Qualquer pessoa pode cadastrar sua loja, anunciar produtos e receber pagamentos — e a plataforma retém automaticamente uma comissão sobre cada venda.

O dinheiro do comprador é **dividido na hora do pagamento**: a parte de cada lojista é creditada via **split nativo do Efí** (quando o lojista tem conta Efí) ou repassada por **PIX Envio** a partir do caixa da plataforma; a comissão fica retida automaticamente. O frete é cotado em tempo real por loja no **Melhor Envio** e pago pelo cliente.

> Projeto de conclusão do curso de Análise e Desenvolvimento de Sistemas (IFSP-GRU), evoluído para um produto real em produção.

---

## 🏗️ Arquitetura

```
                          ┌──────────────────────────┐
                          │   Next.js 15 (Vercel)    │
                          │  Loja · Lojista · Admin  │
                          └────────────┬─────────────┘
                                       │ REST + JWT
                          ┌────────────▼─────────────┐
                          │ Django REST (Railway)    │
                          │ catalog · cart · orders  │
                          │ sellers · payments · crm │
                          └──┬──────┬──────┬─────┬────┘
                             │      │      │     │
              ┌──────────────▼┐ ┌───▼──┐ ┌─▼───┐ ▼────────────┐
              │ PostgreSQL    │ │Redis │ │ Efí │ │ Melhor Envio│
              │ (Neon)        │ │broker│ │ PIX │ │   (frete)   │
              └───────────────┘ └──┬───┘ │+cart│ └─────────────┘
                                   │     └─────┘
                          ┌────────▼──────────┐   ┌─────────────┐
                          │ Celery + Beat     │   │ Cloudinary  │
                          │ e-mails · payouts │   │ (mídia)     │
                          │ webhooks · expiry │   └─────────────┘
                          └───────────────────┘
```

---

## ⚙️ Stack

| Camada | Tecnologias |
|---|---|
| **Backend** | Django 5.1 · Django REST Framework · SimpleJWT · django-filter · drf-spectacular · Channels |
| **Frontend** | Next.js 15 (App Router) · React · TypeScript · Tailwind CSS · Zustand · Framer Motion · Recharts |
| **Pagamentos** | **Efí Bank** — PIX (mTLS, split nativo, Pix Envio) e Cartão de crédito (API Cobranças + Efí.js) |
| **Frete** | **Melhor Envio** (cotação multi-transportadora: Correios, Jadlog…) |
| **Dados / Infra** | PostgreSQL 16 (Neon) · Redis · Celery · Meilisearch · Docker Compose |
| **Mídia / Notificações** | Cloudinary · Web Push (VAPID) |
| **Deploy** | Backend em VM **Oracle Cloud**, publicado pelo GitHub Actions a cada push na `master` ([DEPLOY.md](DEPLOY.md)) · Frontend em **Vercel** |

---

## ✨ Funcionalidades

<table>
<tr><td width="50%" valign="top">

**🛍️ Loja (cliente)**
- Catálogo com categorias hierárquicas, marcas e busca
- Variantes de produto e estoque por SKU
- **Promoções relâmpago** com contagem regressiva
- Carrinho multi-loja, cupons globais e por vendedor
- **Frete em tempo real por loja** (cliente paga)
- Avaliações, lista de desejos e chat com a loja

</td><td width="50%" valign="top">

**🏪 Lojista (vendedor)**
- Onboarding com conta **Efí** + CEP de origem
- CRUD de produtos, variantes, fotos e **vídeo**
- Personalização da vitrine (cor, banners, vídeo)
- Promoções e impulsionamento self-service
- Gestão de pedidos, envios e devoluções
- Painel financeiro (vendas, comissões, repasses)

</td></tr>
<tr><td width="50%" valign="top">

**💳 Pagamentos (Efí Bank)**
- **PIX** com cobrança imediata + QR Code e webhook
- **Cartão de crédito** via Efí.js (tokenização no front)
- **Split automático** por vendedor (comissão retida)
- **Repasse** via split nativo ou PIX Envio ao lojista
- **Estorno** e **cancelamento** com devolução de estoque

</td><td width="50%" valign="top">

**🛡️ Super Admin (plataforma)**
- Dashboard executivo (GMV, métricas)
- Gestão de lojistas e comissões
- Moderação de produtos e avaliações
- CRM e visão consolidada do ecossistema

</td></tr>
</table>

---

## 💸 Fluxo de Pagamento e Repasse

O coração do marketplace é o **split**: quando um carrinho tem produtos de várias lojas, o valor é dividido e cada vendedor recebe sua parte, descontada a comissão da plataforma. O frete vai **integral ao lojista** (que compra a etiqueta); a comissão **não** incide sobre o frete.

```
Carrinho (Loja A + Loja B)
        │
        ▼
   Pedido (Order) ──> SubOrder Loja A ──> produto − comissão + frete
        │             SubOrder Loja B ──> produto − comissão + frete
        ▼
   Pagamento (Efí)
   ├── PIX     → cobrança imediata; confirmação via webhook
   └── Cartão  → tokeniza no front (Efí.js) + cobrança one-step
        │
        ▼
   Confirmação autoritativa (webhook / polling)
        │
        ▼
   Order CONFIRMED · CommissionEntry · Payout · e-mail (Celery)
        │
        ▼
   Repasse ao lojista
   ├── lojista com conta Efí → split nativo (crédito direto, payout COMPLETED)
   └── lojista sem conta Efí → PIX Envio do caixa master (job idempotente)
```

| Capacidade | Como funciona |
|---|---|
| **PIX** | `EfiPixService` cria cobrança imediata (mTLS), retorna Copia-e-Cola + QR. Baixa pelo webhook (`/payments/efi-webhook/`) ou polling (`/payments/{id}/confirm-pix/`). |
| **Cartão** | Tokenização no navegador com `payment-token-efi` (Efí.js); cobrança one-step com split via API Cobranças. |
| **Split / Repasse** | Comissão calculada na criação do pedido. Split nativo do Efí para lojistas com `efi_payee_code`; demais liquidados por **PIX Envio** (`settle_payouts`, idempotente, com retry no Celery Beat). |
| **Estorno / Cancelamento** | Estorno (total/parcial) reverte a cobrança e restaura o estoque; cancelamento devolve o estoque reservado e expira cobranças PIX pendentes. |

---

## 🚚 Frete (Melhor Envio)

Cotação **por loja** em tempo real, paga pelo cliente:

```
CEP do cliente → /cart/shipping/quote/ → cota cada loja no Melhor Envio
              → cliente escolhe (PAC, SEDEX, Jadlog…) → /cart/shipping/select/
              → frete entra no total do pedido → repassado ao lojista
```

O token OAuth do Melhor Envio é obtido/renovado pelo comando `melhor_envio_token` (Modelo 1 — conta única da plataforma). Sem token configurado, o serviço retorna cotação *mock* para desenvolvimento.

---

## 🚀 Começando (desenvolvimento)

### Pré-requisitos
- [Docker](https://www.docker.com/) e Docker Compose
- Credenciais de **homologação** do Efí e do Melhor Envio (opcionais para subir; sem elas, PIX usa fallback local e o frete usa mock)

### 1. Clonar e configurar

```bash
git clone https://github.com/MaldivaSky/MySuperStore.git
cd MySuperStore
cp .env.example .env          # preencha as chaves (ver "Variáveis de ambiente")
```

### 2. Subir a infraestrutura

```bash
docker compose up -d --build
docker compose exec api python manage.py migrate
docker compose exec api python manage.py seed_demo   # dados de demonstração
```

### 3. Rodar o frontend

```bash
cd frontend
npm install
npm run dev
```

| Serviço | URL |
|---|---|
| Loja | http://localhost:3000/store |
| Painel do Lojista | http://localhost:3000/seller/dashboard |
| Super Admin | http://localhost:3000/admin |
| API | http://localhost:8000/api/v1/ |
| Docs (Swagger) | http://localhost:8000/api/docs/ |

---

## 🌱 Seed & Credenciais

`python manage.py seed_demo` cria um marketplace completo: admin, vendedores, clientes, produtos com variantes/imagens/avaliações, promoções, banners, cupons e pedidos.

| Papel | E-mail | Senha |
|---|---|---|
| Admin | `admin@mysuperstore.com` | `admin123` |
| Vendedor | `tech_seller@mysuperstore.com` | `seller123` |
| Cliente | `joao.silva@gmail.com` | `cliente123` |

> Flags úteis: `--reset` (recria tudo) · `--skip-images` (mais rápido).

---

## 🔧 Comandos operacionais

```bash
# Repasses pendentes (PIX Envio aos lojistas sem split nativo)
python manage.py settle_payouts            # --dry para apenas listar

# Webhook PIX do Efí (registra a URL na chave recebedora)
python manage.py register_efi_webhook --url https://SEU-BACKEND/api/v1/payments/efi-webhook/

# Token OAuth do Melhor Envio
python manage.py melhor_envio_token --auth-url      # gera a URL de autorização
python manage.py melhor_envio_token --code XXXX     # troca o code pelo token
python manage.py melhor_envio_token --refresh YYYY  # renova (token expira ~30 dias)
```

---

## 🔌 Principais endpoints

```
POST   /api/v1/auth/login/                       Login (JWT)
GET    /api/v1/catalog/products/                  Catálogo (filtros: categoria, marca, flash_sale…)
GET    /api/v1/sellers/me/products/               CRUD de produtos do lojista
POST   /api/v1/cart/shipping/quote/               Cotar frete por loja (Melhor Envio)
POST   /api/v1/cart/shipping/select/              Selecionar opção de frete
POST   /api/v1/orders/                            Criar pedido a partir do carrinho
POST   /api/v1/payments/process/                  Iniciar pagamento (pix | credit_card)
POST   /api/v1/payments/{id}/confirm-pix/         Confirmar PIX (polling)
POST   /api/v1/payments/{id}/simulate-pix/        Simular baixa PIX (apenas DEBUG)
POST   /api/v1/payments/{id}/cancel/              Cancelar pedido não pago
POST   /api/v1/payments/{id}/refund/              Estorno (total ou parcial)
POST   /api/v1/payments/efi-webhook/              Webhook PIX do Efí
```

Documentação interativa completa em **`/api/docs/`**.

---

## 🔑 Variáveis de ambiente

Segredos **nunca** são versionados. Resumo (valores reais ficam no Railway/Vercel):

**Backend (Railway)**
```env
DJANGO_SECRET_KEY=...            DJANGO_SETTINGS_MODULE=config.settings.prod
DATABASE_URL=...                 REDIS_URL=...
EFI_ENV=production               EFI_PIX_KEY=...
EFI_PIX_CLIENT_ID_PROD=...       EFI_PIX_CLIENT_SECRET_PROD=...
EFI_COBRANCAS_CLIENT_ID_PROD=... EFI_COBRANCAS_CLIENT_SECRET_PROD=...
EFI_PIX_CERT_BASE64=...          # .p12 em base64 (Railway não monta arquivo)
MELHOR_ENVIO_ENVIRONMENT=sandbox MELHOR_ENVIO_TOKEN=...
MELHOR_ENVIO_CLIENT_ID=...       MELHOR_ENVIO_CLIENT_SECRET=...
MELHOR_ENVIO_REDIRECT_URI=...    CLOUDINARY_URL=...
VAPID_PRIVATE_KEY=...            FRONTEND_URL=...
```

**Frontend (Vercel)** — apenas `NEXT_PUBLIC_`
```env
NEXT_PUBLIC_API_URL=...                   NEXT_PUBLIC_IS_DEBUG=false
NEXT_PUBLIC_EFI_ACCOUNT_IDENTIFIER=...    # libera a tokenização de cartão
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

---

## 📁 Estrutura

```
MySuperStore/
├── backend/
│   ├── apps/
│   │   ├── catalog/    Produtos, categorias, marcas, promoções, avaliações, banners
│   │   ├── carts/      Carrinho, cupons e cotação de frete
│   │   ├── orders/     Pedidos, sub-pedidos, frete, devoluções
│   │   ├── payments/   Efí (PIX/cartão), split, repasse (Pix Envio), estorno
│   │   ├── sellers/    Lojas, onboarding, CRUD de produtos, chat
│   │   ├── crm/        CRM da plataforma
│   │   └── users/      Autenticação, endereços, push notifications
│   ├── config/         Settings (base/dev/prod), Celery, URLs
│   └── requirements/
├── frontend/
│   └── src/
│       ├── app/        Rotas (store, seller, admin, checkout, dashboard…)
│       ├── components/ Header, uploader de mídia, configurações da loja…
│       ├── lib/        Cliente da API
│       └── store/      Estado global (Zustand)
└── docker-compose.yml
```

---

## ✅ Status & Roadmap

- [x] **Catálogo, carrinho, autenticação, painel do lojista**
- [x] **Promoções relâmpago, cupons, impulsionamento**
- [x] **Pagamentos Efí** — PIX (cobrança + webhook + split/Pix Envio) e cartão
- [x] **Frete Melhor Envio** — cotação por loja, cliente paga, repasse ao lojista
- [x] **Estorno, cancelamento, devoluções, expiração de PIX**
- [x] **Web Push, chat lojista↔cliente, CRM**
- [ ] **Validação end-to-end em produção** (1ª venda real: cliente paga → lojista recebe → comissão)
- [ ] **Cobertura de testes ampla + CI/CD**
- [ ] **Busca em produção (Meilisearch gerenciado)** e revisão de performance
- [ ] **Revisão de segurança e conformidade LGPD**

---

## 🔒 Segurança

- `.env` **nunca** é versionado (`.gitignore`); use `.env.example` como referência.
- Certificado do Efí (mTLS) injetado por variável (`EFI_PIX_CERT_BASE64`), nunca no repositório.
- Senhas com hash; autenticação JWT com blacklist de refresh tokens.
- Webhooks de pagamento processados de forma idempotente.
- Tokenização de cartão no navegador (os dados do cartão **não** trafegam pelo nosso backend).

---

<div align="center">

Feito com 💜 por **Rafael Maldivas** — Maldivas Tech Solutions

</div>
