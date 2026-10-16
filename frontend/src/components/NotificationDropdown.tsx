"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, ShoppingBag, MessageSquare, Package } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    notifications, 
    unreadCount, 
    fetchNotifications, 
    markAllAsRead, 
    connectWebSocket, 
    disconnectWebSocket 
  } = useNotificationStore();
  
  const { isAuthenticated, accessToken, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectWebSocket(accessToken);
    } else {
      disconnectWebSocket();
    }
    
    // Fallback polling for robust delivery (1 min)
    const interval = setInterval(() => {
      if (isAuthenticated) fetchNotifications();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, accessToken, connectWebSocket, disconnectWebSocket, fetchNotifications]);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = (type: string, id: string | null) => {
    setOpen(false);
    if (type === "order" || type === "seller_order") {
      if (user?.role === "seller" || user?.role === "admin" || (typeof window !== "undefined" && window.location.pathname.includes("/seller"))) {
        router.push(`/seller/dashboard/orders`);
      } else {
        router.push(`/dashboard/orders`);
      }
    } else if (type === "chat") {
      if (user?.role === "seller" || user?.role === "admin" || (typeof window !== "undefined" && window.location.pathname.includes("/seller"))) {
         router.push(`/seller/dashboard/chats`);
      } else {
         router.push(`/dashboard`);
      }
    } else if (type === "promo") {
      // id contém o slug do produto
      if (id) router.push(`/product/${id}`);
      else router.push(`/super-ofertas`);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full hover:bg-black/[0.04] text-muted-foreground hover:text-foreground transition-colors relative group"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="absolute top-14 right-0 scale-0 group-hover:scale-100 transition-all bg-black/5 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50">
          Notificações
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-black/[0.04]">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notificações
              </h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Marcar lidas
                </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <Bell className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-sm">Você não tem novas notificações.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.slice(0, 10).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif.type, notif.related_entity_id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex gap-3 ${
                        notif.is_read 
                          ? "hover:bg-white/5 opacity-70" 
                          : "bg-primary/5 hover:bg-primary/10 border border-primary/10"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        notif.type === 'order' ? 'bg-blue-500/20 text-blue-400' :
                        notif.type === 'chat' ? 'bg-green-500/20 text-green-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {notif.type === 'order' ? <Package className="w-5 h-5" /> :
                         notif.type === 'chat' ? <MessageSquare className="w-5 h-5" /> :
                         <Bell className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${notif.is_read ? "text-neutral-300" : "text-white"}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          {new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-2 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {notifications.length > 10 && (
              <div className="p-3 border-t border-border text-center bg-black/[0.04]">
                <span className="text-xs text-muted-foreground">Mostrando as 10 mais recentes.</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
