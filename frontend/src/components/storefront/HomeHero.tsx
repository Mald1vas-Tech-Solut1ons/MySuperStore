"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { brand, whatsappLink } from "@/config/brand";
import { type StoreProduct, brl, priceOf } from "@/lib/storefront";

export function HomeHero({ products, onOpen }: { products: StoreProduct[]; onOpen: (slug: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 80]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, reduce ? 1.05 : 1.12]);
  const whats = whatsappLink("Olá! Quero encomendar uma peça sob medida.");

  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: 0.15 } } };
  const item = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <section ref={ref} className="relative -mt-24 min-h-[88svh] overflow-hidden bg-atelie-espresso font-atelie">
      <motion.img
        src={brand.images.hero}
        alt={brand.images.heroAlt}
        style={{ y, scale }}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[50%_25%] lg:object-[50%_15%]"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 sm:from-black/75 sm:via-black/25 sm:to-black/10" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex min-h-[88svh] max-w-7xl flex-col justify-end px-4 pt-32 pb-12 sm:px-6 sm:pb-16 lg:px-8"
      >
        <motion.p variants={item} className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-white/85">
          <span aria-hidden className="h-px w-8 bg-white/70" />
          {brand.hero.eyebrow}
        </motion.p>
        <motion.h1 variants={item} className="mt-4 font-serif text-5xl leading-[0.95] text-white sm:text-7xl lg:text-8xl">
          {brand.hero.title}
          <br />
          <em className="text-atelie-terracotta">{brand.hero.titleEmphasis}</em>
        </motion.h1>
        <motion.p variants={item} className="mt-5 max-w-xl text-lg text-white/85">
          {brand.hero.subtitle}
        </motion.p>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <motion.div variants={item} className="flex flex-wrap gap-3">
            <Link
              href="#colecao"
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-atelie-cream pl-6 pr-2 font-medium text-atelie-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay focus-visible:ring-offset-2"
            >
              Ver coleção
              <span className="grid h-10 w-10 place-items-center rounded-full bg-atelie-clay text-white transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <a
              href={whats || "#encomendas"}
              target={whats ? "_blank" : undefined}
              rel={whats ? "noopener noreferrer" : undefined}
              className="inline-flex h-14 items-center rounded-full px-6 text-white ring-1 ring-white/60 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay"
            >
              Encomendar sob medida
            </a>
          </motion.div>

          {products.length > 0 && (
            <motion.ul variants={item} className="hidden gap-3 lg:flex" aria-label="Peças em destaque">
              {products.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.slug)}
                    className="flex items-center gap-3 rounded-2xl bg-white/10 p-2 pr-4 text-left text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay"
                  >
                    {p.primary_image ? (
                      <img src={p.primary_image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <span className="h-14 w-14 rounded-xl bg-atelie-sand" />
                    )}
                    <span className="text-sm">
                      <span className="block whitespace-nowrap">{p.name}</span>
                      <span className="block font-semibold">{brl(priceOf(p))}</span>
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </div>
      </motion.div>

      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute bottom-4 left-1/2 z-10 h-8 w-px -translate-x-1/2 bg-white/60"
          animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ originY: 0 }}
        />
      )}
    </section>
  );
}
