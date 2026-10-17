# Spec — Sprint "Modo loja única"

Objetivo: uma loja nova de cliente sobe **só com variáveis de ambiente**, sem editar componente.
Regra de ouro: **com nenhuma variável nova definida, o site fica idêntico ao de hoje** (Ateliê Eli Trassi,
modo `marketplace`). Todo valor padrão abaixo é o texto/valor que já está no ar.

Stack: Next.js 15 (App Router), React 19, TypeScript estrito, Tailwind 3.4. Alias `@/` = `frontend/src/`.

**Regra técnica obrigatória (Next.js):** variáveis `NEXT_PUBLIC_*` só são embutidas no bundle quando lidas
de forma literal: `process.env.NEXT_PUBLIC_BRAND_NAME`. Nunca `process.env[nome]`, nunca desestruturar
`process.env`, nunca montar o nome dinamicamente.

---

## Item 1 — `src/config/storeMode.ts` (CTO)

```ts
export type StoreMode = "single" | "marketplace";
export const STORE_MODE: StoreMode = process.env.NEXT_PUBLIC_STORE_MODE === "single" ? "single" : "marketplace";
export const isSingleStore = STORE_MODE === "single";
```

Em `single`: sem link "Venda seu artesanato", sem faixa "Ateliês parceiros", sem link "Plataforma MySuperStore",
sem "Abrir minha loja" na confirmação de e-mail; `/vender`, `/white-label` e `/seller/onboarding` redirecionam
para `/` (em `next.config.ts`). No backend, `STORE_MODE=single` bloqueia `POST /api/v1/sellers/apply/` para
quem não é staff/admin.

---

## Item 2 — `src/config/brand.ts` (marca configurável)

Arquivo único, sem dependências além do próprio TS. Helpers internos (não exportar):

```ts
// Valor do env (aparado) ou o padrão. "-" significa "vazio de propósito" (esconde o trecho).
const str = (v: string | undefined, fallback: string): string => {
  const t = (v ?? "").trim();
  if (t === "-") return "";
  return t || fallback;
};
// Lista separada por "|" (itens aparados, vazios descartados) ou o padrão.
const list = (v: string | undefined, fallback: readonly string[]): string[] => { ... };
```

Exportar `brand` (objeto, **sem** `as const` nos arrays para não quebrar tipos — use um `type Brand` explícito)
e manter exatamente a assinatura de `whatsappLink(text: string): string` que já existe:
`brand.whatsapp ? \`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}\` : ""`.

Campos (env → padrão atual). `${name}` etc. indicam que o padrão é derivado de outro campo já resolvido.

| Campo | Env | Padrão |
|---|---|---|
| `name` | `NEXT_PUBLIC_BRAND_NAME` | `Ateliê Eli Trassi` |
| `fullName` | `NEXT_PUBLIC_BRAND_FULL_NAME` | `Ateliê Eli Trassi Macramê` |
| `tagline` | `NEXT_PUBLIC_BRAND_TAGLINE` | `Macramê feito à mão, nó a nó` |
| `segment` (palavra sob o logo) | `NEXT_PUBLIC_BRAND_SEGMENT` | `macramê` |
| `shopNoun` (como a loja se chama no texto) | `NEXT_PUBLIC_BRAND_SHOP_NOUN` | `ateliê` |
| `location` | `NEXT_PUBLIC_BRAND_LOCATION` | `Vila Galvão · Guarulhos, SP` |
| `shipping` | `NEXT_PUBLIC_BRAND_SHIPPING` | `Enviamos para todo o Brasil` |
| `announcement` (faixa do topo, antes de ` · ${shipping}`) | `NEXT_PUBLIC_BRAND_ANNOUNCEMENT` | `Frete grátis acima de R$ 299` |
| `whatsapp` | `NEXT_PUBLIC_WHATSAPP` | `""` (já existe; só dígitos) |
| `instagram` | `NEXT_PUBLIC_INSTAGRAM` | `""` (já existe; sem @) |
| `meta.title` | `NEXT_PUBLIC_BRAND_META_TITLE` | `Ateliê Eli Trassi Macramê — bolsas feitas à mão` |
| `meta.description` | `NEXT_PUBLIC_BRAND_META_DESCRIPTION` | `Bolsas e peças em macramê feitas à mão, nó a nó, na Vila Galvão em Guarulhos. Encomendas sob medida e envio para todo o Brasil.` |
| `meta.shortDescription` | `NEXT_PUBLIC_BRAND_META_SHORT` | `Bolsas e peças em macramê feitas à mão em Guarulhos-SP.` |
| `hero.eyebrow` | `NEXT_PUBLIC_BRAND_HERO_EYEBROW` | `Ateliê · ${location}` |
| `hero.title` | `NEXT_PUBLIC_BRAND_HERO_TITLE` | `Feito à mão,` |
| `hero.titleEmphasis` | `NEXT_PUBLIC_BRAND_HERO_EMPHASIS` | `nó a nó.` |
| `hero.subtitle` | `NEXT_PUBLIC_BRAND_HERO_SUBTITLE` | `Bolsas e peças em macramê criadas uma a uma no ateliê. ${shipping}.` |
| `marquee` (lista) | `NEXT_PUBLIC_BRAND_MARQUEE` | `feito à mão`, `nó a nó`, `fio de algodão`, `sob medida`, `de Guarulhos para todo o Brasil`, `peças únicas` |
| `collectionSubtitle` | `NEXT_PUBLIC_BRAND_COLLECTION_SUBTITLE` | `Cada peça é feita à mão, uma a uma. Quando acaba, a próxima pode sair diferente — e esse é o charme.` |
| `nav` (lista `Rótulo=slug`) | `NEXT_PUBLIC_BRAND_NAV` | `Bolsas=bolsas`, `Chapéus=chapeus`, `Calçados=calcados`, `Casa=casa` → `{ label, href: "/?category=<slug>" }[]`; item sem `=` é descartado. |
| `search.placeholder` | `NEXT_PUBLIC_BRAND_SEARCH_PLACEHOLDER` | `Busque bolsas, chapéus, peças…` |
| `search.suggestions` (lista) | `NEXT_PUBLIC_BRAND_SEARCH_SUGGESTIONS` | `bolsa caracol`, `boho`, `chapéu`, `sob medida` |
| `chat.greeting` | `NEXT_PUBLIC_BRAND_CHAT_GREETING` | `Oi! Sou a assistente do ${name}. Posso te ajudar com as peças, preços, encomendas sob medida, frete e cuidados com o macramê. 🧶` |
| `chat.chips` (lista) | `NEXT_PUBLIC_BRAND_CHAT_CHIPS` | `Quais bolsas estão disponíveis?`, `Como funciona o sob medida?`, `Quanto custa o frete?`, `Como cuidar do macramê?` |
| `video.eyebrow` | `NEXT_PUBLIC_BRAND_VIDEO_EYEBROW` | `No ateliê` |
| `video.title` | `NEXT_PUBLIC_BRAND_VIDEO_TITLE` | `Do fio` |
| `video.titleEmphasis` | `NEXT_PUBLIC_BRAND_VIDEO_EMPHASIS` | `à peça` |
| `video.text` | `NEXT_PUBLIC_BRAND_VIDEO_TEXT` | `Cada bolsa leva horas de nós feitos à mão, com fio de algodão e acabamento caprichado. Assista ao processo e escolha a sua.` |
| `video.caption` | `NEXT_PUBLIC_BRAND_VIDEO_CAPTION` | `Do fio à bolsa: o processo no ateliê` |
| `video.steps` (lista) | `NEXT_PUBLIC_BRAND_VIDEO_STEPS` | `01 · Escolha do fio`, `02 · Nós e trama`, `03 · Acabamento` |
| `customOrder.enabled` | `NEXT_PUBLIC_BRAND_CUSTOM_ORDER` | `true` (só `"off"` desliga) |
| `customOrder.text` | `NEXT_PUBLIC_BRAND_CUSTOM_ORDER_TEXT` | `Escolha a cor do fio, o tamanho e a ferragem — dourada ou prateada. A gente cria a peça junto com você e envia para qualquer lugar do Brasil.` |
| `images.hero` | `NEXT_PUBLIC_BRAND_HERO_IMAGE` | `/brand/atelie/caracol-praia.webp` |
| `images.heroAlt` | `NEXT_PUBLIC_BRAND_HERO_ALT` | `Bolsa Caracol em macramê cru usada na praia` |
| `images.lookbook` (lista `src::alt`, 3 itens) | `NEXT_PUBLIC_BRAND_LOOKBOOK` | `/brand/atelie/boho-cafe.webp::Bolsa Boho Café em macramê`, `/brand/atelie/boho-offwhite.webp::Bolsa Boho Off-white com alça de couro`, `/brand/atelie/boho-oliva-modelo.webp::Bolsa Boho Oliva no ombro` → `{ src, alt }[]` (item sem `::` vira `{ src: item, alt: "" }`) |
| `images.detail` | `NEXT_PUBLIC_BRAND_DETAIL_IMAGE` | `/brand/atelie/caracol-dourada.webp` |
| `images.detailAlt` | `NEXT_PUBLIC_BRAND_DETAIL_ALT` | `Detalhe de uma bolsa de macramê feita à mão` |
| `images.ogAlt` | `NEXT_PUBLIC_BRAND_OG_ALT` | `Bolsa Caracol em macramê do Ateliê Eli Trassi` |
| `legal.name` | `NEXT_PUBLIC_LEGAL_NAME` | `""` |
| `legal.document` (só dígitos ou formatado) | `NEXT_PUBLIC_LEGAL_DOCUMENT` | `""` |
| `legal.address` | `NEXT_PUBLIC_LEGAL_ADDRESS` | `""` |
| `legal.email` | `NEXT_PUBLIC_LEGAL_EMAIL` | `""` |
| `credit.label` | `NEXT_PUBLIC_CREDIT_LABEL` | `Feito por Maldivas Tech` |
| `credit.url` | `NEXT_PUBLIC_CREDIT_URL` | `""` |

Também exportar:

```ts
// "CPF 123.456.789-00" / "CNPJ 12.345.678/0001-00" a partir do que veio no env; "" se vazio.
// 11 dígitos → CPF formatado; 14 dígitos → CNPJ formatado; outro tamanho → devolve o texto aparado como veio.
export function legalDocumentLabel(raw: string): string
// true se algum campo de brand.legal estiver preenchido.
export const hasLegalInfo: boolean
```

---

## Item 3 — `src/config/palette.ts` (paleta configurável)

Os tokens Tailwind `atelie-*` passam a ser CSS vars em canais RGB (`--brand-<token>: R G B`), com o padrão
atual em `globals.css`. Este módulo gera o CSS que **sobrescreve** só o que vier por env.

Mapa token → env (padrão atual entre parênteses):

| Token Tailwind | CSS var | Env | Padrão |
|---|---|---|---|
| `atelie-cream` | `--brand-cream` | `NEXT_PUBLIC_COLOR_BG` | `#F4EDE3` |
| `atelie-wall` | `--brand-wall` | `NEXT_PUBLIC_COLOR_BG_ALT` | `#EFE6D8` |
| `atelie-sand` | `--brand-sand` | `NEXT_PUBLIC_COLOR_SURFACE` | `#E8DCCA` |
| `atelie-clay` | `--brand-clay` | `NEXT_PUBLIC_COLOR_PRIMARY` | `#A65A3A` |
| `atelie-terracotta` | `--brand-terracotta` | `NEXT_PUBLIC_COLOR_ACCENT` | `#C47A55` |
| `atelie-olive` | `--brand-olive` | `NEXT_PUBLIC_COLOR_SECONDARY` | `#5B6146` |
| `atelie-espresso` | `--brand-espresso` | `NEXT_PUBLIC_COLOR_DARK` | `#2A211B` |
| `atelie-ink` | `--brand-ink` | `NEXT_PUBLIC_COLOR_TEXT` | `#1F1A17` |

Exportar:

```ts
export const PALETTE_DEFAULTS: Record<Token, string>   // hex acima
export function hexToRgbChannels(hex: string): string | null  // "#A65A3A" | "A65A3A" | "#abc" → "166 90 58"; inválido → null
export function hexToHslChannels(hex: string): string | null  // → "18 48% 44%" (H inteiro, S e L inteiros com %); inválido → null
export function paletteCss(): string
export const themeColor: string  // NEXT_PUBLIC_COLOR_BG válido ou "#F4EDE3"
```

`paletteCss()`: para cada env **válida**, emite `--brand-<token>: R G B;`. Além disso, para manter os componentes
shadcn coerentes: `BG` válido → `--background: <hsl>;`; `TEXT` válido → `--foreground: <hsl>;`;
`PRIMARY` válido → `--primary: <hsl>; --ring: <hsl>;`; `SURFACE` válido → `--secondary: <hsl>;`.
Retorna `:root{...}` ou **string vazia** se nenhuma env válida (sem regressão). Ler cada env de forma literal.

---

## Item 4 — `src/components/storefront/SiteFooter.tsx` (rodapé)

Partir do arquivo atual. Mudanças, e só elas:
1. `shopLinks` passa a ser `brand.nav` (remover a constante local).
2. Barra inferior, lado direito: se `isSingleStore` (de `@/config/storeMode`) → crédito discreto `brand.credit.label`;
   com `brand.credit.url` vira `<a target="_blank" rel="noopener noreferrer">` com a mesma classe do link atual,
   sem URL fica `<span>` com `text-atelie-cream/50`. Se **não** for single → exatamente o link atual
   `Plataforma MySuperStore` para `/white-label`.
3. Rodapé legal (Decreto 7.962/2013): se `hasLegalInfo`, renderizar acima da barra inferior um
   `<address className="not-italic mt-10 font-atelie text-xs leading-relaxed text-atelie-cream/55">` com os
   campos preenchidos separados por ` · `, nesta ordem: `legal.name`, `legalDocumentLabel(legal.document)`,
   `legal.address`, `legal.email` (este como `mailto:` com a classe `linkClass`). Campo vazio não aparece.
   Sem nenhum campo → nada é renderizado (o rodapé fica idêntico ao atual).

---

## Item 5 — `scripts/new_store_env.py` (gerador de .env)

Python 3.11+, só stdlib + PyYAML. Lê um YAML de loja (formato em `deploy/store.example.yaml`) e grava:
- `<out>/frontend.env` → variáveis `NEXT_PUBLIC_*` (para colar/importar na Vercel);
- `<out>/backend.env.prod` → variáveis do Django;
- `<out>/deploy.env` → `API_DOMAIN=<host da api>`.

Uso: `python scripts/new_store_env.py deploy/stores/<slug>.yaml --out deploy/stores/<slug>/ [--keep <backend.env.prod antigo>] [--force]`.

Regras:
- Nunca imprimir valores; ao final só `OK: N variáveis frontend, M backend → <out>`.
- Recusar sobrescrever arquivos existentes sem `--force`.
- `--keep`: reaproveita `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` e `EFI_WEBHOOK_SECRET` de um env já em uso.
- Gerar com `secrets` quando ausentes: `DJANGO_SECRET_KEY` (`token_urlsafe(50)`), `POSTGRES_PASSWORD` (`token_hex(24)`),
  `EFI_WEBHOOK_SECRET` (`token_urlsafe(32)`).
- Validar: `store.slug` (regex `^[a-z0-9-]{3,50}$`), `domains.frontend` e `domains.api` começando com `https://`,
  `store.mode` ∈ {`single`, `marketplace`}, cores (se dadas) hex `#RGB`/`#RRGGBB`. Erro → `SystemExit` com mensagem clara.
- Listas do YAML viram texto com `|` (lookbook: `src::alt`; nav: `Rótulo=slug`).
- Chave do YAML ausente ou vazia → a variável **não** é escrita (o código usa o padrão).
- Valores com quebra de linha → erro.
- `frontend.env`: cores sem `#` (no `.env`, `#` sem aspas vira comentário) e qualquer outro valor com `#` entre aspas.
- Gravar com `newline="\n"`, `encoding="utf-8"`.

Mapeamento backend fixo (além dos segredos): `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS=<host api>,localhost,127.0.0.1`,
`CORS_ALLOWED_ORIGINS=<frontend>`, `FRONTEND_URL=<frontend>`, `BACKEND_PUBLIC_URL=<api>`,
`EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `POSTGRES_DB=mysuperstore`, `POSTGRES_USER=mysuperstore`,
`DATABASE_URL=postgres://mysuperstore:<senha>@postgres:5432/mysuperstore`, `REDIS_URL=redis://redis:6379/2`,
`CELERY_BROKER_URL=redis://redis:6379/0`, `CELERY_RESULT_BACKEND=redis://redis:6379/1`,
`EFI_PIX_CERT_HOMOL=/app/certs/homologacao.p12`, `EFI_PIX_CERT_PROD=/app/certs/producao.p12`,
`STORE_MODE`, `STORE_NAME`, `STORE_FULL_NAME`, `STORE_SEGMENT`, `STORE_ABOUT`, `PLATFORM_COMMISSION_RATE=0` em `single`.
Seções livres `backend.env` (dict) e `frontend.env` (dict) do YAML são copiadas como estão (para Efí, Melhor Envio,
e-mail, Gemini, VAPID), sobrescrevendo as derivadas. Valores booleanos/números do YAML viram texto (`true`→`true`).

Mapeamento YAML → frontend (`store.` omitido; formato exato do arquivo em `deploy/store.example.yaml`):
`mode`→`NEXT_PUBLIC_STORE_MODE`, `name`→`NEXT_PUBLIC_BRAND_NAME`, `full_name`→`_FULL_NAME`, `tagline`→`_TAGLINE`,
`segment`→`_SEGMENT`, `shop_noun`→`_SHOP_NOUN`, `location`→`_LOCATION`, `shipping`→`_SHIPPING`,
`announcement`→`_ANNOUNCEMENT`, `whatsapp`→`NEXT_PUBLIC_WHATSAPP`, `instagram`→`NEXT_PUBLIC_INSTAGRAM`,
`meta.title`→`_META_TITLE`, `meta.description`→`_META_DESCRIPTION`, `meta.short`→`_META_SHORT`,
`hero.eyebrow`→`_HERO_EYEBROW`, `hero.title`→`_HERO_TITLE`, `hero.emphasis`→`_HERO_EMPHASIS`,
`hero.subtitle`→`_HERO_SUBTITLE`, `hero.image`→`_HERO_IMAGE`, `hero.image_alt`→`_HERO_ALT`,
`detail_image`→`_DETAIL_IMAGE`, `detail_alt`→`_DETAIL_ALT`, `og_alt`→`_OG_ALT`,
`lookbook` (lista de `{src, alt}`)→`_LOOKBOOK`, `nav` (lista de `{label, slug}`)→`_NAV`, `marquee`→`_MARQUEE`,
`collection_subtitle`→`_COLLECTION_SUBTITLE`, `search.placeholder`→`_SEARCH_PLACEHOLDER`,
`search.suggestions`→`_SEARCH_SUGGESTIONS`, `chat.greeting`→`_CHAT_GREETING`, `chat.chips`→`_CHAT_CHIPS`,
`video.eyebrow|title|emphasis|text|caption|steps`→`_VIDEO_EYEBROW|_VIDEO_TITLE|_VIDEO_EMPHASIS|_VIDEO_TEXT|_VIDEO_CAPTION|_VIDEO_STEPS`,
`custom_order` (`false`→`off`; `true` não escreve nada)→`_CUSTOM_ORDER`, `custom_order_text`→`_CUSTOM_ORDER_TEXT`
(onde `_X` = `NEXT_PUBLIC_BRAND_X`);
`colors.bg|bg_alt|surface|primary|accent|secondary|dark|text`→`NEXT_PUBLIC_COLOR_BG|_BG_ALT|_SURFACE|_PRIMARY|_ACCENT|_SECONDARY|_DARK|_TEXT`;
`legal.name|document|address|email`→`NEXT_PUBLIC_LEGAL_NAME|_DOCUMENT|_ADDRESS|_EMAIL`; `credit_url`→`NEXT_PUBLIC_CREDIT_URL`;
sempre `NEXT_PUBLIC_API_URL=<domains.api>/api/v1` e `NEXT_PUBLIC_WS_URL=wss://<host api>`.

Backend: `mode`→`STORE_MODE`, `name`→`STORE_NAME`, `full_name`→`STORE_FULL_NAME`, `segment`→`STORE_SEGMENT`,
`about`→`STORE_ABOUT`.

---

## Item 6 — `deploy/NEW_STORE.md` (roteiro)

Roteiro passo a passo, do zero até a loja de teste no ar. Público: técnico da Maldivas Tech. Seções:
pré-requisitos e contas; YAML da loja; gerar envs; backend (VM + Docker + Caddy + certificados Efí);
banco e `bootstrap_store`; frontend na Vercel (envs + domínio); Efí (apps Pix e Cobranças, certificado, chave Pix,
webhook com `EFI_WEBHOOK_SECRET`, identificador de conta); Melhor Envio ou frete fixo; e-mail SMTP;
domínio/DNS; checklist de go-live; o que nunca fazer (segredos, PAYG, commitar YAML com segredos).
