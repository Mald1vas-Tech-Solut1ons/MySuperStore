// Camada de dados da vitrine (home). Tipos espelham os serializers públicos do
// backend: ProductListSerializer e SellerPublicSerializer.
import { catalogApi } from "@/lib/api";

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  base_price: string;
  promotional_price: string | null;
  min_price: string;
  seller_name: string;
  seller_slug: string;
  category_name: string | null;
  category_slug: string | null;
  primary_image: string | null;
  avg_rating?: number | null;
  review_count?: number;
};

export type PublicStore = {
  id: string;
  store_name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  product_count: number;
  avg_rating: number | null;
  video_url: string | null;
  presentation_video_url: string | null;
  physical_address: string;
  featured_rank: number | null;
};

export type StoreCategory = { id: string; name: string; slug: string; image: string | null };

const rows = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : ((data as { results?: T[] })?.results ?? []);

export async function fetchFeaturedStores(): Promise<PublicStore[]> {
  const res = await catalogApi.stores({ featured: 1 });
  return rows<PublicStore>(res.data);
}

export async function fetchProducts(params: {
  seller?: string;
  category?: string;
  ordering?: string;
  page_size?: number;
} = {}): Promise<StoreProduct[]> {
  const res = await catalogApi.products({ page_size: 24, ...params });
  return rows<StoreProduct>(res.data);
}

export async function fetchCategories(): Promise<StoreCategory[]> {
  const res = await catalogApi.categories();
  return rows<StoreCategory>(res.data);
}

export const priceOf = (p: StoreProduct) => Number(p.promotional_price ?? p.min_price ?? p.base_price);
export const compareAtOf = (p: StoreProduct) =>
  p.promotional_price && Number(p.promotional_price) < Number(p.base_price) ? Number(p.base_price) : null;

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "3x de R$ 83,00 sem juros" — parcelas só a partir de R$ 100. */
export const installmentsLabel = (v: number, max = 3) => {
  if (v < 100) return "";
  const n = Math.min(max, Math.floor(v / 50));
  return `${n}x de ${brl(v / n)} sem juros`;
};

/** Extrai o id de um link do YouTube (watch, youtu.be, shorts, embed). */
export function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
