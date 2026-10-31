import Link from "next/link";
import { Bot, Building2, CalendarDays, ClipboardList, MapPin } from "lucide-react";

const actions = [
  {
    label: "Credenciamento de clínicas",
    shortLabel: "Clínicas",
    icon: Building2,
    href: "/providers",
    description: "Cadastrar clínica, contatos e condições no NAI.",
  },
  {
    label: "Gerar kit em PDF",
    shortLabel: "Agendamentos",
    icon: CalendarDays,
    href: "/health-control?tab=agendamento",
    description: "Conferir o colaborador e preparar pedido, ficha clínica e minuta de ASO.",
  },
  {
    label: "Periódicos e clínicas AVP",
    shortLabel: "Campanha AVP",
    icon: MapPin,
    href: "/clients/grupo-avp",
    description: "Consultar campanha, valores e acompanhamento dos kits.",
  },
  {
    label: "Convocações SOC",
    shortLabel: "Convocações SOC",
    icon: ClipboardList,
    href: "/integrations/soc/convocations",
    description: "Importar e conferir a base de convocações.",
  },
  {
    label: "Assistente OpenAI no NAI",
    shortLabel: "Assistente",
    icon: Bot,
    href: "/assistente",
    description: "Consultar títulos de documentos e tarefas e preparar propostas de novos cards.",
  },
] as const;

/** Navigation only; each destination enforces its existing authorization. */
export function OperationsShortcuts({
  includeAssistant = true,
  compact = false,
}: {
  includeAssistant?: boolean;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="Ações operacionais do NAI"
      className={compact ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid gap-3 sm:grid-cols-2"}
    >
      {actions
        .filter((action) => includeAssistant || action.href !== "/assistente")
        .map(({ icon: Icon, ...action }) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              compact
                ? "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-center text-sm transition-colors hover:border-primary hover:bg-muted focus-visible:outline focus-visible:outline-2"
                : "rounded-lg border p-4 hover:bg-muted focus-visible:outline focus-visible:outline-2"
            }
            title={action.description}
          >
            <Icon
              aria-hidden="true"
              className={compact ? "h-5 w-5 text-primary" : "mb-2 h-5 w-5"}
            />
            <span className="font-semibold">{compact ? action.shortLabel : action.label}</span>
            {!compact && (
              <span className="mt-1 block text-sm text-muted-foreground">{action.description}</span>
            )}
          </Link>
        ))}
    </nav>
  );
}
