"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import { whatsappLink } from "@/config/brand";
import { ordersApi, reviewApi, returnsApi, paymentsApi } from "@/lib/api";
import { Loader2, Package, CheckCircle2, Truck, Clock, Star, Send, MessageCircle, X, RefreshCcw, Store, Ban, Undo2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Review state
  const [reviewingItem, setReviewingItem] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewSubject, setReviewSubject] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  // Chat State
  const [chattingWith, setChattingWith] = useState<any | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { id: 1, sender: 'seller', text: 'Olá! Como posso ajudar com o seu pedido hoje?', time: '10:00' }
  ]);

  // Return State
  const [returningItem, setReturningItem] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState("remorse");
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnMessage, setReturnMessage] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await ordersApi.getAll();
      setOrders(res.data.results || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingItem) return;
    
    setSubmittingReview(true);
    setReviewMessage("");
    try {
      await reviewApi.submit(reviewingItem.product_slug, {
        rating,
        subject: reviewSubject,
        body: reviewBody
      });
      setReviewMessage("Avaliação enviada com sucesso!");
      setTimeout(() => {
        setReviewingItem(null);
        setReviewMessage("");
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setReviewMessage(err.response?.data?.detail || "Erro ao enviar avaliação.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningItem) return;
    
    setSubmittingReturn(true);
    setReturnMessage("");
    try {
      await returnsApi.requestReturn(returningItem.id, returnReason, returnNotes);
      setReturnMessage("Solicitação de devolução enviada com sucesso!");
      setTimeout(() => {
        setReturningItem(null);
        setReturnMessage("");
        loadOrders(); // recarrega a lista para mostrar o novo status
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setReturnMessage(err.response?.data?.error || "Erro ao solicitar devolução.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleCancel = async (order: any) => {
    if (!order.payment?.id) return;
    if (!confirm(`Cancelar o pedido ${order.order_number}? O estoque será devolvido.`)) return;
    setActioningId(order.id);
    try {
      await paymentsApi.cancel(order.payment.id);
      await loadOrders();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Erro ao cancelar pedido.");
    } finally {
      setActioningId(null);
    }
  };

  // Devolução passa pela loja (CDC: 7 dias): ela confere a peça e faz o estorno.
  // O cliente não estorna sozinho — o botão abre a conversa com o ateliê já com o pedido.
  const handleReturnRequest = (order: any) => {
    const link = whatsappLink(`Olá! Quero pedir a devolução do pedido ${order.order_number}.`);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    else alert("Fale com o ateliê para pedir a devolução deste pedido.");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-amber-500" />;
      case "processing": return <Package className="h-4 w-4 text-blue-500" />;
      case "shipped": return <Truck className="h-4 w-4 text-purple-500" />;
      case "delivered": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "processing": return "Em Separação";
      case "shipped": return "Enviado";
      case "delivered": return "Entregue";
      case "cancelled": return "Cancelado";
      case "refunded": return "Reembolsado";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Meus Pedidos</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/60 rounded-3xl bg-card/20">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">Você ainda não possui pedidos</h3>
          <p className="text-sm text-muted-foreground">Suas compras aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden"
            >
              <div className="p-4 md:p-6 bg-secondary/10 border-b border-border/40 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pedido {order.order_number}</p>
                  <p className="text-sm text-foreground mt-1">{new Date(order.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
                    <p className="text-lg font-display font-bold text-primary">R$ {Number(order.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>

                  {/* Ações de pagamento no nível do pedido */}
                  {order.status === "pending" && order.payment?.id && (
                    <button
                      onClick={() => handleCancel(order)}
                      disabled={actioningId === order.id}
                      className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors font-semibold disabled:opacity-50"
                    >
                      {actioningId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                      Cancelar
                    </button>
                  )}
                  {["confirmed", "processing"].includes(order.status) && order.payment?.status === "approved" && (
                    <button
                      onClick={() => handleReturnRequest(order)}
                      className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-colors font-semibold disabled:opacity-50"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Pedir devolução
                    </button>
                  )}
                  {order.status === "refunded" && (
                    <span className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500 font-semibold">
                      <Undo2 className="h-3.5 w-3.5" /> Reembolsado
                    </span>
                  )}
                  {order.status === "cancelled" && (
                    <span className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 font-semibold">
                      <Ban className="h-3.5 w-3.5" /> Cancelado
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 md:p-6 space-y-6">
                {order.sub_orders?.map((sub: any) => (
                  <div key={sub.id} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/20 pb-2">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Package className="h-4 w-4" /> {sub.seller_name}
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide bg-background px-3 py-1 rounded-full border border-border/60">
                          {getStatusIcon(sub.status)} {getStatusLabel(sub.status)}
                        </span>
                        {(sub.carrier_name || sub.estimated_delivery_date) && (
                          <div className="text-[10px] text-muted-foreground mt-1 flex flex-col items-end gap-0.5">
                            {sub.carrier_name && <span>Via {sub.carrier_name}</span>}
                            {sub.estimated_delivery_date && <span>Previsão: {new Date(sub.estimated_delivery_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                          </div>
                        )}
                        {sub.tracking_code && (
                          <div className="text-[10px] text-muted-foreground font-mono tracking-wider mt-1 px-2 border border-border/50 bg-background/50 py-1 rounded">
                            Rastreio: {sub.tracking_code.startsWith('http') ? (
                              <a href={sub.tracking_code} target="_blank" rel="noreferrer" className="text-primary hover:underline">{sub.tracking_code}</a>
                            ) : (
                              <span>{sub.tracking_code}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Timeline Visual do Status */}
                      <div className="relative pt-6 pb-2 px-2">
                        <div className="absolute top-1/2 left-4 right-4 h-1 bg-border/40 -translate-y-1/2 rounded-full z-0"></div>
                        <div 
                          className="absolute top-1/2 left-4 h-1 bg-primary -translate-y-1/2 rounded-full z-0 transition-all duration-500"
                          style={{
                            width: sub.status === 'pending' ? '0%' :
                                   sub.status === 'processing' ? '33%' :
                                   sub.status === 'shipped' ? '66%' :
                                   sub.status === 'delivered' ? '100%' : '0%'
                          }}
                        ></div>
                        
                        <div className="relative z-10 flex justify-between">
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${['pending', 'processing', 'shipped', 'delivered'].includes(sub.status) ? 'bg-primary border-primary text-white' : 'bg-card border-border text-muted-foreground'}`}>
                              <Clock className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Pago</span>
                          </div>
                          
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${['processing', 'shipped', 'delivered'].includes(sub.status) ? 'bg-primary border-primary text-white' : 'bg-card border-border text-muted-foreground'}`}>
                              <Package className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Preparando</span>
                          </div>
                          
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${['shipped', 'delivered'].includes(sub.status) ? 'bg-primary border-primary text-white' : 'bg-card border-border text-muted-foreground'}`}>
                              <Truck className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Em Trânsito</span>
                          </div>
                          
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${sub.status === 'delivered' ? 'bg-green-500 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-card border-border text-muted-foreground'}`}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase ${sub.status === 'delivered' ? 'text-green-500' : 'text-muted-foreground'}`}>Entregue</span>
                          </div>
                        </div>
                      </div>

                      {/* Botão da Nota Fiscal */}
                      {sub.invoice_link && (
                        <div className="flex justify-end mt-2 px-2">
                          <a 
                            href={sub.invoice_link} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors font-bold shadow-[0_0_10px_rgba(230,181,60,0.15)]"
                          >
                            <Package className="h-3.5 w-3.5" />
                            Baixar Nota Fiscal
                          </a>
                        </div>
                      )}

                      {/* Lista de Itens */}
                      <div className="space-y-3 mt-4 border-t border-border/20 pt-4">
                      {sub.items.map((item: any) => (
                        <div key={item.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                          <div className="flex-grow">
                            <p className="font-semibold text-sm text-foreground">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {item.quantity} | R$ {Number(item.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} un.</p>
                          </div>
                          
                          {/* Botões de Ação */}
                          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <button
                              onClick={() => setChattingWith(sub)}
                              className="text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 transition-colors font-medium w-full sm:w-auto"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Falar com Lojista
                            </button>
                            
                            {sub.status === "delivered" && (
                              <>
                                <button
                                  onClick={() => setReviewingItem(item)}
                                  className="text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-medium w-full sm:w-auto"
                                >
                                  <Star className="h-3.5 w-3.5" />
                                  Avaliar Produto
                                </button>
                                {item.return_request ? (
                                  <div className="text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 text-orange-500 bg-orange-500/10 font-medium w-full sm:w-auto">
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                    Devolução em Análise
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setReturningItem(item)}
                                    className="text-xs flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors font-medium w-full sm:w-auto"
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                    Devolver / Trocar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL DE AVALIAÇÃO */}
      <AnimatePresence>
        {reviewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReviewingItem(null)} className="absolute inset-0 bg-black/5 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-card rounded-2xl p-6 shadow-2xl border border-border/50 z-10">
              <h3 className="text-xl font-bold mb-1">Avaliar Produto</h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{reviewingItem.product_name}</p>

              {reviewMessage && (
                <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary border border-primary/20 text-sm font-medium">
                  {reviewMessage}
                </div>
              )}

              <form onSubmit={submitReview} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">Nota</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button type="button" key={star} onClick={() => setRating(star)} className="p-1 focus:outline-none transition-transform hover:scale-110">
                        <Star className={`h-8 w-8 ${star <= rating ? "fill-amber-500 text-amber-500" : "text-border"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Título da Avaliação</label>
                  <input type="text" required value={reviewSubject} onChange={e => setReviewSubject(e.target.value)} placeholder="Ex: Excelente produto!" className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background focus:border-primary outline-none text-sm" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Comentário</label>
                  <textarea required value={reviewBody} onChange={e => setReviewBody(e.target.value)} placeholder="Conte sua experiência com este item..." rows={4} className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background focus:border-primary outline-none text-sm resize-none" />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setReviewingItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-secondary/50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={submittingReview} className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg hover:bg-primary/95 transition-all flex items-center gap-2 disabled:opacity-50">
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar Avaliação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE DEVOLUÇÃO */}
      <AnimatePresence>
        {returningItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReturningItem(null)} className="absolute inset-0 bg-black/5 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-card rounded-2xl p-6 shadow-2xl border border-border/50 z-10">
              <h3 className="text-xl font-bold mb-1 flex items-center gap-2 text-red-500">
                <RefreshCcw className="h-5 w-5" /> Solicitar Devolução
              </h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{returningItem.product_name}</p>

              {returnMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm font-medium border ${returnMessage.includes("sucesso") ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                  {returnMessage}
                </div>
              )}

              <form onSubmit={submitReturn} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Motivo da Devolução</label>
                  <select 
                    value={returnReason} 
                    onChange={e => setReturnReason(e.target.value)} 
                    className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background focus:border-primary outline-none text-sm"
                  >
                    <option value="remorse">Arrependimento (Em até 7 dias)</option>
                    <option value="defect">Produto com Defeito</option>
                    <option value="wrong">Recebi o Produto Errado</option>
                    <option value="late">Atraso Extremo na Entrega</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Detalhes Adicionais</label>
                  <textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Por favor, explique o problema para o lojista..." rows={4} className="w-full px-4 py-2 rounded-lg border border-border/60 bg-background focus:border-primary outline-none text-sm resize-none" />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setReturningItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-secondary/50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={submittingReturn} className="px-6 py-2 rounded-xl bg-red-500 text-white text-sm font-bold shadow-lg hover:bg-red-600 transition-all flex items-center gap-2 disabled:opacity-50">
                    {submittingReturn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Confirmar Solicitação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CHAT COM O LOJISTA */}
      <AnimatePresence>
        {chattingWith && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChattingWith(null)} className="absolute inset-0 bg-black/5 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }} className="relative w-full max-w-md bg-background rounded-3xl shadow-2xl border border-border z-10 overflow-hidden flex flex-col h-[600px]">
              
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-gradient-to-r from-blue-600/20 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Store className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground leading-tight">{chattingWith.seller_name}</h3>
                    <p className="text-xs text-emerald-400 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online agora</p>
                  </div>
                </div>
                <button onClick={() => setChattingWith(null)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-black/[0.04] rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white/[0.05] text-neutral-200 border border-white/[0.02] rounded-bl-none'}`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-border bg-black/5">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatMessage.trim()) return;
                    setChatHistory([...chatHistory, { id: Date.now(), sender: 'user', text: chatMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
                    setChatMessage("");
                    // Simulate seller typing
                    setTimeout(() => {
                      setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'seller', text: 'Entendido! Vou verificar isso imediatamente para você.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
                    }, 1500);
                  }}
                  className="relative flex items-center"
                >
                  <input 
                    type="text" 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Digite sua mensagem..." 
                    className="w-full bg-card border border-border rounded-full pl-4 pr-12 py-3 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button type="submit" className="absolute right-2 w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full hover:scale-105 transition-transform disabled:opacity-50">
                    <Send className="h-4 w-4 ml-0.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
