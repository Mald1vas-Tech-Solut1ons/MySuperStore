"use client";

export const dynamic = "force-dynamic";


import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ShieldCheck } from "lucide-react";

export default function TermosClientePage() {
  return (
    <div className="min-h-screen bg-background text-neutral-200 font-sans selection:bg-[#E6B53C] selection:text-black">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-20 flex-grow">
        <div className="flex items-center gap-4 mb-12 border-b border-border pb-8">
          <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Termos de Uso e Política de Privacidade</h1>
            <p className="text-muted-foreground mt-2">Versão 2.1 — Atualizado em 20 de Junho de 2026</p>
          </div>
        </div>

        <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta, acessar ou utilizar a MySuperStore ("Plataforma"), você ("Usuário" ou "Cliente") concorda expressamente e sem ressalvas com as condições descritas neste documento. Se você não concordar com qualquer um dos termos, você está proibido de usar ou acessar este site.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Definição do Serviço (Marketplace)</h2>
            <p>A MySuperStore atua como intermediadora de negócios (Marketplace), provendo tecnologia e ambiente virtual para que Vendedores Independentes ("Lojistas") comercializem seus produtos para Clientes finais. Nós não somos o fornecedor direto dos produtos físicos vendidos por terceiros na plataforma.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Política de Arrependimento e Devolução (CDC)</h2>
            <p>Em estrita conformidade com o Artigo 49 do Código de Defesa do Consumidor (Lei 8.078/1990):</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>O Cliente tem o direito de se arrepender da compra no prazo máximo de 7 (sete) dias corridos, contados a partir do recebimento do produto.</li>
              <li>O valor pago será restituído integralmente. O produto deverá ser devolvido na embalagem original, sem indícios de uso ou violação.</li>
              <li>A plataforma retém o pagamento do lojista durante este período de segurança operacional.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Política de Privacidade (LGPD)</h2>
            <p>Seus dados são tratados sob os rigorosos padrões da Lei Geral de Proteção de Dados (Lei 13.709/2018). Coletamos apenas os dados essenciais para o processamento de pagamentos, emissão de notas fiscais e logística. Nós <strong>NUNCA</strong> comercializamos informações de clientes para terceiros.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">5. Propriedade Intelectual</h2>
            <p>A estrutura tecnológica, logotipos, códigos-fonte, algoritmos de recomendação e design sistêmico são propriedades intelectuais exclusivas da MaldivaSky Tech Solutions. A cópia, engenharia reversa ou distribuição sem autorização constitui crime.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
