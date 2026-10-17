"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import { brand } from "@/config/brand";
import { youtubeId } from "@/lib/storefront";

const steps = brand.video.steps;

export function AtelierVideo({ videoUrl, fileUrl }: { videoUrl?: string | null; fileUrl?: string | null }) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const youtube = youtubeId(videoUrl ?? null);
  const reveal = (delay = 0) => ({
    initial: reduced ? undefined : { opacity: 0, y: 24 },
    whileInView: reduced ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.7, delay, ease: "easeOut" as const },
  });

  return (
    <section className="bg-atelie-espresso text-atelie-cream py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <motion.div {...reveal()} className="lg:col-span-4">
            <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-atelie-cream/60">
              <span aria-hidden className="h-px w-8 bg-atelie-terracotta" />
              {brand.video.eyebrow}
            </p>
            <h2 className="mt-4 font-serif text-4xl sm:text-6xl leading-[1] text-atelie-cream">
              {brand.video.title} <em className="text-atelie-terracotta">{brand.video.titleEmphasis}</em>.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-atelie-cream/70">
              {brand.video.text}
            </p>
            <Link
              href="#colecao"
              className="mt-7 inline-flex h-12 items-center rounded-full bg-atelie-cream px-6 text-sm font-medium text-atelie-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay"
            >
              Ver peças
            </Link>
          </motion.div>

          <motion.div {...reveal(0.12)} className="lg:col-span-8">
            <div className="relative aspect-video overflow-hidden rounded-[28px] bg-black shadow-2xl">
              {youtube ? (
                playing ? (
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0&modestbranding=1`}
                    title={brand.video.caption}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    aria-label={`Reproduzir vídeo: ${brand.video.caption}`}
                    className="group absolute inset-0 block h-full w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-atelie-clay"
                  >
                    <img
                      src={`https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`}
                      alt={`Miniatura do vídeo: ${brand.video.caption}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                    <span aria-hidden className="absolute inset-0 bg-black/30 transition-colors duration-300 group-hover:bg-black/20" />
                    <span aria-hidden className="absolute inset-0 grid place-items-center">
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 shadow-lg transition-transform duration-300 group-hover:scale-105">
                        <Play className="ml-0.5 h-6 w-6 text-atelie-ink" fill="currentColor" />
                      </span>
                    </span>
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-10 text-left text-xs text-atelie-cream/90">
                      {brand.video.caption}
                    </span>
                  </button>
                )
              ) : fileUrl ? (
                <video src={fileUrl} controls preload="metadata" playsInline className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0">
                  <img src={brand.images.detail} alt={brand.images.detailAlt} loading="lazy" className="h-full w-full object-cover opacity-90" />
                  <span aria-hidden className="absolute inset-0 bg-black/35" />
                  <span className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 rounded-full bg-atelie-espresso/85 px-4 py-2 text-xs text-atelie-cream/90 ring-1 ring-white/10">
                    Em breve: vídeos do processo no {brand.shopNoun}
                  </span>
                </div>
              )}
            </div>

            <ul className="mt-8 grid grid-cols-3 gap-3 border-t border-atelie-cream/20 pt-3 text-xs text-atelie-cream/60">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
