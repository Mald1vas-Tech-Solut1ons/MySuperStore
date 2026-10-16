"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PartyPopper, Truck } from "lucide-react";

const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Incentivo de ticket: mostra quanto falta para o frete grátis (a regra é decidida no servidor).
export function FreeShippingProgress({ amount, min, className = "" }: { amount: number; min: number; className?: string }) {
  const reduce = useReducedMotion();
  if (min <= 0) return null;

  const missing = Math.max(0, min - amount);
  const pct = Math.min(100, (amount / min) * 100);

  return (
    <div className={`rounded-2xl bg-white/70 p-4 ring-1 ring-black/5 ${className}`} role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-atelie-ink">
        {missing > 0 ? (
          <>
            <Truck className="h-4 w-4 shrink-0 text-atelie-clay" aria-hidden="true" />
            <span>
              Faltam <strong className="font-semibold">{formatBRL(missing)}</strong> para o frete grátis
            </span>
          </>
        ) : (
          <>
            <PartyPopper className="h-4 w-4 shrink-0 text-atelie-clay" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Frete grátis</strong> garantido nesta compra 🎉
            </span>
          </>
        )}
      </p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-atelie-sand" aria-hidden="true">
        {reduce ? (
          <div className="h-full rounded-full bg-atelie-clay" style={{ width: `${pct}%` }} />
        ) : (
          <motion.div
            className="h-full rounded-full bg-atelie-clay"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </div>
      {missing > 0 && <p className="mt-2 text-xs text-atelie-ink/60">Frete grátis a partir de {formatBRL(min)} em produtos.</p>}
    </div>
  );
}
