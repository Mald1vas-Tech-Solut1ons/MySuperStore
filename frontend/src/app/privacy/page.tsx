"use client";

import { Suspense } from "react";
import { Header } from "@/components/Header";

function PrivacyContent() {
  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-4xl font-display font-black mb-8">Política de Privacidade</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p>Última atualização: 25 de Junho de 2026</p>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">1. Informações que Coletamos</h2>
            <p>
              O MySuperStore coleta informações essenciais para garantir o funcionamento do nosso ecossistema e processar seus pagamentos. Isso inclui:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Dados Cadastrais:</strong> Nome, e-mail, telefone, CPF/CNPJ (para lojistas).</li>
              <li><strong>Dados de Pagamento:</strong> Informações de cartão de crédito e PIX (processados de forma segura pelo nosso parceiro Efí Bank).</li>
              <li><strong>Dados de Navegação:</strong> Informações de uso, dispositivo e localização (para segurança).</li>
              <li><strong>Conta Google:</strong> Nome e endereço de e-mail ao utilizar o "Login com o Google".</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">2. Como Usamos as Informações</h2>
            <p>
              As informações coletadas são utilizadas exclusivamente para os seguintes fins:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Processar suas compras e repassar os pagamentos aos lojistas parceiros de forma automatizada (Split Financeiro).</li>
              <li>Personalizar sua experiência e recomendar produtos baseados no seu histórico.</li>
              <li>Enviar notificações importantes sobre status de pedidos e atualizações de segurança.</li>
              <li>Prevenir fraudes e manter a integridade da plataforma.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">3. Compartilhamento de Dados</h2>
            <p>
              O MySuperStore <strong>NÃO</strong> vende seus dados. Suas informações são compartilhadas apenas em situações estritamente necessárias:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Com os lojistas: apenas os dados necessários para o envio do produto (Nome, Endereço de Entrega).</li>
              <li>Com o provedor financeiro (Efí Bank): para processamento seguro dos pagamentos PIX/Cartão.</li>
              <li>Por determinação judicial ou obrigações legais fiscais.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">4. Seus Direitos</h2>
            <p>
              Você pode a qualquer momento:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Solicitar o acesso ou a portabilidade dos seus dados.</li>
              <li>Requerer a correção de dados incompletos ou inexatos.</li>
              <li>Solicitar a exclusão permanente de sua conta e dos dados pessoais do nosso sistema (salvo dados que somos obrigados por lei a manter para fins fiscais).</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">5. Segurança</h2>
            <p>
              Nós utilizamos criptografia de ponta-a-ponta e tecnologias de proteção avançadas. A senha da sua conta não é acessível a nenhum de nossos desenvolvedores, e os tokens de integração (como o do Google) são armazenados em conformidade com as diretrizes de segurança da indústria.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <Suspense fallback={null}>
        <PrivacyContent />
      </Suspense>
    </>
  );
}
