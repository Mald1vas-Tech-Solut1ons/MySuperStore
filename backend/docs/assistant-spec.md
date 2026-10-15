# Spec — Assistente de atendimento do Ateliê (IA)

Objetivo: chat no site que responde sobre peças, preços, estoque, processo de fabricação, sob medida, frete, pagamento e trocas do Ateliê Eli Trassi Macramê (Vila Galvão, Guarulhos-SP; envia para todo o Brasil). A IA (Google Gemini) roda **só no backend**; a chave nunca vai ao navegador.

## A1 — Backend Django: `apps/assistant` (Django 5.1, DRF, Python 3.12)
Arquivos: `apps/assistant/__init__.py`, `apps.py` (AssistantConfig, name="apps.assistant"), `urls.py`, `views.py`, `tests.py`. **Não** escrever `gemini.py` nem `context.py` (já existem — use as assinaturas abaixo).
- Já existem (não reescrever):
  - `from apps.assistant.gemini import ask, AssistantUnavailable` → `ask(system: str, messages: list[dict]) -> str`; `messages` = `[{"role": "user"|"model", "text": str}]`; lança `AssistantUnavailable` se sem chave ou se todos os modelos falharem.
  - `from apps.assistant.context import system_prompt, catalog_products` → `system_prompt() -> str`; `catalog_products() -> list[dict]` com `{"slug","name","price": float,"image": str|None}` (produtos públicos disponíveis).
- `urls.py`: `path("chat/", ChatView.as_view(), name="assistant-chat")`. Será incluído em `config/urls.py` como `api/v1/assistant/`.
- `ChatView(APIView)`: `permission_classes = [AllowAny]`, `authentication_classes = []`, `throttle_classes = [ScopedRateThrottle]`, `throttle_scope = "assistant"`. `POST` recebe `{"messages": [{"role": "user"|"assistant", "content": str}, ...]}` validado por um `serializers.Serializer`: 1–12 mensagens; `role` em ("user","assistant"); `content` string não vazia, máx. 800 caracteres (após strip); a última mensagem deve ser `user` (senão 400). Converte `assistant`→`model` e chama `ask(system_prompt(), msgs)`. Em `AssistantUnavailable` → 503 `{"detail": "Atendimento automático indisponível no momento. Fale com a gente pelo WhatsApp."}`. Sucesso → 200 `{"reply": str, "products": [...]}` onde `products` = até 3 itens de `catalog_products()` cujo `name` aparece (case-insensitive) no `reply`.
- `tests.py` (TestCase + APIClient, `@mock.patch("apps.assistant.views.ask")` e `@mock.patch("apps.assistant.views.catalog_products")`, `system_prompt` também mockado): (1) resposta 200 com reply e produto citado; (2) 400 quando a última mensagem não é do usuário; (3) 400 com conteúdo > 800 chars; (4) 400 com 13 mensagens; (5) 503 quando `ask` lança `AssistantUnavailable`. Use `override_settings` para deixar o throttle alto (`REST_FRAMEWORK` copiando o existente e definindo `DEFAULT_THROTTLE_RATES={"assistant": "1000/min"}`) ou limpe o cache entre testes.
- SAÍDA: cada arquivo precedido de uma linha `# FILE: <caminho>`; só código, sem cercas markdown.

## A2 — Frontend: `src/components/storefront/ChatWidget.tsx`
Stack/tokens/regras de design: os mesmos de `frontend/docs/storefront-spec.md` (Next 15, React 19, TS strict, Tailwind com cores `atelie-*`, fontes `font-serif`/`font-atelie`, framer-motion respeitando `useReducedMotion`, lucide-react, acessível, mobile-first).
- `export function ChatWidget()`. Usa `import { api } from "@/lib/api";` → `api.post("/assistant/chat/", { messages })` retorna `{ data: { reply: string; products: {slug,name,price,image}[] } }`. Usa `import { brand, whatsappLink } from "@/config/brand";` e `import { brl } from "@/lib/storefront";`.
- Botão flutuante fixo `bottom-5 right-5` (mobile `bottom-4 right-4`), `z-[70]`, redondo `h-14 w-14 bg-atelie-ink text-atelie-cream shadow-xl`, ícone `MessageCircle`; ao lado (só desktop, só antes da 1ª abertura) um balão discreto "Dúvidas? Fale com o ateliê". `aria-label`, `aria-expanded`.
- Painel: desktop `w-[380px] h-[560px]` ancorado acima do botão, `rounded-3xl`; mobile tela cheia (`inset-0`). Fundo `bg-atelie-cream`, borda `ring-1 ring-black/10`, sombra grande. Entra com scale/opacity (framer-motion). Fecha com X e Esc; foco vai para o input ao abrir.
- Cabeçalho: avatar redondo com a inicial "E" em `font-serif` sobre `bg-atelie-clay text-white`, título `Ateliê ${brand.name.replace("Ateliê ", "")}`... use simplesmente `brand.name`, subtítulo "Assistente do ateliê · responde na hora" com ponto verde; botão fechar.
- Mensagem inicial (local, não vai à API): "Oi! Sou a assistente do {brand.name}. Posso te ajudar com as peças, preços, encomendas sob medida, frete e cuidados com o macramê. 🧶". Abaixo, chips de sugestão (somem após o 1º envio): "Quais bolsas estão disponíveis?", "Como funciona o sob medida?", "Quanto custa o frete?", "Como cuidar do macramê?".
- Bolhas: usuário à direita `bg-atelie-ink text-atelie-cream rounded-2xl rounded-br-md`; assistente à esquerda `bg-white text-atelie-ink ring-1 ring-black/5 rounded-2xl rounded-bl-md`; texto `text-[14px] leading-relaxed whitespace-pre-wrap`. Indicador "digitando" (3 pontos animados) enquanto aguarda. Rolagem automática para o fim.
- Produtos devolvidos: mini-cards horizontais abaixo da resposta (thumb 48px, nome, `brl(price)`), cada um é `<a href={"/?product=" + slug}>`.
- Envio: textarea 1 linha que cresce até 4 (Enter envia, Shift+Enter quebra), `maxLength={800}`, botão `Send`. Envia o histórico (sem a saudação local), no máx. as últimas 12 mensagens, mapeando para `{role, content}`.
- Erro (429 ou 5xx): bolha do assistente "Estou com muita procura agora. Fale com a gente pelo WhatsApp que respondemos rapidinho." e, se `whatsappLink(...)` não vazio, botão "Abrir WhatsApp".
- Rodapé do painel: link "Falar com uma pessoa" → `whatsappLink("Olá! Vim pelo site e queria falar com o ateliê.")` (se vazio, ocultar) e texto minúsculo "Respostas geradas por IA podem conter erros."
- Persistir a conversa em `sessionStorage` (chave `atelie-chat`), com try/catch.
- SAÍDA: só o código do arquivo, sem cercas markdown.

## A3 — Base de conhecimento: `apps/assistant/knowledge.md`
Texto em português, seções curtas em markdown, para a IA consultar. Use SÓ estes fatos; onde faltar informação escreva literalmente "(a confirmar pelo ateliê)":
- Ateliê Eli Trassi Macramê: peças em macramê feitas à mão, uma a uma, pela Eli, na Vila Galvão, Guarulhos-SP. Envia para todo o Brasil.
- Peças: bolsas (linha Caracol — formato de concha, alça trançada, ferragens douradas ou prateadas; linha Boho — alça trançada ou de couro, borla com contas de madeira, cores café, off-white e oliva). Também chapéus, calçados e itens de casa quando houver no catálogo.
- Material: fio/cordão de algodão; contas de madeira; ferragens metálicas.
- Processo: escolha do fio → nós e trama feitos à mão → acabamento. Cada peça leva horas; pequenas variações tornam cada peça única.
- Sob medida: cliente escolhe cor do fio, tamanho e ferragem; combina pelo WhatsApp; prazo de produção (a confirmar pelo ateliê, combinado no pedido); pagamento e frete combinados.
- Pagamento: Pix (aprovação na hora) e cartão de crédito no site.
- Frete: calculado no carrinho pelo CEP (Melhor Envio); prazo depende da transportadora e do CEP.
- Trocas: direito de arrependimento em até 7 dias após o recebimento (compras online); peças sob medida (a confirmar pelo ateliê).
- Cuidados com macramê: limpar com pano úmido ou lavar à mão com sabão neutro em água fria, não torcer, secar à sombra na horizontal, guardar longe de umidade, evitar contato prolongado com sol forte (pode desbotar).
- Contato humano: WhatsApp do ateliê (link no site).
SAÍDA: só o markdown, sem cercas.
