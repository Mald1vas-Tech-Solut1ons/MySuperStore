"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { type StoreProduct } from "@/lib/storefront";
import { ProductCard } from "./ProductCard";

type ProductGridProps = {
  products: StoreProduct[];
  loading: boolean;
  onOpen: (slug: string) => void;
  title?: string;
  subtitle?: string;
  empty?: ReactNode;
};

export function ProductGrid({ products, loading, onOpen, title = "A coleção", subtitle, empty }: ProductGridProps) {
  const reduce = useReducedMotion();
  const count = products.length;

  return (
    <section id="colecao" className="scroll-mt-28 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-10 flex flex-col gap-3 sm:mb-14 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <h2 className="font-serif text-4xl leading-[1.05] text-atelie-ink sm:text-5xl">{title}</h2>
            {subtitle ? <p className="mt-3 font-atelie text-[15px] leading-relaxed text-atelie-ink/60">{subtitle}</p> : null}
          </div>
          {!loading && count > 0 ? (
            <p className="font-atelie text-[12px] uppercase tracking-[0.18em] whitespace-nowrap text-atelie-ink/45 sm:pb-2">
              {count} {count === 1 ? "peça" : "peças"}
            </p>
          ) : null}
        </motion.header>

        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-atelie-sand/70" />
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-atelie-sand/70" />
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-atelie-sand/70" />
              </div>
            ))}
            <span className="sr-only">Carregando a coleção…</span>
          </div>
        ) : count === 0 ? (
          empty ?? (
            <div className="rounded-3xl bg-white/50 p-10 text-center ring-1 ring-black/5">
              <h3 className="font-serif text-3xl text-atelie-ink">Novas peças chegando</h3>
              <p className="mx-auto mt-3 max-w-md font-atelie text-[15px] leading-relaxed text-atelie-ink/60">
                Estamos fotografando as próximas criações. Volte em breve.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} onOpen={onOpen} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
