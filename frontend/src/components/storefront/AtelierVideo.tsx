"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { brand, type Film } from "@/config/brand";
import { youtubeId } from "@/lib/storefront";

const steps = brand.video.steps;
const films = brand.video.films;

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
            {films.length > 0 ? (
              <BrandFilms films={films} />
            ) : (
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
            )}

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

// Filmes de marca: tocam mudos, em sequência, só enquanto a seção está na tela.
// Com "movimento reduzido" nada começa sozinho — o vídeo espera o clique.
function BrandFilms({ films }: { films: Film[] }) {
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const film = films[index];
  const paused = userPaused ?? Boolean(reduced);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    // Autoplay bloqueado pelo navegador: mostra o botão de play em vez de insistir.
    if (inView && !paused) v.play().catch(() => setUserPaused(true));
    else v.pause();
  }, [index, inView, paused, muted]);

  const goTo = (i: number) => {
    setIndex(i);
    setProgress(0);
  };
  const counter = films.length > 1 ? `${index + 1}/${films.length} · ` : "";
  const control =
    "grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay";

  return (
    <div ref={frameRef} className="relative aspect-video overflow-hidden rounded-[28px] bg-black shadow-2xl">
      <video
        key={film.src}
        ref={videoRef}
        src={film.src}
        poster={film.poster || undefined}
        aria-label={film.label || brand.video.caption}
        muted
        playsInline
        preload="metadata"
        loop={films.length === 1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        onEnded={() => goTo((index + 1) % films.length)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 to-transparent" />

      {/* Antes das barras e dos controles: o overlay de play não pode cobrir os botões. */}
      {!playing && paused && (
        <button
          type="button"
          onClick={() => setUserPaused(false)}
          aria-label={`Reproduzir vídeo: ${film.label || brand.video.caption}`}
          className="group absolute inset-0 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-atelie-clay"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 shadow-lg transition-transform duration-300 group-hover:scale-105">
            <Play className="ml-0.5 h-6 w-6 text-atelie-ink" fill="currentColor" />
          </span>
        </button>
      )}

      {films.length > 1 && (
        <div className="absolute inset-x-4 top-3 flex gap-2 sm:inset-x-6 sm:top-4">
          {films.map((f, i) => (
            <button
              key={f.src}
              type="button"
              onClick={() => {
                goTo(i);
                setUserPaused(false);
              }}
              aria-label={`Ver filme ${i + 1}: ${f.label || brand.video.caption}`}
              aria-current={i === index}
              className="flex-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay rounded-full"
            >
              <span className="block h-[3px] overflow-hidden rounded-full bg-white/30">
                <span
                  className="block h-full rounded-full bg-white transition-[width] duration-300 ease-linear"
                  style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
                />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-5 pb-4 sm:px-6 sm:pb-5">
        <p className="text-xs text-atelie-cream/90">
          <span className="text-atelie-cream/60">{counter}</span>
          {film.label || brand.video.caption}
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setUserPaused(!paused)} aria-label={paused ? "Reproduzir" : "Pausar"} className={control}>
            {paused ? <Play className="ml-0.5 h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </button>
          <button type="button" onClick={() => setMuted(!muted)} aria-label={muted ? "Ativar som" : "Desativar som"} aria-pressed={!muted} className={control}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
