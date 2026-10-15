"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// "Parede descolada": cal/limewash com textura de ruído, luz de janela que deriva
// devagar e a sombra de um arco. Tudo decorativo e sem interação.
const NOISE_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='wall-noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23wall-noise)'/%3E%3C/svg%3E\")";

type LightSpot = {
  top: string;
  left: string;
  size: number;
  dx: number;
  dy: number;
  duration: number;
  rgb: string;
  alpha: number;
};

const LIGHT_SPOTS: LightSpot[] = [
  { top: "-14%", left: "-10%", size: 560, dx: 44, dy: 28, duration: 22, rgb: "255,241,209", alpha: 0.5 },
  { top: "24%", left: "58%", size: 460, dx: -42, dy: -30, duration: 19, rgb: "255,238,205", alpha: 0.38 },
  { top: "62%", left: "14%", size: 340, dx: 30, dy: -24, duration: 25, rgb: "255,248,231", alpha: 0.3 },
];

export function WallBackdrop({
  children,
  className,
  tone = "light",
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "warm";
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={[
        // overflow-clip (e não hidden): recorta as manchas de luz sem virar contêiner
        // de rolagem — senão o header e a barra de categorias perdem o sticky.
        "relative isolate overflow-clip",
        tone === "warm" ? "bg-atelie-sand" : "bg-atelie-wall",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: NOISE_TEXTURE, opacity: 0.18 }}
      />

      {LIGHT_SPOTS.map((spot, index) => (
        <motion.div
          key={index}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.size,
            height: spot.size,
            background: `radial-gradient(circle, rgba(${spot.rgb},${spot.alpha}) 0%, rgba(${spot.rgb},0) 70%)`,
          }}
          animate={reduceMotion ? undefined : { x: [0, spot.dx, 0], y: [0, spot.dy, 0] }}
          transition={{ duration: spot.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        className="pointer-events-none absolute right-0 top-0 h-56 w-56 text-atelie-espresso sm:h-80 sm:w-80"
        style={{ opacity: 0.06 }}
      >
        <path d="M200 0 L200 136 A136 136 0 0 1 64 0 Z" fill="currentColor" />
        <path d="M200 0 L200 96 A96 96 0 0 1 104 0" fill="none" stroke="currentColor" strokeWidth="10" />
      </svg>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
