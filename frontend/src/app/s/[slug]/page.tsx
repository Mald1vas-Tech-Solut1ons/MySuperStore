"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { catalogApi } from "@/lib/api";
import { Star, Store, MapPin, ExternalLink, Search, Package, ShoppingBag, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { ProductModal } from "@/components/ui/ProductModal";

export default function PremiumGlassdoorPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeSlide, setActiveSlide] = useState(0);

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  
  const [isPhysicalStoreModalOpen, setIsPhysicalStoreModalOpen] = useState(false);

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Busca perfil publico do lojista
        const sellerRes = await catalogApi.getSellerPublicProfile(slug);
        setSeller(sellerRes.data);

        // Busca produtos deste lojista
        const productsRes = await catalogApi.products({ seller: slug });
        setProducts(productsRes.data.results || productsRes.data);
      } catch (err) {
        console.error("Erro ao carregar loja", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  // Handle ?product=slug in URL to open modal on load
  useEffect(() => {
    const productSlug = searchParams.get("product");
    if (productSlug && products.length > 0 && !isModalOpen) {
      const p = products.find(prod => prod.slug === productSlug);
      if (p) {
        setSelectedProduct(p);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, products, isModalOpen]);

  // Carousel auto-rotate
  useEffect(() => {
    if (!seller) return;
    const banners = [seller.banner_url, seller.banner2_url, seller.banner3_url].filter(Boolean);
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [seller]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center text-[#E6B53C]">
        <Store className="w-16 h-16 mb-4 animate-pulse" />
        <p className="text-xl font-bold tracking-widest uppercase">Carregando Vitrine...</p>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center text-white">
        <Store className="w-16 h-16 mb-4 text-neutral-600" />
        <h2 className="text-2xl font-bold">Loja não encontrada</h2>
        <button onClick={() => router.push("/")} className="mt-6 px-6 py-2 bg-[#E6B53C] text-black font-bold rounded-full">
          Voltar ao Marketplace
        </button>
      </div>
    );
  }

  const banners = [seller.banner_url, seller.banner2_url, seller.banner3_url].filter(Boolean);
  const categories = Array.from(new Set(products.map(p => p.category_name))).filter(Boolean) as string[];
  const displayProducts = activeCategory === "all" ? products : products.filter(p => p.category_name === activeCategory);
  const primaryColor = seller.primary_color || "#E6B53C";

  return (
    <div className="min-h-screen bg-[#05050A] text-white font-sans overflow-x-hidden selection:text-black" style={{ '--color-primary': primaryColor } as any}>
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-10 blur-[150px]" style={{ backgroundColor: primaryColor }}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-10 blur-[150px]" style={{ backgroundColor: primaryColor }}></div>
      </div>

      {/* Floating Header */}
      <header className="fixed top-0 left-0 w-full z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between bg-[#0A0A15]/80 backdrop-blur-2xl border border-white/[0.05] rounded-full px-6 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-bold tracking-wider uppercase hidden sm:block">Marketplace</span>
          </button>

          <div className="flex flex-col items-center">
            {seller.logo_url ? (
              <img src={seller.logo_url} alt={seller.store_name} className="h-8 object-contain" />
            ) : (
              <span className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#E6B53C] to-[#B38F25]">
                {seller.store_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide max-w-[50vw]">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === "all" ? "text-black" : "bg-white/5 text-neutral-400 hover:text-white"}`}
              style={activeCategory === "all" ? { backgroundColor: primaryColor } : {}}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat ? "text-black" : "bg-white/5 text-neutral-400 hover:text-white"}`}
                style={activeCategory === cat ? { backgroundColor: primaryColor } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-20">
        {/* Banner Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-16">
          <div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {banners.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeSlide}
                  src={banners[activeSlide]}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </AnimatePresence>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#11111A] to-[#0A0A15] flex flex-col items-center justify-center">
                <Store className="w-20 h-20 text-neutral-800 mb-4" />
                <h1 className="text-4xl font-black text-neutral-700">{seller.store_name}</h1>
              </div>
            )}

            {/* Gradient Overlay bottom for Text */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#05050A] via-[#05050A]/40 to-transparent"></div>

            {/* Store Info Overlay */}
            <div className="absolute bottom-0 left-0 w-full p-8 sm:p-12 flex flex-col sm:flex-row items-end justify-between gap-6">
              <div className="flex items-center gap-6">
                {seller.logo_url && (
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-white flex-shrink-0">
                    <img src={seller.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2 drop-shadow-lg">{seller.store_name}</h1>
                  <div className="flex items-center gap-4 text-sm font-bold">
                    <div className="flex items-center gap-1 text-[#E6B53C] bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
                      <Star className="w-4 h-4 fill-current" />
                      {seller.avg_rating > 0 ? seller.avg_rating.toFixed(1) : "Novo"}
                    </div>
                    <span className="text-neutral-300 flex items-center gap-1">
                      <Package className="w-4 h-4" /> {seller.product_count} Produtos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel Dots */}
            {banners.length > 1 && (
              <div className="absolute bottom-6 right-8 flex gap-2">
                {banners.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    className={`w-12 h-1.5 rounded-full transition-all duration-500 ${i === activeSlide ? "shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "bg-white/30 hover:bg-white/50"}`}
                    style={i === activeSlide ? { backgroundColor: primaryColor } : {}}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-8 max-w-4xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="flex-1">
              <p className="text-lg text-neutral-400 font-medium leading-relaxed">
                {seller.description || "Bem-vindo à nossa vitrine oficial na MySuperStore."}
              </p>
              
              {seller.physical_address && (
                <button 
                  onClick={() => setIsPhysicalStoreModalOpen(true)}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all text-sm font-bold text-white"
                >
                  <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                  Conheça a Loja Física
                </button>
              )}
            </div>
            
            {seller.presentation_video_url ? (
              <div className="w-full md:w-80 h-44 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-black">
                <video
                  src={seller.presentation_video_url}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                />
              </div>
            ) : seller.video_url ? (
              <div className="w-full md:w-80 h-44 rounded-2xl overflow-hidden border border-white/10 shrink-0">
                <iframe
                  src={seller.video_url.replace("watch?v=", "embed/")}
                  className="w-full h-full object-cover"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
          </div>
        </section>

        {/* Products Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
            <h2 className="text-3xl font-black">Nossa Coleção</h2>
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-400">
              <span>Ordenar por</span>
              <select className="bg-transparent border border-white/20 rounded-lg px-3 py-1.5 outline-none focus:border-[#E6B53C] text-white">
                <option value="recent">Mais Recentes</option>
                <option value="price_asc">Menor Preço</option>
                <option value="price_desc">Maior Preço</option>
              </select>
            </div>
          </div>

          {displayProducts.length === 0 ? (
            <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
              <Package className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Nenhum produto disponível</h3>
              <p className="text-neutral-400">Esta categoria não possui produtos no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {displayProducts.map((product) => (
                <div onClick={() => handleProductClick(product)} className="cursor-pointer" key={product.id}>
                  <div className="group bg-[#0A0A15]/60 backdrop-blur-md border border-white/[0.05] rounded-3xl overflow-hidden hover:border-[#E6B53C]/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                    <div className="relative aspect-[4/5] bg-white/5 overflow-hidden">
                      {product.primary_image ? (
                        <img 
                          src={product.primary_image} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <Package className="w-10 h-10" />
                        </div>
                      )}
                      {product.is_on_sale && (
                        <div className="absolute top-4 left-4 text-black text-xs font-black px-3 py-1.5 rounded-full shadow-lg" style={{ backgroundColor: primaryColor }}>
                          -{Math.round(((product.base_price - product.promotional_price) / product.base_price) * 100)}%
                        </div>
                      )}
                      {product.has_video && (
                        <div className="absolute top-4 right-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                          <span aria-hidden="true">▶</span> Vídeo
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">{product.category_name}</p>
                      <h3 className="font-bold text-white mb-2 line-clamp-2 transition-colors hover:opacity-80" style={{ color: "white" }} 
                          onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
                          onMouseLeave={(e) => e.currentTarget.style.color = "white"}>{product.name}</h3>
                      <div className="flex items-end gap-2 mt-4">
                        {product.is_on_sale ? (
                          <>
                            <span className="text-2xl font-black text-white">R$ {product.promotional_price}</span>
                            <span className="text-sm font-medium text-neutral-500 line-through mb-1">R$ {product.base_price}</span>
                          </>
                        ) : (
                          <span className="text-2xl font-black text-white">R$ {product.base_price}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      
      {/* Footer minimalista do Lojista */}
      <footer className="border-t border-white/10 bg-[#0A0A15]/80 backdrop-blur-lg py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <Store className="w-8 h-8 text-neutral-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{seller.store_name}</h2>
          <p className="text-neutral-500 text-sm mb-8">Comprando diretamente na vitrine oficial na MySuperStore.</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest uppercase text-neutral-400">Powered by MySuperStore</span>
          </div>
        </div>
      </footer>

      {selectedProduct && (
        <ProductModal 
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTimeout(() => setSelectedProduct(null), 300); // Allow exit animation
          }}
          slug={selectedProduct.slug}
          initialVideo={searchParams.get("video") === "1" && searchParams.get("product") === selectedProduct.slug}
        />
      )}

      {/* Modal Loja Física */}
      <AnimatePresence>
        {isPhysicalStoreModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsPhysicalStoreModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative bg-[#0F0F1A] border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: primaryColor }}></div>
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">Nossa Loja Física</h3>
                  <p className="text-neutral-400 text-sm">Venha nos fazer uma visita ou retirar seu pedido pessoalmente.</p>
                </div>
                <button onClick={() => setIsPhysicalStoreModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full"><Star className="w-5 h-5 hidden" /> <span className="text-xl leading-none">&times;</span></button>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="p-3 rounded-xl bg-white/10" style={{ color: primaryColor }}>
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-1">Endereço</h4>
                    <p className="text-neutral-300 leading-relaxed">{seller.physical_address}</p>
                  </div>
                </div>

                {seller.business_hours && (
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="p-3 rounded-xl bg-white/10" style={{ color: primaryColor }}>
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-1">Horário de Atendimento</h4>
                      <p className="text-neutral-300 leading-relaxed">{seller.business_hours}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <button onClick={() => setIsPhysicalStoreModalOpen(false)} className="w-full mt-8 py-4 rounded-xl text-black font-black hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
