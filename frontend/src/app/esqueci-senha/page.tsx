"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { api } from "@/lib/api";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { WallBackdrop } from "@/components/storefront/WallBackdrop";

// Pedido de recuperação de senha: a resposta é sempre a mesma (não revela se o e-mail existe).
export default function Page() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/password-reset/", { email });
      setSent(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(
        status === 429
          ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
          : "Não foi possível enviar agora. Tente novamente em instantes.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <WallBackdrop className="min-h-screen font-atelie text-atelie-ink">
      <SiteHeader />
      <main className="mx-4 mt-12 rounded-3xl bg-white/80 p-8 shadow-xl ring-1 ring-black/5 sm:mx-auto sm:max-w-md sm:p-10">
        {sent ? (
          <div className="flex flex-col items-center text-center">
            <MailCheck className="h-12 w-12 text-atelie-clay" aria-hidden="true" />
            <h1 className="mt-4 font-serif text-4xl">Confira seu e-mail</h1>
            <p className="mt-3 text-sm text-atelie-ink/80">
              Se houver uma conta com {email}, você receberá um link em alguns minutos. O link vale por 2 horas. Olhe
              também a caixa de spam.
            </p>
            <Link href="/login" className="mt-6 text-sm font-medium text-atelie-clay hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-4xl">Esqueceu a senha?</h1>
            <p className="mt-3 text-sm text-atelie-ink/80">
              Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para criar uma nova senha.
            </p>
            {error && (
              <div role="alert" className="mt-6 rounded-2xl border border-atelie-clay/30 bg-atelie-clay/10 p-3 text-sm text-atelie-clay">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm text-atelie-ink/80">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-atelie-clay"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-atelie-ink font-medium text-atelie-cream hover:bg-atelie-clay disabled:opacity-60"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                Enviar link
              </button>
            </form>
            <p className="mt-6 text-center text-sm">
              <Link href="/login" className="font-medium text-atelie-clay hover:underline">Lembrei a senha</Link>
            </p>
          </>
        )}
      </main>
      <p className="mx-auto mt-4 pb-16 text-center text-xs text-atelie-ink/50">Seus dados são protegidos com criptografia.</p>
    </WallBackdrop>
  );
}
