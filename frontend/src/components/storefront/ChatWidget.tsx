"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { brand, whatsappLink } from "@/config/brand";
import { brl } from "@/lib/storefront";

type Product = { slug: string; name: string; price: number; image?: string | null };
type Msg = { role: "user" | "assistant"; content: string; products?: Product[]; local?: boolean; wa?: boolean };

const GREETING = brand.chat.greeting;
const CHIPS = brand.chat.chips;
const ERROR_TEXT = "Estou com muita procura agora. Fale com a gente pelo WhatsApp que respondemos rapidinho.";
const WA_LINK = whatsappLink(`Olá! Vim pelo site e queria falar com o ${brand.shopNoun}.`);

// Atendimento por IA: o histórico vai ao backend, que fala com o Gemini usando
// catálogo, cupons e base de conhecimento reais. Nenhuma chave no navegador.
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING, local: true }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (open && el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading, open, reduce]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const history = next.filter((m) => !m.local).slice(-12).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await api.post("/assistant/chat/", { messages: history });
      const data = res.data as { reply: string; products?: Product[] };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, products: data.products ?? [] }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: ERROR_TEXT, local: true, wa: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir chat do ateliê"
        aria-expanded={open}
        className={`fixed bottom-4 right-4 z-[70] h-14 w-14 place-items-center rounded-full bg-atelie-ink text-atelie-cream shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay sm:bottom-5 sm:right-5 ${open ? "hidden" : "grid"}`}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Assistente do ateliê"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-atelie-cream font-atelie shadow-2xl ring-1 ring-black/10 sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(560px,calc(100dvh-7rem))] sm:w-[380px] sm:rounded-3xl"
          >
            <header className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-atelie-clay font-serif text-white">E</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[16px] text-atelie-ink">{brand.name}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-atelie-ink/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Assistente do ateliê · responde na hora
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat" className="grid h-9 w-9 place-items-center rounded-full text-atelie-ink/70 hover:bg-black/5">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-atelie-ink px-3.5 py-2 text-[14px] leading-relaxed text-atelie-cream">{m.content}</p>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-start gap-2">
                    <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[14px] leading-relaxed text-atelie-ink ring-1 ring-black/5">{m.content}</p>
                    {m.wa && WA_LINK && (
                      <a href={WA_LINK} target="_blank" rel="noreferrer" className="rounded-full bg-atelie-ink px-3.5 py-2 text-[12px] text-atelie-cream">Abrir WhatsApp</a>
                    )}
                    {!!m.products?.length && (
                      <ul className="flex w-full gap-2 overflow-x-auto pb-1">
                        {m.products.map((p) => (
                          <li key={p.slug}>
                            <a href={`/?product=${p.slug}`} className="flex w-44 items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-black/5 hover:ring-atelie-clay/40">
                              {p.image ? (
                                <img src={p.image} alt={p.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                              ) : (
                                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-atelie-sand">🧶</span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-[12px] text-atelie-ink">{p.name}</span>
                                <span className="block text-[12px] text-atelie-ink/60">{brl(p.price)}</span>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              )}

              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button key={c} type="button" onClick={() => void send(c)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-atelie-ink/80 hover:border-atelie-clay/40">
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <span aria-label="Assistente digitando" className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 ring-1 ring-black/5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-atelie-ink/50"
                        animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-black/10 px-3 pt-3 pb-2">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  maxLength={800}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Escreva sua dúvida…"
                  aria-label="Mensagem para o ateliê"
                  className="max-h-24 flex-1 resize-none rounded-2xl border border-black/10 bg-white px-3 py-2 text-[14px] text-atelie-ink outline-none focus:border-atelie-clay/50"
                />
                <button type="button" onClick={() => void send()} disabled={!input.trim() || loading} aria-label="Enviar mensagem" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-atelie-ink text-atelie-cream disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
                {WA_LINK ? <a href={WA_LINK} target="_blank" rel="noreferrer" className="text-[11px] text-atelie-ink/70 underline">Falar com uma pessoa</a> : <span />}
                <p className="text-[10px] leading-tight text-atelie-ink/50">Respostas geradas por IA podem conter erros.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
