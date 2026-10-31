import Link from "next/link";

const actions = [
  {
    label: "Credenciamento de clínicas",
    href: "/providers",
    description: "Cadastrar clínica, contatos e condições no NAI.",
  },
  {
    label: "Gerar kit em PDF",
    href: "/health-control?tab=agendamento",
    description: "Conferir o colaborador e preparar pedido, ficha clínica e minuta de ASO.",
  },
  {
    label: "Periódicos e clínicas AVP",
    href: "/clients/grupo-avp",
    description: "Consultar campanha, valores e acompanhamento dos kits.",
  },
  {
    label: "Convocações SOC",
    href: "/integrations/soc/convocations",
    description: "Importar e conferir a base de convocações.",
  },
  {
    label: "Assistente OpenAI no NAI",
    href: "/assistente",
    description: "Consultar títulos de documentos e tarefas e preparar propostas de novos cards.",
  },
] as const;

/** Navigation only; each destination enforces its existing authorization. */
export function OperationsShortcuts({ includeAssistant = true }: { includeAssistant?: boolean }) {
  return (
    <nav aria-label="Ações operacionais do NAI" className="grid gap-3 sm:grid-cols-2">
      {actions
        .filter((action) => includeAssistant || action.href !== "/assistente")
        .map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg border p-4 hover:bg-muted focus-visible:outline focus-visible:outline-2"
          >
            <span className="font-semibold">{action.label}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{action.description}</span>
          </Link>
        ))}
    </nav>
  );
}
