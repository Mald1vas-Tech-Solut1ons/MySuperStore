"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { SiteHeader as Header } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";
import { TrustBadges } from "@/components/storefront/TrustBadges";
import { cartApi, ordersApi, paymentsApi, PaymentMethodChoice, userApi, authApi } from "@/lib/api";
import { Cart } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, CheckCircle2, ShieldCheck, MapPin, CreditCard, ShoppingBag,
  QrCode, Copy, Check, Banknote, Lock, FileText, Search, Home, Briefcase,
  Building2, X, ChevronRight, PlusCircle, AlertCircle, Truck
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
type Method = PaymentMethodChoice;

const brl = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function CheckoutPage() {
  return <CheckoutInner />;
}

function CheckoutInner() {
  const router = useRouter();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  const [method, setMethod] = useState<Method>("credit_card");

  // PIX state
  const [pix, setPix] = useState<{ paymentId: string; copia: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [awaitingPix, setAwaitingPix] = useState(false);
  const [pixConfirmed, setPixConfirmed] = useState(false);

  // Address
  const [addr, setAddr] = useState({
    address_recipient: "", address_cep: "", address_logradouro: "", address_numero: "",
    address_complemento: "", address_bairro: "", address_cidade: "", address_uf: "",
  });
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);

  const [couponCode, setCouponCode] = useState("");

  const fieldClass = "w-full px-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium";
  const labelClass = "text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1";
  const setField = (key: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddr((a) => ({ ...a, [key]: e.target.value }));
  const pickAddress = (a: any) => {
    if (!a) return;
    setAddr((cur) => ({
      address_recipient: a.recipient_name || cur.address_recipient,
      address_cep: a.cep, address_logradouro: a.logradouro, address_numero: a.numero,
      address_complemento: a.complemento || "", address_bairro: a.bairro,
      address_cidade: a.cidade, address_uf: a.uf,
    }));
  };
  // CEP completo: preenche rua/bairro/cidade/UF pelo ViaCEP (o cliente confere e ajusta).
  const onCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setAddr((a) => ({ ...a, address_cep: masked }));
    if (digits.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (d && !d.erro) {
        setAddr((a) => ({
          ...a,
          address_logradouro: a.address_logradouro || d.logradouro || "",
          address_bairro: a.address_bairro || d.bairro || "",
          address_cidade: d.localidade || a.address_cidade,
          address_uf: d.uf || a.address_uf,
        }));
      }
    } catch { /* preenchimento manual */ }
  };
  const [maxInstallments, setMaxInstallments] = useState(1);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Shipping state
  const [shippingQuotes, setShippingQuotes] = useState<Record<string, any>>({});
  const [selectedShipping, setSelectedShipping] = useState<Record<string, any>>({});
  const [quotingShipping, setQuotingShipping] = useState(false);

  // User Profile
  const [userEmail, setUserEmail] = useState("");

  // Card form state
  const [cardNum, setCardNum] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExp, setCardExp] = useState(""); // MM/YY or MM/YYYY
  const [cardCvv, setCardCvv] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Parcelas reais do Efí (valor e juros conforme a conta). Sem resposta, só à vista:
  // não mostramos parcela que o banco pode cobrar diferente.
  const [efiInstallments, setEfiInstallments] = useState<{ installment: number; has_interest: boolean; value: number }[]>([]);
  const installmentOptions = efiInstallments.length
    ? efiInstallments.filter((i) => i.installment <= maxInstallments)
    : [{ installment: 1, has_interest: false, value: Math.round(Number(cart?.total || 0) * 100) }];
  const currentInstallment = installmentOptions.find((i) => i.installment === selectedInstallments) || installmentOptions[0];

  useEffect(() => {
    async function loadData() {
      try {
        const cartRes = await cartApi.get();
        if (!cartRes.data || cartRes.data.items.length === 0) {
          router.push("/cart");
          return;
        }
        setCart(cartRes.data);

        let maxAllowed = 12;
        cartRes.data.items.forEach((item: any) => {
          const sellerMax = item.variant.seller_max_installments || 12;
          if (sellerMax < maxAllowed) maxAllowed = sellerMax;
        });
        setMaxInstallments(maxAllowed);

        const meRes = await authApi.me().catch(() => null);
        if (meRes?.data) setUserEmail(meRes.data.email || "");
        const fullName = [meRes?.data?.first_name, meRes?.data?.last_name].filter(Boolean).join(" ");
        if (fullName) setAddr((a) => ({ ...a, address_recipient: a.address_recipient || fullName }));

        try {
          const addrRes = await userApi.getAddresses();
          const list = addrRes.data?.results || addrRes.data || [];
          
          if (list.length > 0) {
            setUserAddresses(list);
            pickAddress(list.find((a: any) => a.is_default) || list[0]);
            setUseCustomAddress(false);
          } else {
            setUseCustomAddress(true);
          }
        } catch (e) {
          setUseCustomAddress(true);
        }

      } catch (err) {
        router.push("/cart");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  useEffect(() => {
    const cep = addr.address_cep.replace(/\D/g, "");
    if (cep.length === 8) {
      setQuotingShipping(true);
      cartApi.shippingQuote(cep).then(async res => {
        setShippingQuotes(res.data);
        // Loja com uma única opção (ex.: frete fixo) já vem escolhida.
        const auto: Record<string, any> = {};
        Object.entries(res.data || {}).forEach(([sid, d]: [string, any]) => {
          if (!d?.error && (d?.options || []).length === 1) auto[sid] = d.options[0];
        });
        setSelectedShipping(auto);
        if (Object.keys(auto).length) {
          try { setCart((await cartApi.shippingSelect(auto)).data); } catch (e) { console.error(e); }
        }
      }).catch(err => {
        console.error("Erro ao cotar frete", err);
      }).finally(() => {
        setQuotingShipping(false);
      });
    }
  }, [addr.address_cep]);

  const handleSelectShipping = async (sellerId: string, option: any) => {
    const newSelected = { ...selectedShipping, [sellerId]: option };
    setSelectedShipping(newSelected);
    try {
      const res = await cartApi.shippingSelect(newSelected);
      setCart(res.data);
    } catch(err) {
      console.error(err);
    }
  };

  const cardBin = cardNum.replace(/\D/g, "").slice(0, 6);
  const cartTotalCents = Math.round(Number(cart?.total || 0) * 100);
  useEffect(() => {
    const accountId = process.env.NEXT_PUBLIC_EFI_ACCOUNT_IDENTIFIER;
    if (method !== "credit_card" || !accountId || !cartTotalCents) return;
    let cancelled = false;
    (async () => {
      try {
        const EfiModule = await import("payment-token-efi");
        const EfiPay = (EfiModule as any).default || EfiModule;
        const res = await EfiPay.CreditCard
          .setAccount(accountId)
          .setEnvironment(process.env.NEXT_PUBLIC_IS_DEBUG === "true" ? "sandbox" : "production")
          .setBrand(getEfiBrand(cardBin))
          .setTotal(cartTotalCents)
          .getInstallments();
        if (!cancelled && Array.isArray(res?.installments)) setEfiInstallments(res.installments);
      } catch (e) {
        console.error("Parcelas Efí indisponíveis", e);
        if (!cancelled) { setEfiInstallments([]); setSelectedInstallments(1); }
      }
    })();
    return () => { cancelled = true; };
  }, [method, cartTotalCents, cardBin.length >= 6 ? cardBin : ""]);

  const getEfiBrand = (cardNumber: string) => {
    const pan = cardNumber.replace(/\D/g, "");
    if (pan.startsWith("4")) return "visa";
    if (/^5[1-5]/.test(pan) || /^2(?:2(?:2[1-9]|[3-9]\d)|[3-6]\d\d|7(?:[01]\d|20))/.test(pan)) return "mastercard";
    if (/^3[47]/.test(pan)) return "amex";
    if (/^(5067|4576|4011)/.test(pan)) return "elo"; // very basic elo check
    return "visa"; // fallback
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;
    setError("");

    // Exige escolher uma opção de frete para cada loja que retornou cotação.
    const sellersComCotacao = Object.entries(shippingQuotes)
      .filter(([, d]: [string, any]) => !d.error && (d.options || []).length)
      .map(([sellerId]) => sellerId);
    const faltaFrete = sellersComCotacao.some((sid) => !selectedShipping[sid]);
    if (faltaFrete) {
      setError("Escolha uma opção de frete para cada loja antes de continuar.");
      return;
    }

    const missingAddress = ["address_recipient", "address_cep", "address_logradouro", "address_numero", "address_bairro", "address_cidade", "address_uf"]
      .some((k) => !String((addr as any)[k] || "").trim());
    if (missingAddress) {
      setError("Preencha o endereço de entrega completo.");
      return;
    }

    setProcessing(true);

    try {
      // 1. Cartão: valida e tokeniza ANTES de criar o pedido. Criar o pedido reserva
      // o estoque (peça única), então um erro de digitação não pode prender a peça.
      let paymentToken = "";
      if (method === "credit_card" || method === "debit_card") {
        if (!cardNum || !cardExp || !cardCvv || !cardName || !customerCpf) {
          throw new Error("Preencha todos os campos do cartão e titular.");
        }

        const [month, yearRaw] = cardExp.split("/");
        const year = yearRaw?.length === 2 ? `20${yearRaw}` : yearRaw;

        const accountId = process.env.NEXT_PUBLIC_EFI_ACCOUNT_IDENTIFIER;
        if (!accountId) throw new Error("Pagamento com cartão indisponível no momento. Use o Pix.");

        // payment-token-efi v3.x usa o builder EfiPay.CreditCard.setAccount()...
        const EfiModule = await import("payment-token-efi");
        const EfiPay = (EfiModule as any).default || EfiModule;

        const pan = cardNum.replace(/\D/g, "");
        let brand = getEfiBrand(pan);
        try {
          brand = (await EfiPay.CreditCard.setCardNumber(pan).verifyCardBrand()) || brand;
        } catch { /* fica a detecção local */ }

        try {
          const result = await EfiPay.CreditCard
            .setAccount(accountId)
            .setEnvironment(process.env.NEXT_PUBLIC_IS_DEBUG === 'true' ? 'sandbox' : 'production')
            .setCreditCardData({
              brand,
              number: cardNum.replace(/\D/g, ""),
              cvv: cardCvv.replace(/\D/g, ""),
              expirationMonth: month,
              expirationYear: year,
              holderName: cardName,
              holderDocument: customerCpf.replace(/\D/g, ""),
              reuse: false,
            })
            .getPaymentToken();
          paymentToken = result.payment_token;
        } catch (tokenErr: any) {
          console.error("Erro na tokenização", tokenErr);
          throw new Error(tokenErr?.error_description || "Falha ao gerar token de segurança do cartão. Verifique os dados.");
        }
      }

      // 2. Cria o pedido (o cupom aplicado na sacola é usado pelo servidor)
      const orderPayload = { ...addr, address_cep: addr.address_cep.replace(/\D/g, "") };
      if (couponCode.trim()) (orderPayload as any).coupon_code = couponCode.trim();
      const orderRes = await ordersApi.create(orderPayload);
      const order = orderRes.data;

      // 3. Process Payment
      const processPayload: any = {
        order_id: order.id,
        payment_method: method
      };

      if (method === "credit_card" || method === "debit_card") {
        processPayload.payment_token = paymentToken;
        processPayload.installments = currentInstallment.installment;
        processPayload.customer = {
          name: cardName,
          cpf: customerCpf.replace(/\D/g, ""),
          phone_number: customerPhone.replace(/\D/g, ""),
          email: userEmail || "cliente@loja.com"
        };
        processPayload.billing_address = {
          street: addr.address_logradouro,
          number: addr.address_numero,
          neighborhood: addr.address_bairro,
          zipcode: addr.address_cep.replace(/\D/g, ""),
          city: addr.address_cidade,
          state: addr.address_uf
        };
      }

      const payRes = await paymentsApi.processPayment(processPayload);
      const payment = payRes.data;

      if (method === "pix") {
        setPix({ paymentId: payment.id, copia: payment.pix_qr_code, qr: payment.pix_qr_code_base64 });
        setAwaitingPix(true);
      } else {
        setSuccessOrder(order.id);
      }

    } catch (err: any) {
      if (err?.response?.data) {
        const data = err.response.data;
        if (typeof data === "object" && !data.detail) {
          const firstErrorKey = Object.keys(data)[0];
          setError(`Erro: ${data[firstErrorKey]}`);
        } else {
          setError(data.detail || "Erro ao processar pagamento.");
        }
      } else {
        setError(err.message || "Erro ao processar pagamento.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSimulatePix = async () => {
    if (!pix) return;
    setProcessing(true);
    setError("");
    try {
      await paymentsApi.simulatePix(pix.paymentId);
      setSuccessOrder("PIX-OK");
      setAwaitingPix(false);
    } catch (err: any) {
      setError(err.message || "Erro ao simular PIX.");
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (!awaitingPix || !pix || pixConfirmed) return;
    const interval = setInterval(async () => {
      try {
        const res = await paymentsApi.status(pix.paymentId);
        if (res.data?.status === "approved") {
          setPixConfirmed(true);
          setSuccessOrder("PIX-OK");
          setAwaitingPix(false);
        }
      } catch { }
    }, 5000);
    return () => clearInterval(interval);
  }, [awaitingPix, pix, pixConfirmed]);

  const copyPix = () => {
    if (!pix) return;
    navigator.clipboard.writeText(pix.copia);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-atelie-wall font-atelie text-atelie-ink">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (successOrder) {
    return (
      <div className="min-h-screen flex flex-col bg-atelie-wall font-atelie text-atelie-ink">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-12 w-12" />
          </motion.div>
          <h1 className="text-3xl font-display font-bold mb-4">Pagamento Confirmado!</h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Recebemos seu pagamento e seu pedido já está sendo preparado.
          </p>
          <Link href="/dashboard/orders"
            className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/95 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            Acompanhar Pedido
          </Link>
        </main>
      </div>
    );
  }

  // ── Awaiting PIX ──────────────────────────────────────────────────────────
  if (awaitingPix && pix) {
    return (
      <div className="min-h-screen flex flex-col bg-atelie-wall font-atelie text-atelie-ink">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto w-full">
          <QrCode className="h-10 w-10 text-primary mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Pague com PIX</h1>
          <p className="text-muted-foreground mb-6">Escaneie o QR Code no app do seu banco ou use o Copia e Cola para finalizar.</p>

          <div className="bg-white p-4 rounded-3xl shadow-2xl mb-6 border border-border/20">
            <img src={`data:image/png;base64,${pix.qr}`} alt="QR Code PIX" className="w-56 h-56" />
          </div>

          <button onClick={copyPix}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 transition-all mb-6 font-mono text-xs break-all shadow-inner">
            {copied ? <Check className="h-4 w-4 text-green-500 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
            <span className="truncate">{copied ? "Copiado!" : pix.copia}</span>
          </button>

          {process.env.NEXT_PUBLIC_IS_DEBUG === "true" && (
            <button onClick={handleSimulatePix} disabled={processing}
              className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-bold transition-all shadow-lg disabled:opacity-50">
              {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Simular Pagamento
            </button>
          )}
        </main>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────
  const methods: { id: Method; label: string; icon: any; hint: string }[] = [
    { id: "credit_card", label: "Crédito", icon: CreditCard, hint: `Até ${maxInstallments}x` },
    { id: "pix", label: "PIX", icon: QrCode, hint: "Aprovação imediata" },
    // Débito removido: o Efí não processa cartão de débito online via API.
    // O PIX cobre o pagamento à vista. Para reativar, readicione a linha abaixo.
    // { id: "debit_card", label: "Débito", icon: Banknote, hint: "À vista" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-atelie-wall font-atelie text-atelie-ink">
      <Header />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-10">
          <Lock className="w-6 h-6 text-green-500" />
          <h1 className="text-3xl font-display font-bold">Checkout Seguro</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-10">
            
            {/* Delivery Address */}
            <section className="p-8 rounded-3xl border border-border/40 bg-card/40 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-xl flex items-center gap-3">
                  <MapPin className="h-6 w-6 text-primary" /> Endereço de Entrega
                </h3>
              </div>
              {!useCustomAddress ? (
                <div className="space-y-3">
                  {userAddresses.length > 1 && (
                    <select
                      aria-label="Endereço salvo"
                      className={fieldClass}
                      onChange={(e) => pickAddress(userAddresses.find((x: any) => String(x.id) === e.target.value))}
                    >
                      {userAddresses.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.logradouro}, {a.numero} · CEP {a.cep}</option>
                      ))}
                    </select>
                  )}
                  <div className="border border-primary/20 rounded-2xl p-5">
                    <p className="font-bold text-base">{addr.address_recipient}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {addr.address_logradouro}, {addr.address_numero}{addr.address_complemento ? ` · ${addr.address_complemento}` : ""} · {addr.address_bairro}
                    </p>
                    <p className="text-sm text-muted-foreground">{addr.address_cidade}/{addr.address_uf} · CEP {addr.address_cep}</p>
                  </div>
                  <button type="button" onClick={() => setUseCustomAddress(true)} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    Entregar em outro endereço
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-3">
                  <label className="col-span-6 space-y-1">
                    <span className={labelClass}>Quem recebe</span>
                    <input className={fieldClass} value={addr.address_recipient} onChange={setField("address_recipient")} autoComplete="name" required />
                  </label>
                  <label className="col-span-6 sm:col-span-2 space-y-1">
                    <span className={labelClass}>CEP</span>
                    <input className={fieldClass} value={addr.address_cep} onChange={onCepChange} inputMode="numeric" maxLength={9} placeholder="00000-000" autoComplete="postal-code" required />
                  </label>
                  <label className="col-span-6 sm:col-span-4 space-y-1">
                    <span className={labelClass}>Rua</span>
                    <input className={fieldClass} value={addr.address_logradouro} onChange={setField("address_logradouro")} autoComplete="address-line1" required />
                  </label>
                  <label className="col-span-2 space-y-1">
                    <span className={labelClass}>Número</span>
                    <input className={fieldClass} value={addr.address_numero} onChange={setField("address_numero")} required />
                  </label>
                  <label className="col-span-4 space-y-1">
                    <span className={labelClass}>Complemento</span>
                    <input className={fieldClass} value={addr.address_complemento} onChange={setField("address_complemento")} placeholder="Opcional" autoComplete="address-line2" />
                  </label>
                  <label className="col-span-6 sm:col-span-3 space-y-1">
                    <span className={labelClass}>Bairro</span>
                    <input className={fieldClass} value={addr.address_bairro} onChange={setField("address_bairro")} required />
                  </label>
                  <label className="col-span-4 sm:col-span-2 space-y-1">
                    <span className={labelClass}>Cidade</span>
                    <input className={fieldClass} value={addr.address_cidade} onChange={setField("address_cidade")} autoComplete="address-level2" required />
                  </label>
                  <label className="col-span-2 sm:col-span-1 space-y-1">
                    <span className={labelClass}>UF</span>
                    <input className={fieldClass} value={addr.address_uf} onChange={(e) => setAddr((a) => ({ ...a, address_uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} required />
                  </label>
                  {userAddresses.length > 0 && (
                    <button type="button" onClick={() => { setUseCustomAddress(false); pickAddress(userAddresses.find((a: any) => a.is_default) || userAddresses[0]); }}
                      className="col-span-6 text-left text-sm font-semibold text-primary underline-offset-4 hover:underline">
                      Usar endereço salvo
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Frete e Entrega */}
            <section className="p-8 rounded-3xl border border-border/40 bg-card/40 shadow-sm relative z-10">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-3xl" />
              <h3 className="font-display font-bold text-xl flex items-center gap-3 mb-6">
                <Truck className="h-6 w-6 text-primary" /> Frete e Entrega
              </h3>
              {quotingShipping ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Calculando frete...
                </div>
              ) : Object.keys(shippingQuotes).length === 0 ? (
                <p className="text-sm text-muted-foreground">Informe seu CEP no endereço para calcular o frete.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(shippingQuotes).map(([sellerId, data]: [string, any]) => (
                    <div key={sellerId}>
                      <p className="text-sm font-bold mb-2">{data.store_name}</p>
                      {data.error || !(data.options || []).length ? (
                        <p className="text-xs text-red-400">Não foi possível calcular o frete desta loja para o CEP informado.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.options.map((opt: any) => {
                            const selected = selectedShipping[sellerId]?.id === opt.id;
                            return (
                              <button type="button" key={opt.id} onClick={() => handleSelectShipping(sellerId, opt)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                                  selected ? "border-primary bg-primary/10" : "border-border/60 hover:border-border hover:bg-white/5"
                                }`}>
                                <div>
                                  <p className="font-semibold text-sm">{opt.name}</p>
                                  <p className="text-xs text-muted-foreground">{opt.company?.name}{opt.delivery_time ? ` · ${opt.delivery_time} dia(s) útil(eis)` : ""}</p>
                                </div>
                                <span className="font-display font-bold text-primary whitespace-nowrap">
                                  R$ {Number(opt.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Payment Method */}
            <section className="p-8 rounded-3xl border border-border/40 bg-card/40 shadow-sm relative z-10">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-3xl" />
              <h3 className="font-display font-bold text-xl flex items-center gap-3 mb-6">
                <ShieldCheck className="h-6 w-6 text-primary" /> Como você prefere pagar?
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {methods.map((m) => (
                  <button type="button" key={m.id} onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                      method === m.id ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)] scale-[1.02]" : "border-border/60 hover:border-border hover:bg-white/5"
                    }`}>
                    <m.icon className={`h-8 w-8 ${method === m.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.hint}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {(method === "credit_card" || method === "debit_card") && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Número do Cartão</label>
                        <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <input type="text" value={cardNum} onChange={e => setCardNum(e.target.value.replace(/\D/g, ''))} maxLength={19} placeholder="0000 0000 0000 0000" className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-neutral-600 font-medium" required />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Validade</label>
                          <input type="text" value={cardExp} onChange={e => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 2) val = `${val.substring(0, 2)}/${val.substring(2, 6)}`;
                            setCardExp(val);
                          }} maxLength={7} placeholder="MM/AA" className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-neutral-600 font-medium" required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">CVV</label>
                          <input type="text" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))} maxLength={4} placeholder="123" className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-neutral-600 font-medium" required />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Nome no Cartão</label>
                        <input type="text" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Como impresso no cartão" className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-neutral-600 font-medium" required />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">CPF do Titular</label>
                          <input type="text" value={customerCpf} onChange={e => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                            setCustomerCpf(val);
                          }} maxLength={14} placeholder="000.000.000-00" className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-neutral-600 font-medium" required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Celular</label>
                          <input type="text" value={customerPhone} onChange={e => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 2) val = val.replace(/^(\d{2})(\d)/g, "($1) $2");
                            if (val.length > 9) val = val.replace(/(\d{5})(\d)/, "$1-$2");
                            setCustomerPhone(val);
                          }} maxLength={15} placeholder="(11) 90000-0000" className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-neutral-600 font-medium" required />
                        </div>
                      </div>
                    </div>

                    {method === "credit_card" && (
                      <div className="space-y-2 relative mt-4">
                        <label className="text-sm font-semibold text-muted-foreground">Número de Parcelas</label>
                        <div 
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full p-4 rounded-2xl border border-border bg-background outline-none focus-within:border-primary transition-all cursor-pointer flex justify-between items-center"
                        >
                          <span>
                            {currentInstallment.installment}x de R$ {brl(currentInstallment.value / 100)}{" "}
                            {currentInstallment.has_interest ? (
                              <span className="text-muted-foreground ml-1">com juros · total R$ {brl((currentInstallment.value * currentInstallment.installment) / 100)}</span>
                            ) : (
                              <span className="text-green-600 font-bold ml-1">sem juros</span>
                            )}
                          </span>
                          <span className="text-muted-foreground">▼</span>
                        </div>
                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                              className="absolute z-50 w-full mt-2 bg-background border border-border rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar"
                            >
                              {installmentOptions.map(opt => (
                                <div
                                  key={opt.installment} onClick={() => { setSelectedInstallments(opt.installment); setIsDropdownOpen(false); }}
                                  className={`p-4 hover:bg-black/5 cursor-pointer flex justify-between items-center border-b border-border/40 last:border-0 ${currentInstallment.installment === opt.installment ? 'bg-primary/10' : ''}`}
                                >
                                  <span>{opt.installment}x de R$ {brl(opt.value / 100)}</span>
                                  <span className={`text-xs ${opt.has_interest ? "text-muted-foreground" : "text-green-600 font-bold"}`}>
                                    {opt.has_interest ? `total R$ ${brl((opt.value * opt.installment) / 100)}` : "sem juros"}
                                  </span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground bg-green-500/10 text-green-500 p-3 rounded-xl">
                      <Lock className="w-4 h-4" /> Pagamento 100% processado de forma segura e criptografada (PCI DSS).
                    </div>
                  </motion.div>
                )}

                {method === "pix" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 rounded-2xl border border-primary/30 bg-primary/5 flex items-start gap-4">
                    <QrCode className="h-8 w-8 text-primary shrink-0" />
                    <div>
                      <p className="font-bold text-lg mb-1">Aprovação Imediata</p>
                      <p className="text-sm text-muted-foreground">Ao finalizar, geramos um QR Code exclusivo do seu pedido. Assim que você paga, a confirmação chega aqui automaticamente.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-5">
            <div className="p-8 rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl sticky top-28 shadow-2xl">
              <h3 className="font-display font-bold text-2xl border-b border-border/40 pb-5 mb-6 flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" /> Resumo da Compra
              </h3>
              
              <div className="space-y-5 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {cart?.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-border/20 shrink-0">
                      <Image src={item.variant.product_image || "/placeholder.png"} alt="Produto" fill className="object-cover" />
                    </div>
                    <div className="flex-grow flex flex-col justify-center">
                      <p className="font-bold text-sm line-clamp-2 leading-tight">{item.variant.product_name}</p>
                      <p className="text-primary text-sm font-semibold mt-1">
                        {item.quantity}x R$ {brl(item.variant.effective_price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border/40 space-y-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>R$ {brl(cart?.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Frete</span>
                  <span>{(cart as any)?.free_shipping ? "Grátis" : Number(cart?.shipping_total || 0) > 0 ? `R$ ${brl(cart?.shipping_total || 0)}` : "A calcular"}</span>
                </div>

                <div className="pt-6 border-t border-border/40 flex justify-between items-end mt-4">
                  <span className="font-bold text-lg">Total</span>
                  <div className="text-right">
                    <span className="font-display font-black text-4xl text-primary block leading-none">
                      R$ {brl(Number(cart?.total || 0))}
                    </span>
                    {method === "credit_card" && currentInstallment.has_interest && (
                      <span className="text-xs text-muted-foreground mt-1 block">
                        No cartão em {currentInstallment.installment}x: R$ {brl((currentInstallment.value * currentInstallment.installment) / 100)} com juros
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {error && (
                  <div className="bg-red-500/10 text-red-500 p-4 rounded-xl border border-red-500/20 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold">{error}</p>
                  </div>
                )}
                
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-lg hover:bg-primary/95 transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Lock className="h-6 w-6" />}
                  Finalizar Pagamento Seguro
                </button>
              </div>
            </div>
          </div>
        </form>
        <TrustBadges className="mt-12" />
      </main>
      <SiteFooter />
    </div>
  );
}
