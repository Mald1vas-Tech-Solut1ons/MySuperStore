"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { WallBackdrop } from "@/components/storefront/WallBackdrop";

type ResetError = { response?: { status?: number; data?: { new_password?: string[]; detail?: string } } };

const inputCls =
  "h-12 w-full rounded-2xl bg-white px-4 pr-12 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-atelie-clay";

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-atelie-ink/80">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-atelie-ink/60 hover:text-atelie-ink"
        >
          {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function Content() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredLink, setExpiredLink] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uid || !token) return;
    setError(null);
    setExpiredLink(false);
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmation) return setError("As senhas não são iguais.");

    setLoading(true);
    try {
      await api.post("/auth/password-reset/confirm/", { uid, token, new_password: password });
      setDone(true);
    } catch (err) {
      const { status, data } = (err as ResetError).response ?? {};
      if (status === 429) setError("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
      else if (status === 400 && data?.new_password?.length) setError(data.new_password.join(" "));
      else if (status === 400 && data?.detail) {
        setError(data.detail);
        setExpiredLink(true);
      } else if (status === 400) {
        setError("Este link expirou ou já foi usado. Peça um novo.");
        setExpiredLink(true);
      } else setError("Não foi possível salvar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WallBackdrop className="min-h-screen font-atelie text-atelie-ink">
      <SiteHeader />
      <main className="mx-4 mt-12 rounded-3xl bg-white/80 p-8 shadow-xl ring-1 ring-black/5 sm:mx-auto sm:max-w-md sm:p-10">
        {!uid || !token ? (
          <div className="flex flex-col items-center text-center">
            <h1 className="font-serif text-3xl">Link inválido ou incompleto.</h1>
            <Link href="/esqueci-senha" className="mt-6 text-sm font-medium text-atelie-clay hover:underline">Pedir um novo link</Link>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-atelie-clay" aria-hidden="true" />
            <h1 className="mt-4 font-serif text-4xl">Senha alterada!</h1>
            <p className="mt-3 text-sm text-atelie-ink/80">Agora é só entrar com a nova senha.</p>
            <Link
              href="/login"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-atelie-ink font-medium text-atelie-cream hover:bg-atelie-clay"
            >
              Entrar
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-4xl">Crie uma nova senha</h1>
            {error && (
              <div role="alert" className="mt-6 rounded-2xl border border-atelie-clay/30 bg-atelie-clay/10 p-3 text-sm text-atelie-clay">
                {error}
                {expiredLink && <Link href="/esqueci-senha" className="ml-1 font-medium underline">Pedir um novo link</Link>}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <PasswordField id="new_password" label="Nova senha" value={password} onChange={setPassword} />
              <PasswordField id="confirm_password" label="Confirmar senha" value={confirmation} onChange={setConfirmation} />
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-atelie-ink font-medium text-atelie-cream hover:bg-atelie-clay disabled:opacity-60"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                Salvar nova senha
              </button>
            </form>
          </>
        )}
      </main>
      <p className="mx-auto mt-4 pb-16 text-center text-xs text-atelie-ink/50">Seus dados são protegidos com criptografia.</p>
    </WallBackdrop>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
