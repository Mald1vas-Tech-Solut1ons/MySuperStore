"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, MailCheck, Store } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { OfficialLogo } from "@/components/Brand";

type Status = "loading" | "success" | "error";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const { isAuthenticated, updateUser } = useAuthStore();

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Confirmando seu e-mail...");
  const ran = useRef(false);

  useEffect(() => {
    // Evita dupla execução no StrictMode (o token só pode ser consumido uma vez).
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Link inválido: token ausente.");
      return;
    }

    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.data?.detail || "E-mail confirmado com sucesso!");
        // Atualiza o estado local para liberar a abertura de loja imediatamente.
        if (isAuthenticated) {
          updateUser({ email_verified: true });
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err.response?.data?.detail ||
            "Não foi possível confirmar seu e-mail. O link pode ter expirado."
        );
      });
  }, [token, isAuthenticated, updateUser]);

  return (
    <div className="min-h-screen bg-background text-neutral-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#E6B53C]/10 blur-[150px] pointer-events-none" />

      <OfficialLogo className="w-[200px] h-auto mb-10 drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]" />

      <div className="relative z-10 w-full max-w-md bg-background border border-border rounded-3xl p-8 md:p-10 text-center shadow-2xl">
        {status === "loading" && (
          <>
            <Loader2 className="w-14 h-14 text-[#E6B53C] mx-auto mb-5 animate-spin" />
            <h1 className="text-2xl font-black text-foreground mb-2">Confirmando...</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-2">E-mail confirmado!</h1>
            <p className="text-muted-foreground mb-8">{message}</p>
            <div className="flex flex-col gap-3">
              <Link
                href="/seller/onboarding"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#E6B53C] to-[#B38F25] text-black font-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Store className="w-5 h-5" /> Abrir minha loja
              </Link>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                Voltar para a loja
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-9 h-9 text-red-400" />
            </div>
            <h1 className="text-2xl font-black text-foreground mb-2">Não rolou</h1>
            <p className="text-muted-foreground mb-8">{message}</p>
            <div className="flex flex-col gap-3">
              <Link
                href="/seller/onboarding"
                className="w-full py-3.5 rounded-xl bg-black/[0.04] border border-border text-foreground font-bold hover:bg-black/[0.04] transition-colors flex items-center justify-center gap-2"
              >
                <MailCheck className="w-5 h-5" /> Reenviar confirmação
              </Link>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                Voltar para a loja
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
