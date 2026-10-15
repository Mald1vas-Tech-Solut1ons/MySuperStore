"use client";

import { motion, useReducedMotion } from "framer-motion";
import { QrCode, CreditCard, Truck, ShieldCheck } from "lucide-react";

export function Marquee({ items }: { items: string[] }) {
  const reduced = useReducedMotion();
  const row = (copy: "a" | "b") => (
    <ul aria-hidden={copy === "b" ? true : undefined} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((item, i) => (
        <li key={`${copy}-${i}`} className="flex items-center gap-8 font-serif italic text-xl sm:text-2xl text-atelie-ink whitespace-nowrap">
          <span>{item}</span>
          <span aria-hidden="true" className="text-atelie-clay">✺</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="group border-y border-black/10 py-4 overflow-hidden">
      <style>{`
        @keyframes atelie-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .atelie-marquee-track { animation: atelie-marquee 35s linear infinite; will-change: transform; }
        .group:hover .atelie-marquee-track { animation-play-state: paused; }
      `}</style>
      <div className={`flex w-max ${reduced ? "" : "atelie-marquee-track"}`}>
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

const trustItems = [
  { icon: QrCode, title: "Pix na hora", subtitle: "Aprovação imediata" },
  { icon: CreditCard, title: "Cartão de crédito", subtitle: "Parcele sem juros" },
  { icon: Truck, title: "Enviamos para todo o Brasil", subtitle: "Frete calculado no carrinho" },
  { icon: ShieldCheck, title: "Compra protegida", subtitle: "Pagamento seguro e trocas em 7 dias" },
];

export function TrustBar() {
  const reduced = useReducedMotion();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {trustItems.map(({ icon: Icon, title, subtitle }, i) => (
          <motion.div
            key={title}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.06 }}
            className="flex items-center gap-3 rounded-2xl bg-white/55 ring-1 ring-black/5 backdrop-blur-sm p-4"
          >
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-atelie-cream text-atelie-clay">
              <Icon size={18} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-atelie-ink">{title}</span>
              <span className="text-xs text-atelie-ink/60">{subtitle}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
