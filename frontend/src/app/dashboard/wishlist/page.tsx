"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import { wishlistApi, cartApi } from "@/lib/api";
import { Heart, Loader2, ShoppingCart, Trash2, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WishlistPage() {
  const router = useRouter();
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      const res = await wishlistApi.get();
      setWishlist(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    setActionLoadingId(productId);
    try {
      await wishlistApi.remove(productId);
      setWishlist(prev => prev.filter(item => item.product.id !== productId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const moveToCart = async (product: any) => {
    if (!product.variants || product.variants.length === 0) return;
    setActionLoadingId(product.id);
    
    // Pega a primeira variante ativa com estoque
    const variant = product.variants.find((v: any) => v.is_active && v.stock > 0);
    if (!variant) {
      alert("Este produto está esgotado no momento.");
      setActionLoadingId(null);
      return;
    }

    try {
      await cartApi.addItem(variant.id, 1);
      router.push("/cart");
    } catch (err) {
      console.error(err);
      alert("Houve um erro ao adicionar o produto ao carrinho.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold flex items-center gap-2">
        <Heart className="h-6 w-6 text-red-500 fill-red-500" /> Minha Lista de Desejos
      </h1>

      {wishlist.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/60 rounded-3xl bg-card/20 space-y-4">
          <Heart className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Sua lista está vazia</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Explore nossa loja e clique no coração dos produtos para salvá-os aqui.
          </p>
          <Link 
            href="/"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold transition-all"
          >
            Navegar na Loja
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlist.map((item) => {
            const product = item.product;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/40 p-4 bg-card/40 hover:bg-card/70 hover:border-primary/60 transition-all shadow-sm"
              >
                <div>
                  <div className="relative aspect-square w-full rounded-xl bg-black/5 overflow-hidden mb-4 border border-border/20 flex items-center justify-center cursor-pointer" onClick={() => router.push(`/store?p=${product.slug}`)}>
                    {product.primary_image ? (
                      <Image
                        src={product.primary_image}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                    )}
                    
                    {/* Botão de Remover absoluto em cima da imagem */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFromWishlist(product.id); }}
                      disabled={actionLoadingId === product.id}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/5 backdrop-blur-md text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                      title="Remover dos favoritos"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="capitalize">{product.category_name}</span>
                    </div>
                    <h4 className="font-display font-bold text-base text-foreground leading-tight line-clamp-2">
                      {product.name}
                    </h4>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/40 flex justify-between items-center gap-2">
                  <span className="font-display font-black text-lg text-primary">
                    R$ {Number(product.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>

                  <button
                    onClick={() => moveToCart(product)}
                    disabled={actionLoadingId === product.id}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm disabled:opacity-50"
                    title="Mover para o carrinho"
                  >
                    {actionLoadingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
