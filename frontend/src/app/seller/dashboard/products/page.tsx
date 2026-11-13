"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Package, Loader2, X, DollarSign, Trash2, Eye, EyeOff, ImageOff, CheckCircle2, AlertTriangle, ArrowLeft, Edit, Zap } from "lucide-react";
import { Header } from "@/components/Header";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { sellerDashboardApi, catalogApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ProductMediaUploader, UploaderImage } from "@/components/seller/ProductMediaUploader";
import { ProductFormFields, CategoryOption } from "@/components/seller/ProductFormFields";
import { ProductFormValues, emptyProductForm, productToForm, toProductPayload } from "@/lib/productForm";
import { useToast } from "@/components/ui/Toast";
import Confetti from "react-confetti";

interface SellerProduct {
  id: string;
  name: string;
  base_price: string | number;
  promotional_price: string | number | null;
  promo_ends_at: string | null;
  is_available: boolean;
  is_boosted?: boolean;
  primary_image: string | null;
  slug: string;
}

export default function SellerProductsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Modal: "create" (formulário) → "media" (uploader); "media" direto; "promo"; "edit"
  const [modalStep, setModalStep] = useState<null | "create" | "media" | "promo" | "edit">(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<SellerProduct | null>(null);
  const [initialImages, setInitialImages] = useState<UploaderImage[]>([]);
  const [initialVideo, setInitialVideo] = useState<string | null>(null);
  const [mediaCount, setMediaCount] = useState(0);

  // Promo Form
  const [promoPrice, setPromoPrice] = useState("");
  const [promoEndsAt, setPromoEndsAt] = useState("");

  // Form de criação/edição (mesmos campos nos dois modais)
  const [form, setForm] = useState<ProductFormValues>(emptyProductForm);
  const patchForm = (patch: Partial<ProductFormValues>) => setForm((f) => ({ ...f, ...patch }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await sellerDashboardApi.products.list();
      setProducts(data.results || data);
    } catch {
      // silencioso — provavelmente sem loja ainda
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchProducts();
    catalogApi.getCategories()
      .then((res) => setCategories(res.data.results || res.data))
      .catch(() => {});
  }, [isAuthenticated]);

  const openCreate = () => {
    setForm(emptyProductForm);
    setFormError(""); setActiveProductId(null);
    setInitialImages([]); setInitialVideo(null); setMediaCount(0);
    setModalStep("create");
  };

  // Mensagem de erro útil: a API devolve {campo: ["erro"]} nas validações.
  const apiErrorMessage = (err: any, fallback: string) => {
    const data = err.response?.data;
    if (data?.detail) return data.detail;
    if (data && typeof data === "object") {
      const first = Object.values(data).flat()[0];
      if (typeof first === "string") return first;
    }
    return fallback;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) {
      setFormError("Escolha a categoria da peça.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const { data } = await sellerDashboardApi.products.create(toProductPayload(form));
      setActiveProductId(data.id);
      setInitialImages([]); setInitialVideo(null); setMediaCount(0);
      setModalStep("media");
      fetchProducts();
    } catch (err: any) {
      setFormError(apiErrorMessage(err, "Erro ao criar o produto. Verifique os dados."));
    } finally {
      setSaving(false);
    }
  };

  const openMedia = async (productId: string) => {
    setActiveProductId(productId);
    setInitialImages([]); setInitialVideo(null); setMediaCount(0);
    setModalStep("media");
    try {
      const { data } = await sellerDashboardApi.products.get(productId);
      const imgs: UploaderImage[] = data.images || [];
      setInitialImages(imgs);
      setInitialVideo(data.video_url || null);
      setMediaCount(imgs.length);
    } catch {
      /* mantém vazio */
    }
  };

  const togglePublish = async (p: SellerProduct) => {
    try {
      await sellerDashboardApi.products.update(p.id, { is_available: !p.is_available });
      fetchProducts();
    } catch {
      /* ignore */
    }
  };

  const removeProduct = async (p: SellerProduct) => {
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await sellerDashboardApi.products.delete(p.id);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Não foi possível excluir (produto com pedidos? desative-o).");
    }
  };

  const publishAndClose = async () => {
    if (!activeProductId) return;
    if (mediaCount < 1) return;
    try {
      await sellerDashboardApi.products.update(activeProductId, { is_available: true });
    } catch {
      /* ignore */
    }
    setModalStep(null);
    fetchProducts();
  };

  const openEdit = async (p: SellerProduct) => {
    setActiveProductId(p.id);
    // Mostra nome e preço da lista enquanto o detalhe completo carrega.
    setForm({ ...emptyProductForm, name: p.name, basePrice: p.base_price.toString() });
    setFormError("");
    setModalStep("edit");
    try {
      const { data } = await sellerDashboardApi.products.get(p.id);
      setForm(productToForm(data));
    } catch {
      setFormError("Não foi possível carregar todos os dados do produto. Feche e tente de novo.");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProductId) return;
    if (!form.categoryId) {
      setFormError("Escolha a categoria da peça.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await sellerDashboardApi.products.update(activeProductId, toProductPayload(form));
      setModalStep(null);
      fetchProducts();
    } catch (err: any) {
      setFormError(apiErrorMessage(err, "Erro ao editar o produto."));
    } finally {
      setSaving(false);
    }
  };

  const openPromo = (p: SellerProduct) => {
    setActiveProduct(p);
    setPromoPrice(p.promotional_price ? p.promotional_price.toString() : "");
    setPromoEndsAt(p.promo_ends_at ? new Date(p.promo_ends_at).toISOString().slice(0, 16) : "");
    setFormError("");
    setModalStep("promo");
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    setSaving(true);
    setFormError("");
    try {
      if (!promoPrice) {
         // Cancel Promo
         await catalogApi.setPromo(activeProduct.slug, { promotional_price: null, promo_ends_at: null });
         toast("Promoção removida.", "info");
      } else {
         const endIso = promoEndsAt ? new Date(promoEndsAt).toISOString() : new Date(Date.now() + 7*24*60*60*1000).toISOString();
         await catalogApi.setPromo(activeProduct.slug, { promotional_price: parseFloat(promoPrice), promo_ends_at: endIso });
         setShowConfetti(true);
         toast("Produto promovido com sucesso!", "success");
         setTimeout(() => setShowConfetti(false), 5000);
      }
      setModalStep(null);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Erro ao definir promoção. Preço promocional deve ser menor que o original.");
      toast("Falha ao promover produto.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {showConfetti && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <Confetti width={typeof window !== 'undefined' ? window.innerWidth : 1200} height={typeof window !== 'undefined' ? window.innerHeight : 800} recycle={false} numberOfPieces={300} />
        </div>
      )}
      <Header />
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Topo */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6 mb-8">
          <div>
            <button
              onClick={() => router.push("/seller/dashboard")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao painel
            </button>
            <h1 className="text-3xl font-display font-black text-foreground">Meus Produtos</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie seus anúncios — até 6 fotos e 1 vídeo por produto.</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 font-bold text-sm shadow-md transition-all"
          >
            <Plus className="w-5 h-5" /> Novo Produto
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <BrandLoader size="lg" text="Carregando catálogo..." />
        ) : products.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/50 rounded-2xl">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground">Nenhum produto ainda</h3>
            <p className="text-sm text-muted-foreground mb-6">Crie seu primeiro anúncio com fotos e vídeo.</p>
            <button onClick={openCreate} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm inline-flex items-center gap-2">
              <Plus className="w-5 h-5" /> Criar produto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden flex flex-col">
                <div className="aspect-video bg-black/20 relative">
                  {p.primary_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.primary_image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
                      <ImageOff className="w-7 h-7" /> <span className="text-xs">Sem foto</span>
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                    p.is_available ? "bg-emerald-500/90 text-white" : "bg-neutral-700/90 text-neutral-200"
                  }`}>
                    {p.is_available ? "Publicado" : "Rascunho"}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-3 flex-grow">
                  <div className="flex-grow">
                    <h3 className="font-bold text-foreground line-clamp-1">{p.name}</h3>
                    <p className="text-primary font-display font-black">
                      R$ {Number(p.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openMedia(p.id)}
                      className="flex-grow text-sm font-semibold py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Mídia
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      title="Editar Info"
                      className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openPromo(p)}
                      title="Promover Produto (Desconto)"
                      className={`p-2 rounded-lg transition-colors ${p.promotional_price ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"}`}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await sellerDashboardApi.products.toggleBoost(p.id);
                          toast(p.is_boosted ? "Impulsionamento desativado." : "Produto Impulsionado com Sucesso! 🚀", "success");
                          if (!p.is_boosted) {
                            setShowConfetti(true);
                            setTimeout(() => setShowConfetti(false), 5000);
                          }
                          fetchProducts();
                        } catch (err) { 
                          toast("Erro ao impulsionar o produto.", "error"); 
                        }
                      }}
                      title={p.is_boosted ? "Remover Impulsionamento" : "Impulsionar Produto 🚀"}
                      className={`p-2 rounded-lg transition-colors ${p.is_boosted ? "bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"}`}
                    >
                      🚀
                    </button>
                    <button
                      onClick={() => togglePublish(p)}
                      title={p.is_available ? "Despublicar" : "Publicar"}
                      className="p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 text-foreground transition-colors"
                    >
                      {p.is_available ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => removeProduct(p)}
                      title="Excluir"
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL */}
      <AnimatePresence>
        {modalStep && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalStep(null)} className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0A0A15] border border-white/10 rounded-3xl p-6 md:p-8 text-neutral-200"
            >
              <button onClick={() => setModalStep(null)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>

              {modalStep === "create" && (
                <>
                  <h2 className="text-2xl font-black text-white mb-1">Novo Produto</h2>
                  <p className="text-sm text-neutral-400 mb-6">Comece pelo básico. Em seguida você adiciona fotos e vídeo.</p>
                  {formError && (
                    <div className="mb-4 text-sm px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
                    </div>
                  )}
                  <form onSubmit={handleCreate} className="space-y-4">
                    <ProductFormFields values={form} onChange={patchForm} categories={categories} />
                    <button type="submit" disabled={saving}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#E6B53C] to-[#B38F25] text-black font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      {saving ? "Criando..." : "Criar e adicionar fotos"}
                    </button>
                  </form>
                </>
              )}

              {modalStep === "media" && activeProductId && (
                <>
                  <h2 className="text-2xl font-black text-white mb-1">Fotos & Vídeo</h2>
                  <p className="text-sm text-neutral-400 mb-6">As mídias são salvas automaticamente ao adicionar.</p>
                  <ProductMediaUploader
                    productId={activeProductId}
                    initialImages={initialImages}
                    initialVideoUrl={initialVideo}
                    onChange={({ images }) => setMediaCount(images.length)}
                  />
                  <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between gap-3">
                    <span className="text-xs text-neutral-500">
                      {mediaCount > 0 ? `${mediaCount} foto(s) salva(s).` : "Adicione ao menos 1 foto para publicar."}
                    </span>
                    <button
                      onClick={publishAndClose}
                      disabled={mediaCount < 1}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black hover:opacity-90 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Publicar
                    </button>
                  </div>
                </>
              )}

              {modalStep === "edit" && activeProductId && (
                <>
                  <h2 className="text-2xl font-black text-white mb-1">Editar Produto</h2>
                  <p className="text-sm text-neutral-400 mb-6">Atualize os dados básicos do produto.</p>
                  {formError && (
                    <div className="mb-4 text-sm px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
                    </div>
                  )}
                  <form onSubmit={handleEdit} className="space-y-4">
                    <ProductFormFields values={form} onChange={patchForm} categories={categories} stockLabel="Estoque (Opcional)" stockPlaceholder="Mudar estoque base" />
                    <button type="submit" disabled={saving}
                      className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#E6B53C] to-[#B38F25] text-black font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      {saving ? "Salvando..." : "Salvar Alterações"}
                    </button>
                  </form>
                </>
              )}

              {modalStep === "promo" && activeProduct && (
                <>
                  <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2"><Zap className="text-yellow-400 w-6 h-6" /> Promover Produto</h2>
                  <p className="text-sm text-neutral-400 mb-6">Ofereça um desconto de pelo menos 10% para que ele seja notificado aos clientes e listado nas <strong>SUPER OFERTAS</strong>!</p>
                  
                  {formError && (
                    <div className="mb-4 text-sm px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
                    </div>
                  )}

                  <form onSubmit={handleSavePromo} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Preço Original</label>
                      <input disabled value={`R$ ${Number(activeProduct.base_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} className="w-full mt-1.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-neutral-500 outline-none cursor-not-allowed" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-yellow-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Preço Promocional</label>
                        <input type="number" step="0.01" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)}
                          className="w-full mt-1.5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-black focus:border-red-500 outline-none"
                          placeholder="Ex: 99.90 (Deixe vazio p/ cancelar)" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Fim da Promoção</label>
                        <input type="datetime-local" value={promoEndsAt} onChange={(e) => setPromoEndsAt(e.target.value)}
                          className="w-full mt-1.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-[#E6B53C] outline-none" />
                      </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between gap-3">
                      <button type="button" onClick={() => setModalStep(null)} className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors">Cancelar</button>
                      <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-black hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                        {promoPrice ? "Ativar Oferta!" : "Remover Oferta"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
