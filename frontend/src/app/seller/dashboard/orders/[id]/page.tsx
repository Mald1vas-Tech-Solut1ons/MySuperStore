"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { sellerOrdersApi } from "@/lib/api";
import { Header } from "@/components/Header";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { SubOrder } from "@/types";
import { Package, Truck, CheckCircle2, ChevronLeft, MapPin, Calendar, Link as LinkIcon, DollarSign, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";

const CARRIERS = [
  "Correios", "Jadlog", "Lalamove", "Loggi", "Braspress", "Melhor Envio", "Entrega Própria", "Outra"
];

export default function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { toast } = useToast();
  
  const [order, setOrder] = useState<SubOrder | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [carrier, setCarrier] = useState("Correios");
  const [trackingCode, setTrackingCode] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [invoiceLink, setInvoiceLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const { data } = await sellerOrdersApi.getById(id);
      setOrder(data);
      if (data.carrier_name) setCarrier(data.carrier_name);
      if (data.tracking_code) setTrackingCode(data.tracking_code);
      if (data.estimated_delivery_date) setEstimatedDate(data.estimated_delivery_date);
      if (data.invoice_link) setInvoiceLink(data.invoice_link);
    } catch (err) {
      console.error(err);
      toast("Erro ao carregar pedido.", "error");
      router.push("/seller/dashboard/orders");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (newStatus === "shipped") {
      // Na postagem dos Correios a previsão nem sempre é conhecida: só transportadora e código são obrigatórios.
      if (!carrier || !trackingCode) {
        toast("Preencha a transportadora e o código de rastreio.", "error");
        return;
      }
    }
    
    setSubmitting(true);
    try {
      await sellerOrdersApi.updateStatus(id, newStatus, trackingCode, carrier, estimatedDate);
      toast("Status atualizado!", "success");
      fetchOrder();
    } catch (err) {
      toast("Erro ao atualizar status.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !order) return <BrandLoader />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-4xl mx-auto px-4 pt-28 pb-20">
        <button 
          onClick={() => router.push("/seller/dashboard/orders")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar para Pedidos
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold font-heading mb-1">Pedido #{order.id.split("-")[0]}</h1>
            <p className="text-muted-foreground">Realizado em {new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 border ${
            order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
            order.status === 'processing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
            order.status === 'shipped' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
            'bg-green-500/10 text-green-500 border-green-500/20'
          }`}>
            {order.status === 'pending' && "Aguardando Pagamento"}
            {order.status === 'processing' && "Em Separação"}
            {order.status === 'shipped' && "Em Trânsito"}
            {order.status === 'delivered' && "Entregue"}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-card border border-border/40 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" /> Produtos
              </h2>
              <div className="divide-y divide-border/40">
                {order.items.map(item => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-foreground">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.variant_sku}</p>
                      {item.variant_attributes && Object.entries(item.variant_attributes).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Object.entries(item.variant_attributes).map(([k, v]) => `${k}: ${v}`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{item.quantity}x R$ {Number(item.unit_price).toFixed(2)}</p>
                      <p className="text-sm text-primary">R$ {Number(item.total).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border/40 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> Despacho e Logística
              </h2>
              
              {order.status === "pending" ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-600/90 text-sm">
                  Aguarde a confirmação do pagamento para poder preparar e despachar o pacote.
                </div>
              ) : order.status === "processing" ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm mb-6 font-medium">
                    O pagamento foi confirmado! Prepare o pacote e preencha os dados de envio abaixo para notificar o cliente.
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Transportadora ou App de Entrega</label>
                    <select 
                      value={carrier} 
                      onChange={e => setCarrier(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:border-primary outline-none"
                    >
                      <option value="">Selecione...</option>
                      {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Código de Rastreio ou Link (Lalamove/Uber)</label>
                    <input 
                      type="text" 
                      value={trackingCode} 
                      onChange={e => setTrackingCode(e.target.value)}
                      placeholder="Ex: BR123456789BR ou https://lalamove..."
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Estimativa de Entrega</label>
                    <input 
                      type="date" 
                      value={estimatedDate} 
                      onChange={e => setEstimatedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:border-primary outline-none"
                    />
                  </div>

                  <button 
                    onClick={() => handleUpdateStatus("shipped")}
                    disabled={submitting}
                    className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity mt-4 flex items-center justify-center gap-2"
                  >
                    <Truck className="w-5 h-5" /> Informar Despacho ao Cliente
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-background p-4 rounded-xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Transportadora</p>
                      <p className="font-bold">{order.carrier_name}</p>
                    </div>
                    <div className="bg-background p-4 rounded-xl border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Previsão</p>
                      <p className="font-bold">{new Date(order.estimated_delivery_date!).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-xl border border-border/50 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Rastreamento</p>
                      {order.tracking_code?.startsWith('http') ? (
                        <a href={order.tracking_code} target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline flex items-center gap-2">
                          Ver no Mapa <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <p className="font-bold font-mono tracking-wider">{order.tracking_code}</p>
                      )}
                    </div>
                  </div>

                  {order.status === "shipped" && (
                    <button 
                      onClick={() => handleUpdateStatus("delivered")}
                      disabled={submitting}
                      className="w-full py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors mt-6 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Marcar como Entregue
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border/40 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" /> Financeiro
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal Vendido</span>
                  <span className="font-bold">R$ {Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-red-400">
                  <span>Comissão Plataforma</span>
                  <span>- R$ {Number(order.commission).toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-border/50 flex justify-between">
                  <span className="font-bold text-muted-foreground">Líquido a Receber</span>
                  <span className="font-bold text-primary text-xl">R$ {Number(order.seller_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/40 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> Cliente
              </h2>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p>Os dados do cliente e endereço de entrega foram enviados para seu e-mail no momento da confirmação do pagamento.</p>
                <p>Por favor, consulte o e-mail de "Nova Venda".</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
