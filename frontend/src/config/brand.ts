// Identidade da loja, 100% configurável por env (modo loja única: uma instalação por cliente).
// Sem env nenhuma, tudo cai no padrão do Ateliê Eli Trassi — o site em produção não muda.
// Regra do Next.js: cada NEXT_PUBLIC_* precisa ser lida de forma LITERAL para entrar no bundle.

export type NavItem = { label: string; href: string };
export type LookbookItem = { src: string; alt: string };

export type Brand = {
  name: string;
  fullName: string;
  tagline: string;
  segment: string;
  shopNoun: string;
  location: string;
  shipping: string;
  announcement: string;
  whatsapp: string;
  instagram: string;
  meta: { title: string; description: string; shortDescription: string };
  hero: { eyebrow: string; title: string; titleEmphasis: string; subtitle: string };
  marquee: string[];
  collectionSubtitle: string;
  nav: NavItem[];
  search: { placeholder: string; suggestions: string[] };
  chat: { greeting: string; chips: string[] };
  video: { eyebrow: string; title: string; titleEmphasis: string; text: string; caption: string; steps: string[] };
  customOrder: { enabled: boolean; text: string };
  images: { hero: string; heroAlt: string; lookbook: LookbookItem[]; detail: string; detailAlt: string; ogAlt: string };
  legal: { name: string; document: string; address: string; email: string };
  credit: { label: string; url: string };
};

// Valor do env (aparado) ou o padrão. "-" significa "vazio de propósito" (esconde o trecho).
const str = (v: string | undefined, fallback: string): string => {
  const t = (v ?? "").trim();
  if (t === "-") return "";
  return t || fallback;
};

// Lista separada por "|" (itens aparados, vazios descartados) ou o padrão.
const list = (v: string | undefined, fallback: readonly string[]): string[] => {
  const items = (v ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : [...fallback];
};

// "Rótulo=slug" → { label, href: "/?category=<slug>" }; item sem "=" é descartado.
const parseNav = (v: string | undefined): NavItem[] =>
  list(v, ["Bolsas=bolsas", "Chapéus=chapeus", "Calçados=calcados", "Casa=casa"]).flatMap((item) => {
    const i = item.indexOf("=");
    const label = item.slice(0, i).trim();
    const slug = item.slice(i + 1).trim();
    return i > 0 && label && slug ? [{ label, href: `/?category=${encodeURIComponent(slug)}` }] : [];
  });

// "src::alt" → { src, alt }; item sem "::" vira { src: item, alt: "" }.
const parseLookbook = (v: string | undefined): LookbookItem[] =>
  list(v, [
    "/brand/atelie/boho-cafe.webp::Bolsa Boho Café em macramê",
    "/brand/atelie/boho-offwhite.webp::Bolsa Boho Off-white com alça de couro",
    "/brand/atelie/boho-oliva-modelo.webp::Bolsa Boho Oliva no ombro",
  ]).map((item) => {
    const i = item.indexOf("::");
    return i < 0 ? { src: item, alt: "" } : { src: item.slice(0, i).trim(), alt: item.slice(i + 2).trim() };
  });

// Campos usados nos padrões derivados.
const name = str(process.env.NEXT_PUBLIC_BRAND_NAME, "Ateliê Eli Trassi");
const location = str(process.env.NEXT_PUBLIC_BRAND_LOCATION, "Vila Galvão · Guarulhos, SP");
const shipping = str(process.env.NEXT_PUBLIC_BRAND_SHIPPING, "Enviamos para todo o Brasil");

export const brand: Brand = {
  name,
  fullName: str(process.env.NEXT_PUBLIC_BRAND_FULL_NAME, "Ateliê Eli Trassi Macramê"),
  tagline: str(process.env.NEXT_PUBLIC_BRAND_TAGLINE, "Macramê feito à mão, nó a nó"),
  segment: str(process.env.NEXT_PUBLIC_BRAND_SEGMENT, "macramê"),
  shopNoun: str(process.env.NEXT_PUBLIC_BRAND_SHOP_NOUN, "ateliê"),
  location,
  shipping,
  announcement: str(process.env.NEXT_PUBLIC_BRAND_ANNOUNCEMENT, "Frete grátis acima de R$ 299"),
  // Contato: só dígitos com DDI (ex.: 5511999999999) e usuário do Instagram sem @.
  whatsapp: str(process.env.NEXT_PUBLIC_WHATSAPP, ""),
  instagram: str(process.env.NEXT_PUBLIC_INSTAGRAM, ""),
  meta: {
    title: str(process.env.NEXT_PUBLIC_BRAND_META_TITLE, "Ateliê Eli Trassi Macramê — bolsas feitas à mão"),
    description: str(
      process.env.NEXT_PUBLIC_BRAND_META_DESCRIPTION,
      "Bolsas e peças em macramê feitas à mão, nó a nó, na Vila Galvão em Guarulhos. Encomendas sob medida e envio para todo o Brasil.",
    ),
    shortDescription: str(process.env.NEXT_PUBLIC_BRAND_META_SHORT, "Bolsas e peças em macramê feitas à mão em Guarulhos-SP."),
  },
  hero: {
    eyebrow: str(process.env.NEXT_PUBLIC_BRAND_HERO_EYEBROW, `Ateliê · ${location}`),
    title: str(process.env.NEXT_PUBLIC_BRAND_HERO_TITLE, "Feito à mão,"),
    titleEmphasis: str(process.env.NEXT_PUBLIC_BRAND_HERO_EMPHASIS, "nó a nó."),
    subtitle: str(process.env.NEXT_PUBLIC_BRAND_HERO_SUBTITLE, `Bolsas e peças em macramê criadas uma a uma no ateliê. ${shipping}.`),
  },
  marquee: list(process.env.NEXT_PUBLIC_BRAND_MARQUEE, [
    "feito à mão",
    "nó a nó",
    "fio de algodão",
    "sob medida",
    "de Guarulhos para todo o Brasil",
    "peças únicas",
  ]),
  collectionSubtitle: str(
    process.env.NEXT_PUBLIC_BRAND_COLLECTION_SUBTITLE,
    "Cada peça é feita à mão, uma a uma. Quando acaba, a próxima pode sair diferente — e esse é o charme.",
  ),
  nav: parseNav(process.env.NEXT_PUBLIC_BRAND_NAV),
  search: {
    placeholder: str(process.env.NEXT_PUBLIC_BRAND_SEARCH_PLACEHOLDER, "Busque bolsas, chapéus, peças…"),
    suggestions: list(process.env.NEXT_PUBLIC_BRAND_SEARCH_SUGGESTIONS, ["bolsa caracol", "boho", "chapéu", "sob medida"]),
  },
  chat: {
    greeting: str(
      process.env.NEXT_PUBLIC_BRAND_CHAT_GREETING,
      `Oi! Sou a assistente do ${name}. Posso te ajudar com as peças, preços, encomendas sob medida, frete e cuidados com o macramê. 🧶`,
    ),
    chips: list(process.env.NEXT_PUBLIC_BRAND_CHAT_CHIPS, [
      "Quais bolsas estão disponíveis?",
      "Como funciona o sob medida?",
      "Quanto custa o frete?",
      "Como cuidar do macramê?",
    ]),
  },
  video: {
    eyebrow: str(process.env.NEXT_PUBLIC_BRAND_VIDEO_EYEBROW, "No ateliê"),
    title: str(process.env.NEXT_PUBLIC_BRAND_VIDEO_TITLE, "Do fio"),
    titleEmphasis: str(process.env.NEXT_PUBLIC_BRAND_VIDEO_EMPHASIS, "à peça"),
    text: str(
      process.env.NEXT_PUBLIC_BRAND_VIDEO_TEXT,
      "Cada bolsa leva horas de nós feitos à mão, com fio de algodão e acabamento caprichado. Assista ao processo e escolha a sua.",
    ),
    caption: str(process.env.NEXT_PUBLIC_BRAND_VIDEO_CAPTION, "Do fio à bolsa: o processo no ateliê"),
    steps: list(process.env.NEXT_PUBLIC_BRAND_VIDEO_STEPS, ["01 · Escolha do fio", "02 · Nós e trama", "03 · Acabamento"]),
  },
  // Seção "Sob medida": ligada por padrão; só "off" desliga.
  customOrder: {
    enabled: (process.env.NEXT_PUBLIC_BRAND_CUSTOM_ORDER ?? "").trim() !== "off",
    text: str(
      process.env.NEXT_PUBLIC_BRAND_CUSTOM_ORDER_TEXT,
      "Escolha a cor do fio, o tamanho e a ferragem — dourada ou prateada. A gente cria a peça junto com você e envia para qualquer lugar do Brasil.",
    ),
  },
  // Imagens editoriais (fotos reais das peças), servidas de /public ou URL absoluta.
  images: {
    hero: str(process.env.NEXT_PUBLIC_BRAND_HERO_IMAGE, "/brand/atelie/caracol-praia.webp"),
    heroAlt: str(process.env.NEXT_PUBLIC_BRAND_HERO_ALT, "Bolsa Caracol em macramê cru usada na praia"),
    lookbook: parseLookbook(process.env.NEXT_PUBLIC_BRAND_LOOKBOOK),
    detail: str(process.env.NEXT_PUBLIC_BRAND_DETAIL_IMAGE, "/brand/atelie/caracol-dourada.webp"),
    detailAlt: str(process.env.NEXT_PUBLIC_BRAND_DETAIL_ALT, "Detalhe de uma bolsa de macramê feita à mão"),
    ogAlt: str(process.env.NEXT_PUBLIC_BRAND_OG_ALT, "Bolsa Caracol em macramê do Ateliê Eli Trassi"),
  },
  // Rodapé legal (Decreto 7.962/2013): só aparece o que for preenchido.
  legal: {
    name: str(process.env.NEXT_PUBLIC_LEGAL_NAME, ""),
    document: str(process.env.NEXT_PUBLIC_LEGAL_DOCUMENT, ""),
    address: str(process.env.NEXT_PUBLIC_LEGAL_ADDRESS, ""),
    email: str(process.env.NEXT_PUBLIC_LEGAL_EMAIL, ""),
  },
  credit: {
    label: str(process.env.NEXT_PUBLIC_CREDIT_LABEL, "Feito por Maldivas Tech"),
    url: str(process.env.NEXT_PUBLIC_CREDIT_URL, ""),
  },
};

export const whatsappLink = (text: string) =>
  brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}` : "";

// "CPF 123.456.789-00" / "CNPJ 12.345.678/0001-00"; outro tamanho volta como veio; vazio → "".
export function legalDocumentLabel(raw: string): string {
  const t = (raw ?? "").trim();
  const d = t.replace(/\D/g, "");
  if (d.length === 11) return `CPF ${d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}`;
  if (d.length === 14) return `CNPJ ${d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`;
  return t;
}

export const hasLegalInfo = Boolean(brand.legal.name || brand.legal.document || brand.legal.address || brand.legal.email);
