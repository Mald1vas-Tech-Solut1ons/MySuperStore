// PROTOTYPE — dados mock para explorar o redesign da home do marketplace.
// Não é código de produção: some quando a direção vencedora for incorporada à home real.
// "Nó & Trama" é o tenant de macramê (nome provisório); as outras lojas existem só
// para mostrar como o layout se comporta com N lojas no universo MySuperStore.

const u = (id: string, w = 900, h?: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${w}${h ? `&h=${h}` : ""}`;

export const img = u;

export type ProtoStore = {
  slug: string;
  name: string;
  tagline: string;
  city: string;
  avatar: string;
  cover: string;
  rating: number;
  sales: number;
};

export type ProtoProduct = {
  id: string;
  name: string;
  store: string; // slug
  category: string; // slug
  price: number;
  compareAt?: number;
  madeToOrder?: boolean;
  image: string;
  hover?: string;
  tall?: boolean; // usado pelo layout masonry
};

export const stores: ProtoStore[] = [
  {
    slug: "no-e-trama",
    name: "Nó & Trama",
    tagline: "Macramê feito à mão, nó a nó",
    city: "Florianópolis, SC",
    avatar: "/_prototype/eli/caracol-dourada.webp",
    cover: "/_prototype/eli/caracol-praia.webp",
    rating: 4.9,
    sales: 312,
  },
  {
    slug: "palha-viva",
    name: "Palha Viva",
    tagline: "Chapéus de fibra natural",
    city: "Trancoso, BA",
    avatar: u("photo-1775540002435-f0eafc4dec1a", 200, 200),
    cover: u("photo-1518061124653-4b85d51931f1", 1600),
    rating: 4.8,
    sales: 128,
  },
  {
    slug: "passo-tramado",
    name: "Passo Tramado",
    tagline: "Sandálias trançadas artesanais",
    city: "Belo Horizonte, MG",
    avatar: u("photo-1677922336313-b8c3d920aa22", 200, 200),
    cover: u("photo-1677922336239-d6978d0d2af2", 1600),
    rating: 4.7,
    sales: 86,
  },
  {
    slug: "fio-cru",
    name: "Fio Cru",
    tagline: "Acessórios em fio e conta",
    city: "São Paulo, SP",
    avatar: u("photo-1633438724843-489aae6314fb", 200, 200),
    cover: u("photo-1766560360212-e151abcd2855", 1600),
    rating: 4.9,
    sales: 204,
  },
];

export const storeBySlug = Object.fromEntries(stores.map((s) => [s.slug, s]));

export const categories = [
  { slug: "bolsas", name: "Bolsas", image: "/_prototype/eli/boho-offwhite.webp" },
  { slug: "chapeus", name: "Chapéus", image: u("photo-1583238619747-27950824e04d", 600, 750) },
  { slug: "calcados", name: "Calçados", image: u("photo-1677922336239-d6978d0d2af2", 600, 750) },
  { slug: "casa", name: "Casa", image: u("photo-1633594308237-3dcfa56b4e69", 600, 750) },
  { slug: "acessorios", name: "Acessórios", image: u("photo-1766560360212-e151abcd2855", 600, 750) },
];

const eli = (f: string) => `/_prototype/eli/${f}`;
export const eliPhotos = {
  cafe: eli("boho-cafe.webp"),
  offwhite: eli("boho-offwhite.webp"),
  caracol: eli("caracol-dourada.webp"),
  caracolPrata: eli("caracol-prata.webp"),
  caracolPraia: eli("caracol-praia.webp"),
  olivaModelo: eli("boho-oliva-modelo.webp"),
  olivaProduto: eli("boho-oliva-produto.webp"),
  olivaDetalhe: eli("boho-oliva-detalhe.webp"),
};

// Produtos da Nó & Trama usam as fotos reais da loja (preços provisórios).
export const products: ProtoProduct[] = [
  { id: "e1", name: "Bolsa Caracol", store: "no-e-trama", category: "bolsas", price: 249, image: eliPhotos.caracol, hover: eliPhotos.caracolPraia, tall: true },
  { id: "e2", name: "Bolsa Boho Café", store: "no-e-trama", category: "bolsas", price: 279, image: eliPhotos.cafe, tall: true },
  { id: "p3", name: "Chapéu Aba Larga Duna", store: "palha-viva", category: "chapeus", price: 179, compareAt: 219, image: u("photo-1583238619747-27950824e04d", 700, 875), hover: u("photo-1617733401065-c7bdf0b33417", 700, 875) },
  { id: "e3", name: "Bolsa Boho Off-white", store: "no-e-trama", category: "bolsas", price: 289, image: eliPhotos.offwhite, tall: true },
  { id: "p4", name: "Sandália Trança Caramelo", store: "passo-tramado", category: "calcados", price: 239, image: u("photo-1677922336239-d6978d0d2af2", 700, 875), hover: u("photo-1677922336313-b8c3d920aa22", 700, 875) },
  { id: "e4", name: "Bolsa Boho Oliva", store: "no-e-trama", category: "bolsas", price: 259, madeToOrder: true, image: eliPhotos.olivaProduto, hover: eliPhotos.olivaModelo },
  { id: "p7", name: "Chapéu Panamá Fita Preta", store: "palha-viva", category: "chapeus", price: 249, image: u("photo-1568645367936-afb92b45e3bf", 700, 875) },
  { id: "e5", name: "Bolsa Caracol Prata", store: "no-e-trama", category: "bolsas", price: 249, image: eliPhotos.caracolPrata },
  { id: "p9", name: "Pulseiras Terracota (trio)", store: "fio-cru", category: "acessorios", price: 89, image: u("photo-1766560360212-e151abcd2855", 700, 875), tall: true },
  { id: "p12", name: "Sandália Rasteira Colorê", store: "passo-tramado", category: "calcados", price: 159, image: u("photo-1781863065553-e2dfaf6c01a6", 700, 875) },
  { id: "p13", name: "Colar Argola Madeira", store: "fio-cru", category: "acessorios", price: 69, image: u("photo-1633438724843-489aae6314fb", 700, 875) },
  { id: "p14", name: "Bolsa Palha Praia", store: "palha-viva", category: "bolsas", price: 149, image: u("photo-1756725519484-f5aff6ca6bc7", 700, 875), tall: true },
  { id: "p11", name: "Chaveiros Nó Ferrugem", store: "fio-cru", category: "acessorios", price: 39, image: u("photo-1791002598785-b2147978a831", 700, 875) },
  { id: "p2", name: "Painel Lua Crescente", store: "fio-cru", category: "casa", price: 219, madeToOrder: true, image: u("photo-1632761644913-0da6105863cb", 700, 875), tall: true },
];

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const installments = (v: number) => {
  const n = v >= 150 ? 3 : 2;
  return `${n}x de ${(v / n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
};

export const textures = {
  knots: "/_prototype/eli/boho-oliva-modelo.webp",
  weave: u("photo-1608158680747-943c02770c5e", 1600),
  boho: u("photo-1776721976075-388f652c9b4f", 1600),
  hatModel: u("photo-1620961049392-16fe6d81ca3a", 1200),
  hats: u("photo-1518061124653-4b85d51931f1", 1600),
};
