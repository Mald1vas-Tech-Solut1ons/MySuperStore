# Plano de Produto — MySuperStore como "Loja própria pronta e personalizada"

> Dono do produto (PO): Rafael (Maldivas Tech). CTO/PM: Claude. Executores: agentes Ollama (`ollama-delegate`).
> Vitrine/case: **Ateliê Eli Trassi Macramê** — https://mysuperstore-lime.vercel.app

## 1. Decisão estratégica (aprovada pelo PO)
- **Não** vender como SaaS/marketplace aberto (exige muito investimento em mídia).
- **Vender como "loja própria pronta"**: cada cliente = **uma instalação própria** (domínio, banco, conta Efí, marca), saindo do **mesmo código**.
- **O motor multi-tenant fica** (pagamento, repasse, estoque, estorno dependem dele). Por dentro, cada loja é um tenant; o cliente pode ter várias **linhas/lojas da casa** (`Seller.receives_in_master`, `featured_rank`).
- Receita: implantação + mensalidade (hospedagem, manutenção, atualizações).

## 2. Estado atual (produção)
- Frontend: Vercel (`npx vercel deploy --prod --scope team_eEi5jUcSgsZDia5ES37Fa7YI`, a partir da `master`).
- Backend: Oracle (`bash deploy/oracle/deploy.sh 144.22.151.18`, a partir da `master`); `.env.prod` em `~/mysuperstore/shared/`.
- Loja da Eli: dona `elitrassi@gmail.com` (admin+superadmin), 6 peças reais (só fotos da pasta `OneDrive/Pictures/eli`), recebe na conta Efí master (conta pessoal do Rafael, PIX produção ativo, webhook com `EFI_WEBHOOK_SECRET`).
- Frete: `SHIPPING_MODE=flat`, R$ 25, grátis ≥ R$ 299 (servidor decide). Rastreio dos Correios pelo painel da loja.
- Prontos: home do Ateliê, chat IA (Gemini, chave só no servidor), selos verdadeiros, tema claro em todo o site, recuperação de senha, estoque atômico, estornos com trava/teto, cupom BEMVINDA10.
- Áreas `/seller/*` e `/admin/*` seguem no tema escuro antigo (isoladas).

## 3. Sprint atual — "Modo loja única" (produto revendável)
Objetivo: uma nova loja de cliente sobe **só com configuração**, sem editar código.

| # | Entrega | Dono | Critério de aceite |
|---|---|---|---|
| 1 | `NEXT_PUBLIC_STORE_MODE=single`: esconder "Venda seu artesanato", "Ateliês parceiros", cadastro público de lojista, `/vender`, `/white-label` (redirect para `/`) | CTO (lógica) + deepseek (ajustes de JSX) | Em `single`, nenhum link/rota de marketplace acessível; em `marketplace`, tudo como hoje |
| 2 | Marca 100% configurável: `src/config/brand.ts` lendo env (`NEXT_PUBLIC_BRAND_NAME`, `_TAGLINE`, `_LOCATION`, `_SHIPPING`, `_HERO_IMAGE`…) com o Ateliê como padrão | deepseek (boilerplate) + CTO (revisão) | Trocar envs muda nome/textos/fotos sem tocar em componente |
| 3 | Paleta configurável: tokens `atelie-*` viram CSS vars (`--brand-*`) definidas por env/tema | deepseek | Mudar 5 cores no env reflete no site todo |
| 4 | Rodapé "Feito por Maldivas Tech" (discreto) no lugar de "Plataforma MySuperStore" em `single` | deepseek | Link para site comercial da Maldivas Tech |
| 5 | Rodapé legal (Decreto 7.962): razão social/CPF-CNPJ e endereço via env | CTO | Campos aparecem quando configurados (**aguardando dados do vendedor**) |
| 6 | Kit de nova loja: `deploy/NEW_STORE.md` (checklist Efí, Melhor Envio, domínio, envs) + script `scripts/new_store_env.py` que gera os `.env` a partir de um YAML | nemotron (roteiro/infra) + deepseek (script) + CTO (revisão) | Do zero a loja de teste no ar seguindo só o documento |
| 7 | Testes + verificação rota a rota nos dois modos | CTO | `tsc` limpo, testes backend verdes, checagem visual |

## 4. Backlog priorizado (após o sprint)
1. **Compra-teste real** (Pix do Rafael + cartão da Eli) e estorno pelo painel; confirmar "3x sem juros" no Efí.
2. **Melhor Envio produção** (guia na conversa: app de produção, OAuth, `SHIPPING_MODE=melhor_envio`, carteira com saldo).
3. Escopo Efí de **consulta de cobrança/Pix** (necessário para estorno automático de Pix).
4. **Sprint 5 crescimento**: domínio próprio, SEO de produto (schema.org/OG/sitemap), e-mails transacionais com a marca (os atuais são escuros/MySuperStore), cashback 5%, indicação.
5. **Sprint 6**: painel da loja (`/seller/*`) no padrão claro, para a dona operar sozinha (peças, fotos, vídeo, pedidos, rastreio).
6. Robustez restante: refresh JWT 90d sem blacklist, rate limit global DRF, mídia S3 `public-read`, auto-aprovação de lojista.

## 5. Protocolo de delegação (o que funcionou nesta base)
- **1 componente/arquivo pequeno por chamada** (≤ ~200 linhas). Arquivo inteiro maior → timeout (limite 180 s).
- Escrever a **spec uma vez em arquivo** (`frontend/docs/*-spec.md`) e chamar `process_file` com "implemente APENAS o item X" — barato e consistente.
- Modelos: **deepseek-v4.1-flash** (código/UI/testes/copy, melhor histórico); **glm-5.3-flash** (componentes simples, copy factual); **minimax-m3** (UI simples); **nemotron-3-super/ultra** (infra, roteiros, roadmaps); **kimi-k3 não** (lento/caro, estoura 180 s).
- **Nunca delegar**: autenticação, pagamentos/estornos, segurança, credenciais, decisões de produto. Revisar tudo antes de gravar; conferir lógica por diff quando o agente reestiliza.
- Registrar cada delegação em `~/.claude/ollama-routing.md`.

## 6. Regras de operação
- PR por sprint; **merge é do PO** (o classificador bloqueia `gh pr merge`). Deploy só a partir da `master`.
- Produção: ler antes de escrever; backup de `.env.prod` antes de mudar; nunca exibir segredos.
- **Nada falso no site**: sem produto, nota, depoimento, urgência ou selo inventados. Só peças reais da pasta da Eli.
- Verificar no navegador esperando imagens carregarem de fato; não declarar pronto sem prova.
