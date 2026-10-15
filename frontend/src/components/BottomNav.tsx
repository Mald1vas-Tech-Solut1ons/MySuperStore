"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Zap, ShoppingCart, User, Bell, Check, Package, MessageSquare } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";

const HIDDEN_PREFIXES = ["/seller", "/admin", "/login", "/register", "/checkout", "/white-label", "/vender"];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { notifications, unreadCount, fetchNotifications, markAllAsRead } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);

  // Mantém o badge do sino atualizado no mobile (o NotificationDropdown só roda no Header desktop).
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  // A home do Ateliê tem navegação própria (menu em tela cheia); a barra inferior some nela.
  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const accountHref = isAuthenticated ? "/dashboard/account" : "/login";

  const handleNotifClick = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setNotifOpen((v) => !v);
  };

  const handleNotificationItem = (type: string, id: string | null) => {
    setNotifOpen(false);
    if (type === "order" || type === "seller_order") {
      router.push("/dashboard/orders");
    } else if (type === "chat") {
      router.push("/dashboard");
    } else if (type === "promo" && id) {
      router.push(`/product/${id}`);
    } else {
      router.push("/dashboard");
    }
  };

  const tabs = [
    { key: "home",    href: "/",              icon: Home,          label: "Início"   },
    { key: "offers",  href: "/?discount=10",  icon: Zap,           label: "Ofertas"  },
    { key: "cart",    href: "/cart",          icon: ShoppingCart,  label: "Carrinho" },
    { key: "alerts",  href: null as any,      icon: Bell,          label: "Alertas"  },
    { key: "account", href: accountHref,      icon: User,          label: "Conta"    },
  ];

  const activeKey =
    pathname === "/cart" ? "cart" :
    pathname.startsWith("/dashboard") ? "account" :
    pathname === "/" ? "home" : null;

  return (
    <>
      {/* Painel de notificações (desliza de baixo, acima da nav) */}
      <AnimatePresence>
        {notifOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="md:hidden fixed bottom-[60px] left-0 right-0 z-50 max-h-[60vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0F0F1A]"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#0F0F1A] p-4">
                <h3 className="flex items-center gap-2 font-bold text-white">
                  <Bell className="h-4 w-4 text-primary" /> Notificações
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    <Check className="h-3 w-3" /> Marcar lidas
                  </button>
                )}
              </div>
              <div className="p-2">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 text-center text-neutral-400">
                    <Bell className="mb-3 h-8 w-8 opacity-20" />
                    <p className="text-sm">Você não tem novas notificações.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.slice(0, 15).map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationItem(notif.type, notif.related_entity_id)}
                        className={`flex w-full gap-3 rounded-xl p-3 text-left transition-all ${
                          notif.is_read ? "opacity-70 hover:bg-white/5" : "border border-primary/10 bg-primary/5"
                        }`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          notif.type === "order" ? "bg-blue-500/20 text-blue-400" :
                          notif.type === "chat" ? "bg-green-500/20 text-green-400" :
                          "bg-purple-500/20 text-purple-400"
                        }`}>
                          {notif.type === "order" ? <Package className="h-5 w-5" /> :
                           notif.type === "chat" ? <MessageSquare className="h-5 w-5" /> :
                           <Bell className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${notif.is_read ? "text-neutral-300" : "text-white"}`}>
                            {notif.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{notif.message}</p>
                        </div>
                        {!notif.is_read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#050510]/96 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch justify-around h-[60px] px-1">
          {tabs.map(({ key, href, icon: Icon, label }) => {
            const isActive = key === activeKey;
            const isAlerts = key === "alerts";
            const badge =
              key === "cart" && itemCount > 0 ? itemCount :
              isAlerts && unreadCount > 0 ? unreadCount : 0;

            const inner = (
              <>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors duration-150 ${
                      isActive || (isAlerts && notifOpen) ? "text-primary" : "text-neutral-500"
                    }`}
                  />
                  {badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2 text-[9px] font-black h-[15px] min-w-[15px] px-0.5 rounded-full flex items-center justify-center leading-none ${
                      isAlerts ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"
                    }`}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold leading-none transition-colors duration-150 ${
                    isActive || (isAlerts && notifOpen) ? "text-primary" : "text-neutral-500"
                  }`}
                >
                  {label}
                </span>
              </>
            );

            const className =
              "relative flex flex-col items-center justify-center gap-[3px] flex-1 h-full outline-none";

            // A aba "Alertas" é um botão (abre painel), as demais são links.
            if (isAlerts) {
              return (
                <button key={key} onClick={handleNotifClick} aria-label={label} className={className}>
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={key}
                href={href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={className}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
