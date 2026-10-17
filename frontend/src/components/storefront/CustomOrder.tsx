"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { brand, whatsappLink } from "@/config/brand";
import { WallBackdrop } from "./WallBackdrop";

const steps = ["Conte sua ideia pelo WhatsApp", "Aprovamos cores, medidas e prazo", "Produzimos à mão e enviamos"];

export function CustomOrder() {
  const reduce = useReducedMotion();
  const whats = whatsappLink("Olá! Quero encomendar uma peça sob medida.");
  const [, insetImage, mainImage] = brand.images.lookbook;
  const cta =
    "inline-flex items-center gap-3 h-14 px-6 rounded-full bg-atelie-ink text-atelie-cream font-atelie text-sm transition-colors hover:bg-atelie-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay focus-visible:ring-offset-2 focus-visible:ring-offset-atelie-sand";

  const reveal = (delay = 0) => ({
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: reduce ? 0 : 0.6, delay: reduce ? 0 : delay, ease: "easeOut" as const },
  });

  return (
    <section id="encomendas" className="scroll-mt-28 py-16 sm:py-24">
      <WallBackdrop tone="warm" className="mx-4 sm:mx-6 lg:mx-8 rounded-[32px]">
        <div className="grid lg:grid-cols-2 gap-10 items-center p-6 sm:p-12 lg:p-16">
          <div className="space-y-6">
            <motion.p {...reveal(0)} className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-atelie-clay">
              <span aria-hidden="true" className="h-px w-8 bg-atelie-clay/50" />
              Sob medida
            </motion.p>
            <motion.h2 {...reveal(0.06)} className="font-serif text-4xl sm:text-6xl leading-[1] text-atelie-ink">
              Do seu jeito, <em className="text-atelie-clay">feita para você</em>.
            </motion.h2>
            <motion.p {...reveal(0.12)} className="font-atelie text-base sm:text-lg leading-relaxed text-atelie-ink/70 max-w-md">
              {brand.customOrder.text}
            </motion.p>
            <motion.ol {...reveal(0.18)} className="space-y-3 pt-2">
              {steps.map((step, i) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-atelie-ink text-xs text-atelie-cream">{i + 1}</span>
                  <span className="font-atelie text-[15px] text-atelie-ink/85">{step}</span>
                </li>
              ))}
            </motion.ol>
            <motion.div {...reveal(0.24)} className="pt-2">
              {whats ? (
                <a href={whats} target="_blank" rel="noopener noreferrer" className={cta}>
                  <MessageCircle aria-hidden="true" className="h-5 w-5" />
                  Pedir pelo WhatsApp
                </a>
              ) : (
                <Link href="#colecao" className={cta}>
                  Ver peças prontas
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
            </motion.div>
          </div>

          <motion.div {...reveal(0.1)} className="relative mt-2 lg:mt-0">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] bg-atelie-sand shadow-xl">
              <img src={mainImage.src} alt={mainImage.alt} loading="lazy" className="h-full w-full object-cover object-top" />
            </div>
            <div className="hidden sm:block absolute -bottom-6 -left-6 w-40 sm:w-52 rotate-[-4deg] overflow-hidden rounded-2xl ring-8 ring-atelie-sand shadow-lg">
              <div className="aspect-[3/4]">
                <img src={insetImage.src} alt={insetImage.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
            </div>
          </motion.div>
        </div>
      </WallBackdrop>
    </section>
  );
}
