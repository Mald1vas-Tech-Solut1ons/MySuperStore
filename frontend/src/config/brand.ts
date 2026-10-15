// Identidade da vitrine principal. A plataforma segue multi-tenant; isto define
// apenas a curadoria/voz da home (foco: artesanato feito à mão).
export const brand = {
  name: "Ateliê Eli Trassi",
  fullName: "Ateliê Eli Trassi Macramê",
  tagline: "Macramê feito à mão, nó a nó",
  location: "Vila Galvão · Guarulhos, SP",
  shipping: "Enviamos para todo o Brasil",
  // Preenchidos por env para não exigir deploy ao trocar contato.
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "", // só dígitos com DDI, ex.: 5511999999999
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM || "", // usuário sem @
  // Imagens editoriais da marca (fotos reais das peças), servidas de /public/brand/atelie.
  images: {
    hero: "/brand/atelie/caracol-praia.webp",
    heroAlt: "Bolsa Caracol em macramê cru usada na praia",
    lookbook: [
      { src: "/brand/atelie/boho-cafe.webp", alt: "Bolsa Boho Café em macramê" },
      { src: "/brand/atelie/boho-offwhite.webp", alt: "Bolsa Boho Off-white com alça de couro" },
      { src: "/brand/atelie/boho-oliva-modelo.webp", alt: "Bolsa Boho Oliva no ombro" },
    ],
    detail: "/brand/atelie/caracol-dourada.webp",
  },
} as const;

export const whatsappLink = (text: string) =>
  brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}` : "";
