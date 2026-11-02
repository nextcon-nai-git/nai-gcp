"use client";
import * as React from "react";
import { useUser } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import { EXPERT_ROLE, formatExpertDeadline, type ExpertWorkspace } from "@/lib/expert-workspace";
import { Button } from "@/components/ui/button";

const statuses: Record<string, string> = {
  started: "Triagem",
  todo: "Planejamento",
  doing: "Em execução",
  review: "Revisão técnica",
  done: "Concluído",
};
export default function ExpertPage() {
  const { user, role } = useUser();
  // Remount on account changes: a previous expert's data must not persist.
  return role === EXPERT_ROLE ? (
    <Workspace key={user?.uid} />
  ) : (
    <p>Acesso exclusivo para prestador autorizado.</p>
  );
}
function Workspace() {
  const [company, setCompany] = React.useState("");
  const [version, setVersion] = React.useState(0);
  const [data, setData] = React.useState<ExpertWorkspace | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setData(null);
    setError("");
    void (async () => {
      try {
        const token = await getActionIdToken();
        const response = await fetch(
          `/api/expert/workspace${company ? `?company=${encodeURIComponent(company)}` : ""}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = await response.json();
        if (!response.ok && company && (response.status === 400 || response.status === 403)) {
          // A selected unit may have been deleted or unlinked. Discard its
          // data and re-fetch the current grants without the stale selection.
          // The empty selection makes this recovery a single retry; a revoked
          // account still fails closed on the server.
          if (active) setCompany("");
          return;
        }
        if (!response.ok) throw new Error(result.error || "Não foi possível consultar os cards.");
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Falha na consulta.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [company, version]);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Prestadores · CNPJs e cards</h1>
          <p className="text-sm text-muted-foreground">
            Consulta das unidades expressamente liberadas para sua conta.
          </p>
        </div>
        <Button onClick={() => setVersion((v) => v + 1)} disabled={loading}>
          Atualizar
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive p-4">
          {error}
        </p>
      )}
      {loading && <p role="status">Consultando suas unidades…</p>}
      {data && (
        <>
          <label className="block">
            Unidade autorizada
            <select
              className="mt-2 block w-full rounded-lg border bg-background p-3"
              value={data.companyId || ""}
              onChange={(e) => setCompany(e.target.value)}
            >
              {data.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.cnpj || "CNPJ não informado"}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            {data.companies.find((c) => c.id === data.companyId)?.city} · {data.tasks.length} cards
            em consulta
          </p>
          {data.truncated && (
            <p role="status">
              Exibindo até 500 cards desta unidade. Solicite à equipe uma consulta complementar.
            </p>
          )}
          {!data.tasks.length && <p>Nenhum card disponível nesta unidade.</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            {data.tasks.map((task) => (
              <article key={task.id} className="space-y-3 rounded-2xl border bg-card p-5">
                <h2 className="text-lg font-semibold">{task.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {statuses[task.status] || task.status} · Prazo:{" "}
                  {formatExpertDeadline(task.dueDate)}
                </p>
                <ul className="space-y-2 text-sm">
                  {task.checklist.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span aria-label={item.checked ? "Concluído" : "Pendente"}>
                        {item.checked ? "✓" : "○"}
                      </span>
                      <span className="whitespace-pre-wrap break-words">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
