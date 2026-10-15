"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type StoreProduct, brl, priceOf, compareAtOf, installmentsLabel } from "@/lib/storefront";

type ProductCardProps = {
  product: StoreProduct;
  onOpen: (slug: string) => void;
  index?: number;
};

export function ProductCard({ product, onOpen, index = 0 }: ProductCardProps) {
  const reduceMotion = useReducedMotion();
  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const discount = compareAt !== null && compareAt > price ? Math.round((1 - price / compareAt) * 100) : null;
  const installments = installmentsLabel(price);
  const initial = product.name.trim().charAt(0).toUpperCase();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay: Math.min(index, 8) * 0.05, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={() => onOpen(product.slug)}
        aria-label={`Ver ${product.name}`}
        className="group block w-full rounded-3xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay focus-visible:ring-offset-2 focus-visible:ring-offset-atelie-cream"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-atelie-sand">
          {product.primary_image ? (
            <img
              src={product.primary_image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-5xl text-atelie-clay/40">{initial}</div>
          )}

          {discount !== null && (
            <span className="absolute left-3 top-3 rounded-full bg-atelie-cream/95 px-2.5 py-1 text-[11px] font-medium text-atelie-clay">
              -{discount}%
            </span>
          )}

          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-2 rounded-full bg-atelie-cream/95 px-4 py-2 text-center text-xs font-medium text-atelie-ink opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block"
          >
            Ver peça
          </span>
        </div>

        <div className="mt-3 px-0.5">
          {product.category_name && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-atelie-ink/50">{product.category_name}</p>
          )}
          <p className="mt-1 text-[15px] leading-snug text-atelie-ink">{product.name}</p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-atelie-ink">{brl(price)}</span>
            {compareAt !== null && compareAt > price && (
              <span className="text-xs text-atelie-ink/45 line-through">{brl(compareAt)}</span>
            )}
          </p>
          {installments && <p className="mt-0.5 text-xs text-atelie-ink/55">{installments}</p>}
        </div>
      </button>
    </motion.div>
  );
}
