"use client";

export const dynamic = "force-dynamic";


import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Lock } from "lucide-react";

export default function ContratoLicencaPage() {
  return (
    <div className="min-h-screen bg-background text-neutral-200 font-sans selection:bg-[#E6B53C] selection:text-black">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-20 flex-grow">
        <div className="flex items-center gap-4 mb-12 border-b border-border pb-8">
          <div className="p-4 bg-[#E6B53C]/10 rounded-2xl border border-[#E6B53C]/20">
            <Lock className="w-8 h-8 text-[#E6B53C]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Licenciamento de Software (White-Label)</h1>
            <p className="text-muted-foreground mt-2">Versão 1.0 — Confidencial</p>
          </div>
        </div>

        <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Do Objeto (SaaS Enterprise)</h2>
            <p>Este documento estabelece os termos de Licenciamento de Uso de Software (Modelo SaaS / White-Label) fornecido pela MaldivaSky Tech Solutions em favor da parte Contratante ("Licenciada" ou "Investidor"). O objeto engloba a cessão temporária, intransferível e não-exclusiva do direito de uso da arquitetura do Marketplace, customizada com a propriedade intelectual da Licenciada (Logotipo, Domínio, Identidade Visual).</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Acordo de Nível de Serviço (SLA e Infraestrutura)</h2>
            <p>Nossa engenharia compromete-se com níveis empresariais de disponibilidade:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><strong>Uptime Garantido:</strong> 99.9% de disponibilidade anual, provisionado sob infraestrutura serverless Edge (Next.js) e Cloud (Django/AWS).</li>
              <li><strong>Gestão e Manutenção:</strong> A equipe de engenharia raiz (MaldivaSky) reterá responsabilidade integral sobre correções de bugs sistêmicos (hotfixes), proteção contra ataques de negação de serviço (DDoS) e escala elástica de banco de dados durante picos de tráfego.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Limitação de Responsabilidade Operacional</h2>
            <p>No modelo White-Label, a Plataforma age exclusivamente como provedora da infraestrutura sistêmica. A Licenciada e seus respectivos Lojistas são os únicos e exclusivos responsáveis por:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Operações de venda, logística, atendimento ao consumidor final e gestão de suporte (SAC).</li>
              <li>Fraudes financeiras cometidas por agentes terceiros no ecossistema da Licenciada, chargebacks e disputas bancárias. A arquitetura antifraude é provida, porém as aprovações e bloqueios cabem à matriz de risco do adquirente (ex: Efí).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Sigilo, Código Fonte e Non-Compete</h2>
            <p>É expressamente vedado à Licenciada sub-licenciar, realizar engenharia reversa, ou alegar autoria sob o código-fonte raiz. O código-fonte permanece propriedade inalienável da MaldivaSky. Este contrato exige Acordo de Confidencialidade (NDA) sobre as métricas de conversão e arquiteturas de gatilho desenvolvidas pela licenciadora.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
