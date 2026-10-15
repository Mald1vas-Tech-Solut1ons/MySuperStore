"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Store } from "lucide-react";
import { type PublicStore } from "@/lib/storefront";

// Com uma loja só, a home já é dela; a faixa aparece a partir do segundo ateliê.
export function StoresStrip({ stores }: { stores: PublicStore[] }) {
  const reduce = useReducedMotion();
  if (stores.length < 2) return null;

  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-serif text-3xl sm:text-4xl leading-tight text-atelie-ink">Ateliês parceiros</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store, index) => (
            <motion.div
              key={store.id}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={`/s/${store.slug}`}
                className="group block overflow-hidden rounded-3xl bg-white/60 ring-1 ring-black/5 shadow-sm transition-shadow duration-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay"
              >
                <div className="relative h-36 bg-atelie-sand">
                  {store.banner_url ? (
                    <img src={store.banner_url} alt={`Banner do ateliê ${store.store_name}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-atelie-wall">
                      <Store className="h-9 w-9 text-atelie-clay/35" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="relative z-10 mx-5 -mt-7 h-14 w-14 overflow-hidden rounded-full bg-atelie-cream ring-4 ring-white">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={`Logo do ateliê ${store.store_name}`} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-serif text-xl text-atelie-clay">{store.store_name.charAt(0)}</span>
                  )}
                </div>
                <div className="px-5 pb-6">
                  <h3 className="mt-4 font-serif text-xl leading-tight text-atelie-ink transition-colors duration-300 group-hover:text-atelie-clay">{store.store_name}</h3>
                  {store.description ? <p className="mt-1.5 font-atelie text-sm leading-relaxed text-atelie-ink/60 line-clamp-2">{store.description}</p> : null}
                  <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
                    <span className="font-atelie text-sm text-atelie-ink/70">
                      {store.product_count} {store.product_count === 1 ? "peça" : "peças"}
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 text-atelie-clay transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
