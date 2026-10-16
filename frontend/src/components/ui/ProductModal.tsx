"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { X, Star, ShoppingCart, Loader2, Info, ArrowRight, Heart, MessageSquare, Share2, Clock, Zap, MessageCircle, Truck, Flame } from "lucide-react";
import { catalogApi, cartApi, wishlistApi, reviewApi, chatApi } from "@/lib/api";
import { Product, ProductVariant } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useToast } from "@/components/ui/Toast";
import { CountdownTimer } from "./CountdownTimer";

interface ProductModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductModal({ slug, isOpen, onClose }: ProductModalProps) {
  const [activeSlug, setActiveSlug] = useState(slug);
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuthStore();
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

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
    setQuantity(1);
    setIsZooming(false);
    
    // Track product view in backend
    catalogApi.track(activeSlug, "view").catch(() => {});
    
    // Carrega o produto
    catalogApi.product(activeSlug)
      .then((res) => {
        const prod = res.data;
        setProduct(prod);
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
  }, [activeSlug, isOpen]);

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    if (!isAuthenticated) {
      setCartMessage("Você precisa estar logado para adicionar ao carrinho.");
      toast("Você precisa estar logado para fazer compras no marketplace.", "error");
      return;
    }
    setAddingToCart(true);
    setCartMessage("");
    try {
      await cartApi.addItem(selectedVariant.id, quantity);
      useCartStore.getState().fetchCartCount();
      setCartMessage("Produto adicionado ao carrinho com sucesso!");
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
          className="absolute inset-0 bg-black/5 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-6xl h-[95vh] max-h-[900px] bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col md:flex-row z-10"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-background/50 backdrop-blur-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium">Carregando detalhes...</p>
            </div>
          ) : !product ? (
            <div className="w-full p-10 text-center">
              <p className="text-destructive font-semibold">Produto não encontrado.</p>
            </div>
          ) : (
            <>
              {/* LEFT: Image Gallery
                  Mobile: altura fixa 55vh, imagem preenche em retrato com object-contain
                  Desktop: metade da largura, scroll próprio */}
              <div className="shrink-0 w-full h-[55vh] md:h-auto md:shrink md:flex-1 md:w-1/2 bg-black/5 flex flex-col p-3 md:p-6 gap-3 border-b md:border-b-0 md:border-r border-border/20 md:overflow-y-auto">
                {/* Imagem principal — flex-1 preenche a altura disponível (retrato no mobile) */}
                <div
                  className="relative flex-1 min-h-0 rounded-xl overflow-hidden border border-border/30 bg-background/50 cursor-crosshair group"
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
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Sem imagem principal
                    </div>
                  )}
                  {!isZooming && (
                    <div className="absolute bottom-3 left-0 right-0 hidden md:flex justify-center opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="bg-black/5 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
                        <Info className="h-3.5 w-3.5" /> Passe o mouse para dar zoom
                      </span>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {product.images && product.images.length > 1 && (
                  <div className="shrink-0 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {product.images.map((img: any) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedImage(img.image)}
                        className={`relative w-14 h-14 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                          selectedImage === img.image ? "border-primary" : "border-transparent hover:border-primary/50"
                        }`}
                      >
                        <img src={img.image} alt="Thumbnail" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT: Product Details & Reviews */}
              <div className="flex-1 min-h-0 w-full md:w-1/2 flex flex-col overflow-y-auto">
                <div className="flex-grow p-6 md:p-8 space-y-6">
                  
                  {/* Header */}
                  <div className="relative pr-8">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {product.category}
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
                    
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight pr-10">
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
                        className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
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
                        className="p-2 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Adicionar aos Favoritos"
                      >
                        <Heart className="h-5 w-5" />
                      </button>
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/s/${product.seller_slug}?product=${product.slug}`;
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
                        className="p-2 rounded-full text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                        title="Compartilhar Produto"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await wishlistApi.add(product);
                            toast("Produto adicionado aos favoritos!", "success");
                          } catch (err) {
                            toast("Faça login para favoritar produtos.", "error");
                          }
                        }}
                        className="p-2 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Adicionar aos Favoritos"
                      >
                        <Heart className="h-6 w-6" />
                      </button>
                    </div>
                  
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                      Vendido por <Link href={`/s/${product.seller_slug}`} onClick={onClose} className="font-semibold text-foreground underline decoration-primary/30 underline-offset-4 hover:text-primary transition-colors">{product.seller_name}</Link>
                    </p>
                  </div>

                  {/* Price */}
                  <div className="py-4 border-y border-border/40 space-y-3">
                    {product.promotional_price && Number(product.promotional_price) < Number(product.base_price) ? (
                      <div>
                        <span className="text-sm text-muted-foreground line-through">
                          De R$ {Number(product.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <div className="font-serif text-4xl text-foreground">
                          R$ {Number(selectedVariant?.effective_price || product.promotional_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-serif text-4xl text-foreground">
                          R$ {Number(selectedVariant?.effective_price || product.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Variants Selector */}
                  {product.variants && product.variants.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        Opções Disponíveis
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
                              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                isSelected 
                                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20" 
                                  : isOutOfStock 
                                    ? "border-border/30 bg-muted/30 text-muted-foreground opacity-60 cursor-not-allowed"
                                    : "border-border/60 hover:border-primary/50 hover:bg-secondary/20 text-foreground"
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
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 ml-1">
                              <Info className="h-3.5 w-3.5" />
                              Peça única: feita à mão, esta é a única disponível.
                            </p>
                          ) : selectedVariant.stock > 1 ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 ml-1">
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
                      <label className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" /> Sobre o Produto
                      </label>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {product.description}
                      </p>

                      {/* Logística e Garantia */}
                      <div className="mt-4 bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                          <Truck className="w-4 h-4" /> Logística e Devoluções
                        </h4>
                        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                          {product.is_free_shipping ? (
                            <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                              <Truck className="w-4 h-4" /> Frete grátis
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4" /> Frete calculado no checkout
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Prazo de entrega calculado pelo CEP no checkout
                          </div>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
                            <Info className="w-4 h-4" /> Política de Devolução: Você tem até 7 dias após o recebimento para devolver gratuitamente.
                          </div>
                        </div>
                      </div>

                      {/* Características Técnicas Dynamicas ou Fixas */}
                      <div className="mt-4 bg-secondary/10 rounded-xl p-4 border border-border/30">
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-foreground">Características Técnicas</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {product.specifications && product.specifications.length > 0 ? (
                             product.specifications.map((spec: any, idx: number) => (
                               <div key={idx} className="flex justify-between border-b border-border/20 pb-1">
                                 <span className="text-muted-foreground">{spec.attribute_name}</span>
                                 <span className="font-medium text-foreground">{spec.attribute_value}</span>
                               </div>
                             ))
                          ) : product.variants && product.variants.length > 0 ? (
                             product.variants[0].attributes.map((attr: any, idx: number) => (
                               <div key={`var-${idx}`} className="flex justify-between border-b border-border/20 pb-1">
                                 <span className="text-muted-foreground">{attr.attribute_name}</span>
                                 <span className="font-medium text-foreground">{attr.value}</span>
                               </div>
                             ))
                          ) : (
                             <>
                               <div className="flex justify-between border-b border-border/20 pb-1">
                                 <span className="text-muted-foreground">Marca</span>
                                 <span className="font-medium text-foreground">{product.brand?.name || "Premium"}</span>
                               </div>
                               <div className="flex justify-between border-b border-border/20 pb-1">
                                 <span className="text-muted-foreground">Condição</span>
                                 <span className="font-medium text-foreground">Novo</span>
                               </div>
                               <div className="flex justify-between border-b border-border/20 pb-1">
                                 <span className="text-muted-foreground">Garantia</span>
                                 <span className="font-medium text-foreground">12 meses</span>
                               </div>
                             </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reviews Section */}
                  <div className="pt-6 border-t border-border/40 space-y-4">
                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" /> Avaliações dos Clientes
                    </h3>
                    
                    {reviews.length === 0 ? (
                      <p className="text-sm text-muted-foreground bg-card/50 p-4 rounded-xl border border-dashed border-border/50 text-center">
                        Este produto ainda não possui avaliações. Seja o primeiro a avaliar após comprar!
                      </p>
                    ) : (
                      <div className="space-y-4 max-h-80 overflow-y-auto pr-2 scrollbar-hide">
                        {reviews.map((rev) => (
                          <div key={rev.id} className="p-4 rounded-xl bg-secondary/10 border border-border/30">
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
                <div className="p-6 md:p-8 border-t border-border/40 bg-secondary/5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                      Você também pode gostar
                    </h3>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                    {similarProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-4 bg-black/[0.04] rounded-xl border border-border w-full text-center">Nenhum produto similar encontrado.</p>
                    ) : similarProducts.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          catalogApi.track(item.slug, "click").catch(() => {});
                          window.open(`/s/${item.seller_slug}?product=${item.slug}`, "_blank");
                        }}
                        className="shrink-0 w-[200px] snap-start bg-card border border-border/50 rounded-xl p-3 hover:border-primary/50 cursor-pointer transition-all hover:scale-[1.02] group"
                      >
                        <div className="aspect-square bg-secondary/30 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                          {item.primary_image ? (
                            <img src={item.primary_image} alt={item.name} className="w-full h-full object-cover opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all" />
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem Imagem</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{item.name}</p>
                        <p className="text-xs text-primary font-bold mt-1">R$ {Number(item.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action (Sticky) */}
                <div className="px-5 py-3 md:px-6 md:py-3.5 border-t border-border/40 bg-card/95 backdrop-blur-md sticky bottom-0 z-20">
                  {cartMessage && (
                    <div className={`mb-2 p-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      cartMessage.includes("sucesso") ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                    }`}>
                      <Info className="h-3.5 w-3.5" /> {cartMessage}
                    </div>
                  )}

                  <div className="flex gap-3 items-center">
                    <div className="w-20 space-y-1 shrink-0">
                      <label className="text-[11px] font-semibold text-muted-foreground">Quantidade</label>
                      <select 
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        disabled={!selectedVariant || selectedVariant.stock === 0}
                        className="w-full h-10 px-3 rounded-xl border border-border/60 bg-background/50 text-foreground text-sm focus:border-primary outline-none"
                      >
                        {[...Array(Math.min(10, selectedVariant?.stock || 1))].map((_, i) => (
                          <option key={i} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart || !selectedVariant || selectedVariant.stock === 0}
                      className="flex-grow h-10 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-sm transition-all shadow-lg hover:shadow-primary/20 disabled:opacity-50 disabled:hover:shadow-none"
                    >
                      {addingToCart ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      {selectedVariant?.stock === 0 ? "Esgotado" : addingToCart ? "Adicionando..." : "Adicionar ao Carrinho"}
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
