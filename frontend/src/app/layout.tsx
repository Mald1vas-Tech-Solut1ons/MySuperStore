import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Inter, Sora, Space_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Fraunces + DM Sans — tipografia da vitrine artesanal (home do Ateliê)
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "opsz"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap" });

// Sora — fonte display da marca Saturno (títulos, wordmark)
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Space Mono — fonte técnica/labels da marca
const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MySuperStore — O Centro da Gravidade Comercial",
    template: "%s | MySuperStore",
  },
  description: "Explore um universo multi-vendedor com split financeiro automatizado e uma experiência de compra que transcende qualquer expectativa terrestre.",
  manifest: "/manifest.json",
  // Ícones — o apple-touch-icon é obrigatório para o iOS instalar o PWA na tela de início.
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Faz o Safari/iOS tratar o site como um app standalone (pré-requisito do Web Push no iOS).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MySuperStore",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "MySuperStore",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "MySuperStore Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MySuperStore — O Centro da Gravidade Comercial",
    description: "Explore um universo multi-vendedor.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0C0B11",
  width: "device-width",
  initialScale: 1,
  // Permite que o app use a área toda em telas com notch quando instalado (standalone).
  viewportFit: "cover",
};

import { ToastProvider } from "@/components/ui/Toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BottomNav } from "@/components/BottomNav";
import { AuthProvider } from "@/components/AuthProvider";
import { PWARegistry } from "@/components/PWARegistry";
import { NotificationOptIn } from "@/components/NotificationOptIn";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${spaceMono.variable} ${fraunces.variable} ${dmSans.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "1019190620170-a86680qpdbrjgu1vk31st0lts4ju3cm5.apps.googleusercontent.com"}>
            <ToastProvider>
              <AuthProvider>
                {/* pb-20 no mobile garante que o conteúdo não fica atrás da BottomNav */}
                <div className="pb-20 md:pb-0">
                  {children}
                </div>
                <BottomNav />
                <PWARegistry />
                <NotificationOptIn />
              </AuthProvider>
            </ToastProvider>
          </GoogleOAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
