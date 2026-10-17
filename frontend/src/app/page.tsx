"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductModal } from "@/components/ui/ProductModal";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { WallBackdrop } from "@/components/storefront/WallBackdrop";
import { HomeHero } from "@/components/storefront/HomeHero";
import { Marquee, TrustBar } from "@/components/storefront/HomeBits";
import { CategoryRail } from "@/components/storefront/CategoryRail";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { AtelierVideo } from "@/components/storefront/AtelierVideo";
import { CustomOrder } from "@/components/storefront/CustomOrder";
import { StoresStrip } from "@/components/storefront/StoresStrip";
import { ChatWidget } from "@/components/storefront/ChatWidget";
import {
  type PublicStore,
  type StoreCategory,
  type StoreProduct,
  fetchCategories,
  fetchFeaturedStores,
  fetchProducts,
} from "@/lib/storefront";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-atelie-wall" />}>
      <Storefront />
    </Suspense>
  );
}

function Storefront() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get("category");
  const search = params.get("search");
  const loja = params.get("loja");
  const productSlug = params.get("product");
  const browsing = Boolean(category || search || loja);

  const [stores, setStores] = useState<PublicStore[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);

  // Lojas em destaque e categorias: uma vez por visita.
  useEffect(() => {
    fetchFeaturedStores().then(setStores).catch(() => setStores([]));
    fetchCategories().then(setCategories).catch(() => setCategories([]));
    fetchProducts({ page_size: 100 }).then(setAllProducts).catch(() => setAllProducts([]));
  }, [retry]);

  // Produtos: refaz a busca quando filtro/busca mudam.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    fetchProducts({ ...(category ? { category } : {}), ...(search ? { search } : {}), ...(loja ? { seller: loja } : {}) })
      .then((rows) => alive && setProducts(rows))
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        // Instabilidade passageira (ex.: deploy): tenta de novo sozinho.
        setTimeout(() => alive && setRetry((n) => n + 1), 4000);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [category, search, loja, retry]);

  const featured = stores[0] ?? null;

  // Só mostra categorias que têm peças — com uma loja artesanal, menos é mais.
  const usedCategories = useMemo(() => {
    const used = new Set(allProducts.map((p) => p.category_slug).filter(Boolean));
    const list = categories.filter((c) => used.has(c.slug));
    return browsing && category && !list.some((c) => c.slug === category)
      ? [...list, { id: category, slug: category, name: category, image: null }]
      : list;
  }, [categories, allProducts, browsing, category]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Fecha o modal e limpa o ?video=1 junto, para a próxima peça não abrir no vídeo.
  const closeProduct = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("product");
    next.delete("video");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const lojaName = loja ? stores.find((s) => s.slug === loja)?.store_name ?? allProducts.find((p) => p.seller_slug === loja)?.seller_name : null;
  const gridTitle = lojaName ? `Peças de ${lojaName}` : search ? `Resultados para “${search}”` : category ? usedCategories.find((c) => c.slug === category)?.name ?? "A coleção" : "A coleção";

  return (
    <WallBackdrop className="min-h-screen font-atelie text-atelie-ink">
      <SiteHeader transparentOnTop={!browsing} />

      <main>
        {!browsing && <HomeHero products={products} onOpen={(slug) => setParam("product", slug)} />}
        {!browsing && (
          <Marquee items={["feito à mão", "nó a nó", "fio de algodão", "sob medida", "de Guarulhos para todo o Brasil", "peças únicas"]} />
        )}

        <div className={browsing ? "pt-6" : ""}>
          <CategoryRail
            categories={usedCategories}
            active={category}
            onSelect={(slug) => {
              setParam("category", slug);
              document.getElementById("colecao")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
          <ProductGrid
            products={products}
            loading={loading}
            onOpen={(slug) => setParam("product", slug)}
            title={gridTitle}
            empty={
              failed ? (
                <div className="rounded-3xl bg-white/50 p-10 text-center ring-1 ring-black/5">
                  <h3 className="font-serif text-3xl text-atelie-ink">Estamos recarregando a coleção</h3>
                  <p className="mx-auto mt-3 max-w-md text-[15px] text-atelie-ink/60">Houve uma instabilidade rápida. Tentando de novo…</p>
                  <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-6 h-11 rounded-full bg-atelie-ink px-6 text-sm text-atelie-cream">Tentar agora</button>
                </div>
              ) : undefined
            }
            subtitle={browsing ? undefined : "Cada peça é feita à mão, uma a uma. Quando acaba, a próxima pode sair diferente — e esse é o charme."}
          />
        </div>

        {!browsing && (
          <>
            <AtelierVideo videoUrl={featured?.video_url} fileUrl={featured?.presentation_video_url} />
            <CustomOrder />
            <TrustBar />
            <StoresStrip stores={stores} />
          </>
        )}
      </main>

      <SiteFooter />

      <ChatWidget />

      {productSlug && (
        <ProductModal slug={productSlug} isOpen initialVideo={params.get("video") === "1"} onClose={closeProduct} />
      )}
    </WallBackdrop>
  );
}
