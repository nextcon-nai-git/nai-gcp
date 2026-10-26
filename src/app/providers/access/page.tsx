"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import type { ExpertCompany } from "@/lib/expert-workspace";
import { Button } from "@/components/ui/button";

interface Preview {
  id: string;
  name: string;
  email: string;
  revision: string;
  accessUid: string;
  companies: ExpertCompany[];
}
export default function ExpertAccountPage() {
  const { user, role } = useUser();
  return (
    <React.Suspense fallback={<p>Carregando revisão…</p>}>
      {role === "SUPER_ADMIN" ? (
        <Account key={user?.uid} />
      ) : (
        <p>Acesso exclusivo do administrador.</p>
      )}
    </React.Suspense>
  );
}
function Account() {
  const provider = useSearchParams().get("provider") || "";
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const active = React.useRef(true),
    lock = React.useRef(false);
  React.useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    setPreview(null);
    setResult("");
    setError("");
    void (async () => {
      try {
        const token = await getActionIdToken();
        const response = await fetch(
          `/api/admin/expert-accounts?provider=${encodeURIComponent(provider)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setPreview(data);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Falha na consulta.");
      }
    })();
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [provider]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || lock.current) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("initialPassword") || "");
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const token = await getActionIdToken();
      const response = await fetch("/api/admin/expert-accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: preview.id, revision: preview.revision, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (active.current) {
        form.reset();
        setResult(
          data.alreadyExists
            ? "A conta restrita já existe. A senha não foi alterada."
            : `Acesso criado para ${data.email}. Somente CNPJs e cards das unidades abaixo. Nenhum convite foi enviado.`
        );
      }
    } catch (err) {
      if (active.current)
        setError(
          err instanceof Error
            ? err.message
            : "Resultado não confirmado. Consulte antes de repetir."
        );
    } finally {
      lock.current = false;
      if (active.current) setPending(false);
    }
  }
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Criar acesso de médico perito</h1>
      <p>
        Consulta de CNPJs e cards nas unidades vinculadas. Sem contratos, faturamento, prontuários,
        outros clientes ou permissões de edição.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive p-4">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className="rounded-xl border border-green-600 p-4">
          {result}
        </p>
      )}
      {preview && (
        <>
          <h2 className="text-xl font-semibold">{preview.name}</h2>
          <p>{preview.email}</p>
          <ul className="space-y-2">
            {preview.companies.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                {c.name} · {c.cnpj || "CNPJ não informado"}
                <br />
                <small>{c.id}</small>
              </li>
            ))}
          </ul>
          {!result && (
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <label className="block">
                Senha inicial
                <input
                  name="initialPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={pending}
                  className="mt-2 block w-full rounded-lg border bg-background p-3"
                />
              </label>
              <label className="flex gap-2">
                <input type="checkbox" required disabled={pending} />
                Confirmo o e-mail e autorizo acesso de consulta apenas às unidades listadas.
              </label>
              <Button disabled={pending} type="submit">
                {pending ? "Confirmando criação…" : "Criar acesso restrito"}
              </Button>
            </form>
          )}
        </>
      )}
      <a className="inline-block underline" href="/providers">
        Voltar aos prestadores
      </a>
    </section>
  );
}
