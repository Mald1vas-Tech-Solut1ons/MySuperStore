"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { Instagram, MessageCircle, ArrowUpRight } from "lucide-react";
import { brand, whatsappLink, legalDocumentLabel, hasLegalInfo } from "@/config/brand";
import { isSingleStore } from "@/config/storeMode";

const helpLinks = [
  { label: "Trocas e devoluções", href: "/terms" },
  { label: "Privacidade", href: "/privacy" },
  { label: "Termos", href: "/terms" },
];

export function SiteFooter() {
  const whats = whatsappLink("Olá!");
  const year = new Date().getFullYear();
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay rounded-sm";
  const headingClass = "text-[11px] uppercase tracking-[0.3em] text-atelie-cream/50 font-atelie";
  const linkClass = `text-atelie-cream/75 hover:text-atelie-cream transition-colors ${focusRing}`;
  const creditClass = `text-atelie-cream/50 hover:text-atelie-cream/80 transition-colors ${focusRing}`;

  // Rodapé legal (Decreto 7.962/2013): só os campos preenchidos, separados por " · ".
  const legalParts: ReactNode[] = [
    brand.legal.name,
    legalDocumentLabel(brand.legal.document),
    brand.legal.address,
    brand.legal.email ? (
      <a href={`mailto:${brand.legal.email}`} className={linkClass}>
        {brand.legal.email}
      </a>
    ) : "",
  ].filter(Boolean);

  return (
    <footer className="bg-atelie-espresso text-atelie-cream/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 sm:gap-8">
          <div className="font-atelie">
            <p className="font-serif text-2xl text-atelie-cream">{brand.name}</p>
            <p className="mt-3 text-sm leading-relaxed text-atelie-cream/70 max-w-xs">{brand.tagline}</p>
            <p className="mt-4 text-sm text-atelie-cream/60">{brand.location}</p>
            <p className="mt-1 text-sm text-atelie-cream/60">{brand.shipping}</p>
          </div>

          <nav aria-label="Comprar" className="font-atelie">
            <p className={headingClass}>Comprar</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {brand.nav.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={linkClass}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Ajuda" className="font-atelie">
            <p className={headingClass}>Ajuda</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {helpLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={linkClass}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="font-atelie">
            <p className={headingClass}>Contato</p>
            <ul className="mt-4 space-y-3 text-sm">
              {whats ? (
                <li>
                  <a href={whats} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 ${linkClass}`}>
                    <MessageCircle className="h-4 w-4 text-atelie-terracotta" aria-hidden="true" />
                    Falar no WhatsApp
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </li>
              ) : (
                <li className="text-atelie-cream/60">Atendimento pelo WhatsApp em breve</li>
              )}
              {brand.instagram ? (
                <li>
                  <a href={`https://instagram.com/${brand.instagram}`} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 ${linkClass}`}>
                    <Instagram className="h-4 w-4 text-atelie-terracotta" aria-hidden="true" />
                    @{brand.instagram.replace(/^@/, "")}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {hasLegalInfo && (
          <address className="not-italic mt-10 font-atelie text-xs leading-relaxed text-atelie-cream/55">
            {legalParts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {part}
              </Fragment>
            ))}
          </address>
        )}

        <div className="mt-12 border-t border-white/10 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-atelie text-xs text-atelie-cream/60">
          <p>© {year} {brand.fullName}</p>
          {!isSingleStore ? (
            <Link href="/white-label" className={creditClass}>
              Plataforma MySuperStore
            </Link>
          ) : brand.credit.url ? (
            <a href={brand.credit.url} target="_blank" rel="noopener noreferrer" className={creditClass}>
              {brand.credit.label}
            </a>
          ) : (
            <span className="text-atelie-cream/50">{brand.credit.label}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
