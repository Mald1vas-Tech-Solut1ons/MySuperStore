// Estado, sugestões e conversões do formulário de cadastro de produto do lojista.
// Os slugs das categorias seguem backend/apps/catalog/macrame.py.

export type SpecField = { attribute_name: string; attribute_value: string };

export type ProductFormValues = {
  name: string;
  categoryId: string;
  basePrice: string;
  stock: string;
  description: string;
  specs: SpecField[];
  // Embalagem pronta para envio — entra na cotação do Melhor Envio.
  weightG: string;
  length: string;
  width: string;
  height: string;
  deliveryDays: string;
};

export const emptyProductForm: ProductFormValues = {
  name: "",
  categoryId: "",
  basePrice: "",
  stock: "",
  description: "",
  specs: [],
  weightG: "",
  length: "",
  width: "",
  height: "",
  deliveryDays: "",
};

export type PackagePreset = { weightG: number; length: number; width: number; height: number };

// Ponto de partida por tipo de peça (embalagem incluída). São estimativas: o ideal é pesar
// e medir a peça embalada — frete subestimado sai do bolso da lojista.
export const PACKAGE_PRESETS: Record<string, PackagePreset> = {
  bolsas: { weightG: 500, length: 30, width: 25, height: 12 },
  calcados: { weightG: 600, length: 32, width: 22, height: 12 },
  rasteirinhas: { weightG: 400, length: 30, width: 20, height: 10 },
  "moda-feminina": { weightG: 300, length: 30, width: 22, height: 6 },
  "moda-praia": { weightG: 300, length: 30, width: 22, height: 6 },
  chapeus: { weightG: 300, length: 38, width: 38, height: 15 },
  acessorios: { weightG: 150, length: 16, width: 11, height: 4 },
  casa: { weightG: 800, length: 40, width: 30, height: 15 },
};

const COMMON_SPECS = ["Material", "Cor", "Medidas", "Tempo de produção", "Cuidados"];

// Nomes de característica sugeridos por categoria (o valor a lojista escreve).
export const SPEC_SUGGESTIONS: Record<string, string[]> = {
  bolsas: ["Material", "Cor", "Medidas (L x A x P)", "Alça", "Forro", "Fecho", "Tempo de produção", "Cuidados"],
  calcados: ["Numeração", "Cor", "Material", "Solado", "Tempo de produção", "Cuidados"],
  rasteirinhas: ["Numeração", "Cor", "Material", "Solado", "Tempo de produção", "Cuidados"],
  "moda-feminina": ["Tamanho", "Cor", "Material", "Modelagem", "Forro", "Tempo de produção", "Cuidados"],
  "moda-praia": ["Tamanho", "Cor", "Material", "Modelagem", "Forro", "Tempo de produção", "Cuidados"],
  chapeus: ["Tamanho", "Cor", "Material", "Aba", "Cuidados"],
  acessorios: ["Cor", "Material", "Medidas", "Fecho", "Cuidados"],
  casa: ["Medidas", "Cor", "Material", "Como instalar", "Cuidados"],
};

export function specSuggestionsFor(slug: string | undefined): string[] {
  return (slug && SPEC_SUGGESTIONS[slug]) || COMMON_SPECS;
}

const toNumber = (value: string): number | null => {
  const n = parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toInt = (value: string): number | null => {
  const n = parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Corpo enviado à API (criação e edição usam o mesmo formato).
export function toProductPayload(v: ProductFormValues) {
  const grams = toNumber(v.weightG);
  const payload: Record<string, unknown> = {
    name: v.name.trim(),
    category: v.categoryId,
    base_price: parseFloat(v.basePrice.replace(",", ".")),
    description: v.description,
    initial_stock: v.stock ? parseInt(v.stock, 10) : 0,
    specifications: v.specs.filter((s) => s.attribute_name.trim() && s.attribute_value.trim()),
    // null limpa o campo na edição; sem valor o frete cai no padrão mínimo do Melhor Envio.
    weight: grams === null ? null : Math.round(grams) / 1000,
    length: toNumber(v.length),
    width: toNumber(v.width),
    height: toNumber(v.height),
  };
  const days = toInt(v.deliveryDays);
  if (days !== null) payload.estimated_delivery_days = days;
  return payload;
}

const trimNumber = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
};

// Detalhe do produto (GET /sellers/me/products/{id}/) → valores do formulário.
export function productToForm(data: any): ProductFormValues {
  const kg = Number(data.weight);
  return {
    name: data.name ?? "",
    categoryId: data.category ?? "",
    basePrice: data.base_price !== undefined ? String(data.base_price) : "",
    stock: data.initial_stock !== undefined ? String(data.initial_stock) : "",
    description: data.description ?? "",
    specs: (data.specifications ?? []).map((s: SpecField) => ({
      attribute_name: s.attribute_name,
      attribute_value: s.attribute_value,
    })),
    weightG: data.weight ? String(Math.round(kg * 1000)) : "",
    length: trimNumber(data.length),
    width: trimNumber(data.width),
    height: trimNumber(data.height),
    deliveryDays: trimNumber(data.estimated_delivery_days),
  };
}
