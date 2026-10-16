"use client";

import { useAuthStore } from "@/store/authStore";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, Heart, User, LogOut, Sparkles, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, logout, user, _hydrated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (_hydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router, _hydrated]);

  if (!_hydrated || !isAuthenticated) return null;

  const tabs = [
    { name: "Minha Conta", href: "/dashboard/account", icon: User },
    { name: "Pedidos", href: "/dashboard/orders", icon: ShoppingBag },
    { name: "Favoritos", href: "/dashboard/wishlist", icon: Heart },
    { name: "Universo (Recap)", href: "/dashboard", icon: Sparkles, exact: true },
  ];

  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* ── Mobile: tab bar no topo, logo abaixo do header ── */}
      <div className="md:hidden sticky top-16 z-40 bg-background backdrop-blur-xl border-b border-border">
        {/* User identity strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/30 shrink-0">
            {initials || <User className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="ml-auto shrink-0 text-[10px] text-muted-foreground flex items-center gap-1 hover:text-destructive transition-colors"
          >
            <LogOut className="h-3 w-3" /> Sair
          </button>
        </div>

        {/* Horizontal scrollable tabs */}
        <div className="flex overflow-x-auto scrollbar-hide px-2 gap-1 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col md:flex-row gap-6 md:gap-8">

        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="p-6 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm sticky top-24">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-border/30">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary border border-primary/30 shrink-0">
                {initials || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-md"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {tab.name}
                    </span>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="mt-6 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sair da Conta
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-grow min-w-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
