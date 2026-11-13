"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { X, Star, ShoppingCart, Loader2, Info, ArrowRight, Heart, MessageSquare, Share2, Clock, Zap, MessageCircle, Truck, Flame, Play, Hand, Sparkles } from "lucide-react";
import { catalogApi, cartApi, wishlistApi, reviewApi, chatApi } from "@/lib/api";
import { Product, ProductVariant } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useToast } from "@/components/ui/Toast";
import { CountdownTimer } from "./CountdownTimer";
import { brand, whatsappLink } from "@/config/brand";
import { isSingleStore } from "@/config/storeMode";
import { installmentsLabel } from "@/lib/storefront";
import { isMacrameCategory } from "@/lib/macrame";

interface ProductModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  /** Abre já no vídeo da peça (link com ?video=1), se ela tiver vídeo. */
  initialVideo?: boolean;
}

export function ProductModal({ slug, isOpen, onClose, initialVideo = false }: ProductModalProps) {
  const [activeSlug, setActiveSlug] = useState(slug);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuthStore();
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // Vídeo da peça (máx. 1, enviado pelo painel da loja): aparece como miniatura ao lado das fotos.
  const [showVideo, setShowVideo] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const [reviews, setReviews] = useState<any[]>([]);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  
  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMessageInput, setChatMessageInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  
  // Q&A States
  const [questions, setQuestions] = useState<{ id: number; user: string; text: string; reply: string | null; replyBy: string | null; date: string }[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  
  // Image Zoom states
  const [isZooming, setIsZooming] = useState(false);
  const [zoomStyle, setZoomStyle] = useState({});

  // Reset active slug when modal reopens
  useEffect(() => {
    if (isOpen) {
      setActiveSlug(slug);
    } else {
      setIsChatOpen(false);
    }
  }, [slug, isOpen]);

  // Poll chat messages while open
  useEffect(() => {
    if (!isChatOpen || !chatRoom) return;
    const interval = setInterval(() => {
      chatApi.listRooms()
        .then((res) => {
          const rooms = res.data.results || res.data;
          const room = rooms.find((r: any) => r.id === chatRoom.id);
          if (room) setChatMessages(room.messages);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [isChatOpen, chatRoom]);

  useEffect(() => {
    if (!isOpen || !activeSlug) return;
    
    setLoading(true);
    setCartMessage("");
    setNeedsLogin(false);
    setQuantity(1);
    setIsZooming(false);
    
    // Track product view in backend
    catalogApi.track(activeSlug, "view").catch(() => {});
    
    // Carrega o produto
    catalogApi.product(activeSlug)
      .then((res) => {
        const prod = res.data;
        setProduct(prod);
        setShowVideo(Boolean(initialVideo && activeSlug === slug && prod.video_url));
        if (prod.images && prod.images.length > 0) {
          const primary = prod.images.find((img: any) => img.is_primary) || prod.images[0];
          setSelectedImage(primary.image);
        }
        if (prod.variants && prod.variants.length > 0) {
          const activeVariant = prod.variants.find((v: any) => v.is_active && v.stock > 0) || prod.variants[0];
          setSelectedVariant(activeVariant);
        }

        if (prod.is_demo) {
          setQuestions([{ id: 1, user: "Visitante", text: "O produto vem na caixa original lacrada?", reply: "Olá! Sim, todos os nossos produtos são 100% originais, enviados na caixa lacrada de fábrica com nota fiscal.", replyBy: "Lojista", date: "Hoje" }]);
        } else {
          setQuestions([]);
        }

        // Fetch similar products in same category
        if (prod.category_slug) {
          catalogApi.products({ category: prod.category_slug, limit: 5 })
            .then((simRes) => {
              const filtered = (simRes.data.results || simRes.data).filter((item: any) => item.id !== prod.id);
              setSimilarProducts(filtered.slice(0, 4));
            })
            .catch(() => {});
        }
      })
      .catch((err) => console.error("Erro ao carregar produto:", err))
      .finally(() => setLoading(false));

    // Carrega as reviews
    reviewApi.getReviews(activeSlug)
      .then((res) => setReviews(res.data.results || res.data))
      .catch((err) => console.error("Erro ao carregar avaliações", err));

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialVideo/slug só valem na abertura
  }, [activeSlug, isOpen]);

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    if (!isAuthenticated) {
      setNeedsLogin(true);
      setCartMessage("Entre na sua conta para guardar esta peça no carrinho.");
      return;
    }
    setAddingToCart(true);
    setCartMessage("");
    try {
      await cartApi.addItem(selectedVariant.id, quantity);
      useCartStore.getState().fetchCartCount();
      setNeedsLogin(false);
      setCartMessage("Peça adicionada ao carrinho com sucesso!");
      setTimeout(() => setCartMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setCartMessage(err.response?.data?.detail || "Faça login para adicionar ao carrinho.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%`, transform: 'scale(2.5)' });
  };

  const promoActive = product && product.promotional_price && Number(product.promotional_price) < Number(product.base_price);
  const unitPrice = product
    ? Number(selectedVariant?.effective_price || (promoActive ? product.promotional_price : product.base_price))
    : 0;
  const installments = unitPrice ? installmentsLabel(unitPrice) : "";
  const showMacrame = !!product && (isSingleStore || isMacrameCategory(product.category_slug));
  const productLink = product && typeof window !== "undefined" ? `${window.location.origin}/?product=${product.slug}` : "";
  const customWhats =
    product && brand.customOrder.enabled
      ? whatsappLink(`Olá! Quero encomendar "${product.name}" em outra cor ou tamanho. ${productLink}`)
      : "";
  const loginHref = `/login?next=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
  )}`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div key="modal-main" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-atelie-espresso/40 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-6xl h-[95vh] max-h-[900px] bg-atelie-cream font-atelie text-atelie-ink rounded-3xl shadow-2xl ring-1 ring-black/10 overflow-hidden flex flex-col md:flex-row z-10"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-atelie-cream/80 backdrop-blur-md ring-1 ring-black/10 text-atelie-ink/70 hover:text-atelie-ink hover:bg-atelie-cream transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-atelie-clay" />
              <p className="text-atelie-ink/60">Carregando a peça…</p>
            </div>
          ) : !product ? (
            <div className="w-full p-10 text-center">
              <p className="font-serif text-2xl text-atelie-ink">Peça não encontrada.</p>
            </div>
          ) : (
            <>
              {/* LEFT: Image Gallery
                  Mobile: altura fixa 55vh, imagem preenche em retrato com object-contain
                  Desktop: metade da largura, scroll próprio */}
              <div className="shrink-0 w-full h-[55vh] md:h-auto md:shrink md:flex-1 md:w-1/2 bg-atelie-sand/60 flex flex-col p-3 md:p-6 gap-3 border-b md:border-b-0 md:border-r border-black/10 md:overflow-y-auto">
                {/* Imagem principal — flex-1 preenche a altura disponível (retrato no mobile) */}
                {showVideo && product.video_url ? (
                  <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden ring-1 ring-black/10 bg-black">
                    <video
                      key={product.video_url}
                      src={product.video_url}
                      controls
                      autoPlay
                      muted
                      playsInline
                      preload="metadata"
                      aria-label={`Vídeo da peça ${product.name}`}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                ) : (
                <div
                  className="relative flex-1 min-h-0 rounded-2xl overflow-hidden ring-1 ring-black/5 bg-white/50 cursor-crosshair group"
                  onMouseEnter={() => setIsZooming(true)}
                  onMouseLeave={() => { setIsZooming(false); setZoomStyle({}); }}
                  onMouseMove={handleMouseMove}
                >
                  {selectedImage ? (
                    <img
                      src={selectedImage}
                      alt={product.name}
                      className={`absolute inset-0 w-full h-full object-contain transition-transform duration-200 ${isZooming ? "" : "p-3 md:p-4"}`}
                      style={isZooming ? zoomStyle : {}}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-atelie-ink/50">
                      Esta peça ainda não tem foto
                    </div>
                  )}
                  {product.video_url && (
                    <button
                      type="button"
                      onClick={() => { setShowVideo(true); setIsZooming(false); setZoomStyle({}); }}
                      className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow backdrop-blur-md hover:bg-black/85 transition-colors"
                    >
                      <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden /> Ver vídeo
                    </button>
                  )}
                  {!isZooming && (
                    <div className="absolute bottom-3 left-0 right-0 hidden md:flex justify-center opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="bg-atelie-ink/60 text-atelie-cream text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
                        <Info className="h-3.5 w-3.5" /> Passe o mouse para dar zoom
                      </span>
                    </div>
                  )}
                </div>
                )}

                {/* Thumbnails (fotos + vídeo, se houver) */}
                {((product.images?.length ?? 0) > 1 || product.video_url) && (
                  <div className="shrink-0 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {product.video_url && (
                      <button
                        type="button"
                        onClick={() => { setShowVideo(true); setIsZooming(false); setZoomStyle({}); }}
                        aria-label="Ver vídeo da peça"
                        aria-pressed={showVideo}
                        className={`relative w-14 h-14 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all bg-black ${
                          showVideo ? "border-atelie-clay" : "border-transparent hover:border-atelie-clay/50"
                        }`}
                      >
                        {selectedImage && <img src={selectedImage} alt="" className="w-full h-full object-cover opacity-60" />}
                        <span aria-hidden className="absolute inset-0 grid place-items-center">
                          <span className="grid h-7 w-7 md:h-9 md:w-9 place-items-center rounded-full bg-white/90 shadow">
                            <Play className="ml-0.5 h-3.5 w-3.5 md:h-4 md:w-4 text-black" fill="currentColor" />
                          </span>
                        </span>
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] md:text-[10px] text-white text-center py-0.5">Vídeo</span>
                      </button>
                    )}
                    {product.images.map((img: any, imgIndex: number) => (
                      <button
                        key={img.id}
                        onClick={() => { setSelectedImage(img.image); setShowVideo(false); }}
                        className={`relative w-14 h-14 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                          !showVideo && selectedImage === img.image ? "border-atelie-clay" : "border-transparent hover:border-atelie-clay/50"
                        }`}
                      >
                        <img src={img.image} alt={`${product.name}, foto ${imgIndex + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT: Product Details & Reviews */}
              <div ref={detailsRef} className="flex-1 min-h-0 w-full md:w-1/2 flex flex-col overflow-y-auto">
                <div className="flex-grow p-6 md:p-8 space-y-6">
                  
                  {/* Header */}
                  <div className="relative pr-8">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-atelie-clay">
                        {product.category_name}
                      </span>
                      {/* Nota só com avaliações reais (antes mostrava "5.0" com zero avaliações). */}
                      {product.review_count > 0 && product.avg_rating ? (
                        <div className="flex items-center gap-1 text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="text-sm font-bold">{Number(product.avg_rating).toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({product.review_count})</span>
                        </div>
                      ) : null}
                    </div>
                    
                    <h2 className="font-serif text-3xl md:text-4xl text-atelie-ink leading-[1.05] pr-10">
                      {product.name}
                    </h2>
                    
                    <div className="absolute top-0 right-0 flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!isAuthenticated) {
                            toast("Faça login para conversar com o vendedor.", "error");
                            return;
                          }
                          setChatLoading(true);
                          setIsChatOpen(true);
                          try {
                            const res = await chatApi.createRoom({
                              product_id: product.id,
                              seller_id: product.seller_id
                            });
                            setChatRoom(res.data);
                            setChatMessages(res.data.messages || []);
                          } catch (err) {
                            toast("Erro ao iniciar chat com o vendedor.", "error");
                          } finally {
                            setChatLoading(false);
                          }
                        }}
                        className="p-2 rounded-full text-atelie-ink/60 hover:text-atelie-clay hover:bg-atelie-clay/10 transition-colors"
                        title="Falar com o Vendedor"
                      >
                        <MessageSquare className="h-5 w-5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!product) return;
                          try {
                            await wishlistApi.add(product);
                            toast("Produto adicionado aos favoritos com sucesso!", "success");
                          } catch (err) {
                            toast("Erro ao adicionar aos favoritos.", "error");
                          }
                        }}
                        className="p-2 rounded-full text-atelie-ink/60 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                        title="Adicionar aos Favoritos"
                      >
                        <Heart className="h-5 w-5" />
                      </button>
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/s/${product.seller_slug}?product=${product.slug}${showVideo ? "&video=1" : ""}`;
                          try {
                            if (navigator.clipboard && window.isSecureContext) {
                              await navigator.clipboard.writeText(url);
                              toast("Link do produto copiado com sucesso!", "success");
                            } else {
                              prompt("Copie o link abaixo para compartilhar:", url);
                            }
                          } catch (err) {
                            prompt("Copie o link abaixo para compartilhar:", url);
                          }
                        }}
                        className="p-2 rounded-full text-atelie-ink/60 hover:text-atelie-clay hover:bg-atelie-clay/10 transition-colors"
                        title="Compartilhar Produto"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>
                  
                    {/* Loja própria: sem "vendido por" — a peça é do ateliê. */}
                    {!isSingleStore && (
                      <p className="text-sm text-atelie-ink/60 mt-2 flex items-center gap-2">
                        Vendido por <Link href={`/s/${product.seller_slug}`} onClick={onClose} className="font-medium text-atelie-ink underline decoration-atelie-clay/40 underline-offset-4 hover:text-atelie-clay transition-colors">{product.seller_name}</Link>
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="py-4 border-y border-black/10 space-y-1">
                    {product.promotional_price && Number(product.promotional_price) < Number(product.base_price) ? (
                      <div>
                        <span className="text-sm text-atelie-ink/50 line-through">
                          De R$ {Number(product.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <div className="font-serif text-4xl text-atelie-ink">
                          R$ {Number(selectedVariant?.effective_price || product.promotional_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-serif text-4xl text-atelie-ink">
                          R$ {Number(selectedVariant?.effective_price || product.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                    {installments && <p className="text-sm text-atelie-ink/60">{installments}</p>}
                  </div>

                  {/* Feita à mão: expectativa honesta + caminho para o sob medida */}
                  {showMacrame && (
                    <div className="space-y-3">
                      <ul className="grid gap-2 text-sm text-atelie-ink/75">
                        <li className="flex items-start gap-2.5">
                          <Hand aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-atelie-clay" /> {brand.tagline}
                        </li>
                        <li className="flex items-start gap-2.5">
                          <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-atelie-clay" /> Cada peça é única: pequenas variações no fio e nos nós fazem parte do charme.
                        </li>
                      </ul>
                      {customWhats && (
                        <a
                          href={customWhats}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm text-atelie-ink ring-1 ring-atelie-ink/30 transition-colors hover:bg-atelie-ink hover:text-atelie-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay"
                        >
                          <MessageCircle aria-hidden className="h-4 w-4" /> Quero em outra cor ou tamanho
                        </a>
                      )}
                    </div>
                  )}

                  {/* Variants Selector */}
                  {product.variants && product.variants.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-atelie-ink flex items-center gap-2">
                        Escolha a opção
                        {selectedVariant?.stock === 0 && <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Esgotado</span>}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((variant: any) => {
                          const attrs = variant.attributes.map((a: any) => a.value).join(", ");
                          const label = attrs || "Padrão";
                          const isSelected = selectedVariant?.id === variant.id;
                          const isOutOfStock = variant.stock === 0;

                          return (
                            <button
                              key={variant.id}
                              onClick={() => setSelectedVariant(variant)}
                              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                                isSelected 
                                  ? "border-atelie-ink bg-atelie-ink text-atelie-cream" 
                                  : isOutOfStock 
                                    ? "border-border/30 bg-muted/30 text-muted-foreground opacity-60 cursor-not-allowed"
                                    : "border-black/15 hover:border-atelie-ink text-atelie-ink"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {selectedVariant && (
                        <div className="flex flex-col gap-2 mt-2">
                          {selectedVariant.stock === 1 ? (
                            <p className="text-xs text-atelie-ink/60 flex items-center gap-1.5 ml-1">
                              <Info className="h-3.5 w-3.5" />
                              Peça única: feita à mão, esta é a única disponível.
                            </p>
                          ) : selectedVariant.stock > 1 ? (
                            <p className="text-xs text-atelie-ink/60 flex items-center gap-1.5 ml-1">
                              <Info className="h-3.5 w-3.5" />
                              {selectedVariant.stock} disponíveis
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {product.description && (
                    <div className="space-y-4">
                      <h3 className="font-serif text-2xl text-atelie-ink">Sobre a peça</h3>
                      <p className="text-[15px] text-atelie-ink/75 leading-relaxed whitespace-pre-wrap">
                        {product.description}
                      </p>
                    </div>
                  )}

                  {/* Logística: aparece sempre, mesmo sem descrição */}
                  <div className="bg-white/55 rounded-2xl p-4 ring-1 ring-black/5 space-y-3">
                    <h4 className="text-[11px] uppercase tracking-[0.18em] text-atelie-clay flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Prazo, envio e devoluções
                    </h4>
                    <div className="flex flex-col gap-2 text-sm text-atelie-ink/70">
                      {Number(product.estimated_delivery_days) > 0 && (
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-medium text-atelie-ink">Feita à mão:</strong> preparo de até{" "}
                            {Number(product.estimated_delivery_days)} {Number(product.estimated_delivery_days) === 1 ? "dia útil" : "dias úteis"},
                            mais o prazo de envio calculado pelo seu CEP no carrinho.
                          </span>
                        </div>
                      )}
                      {product.is_free_shipping ? (
                        <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                          <Truck className="w-4 h-4" /> Frete grátis
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4" /> Frete calculado no carrinho
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-black/10">
                        <Info className="w-4 h-4" /> Política de Devolução: Você tem até 7 dias após o recebimento para devolver gratuitamente.
                      </div>
                    </div>
                  </div>

                  {/* Características: só o que a lojista cadastrou (nada de dados inventados) */}
                  {(() => {
                    const rows: { name: string; value: string }[] =
                      product.specifications && product.specifications.length > 0
                        ? product.specifications.map((s: any) => ({ name: s.attribute_name, value: s.attribute_value }))
                        : (product.variants?.[0]?.attributes ?? []).map((a: any) => ({ name: a.attribute_name, value: a.value }));
                    if (rows.length === 0) return null;
                    return (
                      <div className="bg-white/55 rounded-2xl p-4 ring-1 ring-black/5">
                        <h4 className="text-[11px] uppercase tracking-[0.18em] mb-3 text-atelie-clay">Características da peça</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {rows.map((row, idx) => (
                            <div key={idx} className="flex justify-between gap-3 border-b border-black/10 pb-1">
                              <span className="text-atelie-ink/60">{row.name}</span>
                              <span className="font-medium text-atelie-ink text-right">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cuidados: específico do macramê */}
                  {showMacrame && (
                    <details className="group rounded-2xl bg-white/55 ring-1 ring-black/5 p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] uppercase tracking-[0.18em] text-atelie-clay [&::-webkit-details-marker]:hidden">
                        Como cuidar do macramê
                        <span aria-hidden className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-atelie-ink/75">
                        <li>Lave à mão, com água fria e sabão neutro.</li>
                        <li>Não torça, não esfregue e não use máquina de lavar.</li>
                        <li>Seque na horizontal, à sombra.</li>
                        <li>Guarde em local seco e arejado.</li>
                      </ul>
                    </details>
                  )}

                  {/* Reviews Section */}
                  <div className="pt-6 border-t border-black/10 space-y-4">
                    <h3 className="font-serif text-2xl text-atelie-ink">O que dizem</h3>
                    
                    {reviews.length === 0 ? (
                      <p className="text-sm text-atelie-ink/60 bg-white/40 p-4 rounded-2xl ring-1 ring-black/5 text-center">
                        Ainda não há avaliações desta peça. Quem comprar poderá avaliar depois de receber.
                      </p>
                    ) : (
                      <div className="space-y-4 max-h-80 overflow-y-auto pr-2 scrollbar-hide">
                        {reviews.map((rev) => (
                          <div key={rev.id} className="p-4 rounded-2xl bg-white/55 ring-1 ring-black/5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(star => (
                                  <Star key={star} className={`h-3 w-3 ${star <= rev.rating ? "fill-amber-500 text-amber-500" : "text-border"}`} />
                                ))}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(rev.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <p className="font-semibold text-sm">{rev.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1">{rev.body}</p>
                            <p className="text-[10px] text-muted-foreground mt-3 font-semibold">— {rev.user_name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Peças relacionadas (dados reais da API) */}
                <div className={`p-6 md:p-8 border-t border-black/10 bg-atelie-sand/40 ${similarProducts.length === 0 ? "hidden" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-2xl text-atelie-ink">Combina com</h3>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                    {similarProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-4 bg-black/[0.04] rounded-xl border border-border w-full text-center">Nenhum produto similar encontrado.</p>
                    ) : similarProducts.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          catalogApi.track(item.slug, "click").catch(() => {});
                          // Troca a peça aqui mesmo (sem abrir outra aba) e volta ao topo do painel.
                          setActiveSlug(item.slug);
                          detailsRef.current?.scrollTo({ top: 0 });
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
                        className="shrink-0 w-[180px] snap-start bg-white/60 ring-1 ring-black/5 rounded-2xl p-2.5 hover:ring-atelie-clay/40 cursor-pointer transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay"
                      >
                        <div className="aspect-square bg-atelie-sand/70 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                          {item.primary_image ? (
                            <img src={item.primary_image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <span className="text-xs text-atelie-ink/50">Sem foto</span>
                          )}
                        </div>
                        <p className="text-sm text-atelie-ink truncate">{item.name}</p>
                        <p className="text-sm font-semibold text-atelie-ink mt-1">R$ {Number(item.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action (Sticky) */}
                <div className="px-5 py-3 md:px-6 md:py-3.5 border-t border-black/10 bg-atelie-cream/95 backdrop-blur-md sticky bottom-0 z-20">
                  {cartMessage && (
                    <div className={`mb-2 p-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      cartMessage.includes("sucesso") ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                    }`}>
                      <Info className="h-3.5 w-3.5" /> {cartMessage}
                      {needsLogin && (
                        <Link href={loginHref} className="ml-auto shrink-0 rounded-full bg-atelie-ink px-3 py-1 text-atelie-cream hover:bg-atelie-clay transition-colors">
                          Entrar
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 items-center">
                    <div className="w-20 space-y-1 shrink-0">
                      <label className="text-[11px] text-atelie-ink/60">Quantidade</label>
                      <select 
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        disabled={!selectedVariant || selectedVariant.stock === 0}
                        className="w-full h-12 px-3 rounded-full border border-black/15 bg-white/60 text-atelie-ink text-sm focus:border-atelie-clay outline-none"
                      >
                        {[...Array(Math.min(10, selectedVariant?.stock || 1))].map((_, i) => (
                          <option key={i} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart || !selectedVariant || selectedVariant.stock === 0}
                      className="flex-grow h-12 flex items-center justify-center gap-2 rounded-full bg-atelie-ink text-atelie-cream hover:bg-atelie-clay font-medium text-sm transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay focus-visible:ring-offset-2 focus-visible:ring-offset-atelie-cream"
                    >
                      {addingToCart ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      {selectedVariant?.stock === 0 ? "Esgotada" : addingToCart ? "Adicionando..." : "Adicionar ao carrinho"}
                    </button>
                  </div>
                </div>

              </div>
            </>
          )}
        </motion.div>
      </div>
      {/* Floating Chat Drawer */}
      <AnimatePresence key="modal-chat">
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 50 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100, y: 50 }}
            className="fixed bottom-20 right-3 sm:right-6 z-[200] w-[calc(100vw-24px)] sm:w-96 max-w-[384px] h-[420px] sm:h-[480px] bg-background border border-border rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-foreground"
          >
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">Falar com o Vendedor</h4>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  Loja: {product?.seller_name}
                </p>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/[0.04] text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col">
              {chatLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Iniciando conversa...</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center p-4">
                  <p className="text-xs text-muted-foreground italic">Nenhuma mensagem ainda. Envie uma mensagem para iniciar!</p>
                </div>
              ) : (
                chatMessages.map((msg: any) => {
                  const isMe = msg.sender_email === user?.email;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
                    >
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-white/[0.04] text-white rounded-tl-none border border-white/[0.04]"
                        }`}
                      >
                        {msg.message}
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input area */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!chatMessageInput.trim() || !chatRoom) return;
                const txt = chatMessageInput.trim();
                setChatMessageInput("");
                try {
                  const res = await chatApi.sendMessage(chatRoom.id, txt);
                  setChatMessages((prev) => [...prev, res.data]);
                } catch {
                  toast("Erro ao enviar mensagem.", "error");
                }
              }}
              className="p-3 border-t border-border bg-background flex gap-2"
            >
              <input
                type="text"
                placeholder="Digite sua mensagem..."
                value={chatMessageInput}
                onChange={(e) => setChatMessageInput(e.target.value)}
                disabled={chatLoading}
                className="flex-grow bg-black/[0.04] border border-border focus:border-primary/50 text-foreground rounded-xl px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatMessageInput.trim()}
                className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
