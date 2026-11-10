"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSgi } from "@/contexts/sgi-context";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { runSstAnalysis } from "@/app/actions/sst-analysis";
import { getSstModule, type SstModule } from "@/lib/genkit/sst-modules";
function label(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}
function Values({ value }: { value: unknown }) {
  if (value == null) return <span className="text-muted-foreground">A conferir</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="list-disc space-y-2 pl-5">
        {value.map((v, i) => (
          <li key={i}>
            <Values value={v} />
          </li>
        ))}
      </ul>
    ) : (
      <span>Nenhum item</span>
    );
  if (typeof value === "object")
    return (
      <dl className="grid gap-3 border-l pl-3">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold">{label(k)}</dt>
            <dd>
              <Values value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value)}</span>;
}
export function SstAnalysisForm({ moduleId }: { moduleId: SstModule }) {
  const { activeClientId } = useSgi(),
    { user } = useUser();
  return (
    <Analysis
      key={[moduleId, activeClientId, user?.uid].join("|")}
      id={moduleId}
      company={activeClientId}
    />
  );
}
function Analysis({ id, company }: { id: SstModule; company: string }) {
  const config = getSstModule(id)!,
    { user } = useUser(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Record<string, unknown> | null>(null),
    [method, setMethod] = useState("RULA");
  const selected = !!company && !["all", "unauthorized"].includes(company);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !user || !selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await runSstAnalysis(await user.getIdToken(), company, id, form);
      if (r.success) setResult(r.result);
      else setError(r.error);
    } catch {
      setError("A conexão foi interrompida. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-5">
      <Link href={config.origin} className="text-sm text-primary underline">
        Voltar ao módulo
      </Link>
      <h1 className="font-headline text-3xl font-bold">{config.title}</h1>
      {!selected ? (
        <p role="status">Selecione a empresa no seletor do NAI para iniciar a análise.</p>
      ) : (
        <form
          onSubmit={submit}
          onChange={() => {
            setResult(null);
            setError("");
          }}
        >
          <fieldset
            disabled={busy}
            className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2"
          >
            {config.fields
              .filter(
                (f) =>
                  id !== "ergonomia" ||
                  ((!["grupoA", "grupoB"].includes(f.key) || method !== "NIOSH") &&
                    (f.key !== "atividade" || method === "REBA") &&
                    (!["cargaKg", "multiplicadores", "aplicabilidadeConfirmada"].includes(f.key) ||
                      method === "NIOSH"))
              )
              .map((f) => (
                <label
                  key={f.key}
                  className={
                    "grid gap-1 text-sm " +
                    (["rows", "textarea", "check", "multipliers"].includes(f.kind)
                      ? "sm:col-span-2"
                      : "")
                  }
                >
                  <span className="font-medium">{f.label}</span>
                  {f.kind === "select" ? (
                    <select
                      name={f.key}
                      className="rounded border bg-background p-2"
                      onChange={(e) => {
                        if (f.key === "metodo") setMethod(e.target.value);
                      }}
                    >
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : ["textarea", "list", "rows"].includes(f.kind) ? (
                    <textarea
                      name={f.key}
                      required={f.required}
                      rows={4}
                      className="rounded border bg-background p-2"
                    />
                  ) : (
                    <input
                      name={f.key}
                      required={f.required}
                      type={
                        f.kind === "check"
                          ? "checkbox"
                          : ["date", "number"].includes(f.kind)
                            ? f.kind
                            : "text"
                      }
                      step={f.kind === "number" ? "any" : undefined}
                      className="rounded border bg-background p-2"
                    />
                  )}
                  {f.hint && <small className="text-muted-foreground">{f.hint}</small>}
                </label>
              ))}
            {config.accept && (
              <label className="grid gap-2 text-sm sm:col-span-2">
                Documento ou mídia de até 10 MiB
                <input
                  type="file"
                  name="arquivo"
                  required
                  accept={config.accept}
                  onChange={(e) =>
                    e.target.setCustomValidity(
                      (e.target.files?.[0]?.size ?? 0) > 10485760
                        ? "Limite de 10 MiB por arquivo."
                        : ""
                    )
                  }
                />
              </label>
            )}
            <Button type="submit" disabled={!user || busy}>
              {busy ? "Analisando…" : "Gerar análise"}
            </Button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <section
          aria-label="Resultado da análise"
          className="space-y-4 rounded-lg border p-5 text-sm"
        >
          <h2 className="text-xl font-semibold">Resultado para revisão</h2>
          <Values value={result} />
        </section>
      )}
    </main>
  );
}
