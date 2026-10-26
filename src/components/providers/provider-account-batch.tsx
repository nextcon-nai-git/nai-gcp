"use client";
import * as React from "react";
import { getActionIdToken } from "@/lib/auth/action-token";
import type { ExpertCompany } from "@/lib/expert-workspace";
import { Button } from "@/components/ui/button";
interface Candidate {
  id: string;
  name: string;
  email: string;
  revision: string;
  companies: ExpertCompany[];
  ready: boolean;
  reason: string;
}
export function ProviderAccountBatch() {
  const [rows, setRows] = React.useState<Candidate[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [error, setError] = React.useState("");
  const [results, setResults] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const active = React.useRef(true),
    lock = React.useRef(false);
  React.useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const token = await getActionIdToken();
        const response = await fetch("/api/admin/expert-accounts", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active.current) setRows(data.providers);
      } catch (err) {
        if (active.current)
          setError(
            err instanceof Error ? err.message : "Não foi possível consultar os prestadores."
          );
      }
    })();
    return () => {
      active.current = false;
      controller.abort();
    };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !selected.length || selected.length > 50) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("initialPassword") || "");
    lock.current = true;
    setPending(true);
    setError("");
    try {
      for (const id of selected) {
        if (!active.current) break;
        const row = rows.find((r) => r.id === id && r.ready);
        if (!row) continue;
        try {
          const token = await getActionIdToken();
          const response = await fetch("/api/admin/expert-accounts", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ providerId: id, revision: row.revision, password }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          if (active.current)
            setResults((p) => ({
              ...p,
              [id]: data.alreadyExists
                ? "Acesso já existente; senha preservada."
                : "Acesso criado. Nenhum convite enviado.",
            }));
        } catch (err) {
          if (active.current)
            setResults((p) => ({
              ...p,
              [id]:
                err instanceof Error
                  ? err.message
                  : "Criação não confirmada. Confira antes de repetir.",
            }));
        }
      }
      if (active.current) form.reset();
    } finally {
      lock.current = false;
      if (active.current) setPending(false);
    }
  }
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Acessos restritos de prestadores</h1>
      <p>
        Revise os e-mails e vínculos antes de selecionar. O acesso inicial permite somente CNPJs e
        cards; contratos, faturamento, prontuários e edição ficam bloqueados. Nenhum e-mail será
        enviado.
      </p>
      {error && <p role="alert">{error}</p>}
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Selecionar</th>
                <th>Prestador e login</th>
                <th>Clientes autorizados</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="p-3">
                    <input
                      aria-label={`Selecionar ${row.name}`}
                      type="checkbox"
                      disabled={pending || !row.ready || !!results[row.id]}
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((p) =>
                          e.target.checked ? [...p, row.id] : p.filter((id) => id !== row.id)
                        )
                      }
                    />
                  </td>
                  <td className="p-3">
                    {row.name}
                    <br />
                    {row.email}
                  </td>
                  <td className="p-3">
                    {row.companies.map((c) => (
                      <p key={c.id}>
                        {c.name} · {c.cnpj || c.id}
                      </p>
                    ))}
                  </td>
                  <td className="p-3">
                    {results[row.id] || (row.ready ? "Disponível para revisão" : row.reason)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="block">
          Senha inicial para as contas novas selecionadas
          <input
            className="mt-2 block w-full rounded-lg border bg-background p-3"
            name="initialPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            disabled={pending}
          />
        </label>
        <label className="flex gap-2">
          <input type="checkbox" required disabled={pending} />
          Conferi as identidades e os clientes dos prestadores selecionados e autorizo estes acessos
          de consulta.
        </label>
        <Button disabled={pending || !selected.length || selected.length > 50}>
          {" "}
          {pending ? "Confirmando acessos…" : `Criar ${selected.length} acessos selecionados`}{" "}
        </Button>
        {selected.length > 50 && <p>Selecione até 50 prestadores por lote.</p>}
      </form>
    </section>
  );
}
