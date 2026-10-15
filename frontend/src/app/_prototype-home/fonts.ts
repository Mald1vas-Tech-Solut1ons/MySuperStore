// PROTOTYPE — fontes candidatas para o redesign (carregadas só quando uma variante é aberta).
import { DM_Sans, Fraunces, Manrope } from "next/font/google";

export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-proto-serif", display: "swap", axes: ["SOFT", "opsz"] });
export const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-proto-sans", display: "swap" });
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-proto-grotesk", display: "swap" });

export const protoFonts = `${fraunces.variable} ${dmSans.variable} ${manrope.variable}`;
