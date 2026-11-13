// Categorias de peças de macramê (slugs de backend/apps/catalog/macrame.py).
// Usado para mostrar só nelas conteúdos próprios do macramê (ex.: como cuidar).
export const MACRAME_SLUGS = [
  "bolsas",
  "calcados",
  "rasteirinhas",
  "moda-feminina",
  "moda-praia",
  "chapeus",
  "acessorios",
  "casa",
  "pecas-de-macrame",
] as const;

export const isMacrameCategory = (slug?: string | null): boolean =>
  !!slug && (MACRAME_SLUGS as readonly string[]).includes(slug);
