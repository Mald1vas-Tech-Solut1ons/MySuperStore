// Paleta configurável: os tokens Tailwind atelie-* leem CSS vars em canais RGB (--brand-*),
// com o padrão do Ateliê em globals.css. Aqui só se gera o CSS que sobrescreve o que vier por env.
export type Token = "cream" | "wall" | "sand" | "clay" | "terracotta" | "olive" | "espresso" | "ink";

// Leitura literal (exigência do Next.js para embutir NEXT_PUBLIC_* no bundle).
const ENV: Record<Token, string | undefined> = {
  cream: process.env.NEXT_PUBLIC_COLOR_BG,
  wall: process.env.NEXT_PUBLIC_COLOR_BG_ALT,
  sand: process.env.NEXT_PUBLIC_COLOR_SURFACE,
  clay: process.env.NEXT_PUBLIC_COLOR_PRIMARY,
  terracotta: process.env.NEXT_PUBLIC_COLOR_ACCENT,
  olive: process.env.NEXT_PUBLIC_COLOR_SECONDARY,
  espresso: process.env.NEXT_PUBLIC_COLOR_DARK,
  ink: process.env.NEXT_PUBLIC_COLOR_TEXT,
};

// Valores atuais (os mesmos de globals.css).
export const PALETTE_DEFAULTS: Record<Token, string> = {
  cream: "#F4EDE3",
  wall: "#EFE6D8",
  sand: "#E8DCCA",
  clay: "#A65A3A",
  terracotta: "#C47A55",
  olive: "#5B6146",
  espresso: "#2A211B",
  ink: "#1F1A17",
};

// "#abc" | "A65A3A" | "#A65A3A" → [r, g, b]; inválido → null.
function parseHex(hex: string | undefined): [number, number, number] | null {
  const t = (hex ?? "").trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return null;
  const full = t.length === 3 ? t.replace(/./g, (c) => c + c) : t;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

// "#A65A3A" → "166 90 58"; inválido → null.
export function hexToRgbChannels(hex: string): string | null {
  const rgb = parseHex(hex);
  return rgb ? rgb.join(" ") : null;
}

// "#A65A3A" → "18 48% 44%" (formato das vars shadcn); inválido → null.
export function hexToHslChannels(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ":root{...}" só com as envs válidas; nenhuma → "" (nada é injetado, o site fica como está).
export function paletteCss(): string {
  const decls: string[] = [];
  (Object.keys(ENV) as Token[]).forEach((token) => {
    const rgb = hexToRgbChannels(ENV[token] ?? "");
    if (rgb) decls.push(`--brand-${token}:${rgb};`);
  });
  // Mantém os componentes shadcn (bg-background, text-primary…) na mesma paleta.
  const hsl = (t: Token) => hexToHslChannels(ENV[t] ?? "");
  const bg = hsl("cream");
  const text = hsl("ink");
  const primary = hsl("clay");
  const surface = hsl("sand");
  if (bg) decls.push(`--background:${bg};`);
  if (text) decls.push(`--foreground:${text};`);
  if (primary) decls.push(`--primary:${primary};`, `--ring:${primary};`);
  if (surface) decls.push(`--secondary:${surface};`);
  return decls.length ? `:root{${decls.join("")}}` : "";
}

// Cor da barra do navegador/PWA: fundo da env (se válido) ou o creme atual.
const bgRgb = parseHex(ENV.cream);
export const themeColor = bgRgb
  ? `#${bgRgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase()
  : PALETTE_DEFAULTS.cream;
