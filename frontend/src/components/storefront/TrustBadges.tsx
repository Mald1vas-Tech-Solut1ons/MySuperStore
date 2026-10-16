import { Lock, Landmark, QrCode, RotateCcw, Truck, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { brand } from "@/config/brand";

// Selos de confiança: só afirmações verdadeiras (nada de "certificado"/"blindado").
type Badge = { icon: LucideIcon; title: string; description: string };

const BADGES: readonly Badge[] = [
  { icon: Lock, title: "Site protegido", description: "Conexão criptografada (HTTPS)" },
  { icon: Landmark, title: "Pagamento via Efí Bank", description: "Instituição autorizada pelo Banco Central" },
  { icon: QrCode, title: "Pix ou cartão", description: "Aprovação do Pix na hora" },
  { icon: RotateCcw, title: "Troca em até 7 dias", description: "Direito de arrependimento (CDC)" },
  { icon: Truck, title: "Envio rastreado", description: "Para todo o Brasil" },
  { icon: MessageCircle, title: "Atendimento humano", description: `Fale com o ${brand.shopNoun} no WhatsApp` },
];

export function TrustBadges({ variant = "row", className = "" }: { variant?: "row" | "compact"; className?: string }) {
  if (variant === "compact") {
    return (
      <ul aria-label="Garantias de compra" className={`space-y-2 ${className}`}>
        {BADGES.map(({ icon: Icon, title }) => (
          <li key={title} className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-atelie-clay" aria-hidden="true" />
            <span className="text-[12px] text-atelie-ink/80">{title}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label="Garantias de compra" className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 ${className}`}>
      {BADGES.map(({ icon: Icon, title, description }) => (
        <li key={title} className="flex items-start gap-2.5 rounded-2xl bg-white/60 p-3 ring-1 ring-black/5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-atelie-cream">
            <Icon className="h-4 w-4 text-atelie-clay" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium text-atelie-ink">{title}</span>
            <span className="text-[11px] leading-snug text-atelie-ink/60">{description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
