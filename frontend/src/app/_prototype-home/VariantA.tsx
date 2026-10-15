"use client";

// PROTOTYPE — Variante A "Curadoria": marketplace editorial, claro e quente.
// Header em 2 níveis (busca protagonista + categorias em texto), hero editorial
// com loja em destaque, grade de produtos limpa e vitrine de lojas.
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Search, ShieldCheck, ShoppingBag, Star, Truck, User, Hand, QrCode } from "lucide-react";
import { brl, categories, eliPhotos, installments, products, storeBySlug, stores, textures } from "./data";
import { AccountMenu, PlatformMark, VideoEmbed, useHeaderData, useSearchSubmit } from "./shared";

export const name = "Curadoria (editorial)";

const nav = ["Novidades", "Bolsas", "Chapéus", "Calçados", "Casa", "Acessórios"];

function HeaderA() {
  const { cartCount } = useHeaderData();
  const submit = useSearchSubmit();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-40 bg-[#FBF8F3]/95 backdrop-blur border-b border-stone-200">
      <div className="bg-[#26352C] text-[#EDE6D8] text-[12px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-8 flex items-center justify-between">
          <span>Pix com 5% off · Frete calculado na hora</span>
          <div className="hidden sm:flex gap-5">
            <Link href="/seller/onboarding" className="hover:underline">Venda no MySuperStore</Link>
            <Link href="/terms" className="hover:underline">Ajuda</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4 sm:gap-8">
        <Link href="/" className="font-[family-name:var(--font-proto-serif)] text-xl sm:text-2xl text-stone-900 shrink-0">
          <PlatformMark />
        </Link>
        <form onSubmit={(e) => { e.preventDefault(); submit(q); }} className="flex-1 relative hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar bolsas, chapéus, lojas…"
            className="w-full h-11 rounded-full bg-white ring-1 ring-stone-300 focus:ring-2 focus:ring-[#26352C] pl-11 pr-4 text-sm outline-none placeholder:text-stone-500"
          />
        </form>
        <div className="ml-auto flex items-center gap-1 text-stone-800">
          <Link href="/wishlist" className="p-2.5 rounded-full hover:bg-stone-200/60" aria-label="Favoritos"><Heart className="h-5 w-5" /></Link>
          <AccountMenu trigger={<span className="p-2.5 rounded-full hover:bg-stone-200/60 flex" aria-label="Conta"><User className="h-5 w-5" /></span>} />
          <Link href="/cart" className="relative p-2.5 rounded-full hover:bg-stone-200/60" aria-label="Sacola">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-[#B4583A] text-white text-[10px] font-semibold grid place-items-center">{cartCount}</span>}
          </Link>
        </div>
      </div>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 h-11 flex items-center gap-6 text-sm text-stone-700 overflow-x-auto scrollbar-hide">
        {nav.map((n, i) => (
          <a key={n} href="#" className={`whitespace-nowrap hover:text-stone-950 ${i === 0 ? "text-stone-950 font-medium" : ""}`}>{n}</a>
        ))}
        <span className="h-4 w-px bg-stone-300" />
        <a href="#lojas" className="whitespace-nowrap hover:text-stone-950">Lojas</a>
      </nav>
    </header>
  );
}

function ProductCardA({ p }: { p: (typeof products)[number] }) {
  const s = storeBySlug[p.store];
  return (
    <article className="group">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-stone-200">
        <img src={p.image} alt={p.name} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        {p.hover && <img src={p.hover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
        <button className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-white/90 text-stone-800 shadow-sm hover:text-[#B4583A]" aria-label="Favoritar"><Heart className="h-4 w-4" /></button>
        {p.madeToOrder && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-stone-800">Sob encomenda</span>}
      </div>
      <div className="pt-3 space-y-0.5">
        <Link href={`/s/${s.slug}`} className="text-xs text-stone-500 hover:text-stone-900">{s.name}</Link>
        <h3 className="text-[15px] text-stone-900 leading-snug">{p.name}</h3>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-stone-900">{brl(p.price)}</span>
          {p.compareAt && <span className="text-xs text-stone-400 line-through">{brl(p.compareAt)}</span>}
        </div>
        <p className="text-xs text-stone-500">{installments(p.price)} sem juros</p>
      </div>
    </article>
  );
}

export default function VariantA() {
  const featured = stores[0];
  const featuredProducts = products.filter((p) => p.store === featured.slug).slice(0, 3);
  return (
    <div className="min-h-screen bg-[#FBF8F3] text-stone-900 font-[family-name:var(--font-proto-sans)]">
      <HeaderA />

      {/* Hero editorial */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 sm:pt-14 pb-12 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#26352C] font-medium">Feito à mão · Direto de quem faz</p>
          <h1 className="mt-4 font-[family-name:var(--font-proto-serif)] text-[44px] sm:text-6xl leading-[1.02] tracking-tight">
            Peças com <em className="text-[#B4583A]">história</em>, de lojas independentes.
          </h1>
          <p className="mt-5 text-stone-600 text-lg max-w-md">Bolsas, chapéus, calçados e casa feitos por artesãs e pequenas marcas de todo o Brasil.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#escolhas" className="inline-flex items-center gap-2 rounded-full bg-[#26352C] text-[#F4EEE3] px-6 h-12 text-sm font-medium hover:bg-[#1C2821]">Explorar peças <ArrowRight className="h-4 w-4" /></a>
            <a href="#lojas" className="inline-flex items-center rounded-full ring-1 ring-stone-300 px-6 h-12 text-sm font-medium hover:bg-white">Conhecer as lojas</a>
          </div>
        </div>
        <div className="lg:col-span-7 relative">
          <div className="grid grid-cols-5 gap-3 sm:gap-4">
            <img src={eliPhotos.cafe} alt="" className="col-span-3 aspect-[4/5] w-full object-cover rounded-2xl" />
            <div className="col-span-2 grid gap-3 sm:gap-4">
              <img src={eliPhotos.caracol} alt="" className="aspect-square w-full object-cover rounded-2xl" />
              <img src={eliPhotos.olivaProduto} alt="" className="aspect-square w-full object-cover rounded-2xl" />
            </div>
          </div>
          <Link href={`/s/${featured.slug}`} className="absolute -bottom-6 left-4 sm:left-6 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-xl ring-1 ring-stone-200 hover:ring-stone-400">
            <img src={featured.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-stone-500">Loja em destaque</p>
              <p className="font-medium">{featured.name} <span className="text-stone-400 font-normal">· {featured.city}</span></p>
            </div>
          </Link>
        </div>
      </section>

      {/* Categorias */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-6">
        <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x">
          {categories.map((c) => (
            <a key={c.slug} href="#" className="group snap-start shrink-0 w-[42%] sm:w-auto sm:flex-1">
              <div className="aspect-[4/5] overflow-hidden rounded-xl"><img src={c.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div>
              <p className="mt-2 text-sm font-medium flex items-center gap-1">{c.name} <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0" /></p>
            </a>
          ))}
        </div>
      </section>

      {/* Escolhas da semana */}
      <section id="escolhas" className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-[family-name:var(--font-proto-serif)] text-3xl sm:text-4xl">Escolhas da semana</h2>
          <a href="#" className="text-sm underline underline-offset-4">Ver tudo</a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6">
          {products.slice(0, 8).map((p) => <ProductCardA key={p.id} p={p} />)}
        </div>
      </section>

      {/* Loja em destaque */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-2 overflow-hidden rounded-3xl bg-[#EDE6D8]">
          <div className="relative min-h-[320px] lg:min-h-0">
            <VideoEmbed className="absolute inset-0" rounded="rounded-none" />
          </div>
          <div className="p-8 sm:p-12 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <img src={featured.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
              <div>
                <p className="font-medium">{featured.name}</p>
                <p className="text-xs text-stone-600 flex items-center gap-1"><Star className="h-3 w-3 fill-current" />{featured.rating} · {featured.sales} vendas · {featured.city}</p>
              </div>
            </div>
            <h3 className="mt-6 font-[family-name:var(--font-proto-serif)] text-3xl sm:text-4xl leading-tight">“Cada peça leva de 6 a 20 horas de nós. Nenhuma sai igual à outra.”</h3>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {featuredProducts.map((p) => (
                <div key={p.id}>
                  <img src={p.image} alt={p.name} className="aspect-square w-full rounded-lg object-cover" />
                  <p className="mt-1.5 text-xs text-stone-700 truncate">{p.name}</p>
                  <p className="text-xs font-semibold">{brl(p.price)}</p>
                </div>
              ))}
            </div>
            <Link href={`/s/${featured.slug}`} className="mt-8 self-start inline-flex items-center gap-2 rounded-full bg-stone-900 text-white px-6 h-11 text-sm font-medium">Visitar a loja <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Lojas */}
      <section id="lojas" className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <h2 className="font-[family-name:var(--font-proto-serif)] text-3xl sm:text-4xl mb-6">Lojas para conhecer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stores.map((s) => (
            <Link key={s.slug} href={`/s/${s.slug}`} className="group rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden hover:ring-stone-400">
              <div className="h-28 overflow-hidden"><img src={s.cover} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /></div>
              <div className="px-4 pb-4 -mt-6">
                <img src={s.avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-4 ring-white" />
                <p className="mt-2 font-medium">{s.name}</p>
                <p className="text-sm text-stone-500">{s.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Garantias */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
          {[
            [QrCode, "Pix com 5% off", "Aprovação na hora"],
            [Truck, "Frete na hora", "Cotação Melhor Envio"],
            [ShieldCheck, "Compra protegida", "Seu dinheiro garantido"],
            [Hand, "Direto do artesão", "Sem intermediários"],
          ].map(([Icon, t, d]: any) => (
            <div key={t} className="flex items-start gap-3"><Icon className="h-5 w-5 text-[#26352C] mt-0.5" /><div><p className="font-medium">{t}</p><p className="text-stone-500">{d}</p></div></div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-stone-600">
        <div className="col-span-2 md:col-span-1 font-[family-name:var(--font-proto-serif)] text-xl text-stone-900"><PlatformMark /></div>
        <div className="space-y-2"><p className="text-stone-900 font-medium">Comprar</p><p>Categorias</p><p>Lojas</p><p>Meus pedidos</p></div>
        <div className="space-y-2"><p className="text-stone-900 font-medium">Vender</p><p>Abrir minha loja</p><p>Taxas e repasse</p><p>Para empresas (white-label)</p></div>
        <div className="space-y-2"><p className="text-stone-900 font-medium">Ajuda</p><p>Trocas e devoluções</p><p>Termos</p><p>Privacidade</p></div>
      </footer>
    </div>
  );
}
