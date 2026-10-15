"use client";

// PROTOTYPE — barra flutuante para alternar variantes de UI via ?variant=.
// Nunca renderiza em build de produção.
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Variant = { key: string; label: string };

export function PrototypeSwitcher({ variants, current }: { variants: Variant[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idx = Math.max(0, variants.findIndex((v) => v.key === current));

  const go = (delta: number) => {
    const next = variants[(idx + delta + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next.key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 rounded-full bg-fuchsia-600 text-white shadow-2xl ring-4 ring-fuchsia-300/40 px-1.5 py-1.5 font-mono text-xs">
      <button onClick={() => go(-1)} className="h-8 w-8 rounded-full hover:bg-white/20" aria-label="Variante anterior">←</button>
      <span className="px-3 whitespace-nowrap">
        <b>{variants[idx].key}</b> · {variants[idx].label}
      </span>
      <button onClick={() => go(1)} className="h-8 w-8 rounded-full hover:bg-white/20" aria-label="Próxima variante">→</button>
    </div>
  );
}
