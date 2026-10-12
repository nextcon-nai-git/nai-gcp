"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import type { SupplierApplication } from "@/lib/suppliers/qualification";
type View = {
  admin: boolean;
  applications: (SupplierApplication & { current: boolean; issues: string[] })[];
  audit: { id: string; applicationId: string; at: string; action: string; actor: string }[];
};
const labels: Record<string, string> = {
  draft: "Preparação",
  submitted: "Em análise",
  changes: "Ajustes solicitados",
  approved: "Homologado",
  rejected: "Recusado",
  suspended: "Suspenso",
  pending: "Pendente",
  accepted: "Aceito",
};
const input = "mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-white";
const card = "rounded-xl border border-slate-700 bg-slate-900 p-5";
const val = (f: FormData, k: string) => String(f.get(k) || "").trim();
export function SupplierQualificationWorkspace() {
  const { user } = useUser();
  const [view, setView] = useState<View | null>(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const epoch = useRef(0),
    running = useRef(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    epoch.current++;
    running.current = false;
    setView(null);
    setSelected("");
    setError("");
    setBusy(false);
    return () => {
      epoch.current++;
    };
  }, [user]);
  async function request(path: string, init?: RequestInit, download = false) {
    if (!user || running.current) return;
    const seq = epoch.current;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      if (seq !== epoch.current) return;
      const r = await fetch(path, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (seq !== epoch.current) return;
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Falha na operação.");
      }
      if (download) {
        const blob = await r.blob();
        if (seq !== epoch.current) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "documento";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await r.json();
        if (seq !== epoch.current) return;
        setView(data);
        if (init?.method === "POST") setNotice("Registro salvo. Confira o processo atualizado.");
      }
    } catch (e) {
      if (seq === epoch.current)
        setError(e instanceof Error ? e.message : "Falha na operação. Atualize antes de repetir.");
    } finally {
      if (seq === epoch.current) {
        running.current = false;
        setBusy(false);
      }
    }
  }
  const refresh = () => request("/api/suppliers/qualification");
  const a = view?.applications.find((a) => a.id === selected);
  const command = (data: Record<string, unknown>, version = a?.version || 0) =>
    request("/api/suppliers/qualification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, requestId: crypto.randomUUID(), expectedVersion: version }),
    });
  function profile(e: FormEvent<HTMLFormElement>, edit = false) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void command(
      {
        action: edit ? "edit" : "create",
        ...(edit ? { id: a?.id } : {}),
        profile: Object.fromEntries(
          ["name", "document", "email", "phone", "services", "city"].map((k) => [k, val(f, k)])
        ),
      },
      edit ? a?.version : 0
    );
  }
  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-6 text-slate-100">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">NAI · Fornecedores</p>
          <h1 className="mt-2 text-3xl font-semibold">Portal de homologação</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Cadastro, documentos, pendências e validade em um processo acompanhado pela equipe
            interna.
          </p>
        </div>
        <Button disabled={busy || !user} onClick={() => void refresh()}>
          {busy ? "Processando…" : "Atualizar processos"}
        </Button>
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 p-4 text-red-200">
          {error} Atualize os processos antes de repetir uma gravação.
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-300">
          {notice}
        </p>
      )}
      {!view && <p>Use “Atualizar processos” para carregar os dados da sua conta.</p>}
      {view && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Processos", view.applications.length],
              ["Homologações vigentes", view.applications.filter((a) => a.current).length],
              ["Em análise", view.applications.filter((a) => a.status === "submitted").length],
            ].map(([label, n]) => (
              <div key={label} className={card}>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-2 text-3xl">{n}</p>
              </div>
            ))}
          </div>
          {view.admin && (
            <Link
              className="inline-block text-cyan-300 underline"
              href="/financial/omie/conectores"
            >
              Conectores Omie e envio de fornecedores homologados →
            </Link>
          )}
          <details className={card}>
            <summary className="cursor-pointer font-semibold">
              Cadastrar meu processo de fornecedor
            </summary>
            <p className="my-3 text-sm text-slate-300">
              O cadastro ficará vinculado à conta conectada. A equipe definirá os documentos
              exigidos.
            </p>
            <form onSubmit={(e) => profile(e)} className="grid gap-3 md:grid-cols-2">
              {["name", "document", "email", "phone", "services", "city"].map((k, i) => (
                <label className="text-sm" key={k}>
                  {
                    [
                      "Razão social / nome",
                      "CNPJ ou CPF",
                      "E-mail",
                      "Telefone",
                      "Serviços fornecidos",
                      "Cidade / UF",
                    ][i]
                  }
                  <input
                    className={input}
                    name={k}
                    type={k === "email" ? "email" : "text"}
                    required={k !== "phone"}
                    maxLength={k === "services" ? 1000 : 180}
                    disabled={busy}
                  />
                </label>
              ))}
              <Button type="submit" disabled={busy}>
                Criar processo
              </Button>
            </form>
          </details>
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            <aside className="space-y-3">
              <label className="text-sm">
                Buscar fornecedor
                <input
                  className={input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {view.applications
                .filter((a) =>
                  (a.profile.name + " " + a.profile.document)
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase())
                )
                .map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setSelected(x.id)}
                    className={`${card} block w-full text-left ${selected === x.id ? "border-cyan-400" : ""}`}
                  >
                    <strong>{x.profile.name}</strong>
                    <p className="mt-2 text-xs">{x.profile.document}</p>
                    <p className="mt-2 text-sm text-cyan-300">
                      {x.status === "approved" && !x.current
                        ? "Homologação vencida / pendente"
                        : labels[x.status]}
                    </p>
                  </button>
                ))}
              {!view.applications.length && (
                <p className="py-4 text-sm text-slate-400">Nenhum processo cadastrado.</p>
              )}
            </aside>
            {a ? (
              <section key={`${a.id}-${a.version}`} className="space-y-5">
                <div className={card}>
                  <h2 className="text-2xl font-semibold">{a.profile.name}</h2>
                  <p className="mt-2">
                    {a.profile.document} · {a.profile.city}
                  </p>
                  <p className="mt-2 text-sm">
                    {a.profile.email} · {a.profile.phone}
                  </p>
                  <p className="mt-2 text-sm">{a.profile.services}</p>
                  <p className="mt-4 text-cyan-300">
                    {labels[a.status]} {a.validUntil && `· válido até ${a.validUntil}`}
                  </p>
                  {a.decision && <p className="mt-2">Parecer: {a.decision}</p>}
                  {a.issues.length > 0 && (
                    <ul className="mt-4 list-inside list-disc text-sm text-amber-200">
                      {a.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {["draft", "changes"].includes(a.status) && (
                  <details className={card}>
                    <summary className="cursor-pointer">Editar cadastro</summary>
                    <form
                      onSubmit={(e) => profile(e, true)}
                      className="mt-4 grid gap-3 md:grid-cols-2"
                    >
                      {Object.entries(a.profile).map(([k, v]) => (
                        <label key={k}>
                          {
                            (
                              {
                                name: "Nome",
                                document: "Identificação",
                                email: "E-mail",
                                phone: "Telefone",
                                services: "Serviços",
                                city: "Cidade / UF",
                              } as Record<string, string>
                            )[k]
                          }
                          <input
                            className={input}
                            name={k}
                            defaultValue={v}
                            readOnly={k === "document"}
                            required={k !== "phone"}
                          />
                        </label>
                      ))}
                      <Button disabled={busy}>Salvar cadastro</Button>
                    </form>
                  </details>
                )}
                {view.admin && ["draft", "changes"].includes(a.status) && (
                  <details className={card}>
                    <summary className="cursor-pointer">Definir checklist documental</summary>
                    <form
                      className="mt-4 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const existing = a.requirements.map((r) => ({
                          ...r,
                          label: val(f, r.id),
                          required: f.get(`required-${r.id}`) === "on",
                        }));
                        const added = val(f, "new")
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((label) => ({ id: crypto.randomUUID(), label, required: true }));
                        void command({
                          action: "requirements",
                          id: a.id,
                          requirements: [...existing, ...added],
                          reason: val(f, "reason"),
                        });
                      }}
                    >
                      {a.requirements.map((r) => (
                        <div key={r.id}>
                          <label>
                            Requisito
                            <input name={r.id} defaultValue={r.label} className={input} required />
                          </label>
                          <label className="text-sm">
                            <input
                              name={`required-${r.id}`}
                              type="checkbox"
                              defaultChecked={r.required}
                            />{" "}
                            Obrigatório
                          </label>
                        </div>
                      ))}
                      <label className="block">
                        Novos requisitos, um por linha
                        <textarea name="new" className={input} rows={3} />
                      </label>
                      <label className="block">
                        Justificativa
                        <input name="reason" className={input} required minLength={3} />
                      </label>
                      <Button disabled={busy}>Salvar checklist</Button>
                    </form>
                  </details>
                )}
                <h2 className="text-xl font-semibold">Documentos e revisão</h2>
                {!a.requirements.length && (
                  <p>Aguardando definição do checklist pela equipe interna.</p>
                )}
                {a.requirements.map((r) => {
                  const docs = a.documents.filter((d) => d.requirementId === r.id);
                  const latest = docs.at(-1);
                  return (
                    <article className={card} key={r.id}>
                      <h3 className="font-semibold">
                        {r.label} · {r.required ? "Obrigatório" : "Opcional"}
                      </h3>
                      {latest ? (
                        <>
                          <p className="my-3 text-sm">
                            {latest.name} · {labels[latest.review]} ·{" "}
                            {latest.expires
                              ? `Validade ${latest.expires}`
                              : "Sem vencimento informado"}
                          </p>
                          {latest.reason && (
                            <p className="mb-3 text-sm">Revisão: {latest.reason}</p>
                          )}
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void request(
                                `/api/suppliers/documents?applicationId=${a.id}&documentId=${latest.id}`,
                                undefined,
                                true
                              )
                            }
                          >
                            Baixar documento
                          </Button>
                          {docs.length > 1 && (
                            <details className="mt-3">
                              <summary>Versões anteriores ({docs.length - 1})</summary>
                              {docs.slice(0, -1).map((d) => (
                                <button
                                  className="block py-2 text-sm underline"
                                  key={d.id}
                                  disabled={busy}
                                  onClick={() =>
                                    void request(
                                      `/api/suppliers/documents?applicationId=${a.id}&documentId=${d.id}`,
                                      undefined,
                                      true
                                    )
                                  }
                                >
                                  {d.name} · {d.uploadedAt.slice(0, 10)}
                                </button>
                              ))}
                            </details>
                          )}
                        </>
                      ) : (
                        <p className="my-3 text-sm text-amber-200">Nenhum documento enviado.</p>
                      )}
                      {["draft", "changes"].includes(a.status) && (
                        <form
                          className="mt-4 space-y-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget),
                              file = f.get("file") as File;
                            if (!file?.size) return;
                            void request("/api/suppliers/documents", {
                              method: "POST",
                              headers: {
                                "Content-Type": file.type,
                                "x-document-info": encodeURIComponent(
                                  JSON.stringify({
                                    applicationId: a.id,
                                    requirementId: r.id,
                                    requestId: crypto.randomUUID(),
                                    expectedVersion: a.version,
                                    name: file.name,
                                    mime: file.type,
                                    expires: val(f, "expires") || null,
                                  })
                                ),
                              },
                              body: file,
                            });
                          }}
                        >
                          <label className="block text-sm">
                            Documento (PDF, PNG ou JPEG; até 8 MiB)
                            <input
                              className={input}
                              name="file"
                              type="file"
                              accept="application/pdf,image/png,image/jpeg"
                              required
                              disabled={busy}
                            />
                          </label>
                          <label className="block text-sm">
                            Validade, quando aplicável
                            <input name="expires" className={input} type="date" disabled={busy} />
                          </label>
                          <Button disabled={busy}>Enviar documento</Button>
                        </form>
                      )}
                      {view.admin && a.status === "submitted" && latest && (
                        <form
                          className="mt-4 space-y-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void command({
                              action: "reviewDocument",
                              id: a.id,
                              documentId: latest.id,
                              review: val(f, "review"),
                              reason: val(f, "reason"),
                            });
                          }}
                        >
                          <label className="block">
                            Resultado da revisão
                            <select className={input} name="review">
                              <option value="accepted">Aceitar documento</option>
                              <option value="rejected">Solicitar correção</option>
                            </select>
                          </label>
                          <label className="block">
                            Parecer da conferência
                            <input className={input} name="reason" required minLength={3} />
                          </label>
                          <Button disabled={busy}>Registrar revisão</Button>
                        </form>
                      )}
                    </article>
                  );
                })}
                {["draft", "changes"].includes(a.status) && (
                  <Button
                    disabled={busy || !a.requirements.length}
                    onClick={() => void command({ action: "submit", id: a.id })}
                  >
                    Enviar processo para análise
                  </Button>
                )}
                {view.admin &&
                  ["submitted", "approved", "rejected", "suspended"].includes(a.status) && (
                    <form
                      className={card + " space-y-3"}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void command({
                          action: "decide",
                          id: a.id,
                          status: val(f, "status"),
                          validUntil: val(f, "validUntil") || null,
                          reason: val(f, "reason"),
                        });
                      }}
                    >
                      <h2 className="text-lg font-semibold">Decisão de homologação</h2>
                      <label className="block">
                        Decisão
                        <select className={input} name="status">
                          <option value="changes">Devolver para ajustes</option>
                          {a.status === "submitted" && (
                            <>
                              <option value="approved">Homologar</option>
                              <option value="rejected">Recusar</option>
                            </>
                          )}
                          {a.status === "approved" && (
                            <option value="suspended">Suspender homologação</option>
                          )}
                        </select>
                      </label>
                      <label className="block">
                        Validade da homologação
                        <input className={input} name="validUntil" type="date" />
                      </label>
                      <label className="block">
                        Justificativa
                        <textarea name="reason" className={input} required minLength={3} />
                      </label>
                      <p className="text-sm text-slate-400">
                        A aprovação exige documentos aceitos e vigentes, e responsável diferente de
                        quem enviou o processo.
                      </p>
                      <Button disabled={busy}>Registrar decisão</Button>
                    </form>
                  )}
                {view.admin && (
                  <details className={card}>
                    <summary>Histórico do processo</summary>
                    {view.audit
                      .filter((x) => x.applicationId === a.id)
                      .slice()
                      .reverse()
                      .map((x) => (
                        <p key={x.id} className="border-b border-slate-700 py-3 text-sm">
                          {x.at} · {x.action} · {x.actor}
                        </p>
                      ))}
                  </details>
                )}
              </section>
            ) : (
              <div className={card}>
                Selecione um processo para acompanhar os documentos e as pendências.
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
