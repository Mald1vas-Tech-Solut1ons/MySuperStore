import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "loremflickr.com" },
      // Railway backend (produção)
      { protocol: "https", hostname: "*.railway.app" },
      // DummyJSON CDN (imagens do seed demo)
      { protocol: "https", hostname: "cdn.dummyjson.com" },
      // Logo Nike
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Cloudinary para produção
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Adicione o domínio R2/S3 em produção:
      // { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: '/dashboard/recap',
        destination: '/dashboard',
        permanent: true,
      },
      // O Ateliê não trabalha com "oferta relâmpago": essas rotas voltam para a vitrine.
      { source: '/super-ofertas', destination: '/', permanent: false },
      { source: '/store/promotions', destination: '/', permanent: false },
      // Vitrine única: a página de cada loja é a home filtrada por ela.
      { source: '/s/:slug', destination: '/?loja=:slug', permanent: false },
      // Loja própria (NEXT_PUBLIC_STORE_MODE=single): nenhuma rota de marketplace fica acessível.
      ...(process.env.NEXT_PUBLIC_STORE_MODE === "single"
        ? ["/vender", "/white-label", "/seller/onboarding", "/seller/onboarding/:path*"].map((source) => ({
            source,
            destination: "/",
            permanent: false,
          }))
        : []),
    ];
  },
  async rewrites() {
    // Extrai a base URL do backend (remove /api/v1) para o proxy de media local
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const backendBase = apiUrl.replace(/\/api.*$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendBase}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
