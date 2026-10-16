// Área interna: mantém o tema escuro de ferramenta, isolado do tema claro da loja.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-screen bg-background text-foreground">{children}</div>;
}
