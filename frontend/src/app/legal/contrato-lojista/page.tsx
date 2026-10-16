"use client";

export const dynamic = "force-dynamic";


import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DollarSign } from "lucide-react";

export default function ContratoLojistaPage() {
  return (
    <div className="min-h-screen bg-background text-neutral-200 font-sans selection:bg-[#E6B53C] selection:text-black">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-20 flex-grow">
        <div className="flex items-center gap-4 mb-12 border-b border-border pb-8">
          <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
            <DollarSign className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Acordo de Operação para Lojistas B2B</h1>
            <p className="text-muted-foreground mt-2">Versão 3.0 — Atualizado em 20 de Junho de 2026</p>
          </div>
        </div>

        <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Cláusula 1: Da Relação Comercial</h2>
            <p>Este instrumento ("Contrato de Lojista") rege as obrigações entre a Plataforma MySuperStore e a Entidade Vendedora ("Lojista"). A Plataforma fornece licenciamento de uso de software, vitrine digital e infraestrutura de pagamentos (Efí Bank). O Lojista detém inteira responsabilidade legal, fiscal e de fornecimento sobre os produtos físicos comercializados em seu painel.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Cláusula 2: Das Taxas e Regras de Repasse (Split Payment)</h2>
            <p>O ecossistema utiliza arquitetura financeira de liquidação instantânea ("Split"). As regras financeiras operam sob as seguintes premissas:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>No milissegundo de compensação bancária, a comissão da Plataforma é retida de forma automática. O montante remanescente é injetado diretamente na sub-conta do Lojista.</li>
              <li>Essa operação elimina a configuração de bitributação para a Plataforma e garante liquidez imediata para o fluxo de caixa do Lojista.</li>
              <li>As taxas de comissão são pactuadas no ato do cadastro e podem sofrer alterações mediante aviso prévio de 30 dias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Cláusula 3: SLA de Fulfillment e Penalidades</h2>
            <p>O Lojista obriga-se a seguir os níveis de Serviço (SLA) exigidos pela Plataforma para manter a reputação do ecossistema:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Prazo de Postagem:</strong> O Lojista possui 48 (quarenta e oito) horas úteis para inserir o código de rastreio sistêmico do pedido.</li>
              <li><strong>Infrações e Bloqueios:</strong> Falhas recorrentes em prazo, elevação de taxa de chargeback acima de 1.5%, ou envio de mercadorias defeituosas acarretarão no bloqueio profilático de saldo retido e suspensão da vitrine do Lojista.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Cláusula 4: Restrições de Catálogo</h2>
            <p>É estritamente proibida a inserção, comercialização ou tentativa de fraude envolvendo produtos listados em listas de compliance internacionais, itens que violem patentes registradas (pirataria), armamentos, ou produtos que não detenham aprovação das agências reguladoras (ANVISA, INMETRO). A quebra desta cláusula gera rescisão unilateral imediata sem direito a aviso prévio.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
