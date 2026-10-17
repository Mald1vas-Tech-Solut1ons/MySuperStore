import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Design tokens do MySuperStore
        brand: {
          50: "#fef3f2",
          100: "#fee4e2",
          200: "#fecdca",
          300: "#fca5a1",
          400: "#f97066",
          500: "#f04438",  // cor primária
          600: "#d92d20",
          700: "#b42318",
          800: "#912018",
          900: "#7a271a",
          950: "#55160c",
        },
        neutral: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
          950: "#030712",
        },
        success: { DEFAULT: "#16a34a", light: "#dcfce7" },
        warning: { DEFAULT: "#d97706", light: "#fef3c7" },
        error: { DEFAULT: "#dc2626", light: "#fee2e2" },
        // Vitrine da loja: CSS vars em canais RGB (padrão do Ateliê em globals.css,
        // sobrescritas por NEXT_PUBLIC_COLOR_* via src/config/palette.ts).
        atelie: {
          cream: "rgb(var(--brand-cream) / <alpha-value>)",
          sand: "rgb(var(--brand-sand) / <alpha-value>)",
          wall: "rgb(var(--brand-wall) / <alpha-value>)",
          clay: "rgb(var(--brand-clay) / <alpha-value>)",
          terracotta: "rgb(var(--brand-terracotta) / <alpha-value>)",
          olive: "rgb(var(--brand-olive) / <alpha-value>)",
          espresso: "rgb(var(--brand-espresso) / <alpha-value>)",
          ink: "rgb(var(--brand-ink) / <alpha-value>)",
        },
        // Paleta da marca Saturno (ouro premium)
        saturn: {
          50: "#FCE6A0",
          100: "#F6D26A",
          200: "#E6B53C",  // ouro principal
          300: "#D2A23A",
          400: "#B98A2A",  // ouro profundo / accent
          500: "#A4711B",
          600: "#7A5E26",
          ring: "#7C7568",
          ink: "#0C0B11",   // fundo da marca
          surface: "#1A1626",
          paper: "#F3EFE6",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        atelie: ["var(--font-dmsans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
