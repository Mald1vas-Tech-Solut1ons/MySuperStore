"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { authApi, usersApi } from "@/lib/api";
import {
  User, MapPin, Save, Plus, Trash2, Edit2, Camera, Lock, X,
  Check, ShieldCheck, Home, Briefcase, Building2,
  Eye, EyeOff, AlertTriangle, CreditCard, Mail, Heart, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  reference_point?: string;
  is_default: boolean;
}

const LABEL_OPTIONS = [
  { id: "Casa", icon: Home },
  { id: "Trabalho", icon: Briefcase },
  { id: "Outro", icon: Building2 },
];

type Tab = "perfil" | "preferencias" | "enderecos" | "pagamentos" | "seguranca";

export default function AccountDashboardPage() {
  const { user, updateUser } = useAuthStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("perfil");

  // ── Perfil Principal ────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({ first_name: "", last_name: "", phone: "", cpf_cnpj: "", person_type: "PF" });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Preferências (Survey/Bio) ────────────────────────────────────────────────
  const [survey, setSurvey] = useState({
    bio: "",
    date_of_birth: "",
    gender: "",
    profession: "",
    marital_status: "",
    preferred_category: "",
  });
  const [savingSurvey, setSavingSurvey] = useState(false);

  // ── Endereços ─────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [addrModal, setAddrModal] = useState<(Omit<Address, "id"> & { id?: string }) | null>(null);
  const [savingAddr, setSavingAddr] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // CEP state inside modal
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepReady, setCepReady] = useState(false);

  // ── Senha ─────────────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });

  useEffect(() => {
    if (user) {
      setProfile({ 
        first_name: user.first_name || "", 
        last_name: user.last_name || "", 
        phone: user.phone || "",
        cpf_cnpj: user.cpf_cnpj || "",
        person_type: user.person_type || "PF"
      });
      setAvatarPreview(user.avatar_url || (user as any)?.avatar || null);
    }
    loadAddresses();
    loadSurvey();
  }, [user]);

  const loadAddresses = async () => {
    setLoadingAddr(true);
    try {
      const res = await usersApi.addresses();
      setAddresses(res.data.results || res.data);
    } catch { /* silencioso */ } finally {
      setLoadingAddr(false);
    }
  };

  const loadSurvey = async () => {
    try {
      const res = await usersApi.survey();
      if (res.data) {
        setSurvey({
          bio: res.data.bio || "",
          date_of_birth: res.data.date_of_birth || "",
          gender: res.data.gender || "",
          profession: res.data.profession || "",
          marital_status: res.data.marital_status || "",
          preferred_category: res.data.preferred_category || "",
        });
      }
    } catch { /* ignora */ }
  };

  // ── Avatar Handler (Instant Upload) ───────────────────────────────────────
  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    // Preview local imediato
    setAvatarPreview(URL.createObjectURL(f));
    setUploadingAvatar(true);
    
    try {
      const payload = new FormData();
      payload.append("first_name", profile.first_name);
      payload.append("last_name", profile.last_name);
      payload.append("avatar", f);
      
      const res = await authApi.updateProfile(payload);
      updateUser(res.data);
      toast("Foto de perfil atualizada com sucesso!", "success");
    } catch (err) {
      toast("Erro ao enviar a foto de perfil.", "error");
      // Reverte preview
      setAvatarPreview(user?.avatar_url || (user as any)?.avatar || null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = { 
        first_name: profile.first_name, 
        last_name: profile.last_name, 
        phone: profile.phone || null,
        cpf_cnpj: profile.cpf_cnpj || null,
        person_type: profile.person_type
      };
      const res = await authApi.updateProfile(payload);
      updateUser(res.data);
      toast("Perfil atualizado com sucesso!", "success");
    } catch (err: any) {
      toast(err?.response?.data?.phone?.[0] || err?.response?.data?.detail || "Erro ao salvar o perfil.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSurveyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSurvey(true);
    try {
      await usersApi.saveSurvey(survey);
      toast("Preferências atualizadas!", "success");
    } catch (err) {
      toast("Erro ao salvar preferências.", "error");
    } finally {
      setSavingSurvey(false);
    }
  };

  // ── Endereço handlers ────────────────────────────────────────────────────
  const openNewAddress = () => {
    setCepError("");
    setCepReady(false);
    setAddrModal({
      label: "Casa",
      recipient_name: `${profile.first_name} ${profile.last_name}`.trim(),
      cep: "", logradouro: "", numero: "", complemento: "",
      bairro: "", cidade: "", uf: "", reference_point: "", is_default: false,
    });
  };

  const openEditAddress = (addr: Address) => {
    setCepError("");
    setCepReady(!!(addr.logradouro && addr.bairro));
    setAddrModal({ ...addr });
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").substring(0, 8);
    const fmt = raw.length > 5 ? `${raw.substring(0, 5)}-${raw.substring(5)}` : raw;
    setAddrModal(prev => prev ? { ...prev, cep: fmt, logradouro: "", bairro: "", cidade: "", uf: "" } : null);
    setCepError("");
    setCepReady(false);
    if (raw.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepError("CEP não encontrado.");
        } else {
          setAddrModal(prev => prev ? ({
            ...prev,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || "",
          }) : null);
          setCepReady(true);
        }
      } catch {
        setCepError("Erro ao buscar CEP.");
      } finally {
        setCepLoading(false);
      }
    }
  };

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrModal) return;
    setSavingAddr(true);
    try {
      const { id, ...data } = addrModal;
      data.cep = data.cep.replace(/\D/g, "");
      if (id) await usersApi.updateAddress(id, data);
      else await usersApi.createAddress(data);
      setAddrModal(null);
      await loadAddresses();
      toast(id ? "Endereço atualizado!" : "Endereço adicionado!", "success");
    } catch (err: any) {
      toast(err?.response?.data?.detail || "Erro ao salvar endereço.", "error");
    } finally {
      setSavingAddr(false);
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await usersApi.deleteAddress(id);
      setDeleteConfirm(null);
      await loadAddresses();
      toast("Endereço removido.", "success");
    } catch {
      toast("Erro ao remover endereço.", "error");
    }
  };

  const setDefault = async (addr: Address) => {
    try {
      await usersApi.updateAddress(addr.id, { is_default: true });
      await loadAddresses();
      toast("Endereço padrão atualizado.", "success");
    } catch {
      toast("Erro ao definir padrão.", "error");
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.new_password_confirm) {
      return toast("As senhas não coincidem.", "error");
    }
    setSavingPwd(true);
    try {
      await authApi.changePassword(pwd);
      toast("Senha alterada com sucesso!", "success");
      setPwd({ old_password: "", new_password: "", new_password_confirm: "" });
    } catch (err: any) {
      const d = err.response?.data;
      const text = d?.old_password?.[0] || d?.new_password?.[0] || d?.non_field_errors?.[0] || "Erro ao alterar senha.";
      toast(text, "error");
    } finally {
      setSavingPwd(false);
    }
  };

  const initials = `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "perfil", label: "Dados Pessoais", icon: User },
    { id: "preferencias", label: "Bio & Preferências", icon: Heart },
    { id: "enderecos", label: "Endereços", icon: MapPin },
    { id: "pagamentos", label: "Cartões", icon: CreditCard },
    { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      
      {/* ── HEADER DA CONTA ── */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-6 md:p-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-md shadow-lg">
        <div className="relative group cursor-pointer shrink-0" onClick={() => fileRef.current?.click()}>
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-background shadow-lg bg-secondary flex items-center justify-center relative">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className={`w-full h-full object-cover transition-opacity ${uploadingAvatar ? 'opacity-50' : ''}`} />
            ) : (
              <span className="text-3xl font-display font-bold text-primary">{initials || <User className="h-10 w-10" />}</span>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                <Loader2 className="w-8 h-8 animate-spin text-foreground" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-6 h-6 md:w-8 md:h-8 text-foreground" />
          </div>
          <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={onPickAvatar} disabled={uploadingAvatar} />
        </div>
        
        <div className="text-center md:text-left pt-2 md:pt-4">
          <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight">{profile.first_name} {profile.last_name}</h1>
          <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2 mt-2">
            <Mail className="w-4 h-4" /> {user?.email}
          </p>
        </div>
      </div>

      {/* ── TABS HORIZONTAIS ── */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 p-1 bg-secondary/30 rounded-2xl border border-border/40">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >

            {/* ═══════════ PERFIL ═══════════ */}
            {activeTab === "perfil" && (
              <form onSubmit={saveProfile} className="p-6 md:p-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm shadow-xl space-y-8">
                <div>
                  <h2 className="text-2xl font-display font-bold mb-1">Dados Pessoais</h2>
                  <p className="text-muted-foreground text-sm">Atualize suas informações básicas de identificação e contato.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AccountField label="Nome" value={profile.first_name} onChange={v => setProfile({ ...profile, first_name: v })} required />
                  <AccountField label="Sobrenome" value={profile.last_name} onChange={v => setProfile({ ...profile, last_name: v })} required />
                  <AccountField label="E-mail (Login)" value={user?.email || ""} onChange={() => {}} disabled title="O e-mail não pode ser alterado" className="opacity-60 cursor-not-allowed bg-secondary/50" />
                  <AccountField label="Telefone / Celular" value={profile.phone} onChange={v => setProfile({ ...profile, phone: v })} placeholder="(11) 99999-9999" />
                  <AccountField label="CPF / CNPJ" value={profile.cpf_cnpj} onChange={v => setProfile({ ...profile, cpf_cnpj: v })} placeholder="000.000.000-00" />
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Tipo de Pessoa</label>
                    <select 
                      value={profile.person_type} 
                      onChange={e => setProfile({ ...profile, person_type: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background focus:border-primary outline-none transition-colors text-sm font-medium"
                    >
                      <option value="PF">Pessoa Física (PF)</option>
                      <option value="PJ">Pessoa Jurídica (PJ)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/30 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Alterações
                  </button>
                </div>
              </form>
            )}

            {/* ═══════════ PREFERÊNCIAS & BIO ═══════════ */}
            {activeTab === "preferencias" && (
              <form onSubmit={saveSurveyForm} className="p-6 md:p-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm shadow-xl space-y-8">
                <div>
                  <h2 className="text-2xl font-display font-bold mb-1">Bio e Preferências</h2>
                  <p className="text-muted-foreground text-sm">Conte um pouco mais sobre você para personalizarmos sua experiência.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CAMPO BIO ADICIONADO */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Minha Bio (Sobre Mim)</label>
                    <textarea 
                      value={survey.bio}
                      onChange={e => setSurvey({ ...survey, bio: e.target.value })}
                      placeholder="Conte um pouco sobre você..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background focus:border-primary outline-none transition-colors text-sm font-medium resize-none"
                    />
                  </div>

                  <AccountField label="Profissão" value={survey.profession} onChange={v => setSurvey({ ...survey, profession: v })} placeholder="Ex: Designer, Engenheiro" />
                  <AccountField label="Data de Nascimento" type="date" value={survey.date_of_birth} onChange={v => setSurvey({ ...survey, date_of_birth: v })} />
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Gênero</label>
                    <select 
                      value={survey.gender} 
                      onChange={e => setSurvey({ ...survey, gender: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background focus:border-primary outline-none transition-colors text-sm font-medium"
                    >
                      <option value="">Prefiro não informar</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Estado Civil</label>
                    <select 
                      value={survey.marital_status} 
                      onChange={e => setSurvey({ ...survey, marital_status: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background focus:border-primary outline-none transition-colors text-sm font-medium"
                    >
                      <option value="">Não informado</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                    </select>
                  </div>

                  <AccountField label="Categoria Favorita" value={survey.preferred_category} onChange={v => setSurvey({ ...survey, preferred_category: v })} placeholder="Ex: Tecnologia, Moda" className="md:col-span-2" />
                </div>

                <div className="pt-4 border-t border-border/30 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSurvey}
                    className="px-8 py-3 rounded-xl bg-purple-600 text-foreground font-bold hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-600/20"
                  >
                    {savingSurvey ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Preferências
                  </button>
                </div>
              </form>
            )}

            {/* ═══════════ ENDEREÇOS ═══════════ */}
            {activeTab === "enderecos" && (
              <div className="p-6 md:p-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm shadow-xl space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-display font-bold mb-1">Meus Endereços</h2>
                    <p className="text-muted-foreground text-sm">Gerencie seus endereços de entrega.</p>
                  </div>
                  <button
                    onClick={openNewAddress}
                    className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Novo Endereço
                  </button>
                </div>

                {loadingAddr ? (
                  <div className="py-12 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : addresses.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/50 rounded-2xl bg-secondary/20">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-bold">Nenhum endereço salvo</h3>
                    <p className="text-muted-foreground text-sm mt-1 max-w-sm">Adicione um endereço para facilitar suas compras futuras.</p>
                    <button onClick={openNewAddress} className="mt-6 px-6 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shadow-md">
                      Adicionar Agora
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {addresses.map(addr => {
                      const iconOpt = LABEL_OPTIONS.find(o => o.id === addr.label) || LABEL_OPTIONS[2];
                      const LIcon = iconOpt.icon;
                      return (
                        <div key={addr.id} className={`relative p-6 rounded-2xl border transition-all ${addr.is_default ? "border-primary bg-primary/5 shadow-md" : "border-border/50 bg-background/50 hover:border-border"}`}>
                          {addr.is_default && (
                            <span className="absolute top-0 right-0 translate-x-2 -translate-y-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <Check className="w-3 h-3" /> Padrão
                            </span>
                          )}
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2.5 rounded-xl ${addr.is_default ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                              <LIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg leading-tight">{addr.label}</h3>
                              <p className="text-xs text-muted-foreground">{addr.recipient_name}</p>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1 mb-6">
                            <p>{addr.logradouro}, {addr.numero} {addr.complemento && `- ${addr.complemento}`}</p>
                            <p>{addr.bairro} - {addr.cidade}/{addr.uf}</p>
                            <p className="font-mono text-xs opacity-70 mt-1">CEP: {addr.cep}</p>
                          </div>
                          <div className="flex items-center gap-2 pt-4 border-t border-border/40">
                            {!addr.is_default && (
                              <button onClick={() => setDefault(addr)} className="text-xs font-semibold text-primary hover:underline">
                                Tornar Padrão
                              </button>
                            )}
                            <div className="flex-1" />
                            <button onClick={() => openEditAddress(addr)} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(addr.id)} className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ PAGAMENTOS (NOVO CRUD FAKE/PREMIUM) ═══════════ */}
            {activeTab === "pagamentos" && (
              <div className="p-6 md:p-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm shadow-xl space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-display font-bold mb-1">Meus Cartões</h2>
                    <p className="text-muted-foreground text-sm">Gerencie suas formas de pagamento de forma segura.</p>
                  </div>
                  <button
                    className="px-5 py-2.5 rounded-xl bg-blue-500/10 text-blue-500 font-bold hover:bg-blue-500 hover:text-foreground transition-all flex items-center gap-2"
                    onClick={() => toast("Adicionar cartão em breve!", "info")}
                  >
                    <Plus className="w-5 h-5" /> Adicionar Cartão
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cartão Fake 1 */}
                  <div className="relative p-6 rounded-2xl bg-gradient-to-br from-neutral-800 to-black border border-neutral-700 text-white shadow-xl overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                      <CreditCard className="w-32 h-32 rotate-12 translate-x-8 -translate-y-8" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-8">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" alt="Mastercard" className="h-8 object-contain" />
                        <span className="bg-black/[0.04] text-foreground text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-md">Principal</span>
                      </div>
                      <div className="space-y-1 mb-4">
                        <p className="font-mono text-lg tracking-widest text-white/90">**** **** **** 4821</p>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-white/60 uppercase tracking-widest">Titular</p>
                          <p className="font-semibold text-sm uppercase">{profile.first_name || "NOME"} {profile.last_name || "SOBRENOME"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/60 uppercase tracking-widest">Validade</p>
                          <p className="font-semibold text-sm">12/28</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20 backdrop-blur-sm">
                      <button className="p-3 bg-black/[0.04] rounded-full hover:bg-black/[0.04] transition-colors text-foreground" title="Editar">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button className="p-3 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors text-white" title="Remover">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Espaço para novo cartão */}
                  <button 
                    onClick={() => toast("Adicionar cartão em breve!", "info")}
                    className="p-6 flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-border/60 bg-secondary/10 hover:bg-secondary/30 hover:border-primary/50 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="font-bold">Adicionar novo cartão</h3>
                    <p className="text-xs text-muted-foreground mt-1">Cartão de Crédito ou Débito</p>
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════ SEGURANÇA ═══════════ */}
            {activeTab === "seguranca" && (
              <div className="p-6 md:p-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm shadow-xl space-y-8">
                <div>
                  <h2 className="text-2xl font-display font-bold mb-1">Segurança</h2>
                  <p className="text-muted-foreground text-sm">Atualize sua senha e mantenha sua conta segura.</p>
                </div>

                <form onSubmit={changePassword} className="max-w-md space-y-5">
                  <PwdField
                    label="Senha Atual"
                    value={pwd.old_password}
                    show={showPwd.old}
                    onToggle={() => setShowPwd({ ...showPwd, old: !showPwd.old })}
                    onChange={v => setPwd({ ...pwd, old_password: v })}
                  />
                  <div className="h-px bg-border/40 my-4" />
                  <PwdField
                    label="Nova Senha"
                    value={pwd.new_password}
                    show={showPwd.new}
                    onToggle={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                    onChange={v => setPwd({ ...pwd, new_password: v })}
                  />
                  <PwdField
                    label="Confirmar Nova Senha"
                    value={pwd.new_password_confirm}
                    show={showPwd.confirm}
                    onToggle={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                    onChange={v => setPwd({ ...pwd, new_password_confirm: v })}
                  />
                  <button
                    type="submit"
                    disabled={savingPwd}
                    className="w-full mt-4 py-3 rounded-xl bg-foreground text-background font-bold hover:bg-foreground/90 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {savingPwd ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                    Atualizar Senha
                  </button>
                </form>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modal de Endereço ── */}
      {addrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/5 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-background rounded-3xl overflow-hidden shadow-2xl border border-border"
          >
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/30">
              <h2 className="text-lg font-bold">{addrModal.id ? "Editar Endereço" : "Novo Endereço"}</h2>
              <button onClick={() => setAddrModal(null)} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveAddress} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Dar um nome para o endereço</label>
                <div className="flex flex-wrap gap-2">
                  {LABEL_OPTIONS.map(opt => (
                    <button
                      key={opt.id} type="button"
                      onClick={() => setAddrModal({ ...addrModal, label: opt.id })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                        addrModal.label === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                      }`}
                    >
                      <opt.icon className="h-4 w-4" /> {opt.id}
                    </button>
                  ))}
                  {/* Se for "Outro", mostra um input */}
                  {!LABEL_OPTIONS.find(o => o.id === addrModal.label) && addrModal.label !== "" && (
                    <input
                      autoFocus
                      value={addrModal.label}
                      onChange={e => setAddrModal({ ...addrModal, label: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-primary bg-background text-sm w-32 outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AccountField label="CEP" value={addrModal.cep} onChange={() => {}} 
                  disabled={cepLoading}
                  placeholder="00000-000"
                  onChangeCapture={(e: any) => handleCepChange(e)}
                />
                {cepLoading && <div className="flex items-center gap-2 text-sm text-primary mt-6"><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</div>}
                {cepError && <div className="flex items-center gap-2 text-sm text-destructive mt-6"><AlertTriangle className="w-4 h-4" /> {cepError}</div>}
                
                <AccountField className="md:col-span-2" label="Nome do Recebedor" value={addrModal.recipient_name} onChange={v => setAddrModal({ ...addrModal, recipient_name: v })} required />

                {cepReady && (
                  <>
                    <AccountField className="md:col-span-2" label="Endereço / Logradouro" value={addrModal.logradouro} onChange={v => setAddrModal({ ...addrModal, logradouro: v })} required />
                    <AccountField label="Número" value={addrModal.numero} onChange={v => setAddrModal({ ...addrModal, numero: v })} required />
                    <AccountField label="Complemento (Opcional)" value={addrModal.complemento} onChange={v => setAddrModal({ ...addrModal, complemento: v })} />
                    <AccountField label="Bairro" value={addrModal.bairro} onChange={v => setAddrModal({ ...addrModal, bairro: v })} required />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2"><AccountField label="Cidade" value={addrModal.cidade} onChange={v => setAddrModal({ ...addrModal, cidade: v })} required /></div>
                      <AccountField label="UF" value={addrModal.uf} onChange={v => setAddrModal({ ...addrModal, uf: v })} required />
                    </div>
                    <AccountField className="md:col-span-2" label="Ponto de Referência (Opcional)" value={addrModal.reference_point || ""} onChange={v => setAddrModal({ ...addrModal, reference_point: v })} />
                  </>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button type="button" onClick={() => setAddrModal(null)} className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-secondary transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!cepReady || savingAddr} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2">
                  {savingAddr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Endereço
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Modal de Exclusão ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/5 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-background max-w-sm rounded-3xl p-6 shadow-2xl text-center border border-border">
            <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Excluir Endereço?</h3>
            <p className="text-muted-foreground text-sm mb-6">Esta ação não pode ser desfeita. O endereço será removido da sua lista.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-xl font-bold bg-secondary hover:bg-secondary/80 transition-colors">Cancelar</button>
              <button onClick={() => deleteAddress(deleteConfirm)} className="flex-1 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">Excluir</button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function AccountField({
  label, value, onChange, className, ...props
}: { label: string; value: string; onChange: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        {...props}
        className={`w-full px-4 py-3 rounded-xl border border-border/60 bg-background focus:border-primary outline-none transition-colors text-sm font-medium ${props.disabled ? 'opacity-60 cursor-not-allowed bg-secondary/50' : ''}`}
      />
    </div>
  );
}

function PwdField({
  label, value, show, onToggle, onChange,
}: {
  label: string; value: string; show: boolean;
  onToggle: () => void; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          className="w-full px-4 pr-11 py-3 rounded-xl border border-border/60 bg-background focus:border-primary outline-none transition-colors text-sm font-medium"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
