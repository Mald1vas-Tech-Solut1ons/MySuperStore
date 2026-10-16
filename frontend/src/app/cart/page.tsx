"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import { SiteHeader as Header } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { TrustBadges } from "@/components/storefront/TrustBadges";
import { cartApi } from "@/lib/api";
import { Cart } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingCart, ArrowRight, Loader2, Minus, Plus, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProductModal } from "@/components/ui/ProductModal";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadCart = async () => {
    try {
      const res = await cartApi.get();
      setCart(res.data);
      useCartStore.getState().setItemCount(res.data.items.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const updateQuantity = async (itemId: string, newQtd: number) => {
    if (newQtd < 1) return;
    setUpdatingId(itemId);
    try {
      await cartApi.updateItem(itemId, newQtd);
      await loadCart();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      await cartApi.removeItem(itemId);
      await loadCart();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const applyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      await cartApi.applyCoupon(couponCode);
      await loadCart();
      setCouponCode("");
    } catch (err) {
      console.error(err);
      alert("Cupom inválido ou expirado.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-atelie-wall font-atelie text-atelie-ink">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-atelie-wall font-atelie text-atelie-ink">
      <Header />

      <main className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-display font-bold mb-8 flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-primary" />
          Meu Carrinho
        </h1>

        {!cart || cart.items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 border border-dashed border-border/60 rounded-3xl bg-card/20 space-y-4"
          >
            <div className="w-20 h-20 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Seu carrinho está vazio</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Volte para a loja, explore as melhores ofertas e adicione produtos incríveis ao seu carrinho.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all mt-4"
            >
              Explorar Loja
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LISTA DE ITENS */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col sm:flex-row gap-6 p-4 rounded-2xl border border-border/40 bg-card/40 hover:bg-card/70 transition-all items-center"
                >
                  <div 
                    className="relative w-24 h-24 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-border/20 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      if (item.variant.product_slug) {
                        setSelectedProductSlug(item.variant.product_slug);
                        setIsModalOpen(true);
                      }
                    }}
                  >
                    <Image
                      src={item.variant.product_image || "/placeholder.png"}
                      alt={item.variant.product_name || "Produto"}
                      fill
                      className="object-cover hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  
                  <div className="flex-grow text-center sm:text-left space-y-1">
                    <h4 className="font-bold text-lg leading-tight text-foreground">
                      {item.variant.product_name}
                    </h4>
                    {item.variant.product_description && (
                      <p className="text-sm text-neutral-400 line-clamp-2">
                        {item.variant.product_description}
                      </p>
                    )}
                    {item.variant.attributes.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {item.variant.attributes.map(a => a.value).join(" • ")}
                      </p>
                    )}
                    {item.variant.product_base_price && Number(item.variant.product_base_price) > Number(item.variant.effective_price) ? (
                      <div className="font-semibold text-green-500 mt-2 animate-pulse">
                        Economizou R$ {((Number(item.variant.product_base_price) - Number(item.variant.effective_price)) * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Controles de Qtde */}
                    <div className="flex items-center rounded-xl border border-border/60 bg-background/50 overflow-hidden">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={updatingId === item.id || item.quantity <= 1}
                        className="p-2 hover:bg-secondary/40 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center font-semibold text-sm">
                        {updatingId === item.id ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : item.quantity}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updatingId === item.id || item.quantity >= item.variant.stock}
                        className="p-2 hover:bg-secondary/40 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-right w-24 font-bold text-foreground">
                      R$ {Number(item.subtotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>

                    <button 
                      onClick={() => removeItem(item.id)}
                      disabled={updatingId === item.id}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      title="Remover"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* RESUMO DO PEDIDO */}
            <div className="lg:col-span-1">
              <div className="p-6 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md sticky top-24 space-y-6">
                <h3 className="font-display font-bold text-xl border-b border-border/40 pb-4">Resumo do Pedido</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({cart.item_count} itens)</span>
                    <span className="line-through decoration-red-500/50">
                      De: R$ {Number(
                        cart.items.reduce((acc, curr) => acc + ((curr.variant.product_base_price ? Number(curr.variant.product_base_price) : Number(curr.variant.effective_price)) * curr.quantity || Number(curr.subtotal)), 0)
                      ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-primary">
                    <span>Para:</span>
                    <span>R$ {Number(cart.subtotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Frete</span>
                    <span className="text-green-500 font-semibold">Grátis</span>
                  </div>
                  {cart.coupon_code && (
                    <div className="flex justify-between text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        Cupom ({cart.coupon_code})
                        {(cart as any).coupon_discount_percentage && (
                          <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
                            -{Number((cart as any).coupon_discount_percentage).toFixed(0)}%
                          </span>
                        )}
                        {!(cart as any).coupon_discount_percentage && (cart as any).coupon_discount_amount && (
                          <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
                            -R$ {Number((cart as any).coupon_discount_amount).toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span>
                        - R$ {Number(Number(cart.subtotal) - Number(cart.total)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const baseTotal = cart.items.reduce((acc, curr) => {
                      const originalPrice = curr.variant.price ? Number(curr.variant.price) : Number(curr.variant.product_base_price);
                      return acc + (originalPrice * curr.quantity);
                    }, 0);
                    const finalTotal = Number(cart.total);
                    const diff = baseTotal - finalTotal;
                    if (diff > 0) {
                      return (
                        <div className="flex justify-between font-bold text-emerald-500 bg-emerald-500/10 p-2 rounded-lg mt-2 shadow-[0_0_10px_rgba(16,185,129,0.1)] border border-emerald-500/20">
                          <span>✨ Descontos Obtidos</span>
                          <span>- R$ {diff.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <form onSubmit={applyCoupon} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Cupom de Desconto"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-grow bg-secondary/30 border border-border/60 rounded-xl px-4 py-2 text-sm outline-none focus:border-primary transition-all uppercase placeholder:normal-case"
                  />
                  <button
                    type="submit"
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {applyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                  </button>
                </form>

                <div className="pt-4 border-t border-border/40 flex justify-between items-center">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-display font-black text-2xl text-primary">
                    R$ {Number(cart.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <button
                  onClick={() => router.push("/checkout")}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/95 transition-all shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5"
                >
                  <CreditCard className="h-5 w-5" />
                  Finalizar Compra
                </button>
                
                <Link href="/" className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  Continuar comprando
                </Link>
              </div>
            </div>

          </div>
        )}
        <TrustBadges className="mt-12" />
      </main>
      <SiteFooter />

      {selectedProductSlug && (
        <ProductModal 
          slug={selectedProductSlug}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTimeout(() => setSelectedProductSlug(null), 300);
          }}
        />
      )}
    </div>
  );
}
