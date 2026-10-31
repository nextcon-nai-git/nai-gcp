import { OperationsShortcuts } from "@/components/operations/operations-shortcuts";
import type { SocWebAccess } from "@/lib/integrations/soc-access";

export function SocOperations({ access }: { access?: SocWebAccess }) {
  return (
    <section className="space-y-4 rounded-xl border p-5" aria-labelledby="soc-operations-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="soc-operations-title" className="text-xl font-semibold">
            Central de operação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use sua sessão do NAI para credenciar clínicas e preparar os kits.
          </p>
        </div>
        {access?.href && (
          <a
            href={access.href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            {access.mode === "sso" ? "Acessar SOC com login único" : "Abrir SOC"}
          </a>
        )}
      </div>
      <OperationsShortcuts />
      <p className="text-sm text-muted-foreground">
        Credenciamento e PDFs são preparados nos módulos do NAI. A transmissão de cadastros e
        pedidos ao SOC é uma etapa separada.
      </p>
      <p className="text-sm" role="status">
        {access?.mode === "sso"
          ? "Login único configurado. A autenticação será validada pelo provedor ao abrir o SOC."
          : access?.mode === "invalid"
            ? "Configuração do login único incompleta ou inválida. Solicite a revisão ao administrador."
            : "Login único ainda não configurado. Ao abrir o SOC, ele poderá solicitar autenticação."}
      </p>
      <p className="text-sm text-muted-foreground">
        As consultas diretas usam chaves de serviço protegidas no servidor. A senha de acesso ao SOC
        não é necessária para cada consulta quando essas chaves estão configuradas.
      </p>
    </section>
  );
}
