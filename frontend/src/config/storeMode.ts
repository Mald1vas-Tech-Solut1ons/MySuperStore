// "single" = loja própria do cliente (sem nada de marketplace à vista);
// "marketplace" (padrão) = comportamento atual, com cadastro de lojistas.
export type StoreMode = "single" | "marketplace";
export const STORE_MODE: StoreMode = process.env.NEXT_PUBLIC_STORE_MODE === "single" ? "single" : "marketplace";
export const isSingleStore = STORE_MODE === "single";
