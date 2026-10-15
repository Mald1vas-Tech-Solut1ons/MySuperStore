"use client";

// PROTOTYPE — Variante C "Lojas primeiro": a home é organizada por lojas (tenants),
// não por produtos. Header mínimo transparente sobre um hero imersivo da "loja da
// semana", menu em overlay de tela cheia e cards de loja com vitrine embutida.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, Search, ShoppingBag, Star, User, X } from "lucide-react";
import { brl, categories, eliPhotos, products, stores } from "./data";
import { AccountMenu, PlatformMark, VideoEmbed, useHeaderData, useSearchSubmit } from "./shared";

export const name = "Lojas primeiro (imersivo)";

const clay = "#A65A3A";

function HeaderC() {
  const { cartCount } = useHeaderData();
  const submit = useSearchSubmit();
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tone = solid || menu ? "text-[#1F1A17]" : "text-white";

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solid || menu ? "bg-[#F3ECE2]/95 backdrop-blur border-b border-black/5" : "bg-gradient-to-b from-black/40 to-transparent"}`}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-8 h-16 grid grid-cols-3 items-center ${tone}`}>
          <button onClick={() => setMenu((m) => !m)} className="justify-self-start flex items-center gap-2 text-sm font-medium">
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="hidden sm:inline">{menu ? "Fechar" : "Menu"}</span>
          </button>
          <Link href="/" className="justify-self-center font-[family-name:var(--font-proto-serif)] text-xl sm:text-2xl"><PlatformMark ring={solid || menu ? clay : "currentColor"} /></Link>
          <div className="justify-self-end flex items-center gap-1 sm:gap-2">
            <button onClick={() => setSearching(true)} className="p-2" aria-label="Buscar"><Search className="h-5 w-5" /></button>
            <span className="hidden sm:block">
              <AccountMenu trigger={<span className="p-2 flex"><User className="h-5 w-5" /></span>} panelClass="bg-[#F3ECE2] text-[#1F1A17] ring-1 ring-black/10" itemClass="hover:bg-black/5" />
            </span>
            <Link href="/cart" className="flex items-center gap-1.5 p-2 text-sm font-medium"><ShoppingBag className="h-5 w-5" /><span className="hidden sm:inline">Sacola</span>({cartCount})</Link>
          </div>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-40 bg-[#F3ECE2] pt-24 px-6 sm:px-12 overflow-y-auto">
          <div className="mx-auto max-w-7xl grid md:grid-cols-3 gap-10">
            <nav className="md:col-span-2 space-y-1">
              {["Novidades", ...categories.map((c) => c.name), "Todas as lojas"].map((n) => (
                <a key={n} href="#" onClick={() => setMenu(false)} className="group flex items-baseline gap-4 font-[family-name:var(--font-proto-serif)] text-4xl sm:text-6xl text-[#1F1A17] hover:italic">
                  {n}<ArrowUpRight className="h-6 w-6 opacity-0 group-hover:opacity-100" style={{ color: clay }} />
                </a>
              ))}
            </nav>
            <div className="space-y-3 text-sm text-[#1F1A17]/80">
              <p className="text-xs uppercase tracking-widest text-[#1F1A17]/50">Conta</p>
              <Link href="/dashboard/orders" className="block">Meus pedidos</Link>
              <Link href="/wishlist" className="block">Favoritos</Link>
              <Link href="/seller/onboarding" className="block">Abrir minha loja</Link>
              <Link href="/white-label" className="block">Para empresas</Link>
            </div>
          </div>
        </div>
      )}

      {searching && (
        <div className="fixed inset-0 z-[60] bg-[#1F1A17]/60 backdrop-blur-sm" onClick={() => setSearching(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit(q); setSearching(false); }} className="bg-[#F3ECE2] px-6 sm:px-12 py-8">
            <div className="mx-auto max-w-4xl flex items-center gap-4 border-b-2 border-[#1F1A17] pb-3">
              <Search className="h-6 w-6" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque peças ou lojas" className="flex-1 bg-transparent text-2xl sm:text-4xl font-[family-name:var(--font-proto-serif)] outline-none placeholder:text-[#1F1A17]/30" />
              <button type="button" onClick={() => setSearching(false)}><X className="h-6 w-6" /></button>
            </div>
            <div className="mx-auto max-w-4xl mt-4 flex flex-wrap gap-2 text-sm">
              {["bolsa caracol", "macramê", "chapéu de palha", "sandália trançada"].map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)} className="rounded-full ring-1 ring-black/15 px-3 py-1 hover:bg-black/5">{t}</button>
              ))}
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default function VariantC() {
  const featured = stores[0];
  const fp = products.filter((p) => p.store === featured.slug);
  return (
    <div className="min-h-screen bg-[#F3ECE2] text-[#1F1A17] font-[family-name:var(--font-proto-sans)]">
      <HeaderC />

      {/* Hero: loja da semana */}
      <section className="relative h-[92svh] min-h-[560px] overflow-hidden">
        <img src={featured.cover} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_25%] lg:object-[50%_12%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
        <div className="relative z-10 h-full mx-auto max-w-7xl px-4 sm:px-8 flex flex-col justify-end pb-10 sm:pb-14 text-white">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em]"><span className="h-px w-8 bg-white/70" />Loja da semana</p>
          <h1 className="mt-4 font-[family-name:var(--font-proto-serif)] text-6xl sm:text-8xl leading-[0.95] tracking-tight">{featured.name}</h1>
          <p className="mt-3 text-lg text-white/85 max-w-lg">{featured.tagline}. Bolsas em fio de algodão, feitas sob medida em {featured.city.split(",")[0]}.</p>
          <div className="mt-8 flex flex-col lg:flex-row lg:items-end gap-6 lg:justify-between">
            <Link href={`/s/${featured.slug}`} className="self-start inline-flex items-center gap-3 rounded-full bg-[#F3ECE2] text-[#1F1A17] pl-6 pr-2 h-14 font-medium">
              Entrar na loja <span className="grid place-items-center h-10 w-10 rounded-full text-white" style={{ background: clay }}><ArrowRight className="h-4 w-4" /></span>
            </Link>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide">
              {fp.slice(0, 4).map((p) => (
                <Link key={p.id} href={`/s/${featured.slug}`} className="shrink-0 flex items-center gap-3 rounded-2xl bg-white/12 backdrop-blur-md ring-1 ring-white/20 p-2 pr-4 hover:bg-white/20">
                  <img src={p.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="text-sm"><p className="whitespace-nowrap">{p.name}</p><p className="font-semibold">{brl(p.price)}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Faixa */}
      <div className="overflow-hidden border-y border-black/10 py-4">
        <div className="flex gap-10 whitespace-nowrap font-[family-name:var(--font-proto-serif)] text-2xl italic animate-[marquee_30s_linear_infinite]">
          {Array.from({ length: 2 }).flatMap((_, k) =>
            ["feito à mão", "direto de quem faz", "pix com 5% off", "frete na hora", "peças únicas", "compra protegida"].map((t) => (
              <span key={`${k}-${t}`} className="flex items-center gap-10">{t}<span style={{ color: clay }}>✺</span></span>
            )),
          )}
        </div>
        <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      </div>

      {/* Lojas do universo */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 py-16 sm:py-24">
        <div className="flex items-end justify-between gap-6 mb-10">
          <h2 className="font-[family-name:var(--font-proto-serif)] text-4xl sm:text-6xl leading-none">Lojas do universo</h2>
          <a href="#" className="hidden sm:inline-flex items-center gap-2 text-sm font-medium">Todas as lojas <ArrowRight className="h-4 w-4" /></a>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {stores.map((s) => {
            const ps = products.filter((p) => p.store === s.slug).slice(0, 3);
            return (
              <article key={s.slug} className="group rounded-[28px] bg-white/60 ring-1 ring-black/5 p-3 hover:bg-white transition">
                <div className="relative h-56 overflow-hidden rounded-[20px]">
                  <img src={s.cover} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <button className="absolute top-3 right-3 rounded-full bg-white/90 px-4 h-9 text-sm font-medium">Seguir</button>
                </div>
                <div className="flex items-center gap-3 px-2 pt-4">
                  <img src={s.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-[family-name:var(--font-proto-serif)] text-2xl leading-tight">{s.name}</p>
                    <p className="text-sm text-black/55 truncate">{s.tagline} · {s.city}</p>
                  </div>
                  <span className="hidden sm:flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-current" style={{ color: clay }} />{s.rating}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-2 pt-4">
                  {ps.map((p) => (
                    <div key={p.id}>
                      <img src={p.image} alt={p.name} className="aspect-square w-full rounded-xl object-cover" />
                      <p className="mt-1 text-xs font-semibold">{brl(p.price)}</p>
                    </div>
                  ))}
                </div>
                <Link href={`/s/${s.slug}`} className="mx-2 mb-2 mt-2 flex items-center justify-between rounded-full bg-[#1F1A17] text-[#F3ECE2] px-5 h-11 text-sm">Visitar loja <ArrowRight className="h-4 w-4" /></Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* No ateliê — vídeos do processo */}
      <section className="bg-[#1F1A17] text-[#F3ECE2] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[#F3ECE2]/60">No ateliê · {featured.name}</p>
            <h2 className="mt-4 font-[family-name:var(--font-proto-serif)] text-4xl sm:text-6xl leading-[1]">Do fio <em style={{ color: "#D99A74" }}>à peça</em>.</h2>
            <p className="mt-5 text-[#F3ECE2]/75">Cada bolsa leva horas de nós feitos à mão. Assista ao processo e encomende a sua na cor que quiser.</p>
            <div className="mt-8 flex gap-3">
              <Link href={`/s/${featured.slug}`} className="inline-flex items-center gap-2 rounded-full bg-[#F3ECE2] text-[#1F1A17] px-6 h-12 text-sm font-medium">Ver peças <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="lg:col-span-8">
            <VideoEmbed className="aspect-video" rounded="rounded-[28px]" />
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-[#F3ECE2]/60">
              {["01 · Escolha do fio", "02 · Nós e trama", "03 · Acabamento"].map((t) => <p key={t} className="border-t border-[#F3ECE2]/20 pt-2">{t}</p>)}
            </div>
          </div>
        </div>
      </section>

      {/* Categorias em faixa horizontal */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 mb-6"><h2 className="font-[family-name:var(--font-proto-serif)] text-4xl sm:text-5xl">Por tipo de peça</h2></div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 snap-x">
          {categories.map((c) => (
            <a key={c.slug} href="#" className="group relative shrink-0 snap-start w-64 sm:w-80 aspect-[3/4] overflow-hidden rounded-[24px]">
              <img src={c.image} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <p className="absolute bottom-5 left-5 font-[family-name:var(--font-proto-serif)] text-4xl text-white italic">{c.name}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Chamado para lojistas */}
      <section className="mx-4 sm:mx-8 mb-8 rounded-[32px] bg-[#1F1A17] text-[#F3ECE2] overflow-hidden grid lg:grid-cols-2">
        <div className="p-8 sm:p-14">
          <p className="text-xs uppercase tracking-[0.25em] text-[#F3ECE2]/60">Para quem faz</p>
          <h2 className="mt-4 font-[family-name:var(--font-proto-serif)] text-4xl sm:text-6xl leading-[1]">Sua loja, com a sua cara, dentro do universo.</h2>
          <p className="mt-5 text-[#F3ECE2]/75 max-w-md">Página própria, Pix e cartão, frete calculado e repasse automático. Você cuida das peças.</p>
          <Link href="/seller/onboarding" className="mt-8 inline-flex items-center gap-2 rounded-full px-6 h-12 text-sm font-medium text-white" style={{ background: clay }}>Abrir minha loja <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="relative min-h-[300px]"><img src={eliPhotos.olivaModelo} alt="" className="absolute inset-0 h-full w-full object-cover object-top" /></div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 sm:px-8 py-10 flex flex-col sm:flex-row gap-4 justify-between text-sm text-black/60">
        <span className="font-[family-name:var(--font-proto-serif)] text-lg text-[#1F1A17]"><PlatformMark ring={clay} /></span>
        <span className="space-x-5"><Link href="/terms">Termos</Link><Link href="/privacy">Privacidade</Link><Link href="/white-label">Para empresas</Link></span>
      </footer>
    </div>
  );
}
