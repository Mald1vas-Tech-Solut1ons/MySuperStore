"use client";

// PROTOTYPE — três direções para a home do marketplace, alternáveis via ?variant= na rota "/".
// "atual" = home de hoje (baseline para comparação). Removido do main quando uma direção vencer.
import { PrototypeSwitcher } from "@/components/prototype/PrototypeSwitcher";
import { protoFonts } from "./fonts";
import VariantA, { name as nameA } from "./VariantA";
import VariantB, { name as nameB } from "./VariantB";
import VariantC, { name as nameC } from "./VariantC";

export const PROTO_VARIANTS = [
  { key: "atual", label: "Home atual" },
  { key: "A", label: nameA },
  { key: "B", label: nameB },
  { key: "C", label: nameC },
];

export function isProtoVariant(v: string | null): v is "atual" | "A" | "B" | "C" {
  return process.env.NODE_ENV !== "production" && !!v && PROTO_VARIANTS.some((x) => x.key === v);
}

export function ProtoHome({ variant }: { variant: "A" | "B" | "C" }) {
  return (
    <div className={protoFonts}>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={PROTO_VARIANTS} current={variant} />
    </div>
  );
}
