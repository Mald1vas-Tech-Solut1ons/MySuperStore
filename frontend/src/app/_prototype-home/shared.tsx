"use client";

// PROTOTYPE — peças comuns às variantes: dados reais do header (carrinho/usuário)
// e o menu de conta, que passa a concentrar os atalhos de papel (lojista/admin)
// que hoje poluem a navegação pública.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Package, Shield, Store, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";

export function useHeaderData() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { itemCount, fetchCartCount } = useCartStore();
  useEffect(() => {
    if (isAuthenticated) fetchCartCount();
  }, [isAuthenticated, fetchCartCount]);
  // Mostra 2 no protótipo quando não há sessão, só para ver o badge no layout.
  return { user, isAuthenticated, logout, cartCount: isAuthenticated ? itemCount : 2 };
}

export function useSearchSubmit() {
  const router = useRouter();
  return (q: string) => router.push(q.trim() ? `/?search=${encodeURIComponent(q.trim())}` : "/");
}

export function AccountMenu({
  trigger,
  panelClass = "bg-white text-stone-900 ring-1 ring-stone-200",
  itemClass = "hover:bg-stone-100",
}: {
  trigger: React.ReactNode;
  panelClass?: string;
  itemClass?: string;
}) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const item = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${itemClass}`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </button>
      {open && (
        <div role="menu" className={`absolute right-0 top-full mt-2 w-60 rounded-2xl p-2 shadow-xl z-50 ${panelClass}`}>
          {isAuthenticated ? (
            <>
              <div className="px-3 py-2 text-xs opacity-60">Olá, {user?.first_name || "você"}</div>
              <Link href="/dashboard/account" className={item}><User className="h-4 w-4" />Minha conta</Link>
              <Link href="/dashboard/orders" className={item}><Package className="h-4 w-4" />Pedidos</Link>
              {user?.is_seller ? (
                <Link href="/seller/dashboard" className={item}><LayoutDashboard className="h-4 w-4" />Painel da loja</Link>
              ) : (
                <Link href="/seller/onboarding" className={item}><Store className="h-4 w-4" />Abrir minha loja</Link>
              )}
              {user?.role === "admin" && (
                <Link href="/admin" className={item}><Shield className="h-4 w-4" />Administração</Link>
              )}
              <div className="my-1 h-px bg-current opacity-10" />
              <button onClick={logout} className={`${item} w-full`}><LogOut className="h-4 w-4" />Sair</button>
            </>
          ) : (
            <>
              <Link href="/login" className={item}><User className="h-4 w-4" />Entrar</Link>
              <Link href="/register" className={item}>Criar conta</Link>
              <div className="my-1 h-px bg-current opacity-10" />
              <Link href="/seller/onboarding" className={item}><Store className="h-4 w-4" />Abrir minha loja</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Vídeo "lite": mostra só a thumbnail; o iframe do YouTube (≈1MB de JS) só carrega no clique.
// No produto real, a loja/produto teria um campo de vídeos (YouTube/Vimeo ou upload próprio).
export const DEMO_VIDEO = { id: "ZHzQpOO9EEw", start: 21, title: "Do fio à bolsa: o processo no ateliê" };

export function VideoEmbed({
  id = DEMO_VIDEO.id,
  start = DEMO_VIDEO.start,
  title = DEMO_VIDEO.title,
  className = "",
  rounded = "rounded-2xl",
}: {
  id?: string;
  start?: number;
  title?: string;
  className?: string;
  rounded?: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-black ${rounded} ${className}`}>
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&start=${start}&rel=0&modestbranding=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full text-left" aria-label={`Assistir: ${title}`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03]" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-16 w-16 place-items-center rounded-full bg-white/90 text-black shadow-xl transition group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-0.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <span className="absolute bottom-4 left-4 right-4 text-white text-sm font-medium drop-shadow">{title}</span>
        </button>
      )}
    </div>
  );
}

// Marca da plataforma em versão sóbria: anel de Saturno monocromático + wordmark.
export function PlatformMark({ className = "", ring = "currentColor" }: { className?: string; ring?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <circle cx="16" cy="16" r="7" fill="currentColor" />
        <ellipse cx="16" cy="16" rx="14" ry="5" fill="none" stroke={ring} strokeWidth="1.6" transform="rotate(-20 16 16)" />
      </svg>
      <span className="tracking-tight">mysuperstore</span>
    </span>
  );
}
