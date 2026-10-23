"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WorkflowSchema,
  WORKFLOW_STAGES,
  emptyWorkflow,
  workflowNextAction,
  workflowDraft,
  type AvpWorkflow,
  type StoredWorkflow,
} from "@/lib/avp-workflow";
import type { PeriodicPerson } from "@/lib/avp-periodic-control";
import type { AvpAsoEvidence } from "@/lib/avp-evidence";

type Evidence = AvpAsoEvidence & { uploaded?: boolean };
export function AvpWorkflowPanel() {
  const { user } = useUser();
  return <Session key={user?.uid || "signed-out"} />;
}
function Session() {
  const { user } = useUser();
  const active = useRef(true);
  const [people, setPeople] = useState<PeriodicPerson[]>([]);
  const [records, setRecords] = useState<StoredWorkflow[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [editing, setEditing] = useState<AvpWorkflow | null>(null);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function api(path: string, init?: RequestInit) {
    if (!user) throw new Error("Entre no NAI para consultar a esteira.");
    const token = await user.getIdToken();
    if (!active.current) throw new Error("Sessão encerrada.");
    const response = await fetch(`/api/clients/grupo-avp/${path}`, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status) && active.current) {
        setPeople([]);
        setRecords([]);
        setEvidence([]);
        setEditing(null);
        setDraft("");
      }
      throw new Error(data.error || "Não foi possível consultar.");
    }
    return data;
  }
  async function load() {
    setBusy(true);
    setMessage("");
    setEditing(null);
    setDraft("");
    try {
      const [campaign, cases] = await Promise.all([api("periodic-control"), api("workflow")]);
      const docs: Evidence[] = [];
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const page = await api(`evidence${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
        docs.push(...page.records.filter((r: { kind: string }) => r.kind === "aso"));
        cursor = page.nextCursor || null;
        if (cursor && seen.has(cursor)) throw new Error("Paginação inconsistente das evidências.");
        if (cursor) seen.add(cursor);
      } while (cursor && active.current);
      if (active.current) {
        setPeople(campaign.people);
        setRecords(cases.records);
        setEvidence(docs);
      }
    } catch (e) {
      if (active.current) {
        setPeople([]);
        setRecords([]);
        setEvidence([]);
        setMessage(e instanceof Error ? e.message : "Falha na consulta.");
      }
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setMessage("");
    setDraft("");
    try {
      const data = await api("workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: editing, version }),
      });
      if (active.current) {
        setRecords((old) => [...old.filter((r) => r.id !== data.record.id), data.record]);
        setVersion(data.record.version);
        setMessage("Acompanhamento salvo. Nenhuma mensagem foi enviada.");
      }
    } catch (e) {
      if (active.current) setMessage(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function field(key: keyof AvpWorkflow, value: string | boolean) {
    setEditing((old) => {
      if (!old) return old;
      if (key === "evidenceId" && value !== old.evidenceId)
        return {
          ...old,
          evidenceId: String(value),
          documentChecked: false,
          deliveryReference: "",
          stage: value ? "review" : "waiting",
        };
      return { ...old, [key]: value };
    });
    setDraft("");
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const filtered = people.filter((p) =>
    `${p.name} ${p.city} ${p.unit}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  const selected = records.find(
    (r) =>
      r.sourceId === editing?.sourceId &&
      r.unit === editing?.unit &&
      r.admission === editing?.admission
  );
  function prepare(kind: "clinic" | "coordinator") {
    try {
      if (
        !selected ||
        JSON.stringify(WorkflowSchema.parse(selected ? WorkflowSnapshot(selected) : {})) !==
          JSON.stringify(WorkflowSchema.parse(editing))
      )
        throw new Error("Salve a conferência antes de preparar a mensagem.");
      const d = workflowDraft(selected, kind);
      setDraft(
        `Para: ${d.to}\nAssunto: ${d.subject}\n\n${d.body}\n\n${kind === "coordinator" ? "Anexar somente o ASO conferido; ficha clínica não deve acompanhar a entrega ao coordenador.\n" : ""}Rascunho para revisão e autorização. Nenhum envio automático.`
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Confira os dados.");
    }
  }
  return (
    <section className="space-y-4" aria-label="Esteira de ASOs AVP">
      <h2 className="text-2xl font-bold">Do agendamento à entrega do ASO</h2>
      <p className="text-sm">
        Conferência de pedidos, cobrança por prazo e preparação da entrega ao coordenador. A
        consulta SOC deve ser registrada pela equipe; ausência no relatório 270 não comprova
        ausência de pedido.
      </p>
      <Button onClick={() => void load()} disabled={busy}>
        {busy ? "Consultando..." : "Carregar campanha e acompanhamento"}
      </Button>
      {message && (
        <p role="status" className="rounded border p-3">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          {records.filter((r) => r.stage === "waiting" && r.dueDate < today).length} cobranças
          atrasadas
        </span>
        <span>
          {records.filter((r) => r.stage === "ready").length} prontos para revisão de envio
        </span>
        <span>
          {records.filter((r) => r.stage === "delivered").length} entregues com referência
        </span>
      </div>
      <Input
        aria-label="Buscar caso da esteira"
        placeholder="Colaborador, cidade ou unidade"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className="text-sm">
        {filtered.length} participantes · exibindo até 100; refine a busca. Casos ainda não
        conferidos não autorizam gerar kits.
      </p>
      <div className="max-h-80 overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Colaborador e vínculo</th>
              <th>Etapa</th>
              <th>Próxima ação</th>
              <th>Acompanhamento</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((p) => {
              const r = records.find(
                (r) => r.sourceId === p.id && r.unit === p.unit && r.admission === p.admission
              );
              return (
                <tr className="border-t" key={p.id}>
                  <td className="p-2">
                    {p.name}
                    <br />
                    {p.unit} · {p.city}
                    <br />
                    <span className="text-xs">{p.review}</span>
                  </td>
                  <td>{r ? WORKFLOW_STAGES[r.stage] : "Não conferido"}</td>
                  <td>
                    {r
                      ? workflowNextAction(r, today)
                      : "Conferir CPF, vínculo, vencimento e pedidos SOC"}
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      disabled={busy || p.classification === "cancelled"}
                      onClick={() => {
                        setEditing(r ? WorkflowSnapshot(r) : emptyWorkflow(p));
                        setVersion(r?.version || 0);
                        setDraft("");
                        setMessage("");
                      }}
                    >
                      Abrir caso
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="space-y-4 rounded border p-4">
          <h3 className="font-bold">
            {editing.employee} · {editing.unit}
          </h3>
          <p className="text-sm">
            Admissão: {editing.admission}. Confirme CPF e vínculo na fonte antes de avançar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Etapa
              <select
                className="block w-full rounded border p-2 bg-background"
                value={editing.stage}
                onChange={(e) => field("stage", e.target.value)}
              >
                {Object.entries(WORKFLOW_STAGES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Consulta SOC
              <select
                className="block w-full rounded border p-2 bg-background"
                value={editing.socCheck}
                onChange={(e) => field("socCheck", e.target.value)}
              >
                <option value="unchecked">Não conferido</option>
                <option value="no-order">Sem pedido antes da geração</option>
                <option value="existing-order">Pedido já existente: reutilizar</option>
              </select>
            </label>
            {(
              [
                ["socReference", "Evidência da consulta SOC (data, responsável e referência)"],
                ["socOrder", "Número do pedido SOC"],
                ["clinic", "Clínica confirmada"],
                ["clinicEmail", "E-mail da clínica"],
                ["owner", "Responsável pelo acompanhamento"],
                ["scheduledDate", "Data confirmada do agendamento"],
                ["attendedDate", "Data de comparecimento confirmado"],
                ["dueDate", "Prazo de devolução do ASO"],
                ["coordinator", "Coordenador da unidade"],
                ["coordinatorEmail", "E-mail confirmado do coordenador"],
                ["deliveryReference", "Referência do envio realizado"],
                ["notes", "Observações operacionais"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <Input
                  type={key.endsWith("Date") ? "date" : key.endsWith("Email") ? "email" : "text"}
                  value={editing[key]}
                  onChange={(e) => field(key, e.target.value)}
                />
              </label>
            ))}
            <label>
              ASO recebido
              <select
                className="block w-full rounded border p-2 bg-background"
                value={editing.evidenceId}
                onChange={(e) => field("evidenceId", e.target.value)}
              >
                <option value="">Selecionar PDF já anexado</option>
                {evidence
                  .filter((e) => e.uploaded && e.review === "Recebido")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employee} · {e.company} · {e.examDate} · {e.fileName}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="block">
            <input
              type="checkbox"
              checked={editing.identityChecked}
              onChange={(e) => field("identityChecked", e.target.checked)}
            />{" "}
            Conferi CPF, empresa, vínculo, admissão, vencimento e pedidos no SOC.
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={editing.documentChecked}
              onChange={(e) => field("documentChecked", e.target.checked)}
            />{" "}
            Conferi no PDF identificação, empresa/vínculo, tipo e data do exame, assinatura,
            legibilidade e versão; é somente o ASO para o coordenador.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void save()}>
              Salvar acompanhamento
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => prepare("clinic")}>
              Preparar cobrança à clínica
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => prepare("coordinator")}>
              Preparar entrega ao coordenador
            </Button>
          </div>
          {draft && (
            <div className="space-y-2">
              <label>
                Mensagem para revisar
                <textarea
                  readOnly
                  value={draft}
                  className="block min-h-64 w-full rounded border bg-background p-3"
                />
              </label>
              <Button
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(draft)
                    .then(() => setMessage("Rascunho copiado para revisão; nenhum e-mail enviado."))
                    .catch(() => setMessage("Não foi possível copiar. Selecione o texto acima."))
                }
              >
                Copiar rascunho
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
function WorkflowSnapshot(record: StoredWorkflow): AvpWorkflow {
  return WorkflowSchema.parse(
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => !["id", "version", "updatedAt", "updatedBy"].includes(key)
      )
    )
  );
}
