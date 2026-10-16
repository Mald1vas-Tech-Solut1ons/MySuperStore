"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useToast } from "@/components/ui/Toast";
import { isPushSupported, isStandalone, subscribeToPush } from "@/lib/push";

const DISMISS_KEY = "mss_push_optin_dismissed";

/**
 * Banner discreto que convida o usuário a ativar notificações.
 * Só aparece quando: logado, push suportado, app instalado (standalone) e
 * permissão ainda não decidida. O clique no botão é o gesto que o iOS exige.
 */
export function NotificationOptIn() {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isPushSupported()) return;
    if (Notification.permission !== "default") return; // já concedeu ou bloqueou
    // No iOS o push exige o app instalado; fora disso, não adianta mostrar.
    if (!isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, [isAuthenticated]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        toast("Notificações ativadas! 🔔", "success");
        setVisible(false);
      } else {
        toast("Permissão de notificações não concedida.", "error");
        if (Notification.permission === "denied") setVisible(false);
      }
    } catch {
      toast("Não foi possível ativar as notificações.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-primary/25 bg-background p-4 shadow-2xl backdrop-blur md:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Ative as notificações</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Receba avisos de pedidos, vendas e entregas em tempo real, como um app nativo.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Ativando..." : "Ativar"}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-full px-4 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
