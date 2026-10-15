"use client";

// PROTOTYPE — Variante B "Descoberta": marketplace app-first, sem banner.
// Header de uma linha com busca dominante, lojas como "stories", chips de filtro
// fixos e um feed masonry onde cada peça carrega a loja que a fez.
import { useState } from "react";
import Link from "next/link";
import { Heart, Plus, Search, ShoppingBag, SlidersHorizontal, User } from "lucide-react";
import { brl, products, storeBySlug, stores, textures } from "./data";
import { AccountMenu, PlatformMark, VideoEmbed, useHeaderData, useSearchSubmit } from "./shared";

export const name = "Descoberta (feed)";

const chips = ["Para você", "Bolsas", "Chapéus", "Calçados", "Casa", "Acessórios", "Sob encomenda", "Até R$ 150"];

function HeaderB() {
  const { cartCount } = useHeaderData();
  const submit = useSearchSubmit();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
        <Link href="/" className="font-[family-name:var(--font-proto-grotesk)] font-extrabold text-lg text-neutral-950 shrink-0">
          <span className="sm:hidden"><svg viewBox="0 0 32 32" className="h-7 w-7"><circle cx="16" cy="16" r="7" fill="currentColor" /><ellipse cx="16" cy="16" rx="14" ry="5" fill="none" stroke="#E8552B" strokeWidth="2" transform="rotate(-20 16 16)" /></svg></span>
          <span className="hidden sm:inline"><PlatformMark ring="#E8552B" /></span>
        </Link>
        <form onSubmit={(e) => { e.preventDefault(); submit(q); }} className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="O que você procura hoje?"
            className="w-full h-11 rounded-2xl bg-neutral-100 focus:bg-white focus:ring-2 focus:ring-neutral-900 pl-11 pr-11 text-[15px] outline-none placeholder:text-neutral-500"
          />
          <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
        </form>
        <div className="hidden md:flex items-center gap-1">
          <Link href="/wishlist" className="p-2.5 rounded-xl hover:bg-neutral-100" aria-label="Favoritos"><Heart className="h-5 w-5" /></Link>
          <AccountMenu trigger={<span className="p-2.5 rounded-xl hover:bg-neutral-100 flex"><User className="h-5 w-5" /></span>} panelClass="bg-white text-neutral-900 ring-1 ring-neutral-200" itemClass="hover:bg-neutral-100" />
        </div>
        <Link href="/cart" className="relative h-11 px-4 rounded-2xl bg-neutral-950 text-white flex items-center gap-2 text-sm font-semibold">
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Sacola</span>
          {cartCount > 0 && <span className="h-5 min-w-5 px-1 rounded-full bg-[#E8552B] text-[11px] grid place-items-center">{cartCount}</span>}
        </Link>
      </div>
    </header>
  );
}

function StoryRail() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-1">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide">
        {stores.map((s, i) => (
          <Link key={s.slug} href={`/s/${s.slug}`} className="shrink-0 w-[72px] text-center">
            <span className={`block rounded-full p-[2.5px] ${i === 0 ? "bg-gradient-to-tr from-[#E8552B] to-[#F2B33D]" : "bg-neutral-200"}`}>
              <img src={s.avatar} alt="" className="h-[64px] w-[64px] rounded-full object-cover ring-[3px] ring-white" />
            </span>
            <span className="mt-1.5 block text-[11px] leading-tight text-neutral-700 truncate">{s.name}</span>
          </Link>
        ))}
        <Link href="/seller/onboarding" className="shrink-0 w-[72px] text-center">
          <span className="grid place-items-center h-[69px] w-[69px] rounded-full border-2 border-dashed border-neutral-300 text-neutral-500"><Plus className="h-5 w-5" /></span>
          <span className="mt-1.5 block text-[11px] leading-tight text-neutral-500">Sua loja</span>
        </Link>
      </div>
    </div>
  );
}

function Pin({ p }: { p: (typeof products)[number] }) {
  const s = storeBySlug[p.store];
  return (
    <article className="mb-4 break-inside-avoid group">
      <div className="relative overflow-hidden rounded-2xl bg-neutral-100">
        <img src={p.image} alt={p.name} className={`w-full object-cover ${p.tall ? "aspect-[3/4.4]" : "aspect-square"}`} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
        <button className="absolute top-2.5 right-2.5 h-9 w-9 grid place-items-center rounded-full bg-white/95 shadow-sm" aria-label="Favoritar"><Heart className="h-4 w-4" /></button>
        <button className="absolute bottom-2.5 right-2.5 h-9 px-3 rounded-full bg-white/95 shadow-sm text-xs font-semibold flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition"><Plus className="h-3.5 w-3.5" />Sacola</button>
        {p.madeToOrder && <span className="absolute left-2.5 top-2.5 rounded-full bg-neutral-950/80 text-white px-2.5 py-1 text-[11px]">Sob encomenda</span>}
      </div>
      <div className="px-1 pt-2">
        <p className="text-[14px] font-medium leading-snug">{p.name}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold">{brl(p.price)}</span>
          {p.compareAt && <span className="text-xs text-[#E8552B] font-semibold">-{Math.round((1 - p.price / p.compareAt) * 100)}%</span>}
        </div>
        <Link href={`/s/${s.slug}`} className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900">
          <img src={s.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />{s.name}
        </Link>
      </div>
    </article>
  );
}

function StorePin() {
  const s = stores[0];
  const ps = products.filter((p) => p.store === s.slug).slice(0, 4);
  return (
    <article className="mb-4 break-inside-avoid rounded-2xl bg-[#F4EFE7] p-4">
      <div className="flex items-center gap-3">
        <img src={s.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="font-semibold truncate">{s.name}</p>
          <p className="text-xs text-neutral-600 truncate">{s.tagline}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {ps.map((p) => <img key={p.id} src={p.image} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="flex-1 h-10 rounded-xl bg-neutral-950 text-white text-sm font-semibold">Seguir</button>
        <Link href={`/s/${s.slug}`} className="flex-1 h-10 rounded-xl bg-white text-sm font-semibold grid place-items-center">Ver loja</Link>
      </div>
    </article>
  );
}

function CollectionPin() {
  return (
    <article className="mb-4 break-inside-avoid relative overflow-hidden rounded-2xl">
      <img src={textures.hatModel} alt="" className="w-full aspect-[3/4.2] object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 p-4 text-white">
        <p className="text-[11px] uppercase tracking-wider opacity-80">Coleção</p>
        <p className="text-xl font-bold leading-tight font-[family-name:var(--font-proto-grotesk)]">Verão trançado</p>
        <p className="text-sm opacity-90">24 peças de 4 lojas</p>
      </div>
    </article>
  );
}

function VideoPin() {
  const s = stores[0];
  return (
    <article className="mb-4 break-inside-avoid">
      <div className="relative">
        <VideoEmbed className="aspect-[4/5]" title="Bastidores: a Bolsa Caracol nascendo" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-[#E8552B] text-white px-2.5 py-1 text-[11px] font-semibold pointer-events-none">▶ Bastidores</span>
      </div>
      <Link href={`/s/${s.slug}`} className="mt-2 px-1 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900">
        <img src={s.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />{s.name} · do fio à peça
      </Link>
    </article>
  );
}

export default function VariantB() {
  const [chip, setChip] = useState(0);
  const feed = products.slice(0, 12);
  return (
    <div className="min-h-screen bg-white text-neutral-950 font-[family-name:var(--font-proto-grotesk)]">
      <HeaderB />
      <StoryRail />

      <div className="sticky top-16 z-30 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {chips.map((c, i) => (
            <button
              key={c}
              onClick={() => setChip(i)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium transition ${i === chip ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pt-2 pb-16">
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {feed.slice(0, 2).map((p) => <Pin key={p.id} p={p} />)}
          <VideoPin />
          {feed.slice(2, 3).map((p) => <Pin key={p.id} p={p} />)}
          <StorePin />
          {feed.slice(3, 7).map((p) => <Pin key={p.id} p={p} />)}
          <CollectionPin />
          {feed.slice(7).map((p) => <Pin key={p.id} p={p} />)}
        </div>
        <div className="mt-6 text-center">
          <button className="h-11 px-6 rounded-full bg-neutral-100 text-sm font-semibold hover:bg-neutral-200">Carregar mais</button>
        </div>
      </main>

      <footer className="border-t border-neutral-100 py-10 text-center text-xs text-neutral-500 space-y-2">
        <p><PlatformMark ring="#E8552B" className="text-neutral-900 font-bold text-sm" /></p>
        <p>Compra protegida · Pix e cartão · Frete Melhor Envio</p>
        <p className="space-x-4"><Link href="/seller/onboarding">Abrir minha loja</Link><Link href="/white-label">Para empresas</Link><Link href="/terms">Termos</Link></p>
      </footer>
    </div>
  );
}
