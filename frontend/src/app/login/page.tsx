"use client";

export const dynamic = "force-dynamic";


import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { motion } from "framer-motion";
import { LogIn, Lock, Loader2, AlertCircle } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { WallBackdrop } from "@/components/storefront/WallBackdrop";
import { SiteHeader } from "@/components/storefront/SiteHeader";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-atelie-clay" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || null;
  const loginStore = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await authApi.login(email, password);

      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      const userRes = await authApi.me();
      loginStore(data, userRes.data);

      router.push(nextPath || (userRes.data.is_seller ? "/seller/dashboard" : "/"));
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Email ou senha incorretos.");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      const { data } = await authApi.googleLogin(credentialResponse.credential);
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      loginStore({ access: data.access, refresh: data.refresh }, data.user);
      router.push(nextPath || (data.user.is_seller ? "/seller/dashboard" : "/"));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro no login do Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WallBackdrop className="min-h-screen font-atelie text-atelie-ink">
      <SiteHeader />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mx-4 mt-12 rounded-3xl bg-white/80 p-8 shadow-xl ring-1 ring-black/5 sm:mx-auto sm:max-w-md sm:p-10"
      >
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl">Entrar</h1>
          <p className="mt-2 text-sm text-atelie-ink/60">Acesse sua conta para acompanhar pedidos e favoritos.</p>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-center gap-2 rounded-2xl border border-atelie-clay/30 bg-atelie-clay/10 p-3 text-sm text-atelie-clay">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6 flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("O login com Google falhou.")}
            theme="outline"
            text="signin_with"
            shape="pill"
          />
        </div>

        <div className="relative mb-6 flex items-center">
          <div className="flex-grow border-t border-black/10"></div>
          <span className="mx-4 flex-shrink-0 text-xs text-atelie-ink/50">ou continue com e-mail</span>
          <div className="flex-grow border-t border-black/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm text-atelie-ink/80">E-mail</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu-email@exemplo.com"
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-black/10 placeholder:text-atelie-ink/40 focus:ring-2 focus:ring-atelie-clay"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm text-atelie-ink/80">Senha</label>
              <Link href="/esqueci-senha" className="text-xs text-atelie-clay hover:underline">Esqueceu a senha?</Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-black/10 placeholder:text-atelie-ink/40 focus:ring-2 focus:ring-atelie-clay"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-atelie-ink font-medium text-atelie-cream transition-colors hover:bg-atelie-clay disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-atelie-ink/60">
          Ainda não tem conta?{" "}
          <Link href="/register" className="text-atelie-clay hover:underline">Criar conta</Link>
        </p>
      </motion.div>

      <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 pb-16 text-xs text-atelie-ink/50">
        <Lock className="h-3.5 w-3.5" />
        <span>Seus dados são protegidos com criptografia.</span>
      </div>
    </WallBackdrop>
  );
}
