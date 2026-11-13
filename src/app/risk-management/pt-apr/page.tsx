"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  aprChecks,
  aprKeys,
  readyForReview,
  type AprEvidence,
  type WorkPermit,
} from "@/lib/pt-apr";

const field = "block w-full rounded-md border p-2";
const blankAnswers = (): AprEvidence => ({
  hazards: "",
  controls: "",
  teamEvidence: "",
  answers: {
    isolation: { status: "pending", note: "" },
    equipment: { status: "pending", note: "" },
    area: { status: "pending", note: "" },
  },
});
type Account = NonNullable<ReturnType<typeof useUser>["user"]>;
type PermitPage = { items: WorkPermit[]; next: string | null; canReview: boolean };
async function api<T>(
  user: Account,
  company: string,
  options: { body?: unknown; after?: string; signal?: AbortSignal; directory?: boolean } = {}
): Promise<T> {
  const query = new URLSearchParams({ company });
  if (options.directory) query.set("directory", "1");
  if (options.after) query.set("after", options.after);
  const response = await fetch("/api/pt-apr?" + query, {
    method: options.body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + (await user.getIdToken()),
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: options.signal,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Falha ao consultar PT/APR.");
  return data;
}
export default function PtAprDigital() {
  const { user, role, tenantId, servedCompanies, isUserLoading } = useUser();
  const { activeClientId } = useSgi();
  const [choice, setChoice] = useState("");
  if (isUserLoading) return <p>Carregando permissões…</p>;
  if (!user) return <p>Entre no NAI para consultar as permissões.</p>;
  const assigned = [...new Set([tenantId, ...servedCompanies].filter((id): id is string => !!id))];
  const scoped = ["ENGINEER", "SAFETY_TECH"].includes(role || "");
  const company = scoped
    ? assigned.includes(choice)
      ? choice
      : assigned.includes(activeClientId)
        ? activeClientId
        : assigned[0]
    : activeClientId;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Permissões de Trabalho e APR</h1>
      {scoped && assigned.length > 1 && (
        <label>
          Empresa
          <select className={field} value={company} onChange={(e) => setChoice(e.target.value)}>
            {assigned.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
      )}
      {company && !["all", "unauthorized"].includes(company) ? (
        <Workspace key={[user.uid, role, company].join(":")} user={user} company={company} />
      ) : (
        <p>Selecione uma empresa autorizada para abrir a fila de PTs.</p>
      )}
    </div>
  );
}
function Workspace({ user, company }: { user: Account; company: string }) {
  const [items, setItems] = useState<WorkPermit[]>([]),
    [next, setNext] = useState<string | null>(null),
    [mayReview, setMayReview] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<PermitPage>(user, company, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.items);
          setNext(data.next);
          setMayReview(data.canReview);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, company, refresh]);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const item = await api<WorkPermit>(user, company, { body: { ...body, companyId: company } });
      setItems((old) => [item, ...old.filter((r) => r.id !== item.id)]);
      setSelected(item.id);
      setCreating(false);
      setNotice(
        item.status === "awaiting_signature"
          ? "APR registrada. PT aguardando assinatura."
          : "PT registrada e aguardando APR."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na gravação. Confira a fila.");
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (!next) return;
    setBusy(true);
    setError("");
    try {
      const page = await api<PermitPage>(user, company, { after: next });
      setNext(page.next);
      setItems((old) => [...old, ...page.items.filter((v) => !old.some((o) => o.id === v.id))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setBusy(false);
    }
  }
  const current = items.find((i) => i.id === selected);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || loading || (!!error && !items.length)}
          onClick={() => {
            setCreating(true);
            setSelected(null);
            setNotice("");
          }}
        >
          Nova permissão
        </Button>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => {
            setRefresh((n) => n + 1);
            setNotice("");
          }}
        >
          Atualizar fila
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {creating && (
        <CreatePermit
          user={user}
          company={company}
          busy={busy}
          save={save}
          close={() => setCreating(false)}
        />
      )}
      {current && (
        <ReviewPermit
          user={user}
          company={company}
          key={current.id}
          permit={current}
          mayReview={mayReview}
          busy={busy}
          save={save}
        />
      )}
      <h2 className="text-xl font-semibold">Fila e histórico de permissões</h2>
      {loading ? (
        <p>Consultando a fila…</p>
      ) : !items.length && !error ? (
        <p>Nenhuma PT registrada nesta empresa.</p>
      ) : null}
      <ul className="divide-y">
        {items.map((p) => (
          <li className="flex flex-wrap justify-between gap-3 py-3" key={p.id}>
            <span>
              <strong>{p.task}</strong> · {p.location} · {p.employeeName}
              <br />
              {p.status === "awaiting_review"
                ? "Aguardando APR"
                : "APR registrada · aguardando assinatura"}
            </span>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setCreating(false);
                setSelected(p.id);
                setNotice("");
              }}
            >
              Abrir PT
            </Button>
          </li>
        ))}
      </ul>
      {next && (
        <Button disabled={busy} onClick={more}>
          Carregar mais
        </Button>
      )}
    </section>
  );
}
function CreatePermit({
  user,
  company,
  busy,
  save,
  close,
}: {
  user: Account;
  company: string;
  busy: boolean;
  save: (b: Record<string, unknown>) => Promise<void>;
  close: () => void;
}) {
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState("");
  const operation = useRef<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    api<{ employees: { id: string; name: string }[] }>(user, company, {
      signal: abort.signal,
      directory: true,
    })
      .then((data) => {
        if (!abort.signal.aborted) setWorkers(data.employees);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [company, user]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    operation.current ??= crypto.randomUUID();
    void save({
      action: "create",
      permitId: operation.current,
      employeeId: f.get("employee"),
      task: f.get("task"),
      location: f.get("location"),
    });
  }
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-3 rounded-xl border p-5">
      <h2 className="font-semibold">Nova PT</h2>
      {error && <p role="alert">{error}</p>}
      <label className="block">
        Colaborador responsável
        <select className={field} name="employee" required defaultValue="">
          <option value="">Selecione o colaborador</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Atividade
        <Input name="task" required minLength={3} maxLength={320} />
      </label>
      <label className="block">
        Local da atividade
        <Input name="location" required minLength={3} maxLength={320} />
      </label>
      <div className="flex gap-2">
        <Button disabled={busy || !workers.length}>Registrar PT</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
function ReviewPermit({
  user,
  company,
  permit,
  mayReview,
  busy,
  save,
}: {
  user: Account;
  company: string;
  permit: WorkPermit;
  mayReview: boolean;
  busy: boolean;
  save: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AprEvidence>(blankAnswers),
    [confirmed, setConfirmed] = useState(false);
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]),
    [docError, setDocError] = useState("");
  useEffect(() => {
    if (!mayReview || permit.status !== "awaiting_review") return;
    const abort = new AbortController();
    (async () => {
      const res = await fetch("/api/clients/" + encodeURIComponent(company) + "/documents", {
        headers: { Authorization: "Bearer " + (await user.getIdToken()) },
        signal: abort.signal,
        cache: "no-store",
      });
      if (!res.ok) throw Error("Não foi possível consultar o acervo desta empresa.");
      const data = await res.json();
      if (!abort.signal.aborted)
        setDocs(
          data.documents.filter(
            (d: { id: string; companyId: string; isDeleted?: boolean }) =>
              d.companyId === company && !d.isDeleted && /^[a-f0-9]{64}$/.test(d.id)
          )
        );
    })().catch((err) => {
      if (!abort.signal.aborted) setDocError(err.message);
    });
    return () => abort.abort();
  }, [user, company, mayReview, permit.status]);
  const done = permit.status === "awaiting_signature",
    e = permit.evidence || draft,
    disabled = done || !mayReview || busy;
  return (
    <form
      className="max-w-3xl space-y-4 rounded-xl border p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!disabled && confirmed && readyForReview(e))
          void save({ action: "review", permitId: permit.id, evidence: e, confirmed: true });
      }}
    >
      <h2 className="font-semibold">APR · {permit.task}</h2>
      <p>
        {permit.employeeName} · {permit.location}
      </p>
      {done ? (
        <p>
          APR registrada por {permit.reviewerName} em{" "}
          {new Date(permit.reviewedAt!).toLocaleString("pt-BR")}. PT aguardando assinatura.
        </p>
      ) : (
        <p>Aguardando revisão técnica da APR.</p>
      )}
      <fieldset disabled={disabled} className="space-y-3">
        {(
          [
            ["hazards", "Riscos identificados na atividade"],
            ["controls", "Medidas de controle definidas"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            {label}
            <Textarea
              required
              minLength={3}
              maxLength={320}
              value={e[key]}
              onChange={(ev) => setDraft({ ...e, [key]: ev.target.value })}
            />
          </label>
        ))}
        <label className="block">
          Comprovante de confirmação da equipe no acervo da empresa
          {done ? (
            <span className="block">
              {permit.evidenceName} · {e.teamEvidence}
            </span>
          ) : (
            <select
              className={field}
              value={e.teamEvidence}
              onChange={(ev) => setDraft({ ...e, teamEvidence: ev.target.value })}
            >
              <option value="">Selecione o PDF conferido</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </label>
        {!done &&
          mayReview &&
          (docError ? (
            <p role="alert">{docError}</p>
          ) : !docs.length ? (
            <p>O comprovante precisa estar no acervo da empresa para concluir a APR.</p>
          ) : null)}
        {aprKeys.map((key) => (
          <fieldset className="rounded-md border p-3" key={key}>
            <legend>{aprChecks[key]}</legend>
            <label>
              Verificação
              <select
                className={field}
                value={e.answers[key].status}
                onChange={(ev) =>
                  setDraft({
                    ...e,
                    answers: {
                      ...e.answers,
                      [key]: {
                        ...e.answers[key],
                        status: ev.target.value as AprEvidence["answers"][typeof key]["status"],
                      },
                    },
                  })
                }
              >
                <option value="pending">Pendente</option>
                <option value="confirmed">Confirmado</option>
                <option value="not_applicable">Não se aplica</option>
              </select>
            </label>
            <label>
              Evidência ou justificativa
              <Input
                required
                minLength={3}
                maxLength={500}
                value={e.answers[key].note}
                onChange={(ev) =>
                  setDraft({
                    ...e,
                    answers: { ...e.answers, [key]: { ...e.answers[key], note: ev.target.value } },
                  })
                }
              />
            </label>
          </fieldset>
        ))}
        {!done && mayReview && (
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(ev) => setConfirmed(ev.target.checked)}
            />
            Conferi os riscos, os controles e o comprovante de confirmação da equipe para esta
            atividade.
          </label>
        )}
      </fieldset>
      {!done && mayReview && (
        <Button disabled={busy || !confirmed || !readyForReview(e)}>
          Registrar APR para assinatura da PT
        </Button>
      )}
    </form>
  );
}
