"use client";

export const dynamic = "force-dynamic";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { WallBackdrop } from "@/components/storefront/WallBackdrop";
import { useAuthStore } from "@/store/authStore";
import { authApi, crmApi } from "@/lib/api";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, User, Phone, Loader2, AlertCircle, CreditCard, Store, Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

export default function RegisterPage() {
  const router = useRouter();
  const loginStore = useAuthStore((state) => state.login);
  
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personType, setPersonType] = useState("PF");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGateway, setShowGateway] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.match(/[a-z]/) && pwd.match(/[A-Z]/)) score += 1;
    if (pwd.match(/\d/)) score += 1;
    if (pwd.match(/[^a-zA-Z\d]/)) score += 1;

    if (score <= 1) return { label: "Fraca (Inapta)", bg: "bg-red-500", text: "text-red-500", width: "w-1/4", valid: false };
    if (score === 2) return { label: "Razoável (Inapta)", bg: "bg-yellow-500", text: "text-yellow-500", width: "w-2/4", valid: false };
    if (score === 3) return { label: "Boa (Apta)", bg: "bg-green-400", text: "text-green-400", width: "w-3/4", valid: true };
    return { label: "Forte (Apta)", bg: "bg-green-600", text: "text-green-600", width: "w-full", valid: true };
  };

  const strength = getPasswordStrength(password);

  const formatCpfCnpj = (value: string, type: string) => {
    const digits = value.replace(/\D/g, "");
    if (type === "PF") {
      return digits
        .substring(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2");
    } else {
      return digits
        .substring(0, 14)
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})/, "$1-$2");
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      const { data } = await authApi.googleLogin(credentialResponse.credential, "customer");
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      loginStore({ access: data.access, refresh: data.refresh }, data.user);
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro no login do Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfCnpj(formatCpfCnpj(e.target.value, personType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("As senhas não conferem.");
      return;
    }

    try {
      await crmApi.createLead({
        name: `${firstName} ${lastName}`.trim(),
        email: email,
        phone: phone.replace(/\D/g, ''),
        funnel_type: "comprador",
        source: "Register Gateway Abanado"
      });
    } catch (err) {
      console.warn("Silent capture fail:", err);
    }

    setShowGateway(true);
  };

  const executeRegistration = async () => {
    setLoading(true);
    setShowGateway(false);

    try {
      const payload = {
        email,
        first_name: firstName,
        last_name: lastName,
        person_type: personType,
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        phone: phone.replace(/\D/g, ''),
        role: "customer",
        password,
        password_confirm: passwordConfirm,
      };

      const { data } = await authApi.register(payload);
      
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      const userRes = await authApi.me();
      loginStore({ access: data.access, refresh: data.refresh }, userRes.data);
      
      router.push(userRes.data.is_seller ? "/seller/onboarding" : "/");
    } catch (err: any) {
      if (err.response?.data) {
        const data = err.response.data;
        if (data.detail) {
          setError(data.detail);
        } else if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          const firstError = data[firstKey];
          setError(Array.isArray(firstError) ? firstError[0] : String(firstError));
        } else {
          setError("Ocorreu um erro ao criar a conta.");
        }
      } else {
        setError("Ocorreu um erro ao conectar com o servidor.");
      }
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WallBackdrop className="min-h-screen font-atelie text-atelie-ink">
      <SiteHeader />
      <div className="flex justify-center py-12 px-4">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg space-y-6 rounded-3xl bg-white/80 p-8 shadow-xl ring-1 ring-black/5 sm:p-10"
      >
        <div className="text-center space-y-2">
          <h1 className="font-serif text-4xl text-atelie-ink">Criar sua conta</h1>
          <p className="text-sm text-atelie-ink/60">Acompanhe seus pedidos, salve favoritos e compre mais rápido.</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <div className="flex justify-center mb-6">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("O login com Google falhou.")}
            theme="filled_black"
            text="continue_with"
            shape="rectangular"
          />
        </div>

        <div className="relative flex items-center py-2 mb-4">
          <div className="flex-grow border-t border-border/60"></div>
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase tracking-widest font-semibold">Ou continue com email</span>
          <div className="flex-grow border-t border-border/60"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nome
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-background/50 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sobrenome
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Sobrenome"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-background/50 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@exemplo.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-background/50 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
              />
            </div>
          </div>

          {/* Tipo de Pessoa */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Cadastro</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${personType === "PF" ? "border-primary bg-primary/10 text-primary font-bold" : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/50"}`}>
                <input type="radio" checked={personType === "PF"} onChange={() => { setPersonType("PF"); setCpfCnpj(""); }} className="hidden" />
                <User className="w-4 h-4" /> Pessoa Física
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${personType === "PJ" ? "border-primary bg-primary/10 text-primary font-bold" : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/50"}`}>
                <input type="radio" checked={personType === "PJ"} onChange={() => { setPersonType("PJ"); setCpfCnpj(""); }} className="hidden" />
                <Store className="w-4 h-4" /> Pessoa Jurídica
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {personType === "PF" ? "CPF" : "CNPJ"}
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={cpfCnpj}
                  onChange={handleCpfCnpjChange}
                  placeholder={personType === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-background/50 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
              </div>
            </div>

            <div className="space-y-1 mt-1 sm:mt-0">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Telefone / WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const masked = val.replace(/^(\d{2})(\d{4,5})(\d{4}).*/, '($1) $2-$3');
                    setPhone(masked || val);
                  }}
                  placeholder="(11) 99999-9999"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60 bg-background/50 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border bg-background/50 text-foreground placeholder-muted-foreground focus:ring-2 transition-all outline-none text-sm ${strength ? (strength.valid ? 'border-border/60 focus:border-primary focus:ring-primary/20' : 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20') : 'border-border/60 focus:border-primary focus:ring-primary/20'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {strength && (
                <div className="pt-1">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${strength.bg} transition-all duration-300 ${strength.width}`} />
                  </div>
                  <p className={`text-[10px] mt-1 font-medium ${strength.text}`}>{strength.label}</p>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border/60 bg-background/50 text-foreground placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>


          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 font-semibold text-sm transition-all shadow-md disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {loading ? "Cadastrando..." : "Cadastrar Conta"}
          </button>
        </form>

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-muted-foreground">Ou cadastre-se com</span>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => alert("A integração com o Google OAuth será ativada em breve. Por enquanto, use o formulário acima.")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-background hover:bg-secondary/20 transition-all text-sm font-semibold text-foreground shadow-sm hover:shadow"
            >
              <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.549L20.0303 3.124C17.9503 1.19 15.2353 0 12.0003 0C7.31028 0 3.25528 2.69 1.25028 6.609L5.27028 9.724C6.21528 6.81 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L20.18 21.28C22.57 19.08 23.49 15.965 23.49 12.275Z" fill="#4285F4" />
                <path d="M5.26498 14.295C5.02498 13.565 4.88498 12.795 4.88498 12.005C4.88498 11.215 5.01998 10.445 5.26498 9.715L1.23998 6.605C0.44998 8.195 0 9.995 0 12.005C0 14.015 0.44998 15.815 1.23998 17.405L5.26498 14.295Z" fill="#FBBC05" />
                <path d="M12.0004 24C15.2404 24 17.9654 22.935 20.1804 21.28L16.0804 18.1C14.8804 18.9 13.5604 19.25 12.0004 19.25C8.87038 19.25 6.21538 17.19 5.26538 14.29L1.24038 17.4C3.25538 21.31 7.31038 24 12.0004 24Z" fill="#34A853" />
              </svg>
              Entrar com Google
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Já possui uma conta?{" "}
          <Link href="/login" className="text-primary hover:underline font-semibold">
            Fazer login
          </Link>
        </p>
      </motion.div>

      {/* Gateway de Aceite Legal */}
      {showGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-background border border-border rounded-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden shadow-[0_0_50px_rgba(230,181,60,0.15)]"
          >
            <div className="p-6 border-b border-border bg-black/[0.04]">
              <h2 className="text-2xl font-black text-foreground">
                Termos de Uso e Política de Privacidade
              </h2>
              <p className="text-sm text-muted-foreground mt-1">É obrigatória a leitura e aceite para acessar o ecossistema.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow text-muted-foreground text-sm space-y-4 prose prose-invert">
                <>
                  <p><strong>1. Aceitação dos Termos</strong><br/>Ao criar uma conta, acessar ou utilizar a MySuperStore ("Plataforma"), você ("Usuário" ou "Cliente") concorda expressamente e sem ressalvas com as condições descritas neste documento. Se você não concordar com qualquer um dos termos, você está proibido de usar ou acessar este site.</p>
                  <p><strong>2. Definição do Serviço (Marketplace)</strong><br/>A MySuperStore atua como intermediadora de negócios (Marketplace), provendo tecnologia e ambiente virtual para que Vendedores Independentes ("Lojistas") comercializem seus produtos para Clientes finais.</p>
                  <p><strong>3. Política de Arrependimento e Devolução (CDC)</strong><br/>Em estrita conformidade com o Artigo 49 do Código de Defesa do Consumidor, o Cliente tem o direito de se arrepender da compra no prazo máximo de 7 (sete) dias corridos, contados a partir do recebimento do produto.</p>
                  <p><strong>4. Política de Privacidade (LGPD)</strong><br/>Seus dados são tratados sob os rigorosos padrões da Lei Geral de Proteção de Dados. Coletamos apenas os dados essenciais para o processamento de pagamentos, emissão de notas fiscais e logística.</p>
                </>
            </div>

            <div className="p-6 border-t border-border flex gap-4 bg-black/[0.04]">
              <button 
                type="button"
                onClick={() => setShowGateway(false)}
                className="flex-1 py-3 rounded-lg border border-red-500/50 text-red-500 font-bold hover:bg-red-500/10 transition-colors"
              >
                NÃO CONCORDO
              </button>
              <button 
                type="button"
                onClick={executeRegistration}
                className="flex-1 py-3 rounded-lg bg-primary text-black font-black hover:bg-primary/90 transition-colors"
              >
                LI E CONCORDO
              </button>
            </div>
          </motion.div>
        </div>
      )}

      </div>
    </WallBackdrop>
  );
}
