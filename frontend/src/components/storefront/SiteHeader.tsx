"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { brand, whatsappLink } from "@/config/brand";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";

const custom = () => whatsappLink("Olá! Quero encomendar uma peça sob medida.") || "/#encomendas";

const mainLinks = () => [
  { label: "Início", href: "/" },
  { label: "Bolsas", href: "/?category=bolsas" },
  { label: "Chapéus", href: "/?category=chapeus" },
  { label: "Calçados", href: "/?category=calcados" },
  { label: "Casa", href: "/?category=casa" },
  { label: "Sob medida", href: custom() },
];

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay rounded-full";

export function SiteHeader({ transparentOnTop = false }: { transparentOnTop?: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { itemCount, fetchCartCount } = useCartStore();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (isAuthenticated) fetchCartCount();
  }, [isAuthenticated, fetchCartCount]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Esc fecha overlays; o body não rola enquanto um overlay está aberto.
  useEffect(() => {
    const open = menuOpen || searchOpen;
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen, searchOpen]);

  const solid = !transparentOnTop || scrolled || menuOpen;
  const tone = solid ? "text-atelie-ink" : "text-white";
  const iconBtn = `grid h-10 w-10 place-items-center transition-colors hover:bg-black/5 ${focus}`;

  const submitSearch = (term: string) => {
    setSearchOpen(false);
    router.push(term.trim() ? `/?search=${encodeURIComponent(term.trim())}` : "/");
  };

  const external = (href: string) => href.startsWith("http");

  return (
    <>
      <header className="sticky top-0 z-50 font-atelie">
        <div className="bg-atelie-espresso text-atelie-cream text-[12px]">
          <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <span className="truncate">Frete grátis acima de R$ 299 · {brand.shipping}</span>
            <span className="hidden sm:block text-atelie-cream/75">{brand.location}</span>
          </div>
        </div>

        <div
          className={`transition-colors duration-300 ${
            solid ? "bg-atelie-cream/90 backdrop-blur-md border-b border-black/5" : "bg-gradient-to-b from-black/30 to-transparent"
          }`}
        >
          <div className={`mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-6 lg:px-8 ${tone}`}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              className={`justify-self-start flex items-center gap-2 px-2 py-2 text-sm ${focus}`}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span className="hidden sm:inline">{menuOpen ? "Fechar" : "Menu"}</span>
            </button>

            <Link href="/" onClick={() => setMenuOpen(false)} className={`justify-self-center text-center leading-none ${focus}`} aria-label={`${brand.fullName} — início`}>
              <span className="block whitespace-nowrap font-serif text-lg sm:text-2xl">{brand.name}</span>
              <span className="mt-1 block text-[9px] sm:text-[10px] uppercase tracking-[0.35em] opacity-75">macramê</span>
            </Link>

            <div className="justify-self-end flex items-center">
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Buscar" className={iconBtn}>
                <Search className="h-5 w-5" />
              </button>
              <Link href={isAuthenticated ? "/dashboard/account" : "/login"} aria-label={isAuthenticated ? "Minha conta" : "Entrar"} className={iconBtn}>
                <User className="h-5 w-5" />
              </Link>
              <Link href="/wishlist" aria-label="Favoritos" className={`hidden sm:grid ${iconBtn}`}>
                <Heart className="h-5 w-5" />
              </Link>
              <Link href="/cart" aria-label={`Sacola${itemCount ? `, ${itemCount} itens` : ""}`} className={`relative ${iconBtn}`}>
                <ShoppingBag className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-atelie-clay px-1 text-[10px] font-semibold text-white">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-40 overflow-y-auto bg-atelie-cream pt-28 pb-12 font-atelie"
          >
            <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:px-8 md:grid-cols-3">
              <nav aria-label="Navegação principal" className="md:col-span-2 space-y-1">
                {mainLinks().map((l, i) => (
                  <motion.div
                    key={l.label}
                    initial={reduce ? false : { opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.35 }}
                  >
                    <Link
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      target={external(l.href) ? "_blank" : undefined}
                      rel={external(l.href) ? "noopener noreferrer" : undefined}
                      className={`group inline-flex items-baseline gap-3 font-serif text-4xl sm:text-6xl text-atelie-ink hover:italic ${focus}`}
                    >
                      {l.label}
                      <ArrowUpRight className="h-6 w-6 text-atelie-clay opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <div className="space-y-3 text-sm text-atelie-ink/80">
                <p className="text-[11px] uppercase tracking-[0.3em] text-atelie-ink/45">Sua conta</p>
                {isAuthenticated && user?.first_name && <p className="text-atelie-ink">Olá, {user.first_name}</p>}
                <Link href={isAuthenticated ? "/dashboard/account" : "/login"} onClick={() => setMenuOpen(false)} className="block hover:text-atelie-clay">
                  {isAuthenticated ? "Minha conta" : "Entrar ou criar conta"}
                </Link>
                <Link href="/dashboard/orders" onClick={() => setMenuOpen(false)} className="block hover:text-atelie-clay">Pedidos</Link>
                <Link href="/wishlist" onClick={() => setMenuOpen(false)} className="block hover:text-atelie-clay">Favoritos</Link>
                {user?.is_seller ? (
                  <Link href="/seller/dashboard" onClick={() => setMenuOpen(false)} className="block hover:text-atelie-clay">Painel da loja</Link>
                ) : (
                  <Link href="/seller/onboarding" onClick={() => setMenuOpen(false)} className="block hover:text-atelie-clay">Venda seu artesanato</Link>
                )}
                {user?.role === "admin" && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} className="block hover:text-atelie-clay">Administração</Link>
                )}
                {isAuthenticated && (
                  <button type="button" onClick={() => { logout(); setMenuOpen(false); }} className="block text-left hover:text-atelie-clay">
                    Sair
                  </button>
                )}
                <div className="pt-8 text-xs text-atelie-ink/55 space-y-1">
                  <p>{brand.location}</p>
                  <p>{brand.shipping}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-atelie-ink/50 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
            <motion.form
              initial={reduce ? false : { y: -24 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => { e.preventDefault(); submitSearch(q); }}
              className="bg-atelie-cream px-4 py-8 sm:px-12 font-atelie"
              role="search"
            >
              <div className="mx-auto flex max-w-4xl items-center gap-4 border-b-2 border-atelie-ink pb-3">
                <Search className="h-6 w-6 shrink-0 text-atelie-ink" aria-hidden />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Busque bolsas, chapéus, peças…"
                  aria-label="Buscar no ateliê"
                  className="min-w-0 flex-1 bg-transparent font-serif text-2xl sm:text-4xl text-atelie-ink outline-none placeholder:text-atelie-ink/30"
                />
                <button type="button" onClick={() => setSearchOpen(false)} aria-label="Fechar busca" className={iconBtn}>
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="mx-auto mt-4 flex max-w-4xl flex-wrap gap-2 text-sm">
                {["bolsa caracol", "boho", "chapéu", "sob medida"].map((t) => (
                  <button key={t} type="button" onClick={() => submitSearch(t)} className={`rounded-full px-3 py-1 ring-1 ring-black/15 hover:bg-black/5 ${focus}`}>
                    {t}
                  </button>
                ))}
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
