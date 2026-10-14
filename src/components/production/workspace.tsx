"use client";
import * as React from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import { hashContractFile } from "@/lib/contracts/integration";
import {
  type ProductionBook,
  type ProductionRecord,
  type ProductionCard,
  type Cycle,
  type Command,
  type TermsSchema,
  type DocumentSchema,
  progress,
  totals,
  instructionFor,
} from "@/lib/production/model";
import {
  stages,
  stageNames,
  agentNames,
  instructions,
  instructionVersion,
  type Stage,
} from "@/lib/production/instructions";
import type { Extraction } from "@/lib/production/analysis";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Company = { id: string; name: string; cnpj: string };
type FinanceOptions = {
  version: number;
  contracts: { id: string; name: string; client: string; monthlyCents: number }[];
  titles: {
    id: string;
    description: string;
    competence: string;
    amountCents: number;
    receivedCents: number;
    adjustmentCents: number;
  }[];
};
type Terms = z.infer<typeof TermsSchema>;
type Document = z.infer<typeof DocumentSchema>;
type Mutation = Command extends infer C
  ? C extends Command
    ? Omit<C, "requestId" | "expectedVersion">
    : never
  : never;
const inputClass = "w-full rounded-md border border-input bg-background p-2 text-sm";
const money = (v: number) =>
  (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusNames = {
  todo: "A fazer",
  doing: "Em andamento",
  blocked: "Bloqueado",
  done: "Concluído",
  na: "Não aplicável",
};
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const value = (f: FormData, name: string) => String(f.get(name) || "").trim();
function amount(f: FormData, name: string) {
  const raw = value(f, name).replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new Error("Informe valores positivos com até duas casas decimais.");
  return Math.round(Number(raw) * 100);
}
function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  required = false,
  maxLength = 2000,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <input
        className={inputClass}
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        maxLength={maxLength}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
      />
    </label>
  );
}
function TextField({
  label,
  name,
  defaultValue = "",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <textarea
        className={inputClass}
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={2000}
        rows={3}
      />
    </label>
  );
}
class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}
async function api(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${await getActionIdToken()}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.error || "Não foi possível concluir a operação.", response.status);
  return result;
}
export default function ProductionWorkspace() {
  const { user } = useUser();
  return user ? (
    <Workspace key={user.uid} />
  ) : (
    <p className="p-8">Entre no NAI para acessar a central.</p>
  );
}
function Workspace() {
  const [book, setBook] = React.useState<ProductionBook | null>(null),
    [companies, setCompanies] = React.useState<Company[]>([]);
  const [selectedCycle, setSelectedCycle] = React.useState("");
  const [selected, setSelected] = React.useState(""),
    [tab, setTab] = React.useState<"work" | "training" | "agents">("work");
  const [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const [pending, setPending] = React.useState<Command | null>(null),
    [showCreate, setShowCreate] = React.useState(false),
    [search, setSearch] = React.useState("");
  const mounted = React.useRef(true),
    lock = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const data = await api("/api/production");
        if (mounted.current) {
          setBook(data.book);
          setCompanies(data.companies);
        }
      } catch (e) {
        if (mounted.current) setError((e as Error).message);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);
  const reload = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const data = await api("/api/production");
      if (mounted.current) {
        setBook(data.book);
        setCompanies(data.companies);
        setPending(null);
        setError("");
        setNotice("Central atualizada. Confira o histórico antes de repetir uma operação.");
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const saveCommand = async (command: Command) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setPending(command);
    try {
      const next = await api("/api/production", command);
      if (!mounted.current) return false;
      setBook(next);
      setPending(null);
      setSelected(command.recordId);
      if (command.action === "cycle") setSelectedCycle(command.cycleId);
      if (command.action === "create") setSelectedCycle("");
      setNotice("Alteração salva e confirmada.");
      return true;
    } catch (e) {
      if (
        mounted.current &&
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 409
      )
        setPending(null);
      if (mounted.current)
        setError(
          `${(e as Error).message} ${e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 409 ? "Corrija os dados e salve novamente." : "A solicitação foi preservada para nova tentativa; em caso de conflito, atualize e revise."}`
        );
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const mutate = async (command: Mutation) => {
    if (!book || pending) return false;
    return saveCommand({
      ...command,
      requestId: crypto.randomUUID(),
      expectedVersion: book.version,
    } as Command);
  };
  const record = book?.records.find((r) => r.id === selected);
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">NAI · Gestão de serviços</p>
          <h1 className="text-2xl font-bold">Central de Contratos e Produção</h1>
          <p className="text-sm text-muted-foreground">
            Do orçamento à implantação, entrega e recebimento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={reload}>
            Atualizar
          </Button>
          <Button disabled={!book || busy || !!pending} onClick={() => setShowCreate(!showCreate)}>
            Novo registro
          </Button>
        </div>
      </header>
      <p className="rounded-lg border bg-muted/30 p-3 text-sm">
        Acesso à central completa: administração interna, pois contém dados comerciais e
        financeiros. Os agentes preparam orientações e rascunhos. Nenhum e-mail, mensagem, NF ou
        cobrança é enviado ou emitido automaticamente.
      </p>
      {error && (
        <div role="alert" className="rounded-md border border-red-400 p-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {pending && (
        <Button variant="outline" disabled={busy} onClick={() => saveCommand(pending)}>
          Repetir a mesma solicitação com segurança
        </Button>
      )}
      {!book ? (
        <p>
          {error
            ? "A central não foi carregada. Verifique seu acesso e tente atualizar."
            : "Carregando central…"}
        </p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Áreas da central">
            {(
              [
                ["work", "Esteira de produção"],
                ["training", "Instruções de trabalho"],
                ["agents", "3 agentes IA"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={tab === id ? "default" : "outline"}
                onClick={() => setTab(id)}
              >
                {label}
              </Button>
            ))}
            <Button asChild variant="outline">
              <Link href="/financial/operacoes">Abrir ERP financeiro</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contracts">Importações anteriores</Link>
            </Button>
          </nav>
          {showCreate && (
            <RecordForm
              companies={companies}
              disabled={busy || !!pending}
              onSave={async (c) => {
                if (await mutate(c)) setShowCreate(false);
              }}
            />
          )}
          {tab === "training" ? (
            <Training />
          ) : (
            <>
              <label className="block text-sm">
                Buscar cliente, CNPJ ou contrato
                <input
                  className={inputClass}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Registro
                <select
                  className={inputClass}
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setSelectedCycle("");
                  }}
                >
                  <option value="">Selecione um registro</option>
                  {book.records
                    .filter((r) =>
                      `${r.companyName} ${r.cnpj} ${r.name}`
                        .toLowerCase()
                        .includes(search.toLowerCase())
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.companyName} · {r.name}
                        {!r.active ? " · encerrado" : ""}
                      </option>
                    ))}
                </select>
              </label>
              {!record ? (
                <p className="p-8 text-center text-muted-foreground">
                  Cadastre uma proposta ou contrato, revise os dados extraídos e gere a esteira.
                  Também é possível cadastrar manualmente.
                </p>
              ) : tab === "agents" ? (
                <Agents key={record.id} record={record} />
              ) : (
                <RecordView
                  key={record.id + ":" + book.version}
                  record={record}
                  selectedCycle={selectedCycle}
                  onSelectCycle={setSelectedCycle}
                  book={book}
                  disabled={busy || !!pending}
                  mutate={mutate}
                />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
const emptyTerms: Terms = {
  scope: "",
  units: "",
  deliverables: "",
  valueCents: null,
  startsOn: "",
  endsOn: "",
  paymentTerms: "",
  recurring: false,
};
function TermsFields({ terms }: { terms: Terms }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField label="Escopo revisado" name="scope" defaultValue={terms.scope} required />
      <TextField label="Entregáveis" name="deliverables" defaultValue={terms.deliverables} />
      <TextField label="Unidades atendidas" name="units" defaultValue={terms.units} />
      <TextField
        label="Pagamento, frequência e base do valor"
        name="paymentTerms"
        defaultValue={terms.paymentTerms}
      />
      <Field
        label="Valor contratado para o ciclo inicial (R$); vazio = pendente"
        name="value"
        type="number"
        defaultValue={terms.valueCents === null ? "" : terms.valueCents / 100}
      />
      <Field
        label="Início da vigência; vazio = pendente"
        name="startsOn"
        type="date"
        defaultValue={terms.startsOn}
      />
      <Field
        label="Fim da vigência; vazio = pendente"
        name="endsOn"
        type="date"
        defaultValue={terms.endsOn}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="recurring" defaultChecked={terms.recurring} />
        Contrato recorrente (conferido)
      </label>
    </div>
  );
}
function readTerms(f: FormData): Terms {
  return {
    scope: value(f, "scope"),
    units: value(f, "units"),
    deliverables: value(f, "deliverables"),
    valueCents: value(f, "value") ? amount(f, "value") : null,
    startsOn: value(f, "startsOn"),
    endsOn: value(f, "endsOn"),
    paymentTerms: value(f, "paymentTerms"),
    recurring: f.get("recurring") === "on",
  };
}
function SourceUpload({
  onChange,
  disabled,
  onBusy,
}: {
  onChange: (document: Document | null, extraction: Extraction | null) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [document, setDocument] = React.useState<Document | null>(null),
    [kind, setKind] = React.useState<Document["kind"]>("contrato");
  return (
    <div className="space-y-3 rounded-md border p-4">
      <label className="block text-sm">
        Tipo de documento
        <select
          className={inputClass}
          disabled={busy || disabled}
          value={kind}
          onChange={(e) => {
            const k = e.target.value as Document["kind"];
            setKind(k);
            if (document) {
              const d = { ...document, kind: k };
              setDocument(d);
              onChange(d, null);
            }
          }}
        >
          <option value="proposta">Proposta</option>
          <option value="contrato">Contrato</option>
          <option value="anexo">Anexo</option>
          <option value="aditivo">Aditivo</option>
        </select>
      </label>
      <label className="block text-sm">
        Preservar PDF original (menos de 10 MB)
        <input
          className={inputClass}
          type="file"
          accept="application/pdf"
          disabled={busy || disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setDocument(null);
            onChange(null, null);
            setBusy(true);
            onBusy(true);
            setError("");
            try {
              const hash = await hashContractFile(file);
              const response = await fetch("/api/production/source", {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${await getActionIdToken()}`,
                  "Content-Type": "application/pdf",
                },
                body: file,
                signal: AbortSignal.timeout(60000),
                cache: "no-store",
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  result.error || "Não foi possível preservar o PDF. Tente novamente."
                );
              const source = result.source as Document["source"];
              if (source.sha256 !== hash || source.sizeBytes !== file.size)
                throw new Error("A integridade do arquivo enviado não foi confirmada.");
              const d = { name: file.name, kind, source };
              setDocument(d);
              onChange(d, null);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
            }
          }}
        />
      </label>
      {document && (
        <>
          <p className="break-all text-xs">
            Fonte preservada: {document.name} · SHA-256 {document.source.sha256}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy || disabled}
            onClick={async () => {
              setBusy(true);
              onBusy(true);
              setError("");
              try {
                const data = await api("/api/production/assistant", {
                  action: "extract",
                  source: document.source,
                });
                onChange(document, data.extraction);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
                onBusy(false);
              }
            }}
          >
            Identificar cliente e dados com IA
          </Button>
        </>
      )}
      {busy && <p role="status">Processando documento…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
function RecordForm({
  companies,
  disabled,
  onSave,
  record,
}: {
  companies: Company[];
  disabled: boolean;
  onSave: (c: Mutation) => Promise<void>;
  record?: ProductionRecord;
}) {
  const [sourceBusy, setSourceBusy] = React.useState(false);
  const [document, setDocument] = React.useState<Document | null>(null),
    [extraction, setExtraction] = React.useState<Extraction | null>(null),
    [terms, setTerms] = React.useState<Terms>(record?.revisions.at(-1)?.terms || emptyTerms),
    [revision, setRevision] = React.useState(0),
    [error, setError] = React.useState("");
  const [companyId, setCompanyId] = React.useState(record?.companyId || ""),
    [cnpj, setCnpj] = React.useState(record?.cnpj || "");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {record ? "Anexar documento / aprovar aditivo" : "Cadastrar e gerar nove cards"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (sourceBusy) return;
            setError("");
            try {
              const f = new FormData(e.currentTarget),
                evidence = value(f, "evidence");
              if (record) {
                if (!document) throw new Error("Anexe o documento.");
                if (document.kind === "aditivo")
                  await onSave({
                    action: "amend",
                    recordId: record.id,
                    terms: readTerms(f),
                    document,
                    effectiveOn: value(f, "effectiveOn"),
                    evidence,
                    reviewed: true,
                  });
                else await onSave({ action: "document", recordId: record.id, document, evidence });
              } else
                await onSave({
                  action: "create",
                  recordId: crypto.randomUUID(),
                  companyId,
                  cnpj,
                  name: value(f, "name"),
                  owner: value(f, "owner"),
                  terms: readTerms(f),
                  document,
                  effectiveOn: value(f, "effectiveOn"),
                  evidence,
                  reviewed: true,
                });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <fieldset disabled={disabled || sourceBusy} className="space-y-4">
            <SourceUpload
              disabled={disabled}
              onBusy={setSourceBusy}
              onChange={(d, x) => {
                setDocument(d);
                if (!x) {
                  setExtraction(null);
                  if (!d) {
                    setTerms(record?.revisions.at(-1)?.terms || emptyTerms);
                    setRevision((n) => n + 1);
                    if (!record) {
                      setCnpj("");
                      setCompanyId("");
                    }
                  }
                  return;
                }
                setExtraction(x);
                if (!record && x.cnpj) {
                  const normalized = x.cnpj.replace(/[^a-z\d]/gi, "").toUpperCase();
                  setCnpj(normalized);
                  setCompanyId(companies.find((c) => c.cnpj === normalized)?.id || "");
                }
                setTerms((old) => ({
                  scope: x.scope ?? old.scope,
                  units: x.units ?? old.units,
                  deliverables: x.deliverables ?? old.deliverables,
                  valueCents: x.valueCents ?? old.valueCents,
                  startsOn: x.startsOn ?? old.startsOn,
                  endsOn: x.endsOn ?? old.endsOn,
                  paymentTerms: x.paymentTerms ?? old.paymentTerms,
                  recurring: x.recurring ?? old.recurring,
                }));
                setRevision((n) => n + 1);
              }}
            />
            {extraction && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  Cliente identificado: {extraction.clientName || "Pendente"} ·{" "}
                  {extraction.cnpj || "CNPJ pendente"}
                </p>
                <p>Confira o original. Extração não equivale a validação contratual.</p>
                <ul className="list-disc pl-5">
                  {extraction.pending.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <details>
                  <summary>Referências da extração</summary>
                  {extraction.references.map((r, i) => (
                    <p key={i}>
                      {r.field}: {r.pageOrClause} — {r.excerpt}
                    </p>
                  ))}
                </details>
              </div>
            )}
            {!record && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Cliente cadastrado
                  <select
                    className={inputClass}
                    required
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      if (!extraction)
                        setCnpj(companies.find((c) => c.id === e.target.value)?.cnpj || "");
                    }}
                  >
                    <option value="">Selecione o cliente</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.cnpj}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  CNPJ conferido no documento
                  <input
                    className={inputClass}
                    required
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                  />
                </label>
                <Field
                  name="name"
                  label="Nome do contrato / serviço inicial"
                  required
                  maxLength={180}
                />
                <Field name="owner" label="Gestor responsável" required maxLength={180} />
              </div>
            )}
            {(!record || document?.kind === "aditivo") && (
              <>
                <TermsFields key={revision} terms={terms} />
                <Field
                  name="effectiveOn"
                  label="Data de efeito desta versão (revisada)"
                  type="date"
                  defaultValue={today()}
                  required
                />
                {record && (
                  <details>
                    <summary>
                      Comparar com a versão vigente (rev. {record.revisions.length})
                    </summary>
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(record.revisions.at(-1)?.terms, null, 2)}
                    </pre>
                    <p className="text-sm">
                      A nova versão será usada ao selecionar futuros ciclos. Os ciclos existentes
                      mantêm escopo e valores históricos; não são alterados automaticamente.
                    </p>
                  </details>
                )}
              </>
            )}
            <TextField
              name="evidence"
              label="Evidência da revisão / aprovação e pendências identificadas"
              required
            />
            <label className="flex items-start gap-2 text-sm">
              <input key={String(revision) + document?.source.sha256} type="checkbox" required />
              Conferi o cliente, o documento original e os dados. Autorizo salvar esta versão e
              gerar as tarefas, sem autorizar envio externo.
            </label>
            {error && <p role="alert">{error}</p>}
            <Button type="submit">
              {record ? "Salvar documento / versão aprovada" : "Salvar e gerar esteira"}
            </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
function RecordView({
  record,
  book,
  disabled,
  mutate,
  selectedCycle,
  onSelectCycle,
}: {
  record: ProductionRecord;
  book: ProductionBook;
  selectedCycle: string;
  onSelectCycle: (id: string) => void;
  disabled: boolean;
  mutate: (c: Mutation) => Promise<boolean>;
}) {
  const [finance, setFinance] = React.useState<FinanceOptions | null>(null);
  const [financeBusy, setFinanceBusy] = React.useState(false);
  const financeAlive = React.useRef(true);
  React.useEffect(() => {
    financeAlive.current = true;
    return () => {
      financeAlive.current = false;
    };
  }, []);
  const loadFinance = async () => {
    setFinanceBusy(true);
    try {
      const data = await api(`/api/production/finance?recordId=${encodeURIComponent(record.id)}`);
      if (financeAlive.current) setFinance(data);
    } catch (e) {
      if (financeAlive.current) setError((e as Error).message);
    } finally {
      if (financeAlive.current) setFinanceBusy(false);
    }
  };
  const cycleId = record.cycles.some((c) => c.id === selectedCycle)
    ? selectedCycle
    : record.cycles.at(-1)?.id || "";
  const [documents, setDocuments] = React.useState(false),
    [error, setError] = React.useState("");
  const cycle = record.cycles.find((c) => c.id === cycleId),
    sum = totals(record),
    p = progress(record);
  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4">
        <h2 className="text-xl font-semibold">{record.name}</h2>
        <p>
          {record.companyName} · {record.cnpj} · Gestor: {record.owner}
        </p>
        <p className="text-sm">
          {record.active
            ? record.formalizedAt
              ? "Contrato ativo"
              : "Em negociação / formalização"
            : record.formalizedAt
              ? "Contrato encerrado"
              : "Negociação encerrada"}{" "}
          · {p.completed}/{p.total} cards concluídos · {record.revisions.length} versão(ões)
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {(
            [
              ["Contratado nos ciclos", sum.contracted],
              ["Medido", sum.measured],
              ["Faturado registrado", sum.invoiced],
              ["Recebido registrado", sum.received],
            ] as const
          ).map(([label, v]) => (
            <div className="rounded-md bg-muted p-3" key={label}>
              <p className="text-xs">{label}</p>
              <strong>{money(v)}</strong>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Totais dos ciclos cadastrados, não projeção de toda a vigência. Valores contratados
          pendentes: {record.cycles.filter((c) => c.contractedCents === null).length}. Registros da
          central não substituem emissão fiscal nem lançamentos do ERP.
        </p>
      </div>
      <details className="rounded border p-4">
        <summary>Revisar dados iniciais antes da formalização</summary>
        <p className="my-2 text-sm">
          Use para resolver dados pendentes. Reabra os cards comerciais primeiro. A revisão atualiza
          o único ciclo inicial ainda sem execução; após formalização, registre um aditivo.
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const f = new FormData(e.currentTarget);
              await mutate({
                action: "revise",
                recordId: record.id,
                terms: readTerms(f),
                effectiveOn: value(f, "effectiveOn"),
                evidence: value(f, "evidence"),
                reviewed: true,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <fieldset disabled={disabled || !record.active} className="space-y-3">
            <TermsFields terms={record.revisions.at(-1)!.terms} />
            <Field
              name="effectiveOn"
              label="Data de efeito revisada"
              type="date"
              defaultValue={record.revisions.at(-1)!.effectiveOn}
              required
            />
            <TextField name="evidence" label="Evidência e motivo da correção" required />
            <label className="flex gap-2 text-sm">
              <input type="checkbox" required />
              Conferi as alterações e o valor do ciclo inicial.
            </label>
            <Button type="submit">Salvar revisão inicial</Button>
          </fieldset>
        </form>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setDocuments(!documents)}>
          Documentos e aditivos ({record.documents.length})
        </Button>
        <Button type="button" variant="outline" disabled={financeBusy} onClick={loadFinance}>
          {financeBusy ? "Consultando ERP…" : "Consultar contratos e títulos do ERP"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/financial/operacoes">Conferir lançamentos no ERP</Link>
        </Button>
      </div>
      {documents && (
        <>
          <div className="space-y-2">
            {record.documents.map((d) => (
              <div
                key={d.source.sha256}
                className="flex flex-wrap items-center gap-2 rounded border p-2"
              >
                <span>
                  {d.kind} · {d.name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/production/source", {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${await getActionIdToken()}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(d.source),
                      });
                      if (!r.ok) throw new Error("Não foi possível obter o original.");
                      const url = URL.createObjectURL(await r.blob());
                      const a = window.document.createElement("a");
                      a.href = url;
                      a.download = d.name;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Baixar original
                </Button>
              </div>
            ))}
          </div>
          <RecordForm
            record={record}
            companies={[]}
            disabled={disabled || !record.active}
            onSave={async (c) => {
              if (await mutate(c)) setDocuments(false);
            }}
          />
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Comercial · uma vez por negociação</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {record.commercial.map((card) => (
            <CardEditor
              key={card.id}
              card={card}
              disabled={disabled || !record.active}
              save={(c) =>
                mutate({
                  action: "card",
                  recordId: record.id,
                  cycleId: "",
                  card: c.card,
                  reason: c.reason,
                })
              }
            />
          ))}
        </div>
      </section>
      <label className="block text-sm">
        Ciclo operacional / competência
        <select
          className={inputClass}
          value={cycleId}
          onChange={(e) => onSelectCycle(e.target.value)}
        >
          {record.cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.service} · {c.period} · revisão {c.revision + 1}
            </option>
          ))}
        </select>
      </label>
      {cycle && (
        <>
          <details className="rounded border p-3">
            <summary>Escopo preservado deste ciclo · revisão {cycle.revision + 1}</summary>
            <form
              className="my-3 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const f = new FormData(e.currentTarget);
                  await mutate({
                    action: "replan",
                    recordId: record.id,
                    cycleId: cycle.id,
                    revision: Number(value(f, "revision")),
                    contractedCents: value(f, "value") ? amount(f, "value") : null,
                    reason: value(f, "reason"),
                    reviewed: true,
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <fieldset className="space-y-3" disabled={disabled || !record.active}>
                <label className="text-sm">
                  Replanejar ciclo não iniciado com aditivo aprovado
                  <select
                    className={inputClass}
                    name="revision"
                    defaultValue={record.revisions.length - 1}
                  >
                    {record.revisions.map((r, n) => (
                      <option key={n} value={n}>
                        Revisão {n + 1} · efeito {r.effectiveOn}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  name="value"
                  label="Valor revisado deste ciclo (R$); vazio = pendente"
                  type="number"
                  defaultValue={cycle.contractedCents === null ? "" : cycle.contractedCents / 100}
                />
                <TextField name="reason" label="Aprovação e impacto do replanejamento" required />
                <label className="flex gap-2 text-sm">
                  <input type="checkbox" required />
                  Conferi a vigência aplicável e confirmo que este ciclo não foi iniciado.
                  Autorizações anteriores de antecipação serão removidas.
                </label>
                <Button type="submit" variant="outline">
                  Aplicar revisão ao ciclo planejado
                </Button>
              </fieldset>
            </form>
            <p className="whitespace-pre-wrap text-sm">
              {record.revisions[cycle.revision].terms.scope}
            </p>
            <p className="text-sm">
              Entregáveis: {record.revisions[cycle.revision].terms.deliverables || "Pendente"}
            </p>
            <p className="text-sm">
              Antecipação: {cycle.advanceEvidence || "Não autorizada; medição após entrega."}
            </p>
          </details>
          {(["operacional", "faturamento"] as const).map((stage) => (
            <section key={stage}>
              <h2 className="mb-3 text-lg font-semibold">{stageNames[stage]}</h2>
              <div className="grid gap-3 lg:grid-cols-3">
                {cycle.cards
                  .filter((c) => instructionFor(c.id).stage === stage)
                  .map((card) => (
                    <CardEditor
                      key={cycle.id + card.id}
                      card={card}
                      disabled={disabled || !record.active}
                      save={(c) =>
                        mutate({
                          action: "card",
                          recordId: record.id,
                          cycleId: cycle.id,
                          card: c.card,
                          reason: c.reason,
                        })
                      }
                    />
                  ))}
              </div>
            </section>
          ))}
          <BillingEditor
            finance={finance}
            cycle={cycle}
            disabled={disabled || !record.active}
            save={async (data) =>
              mutate({ action: "billing", recordId: record.id, cycleId: cycle.id, ...data })
            }
          />
        </>
      )}
      <details className="rounded border p-4">
        <summary>Novo ciclo / serviço / competência</summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await mutate({
                action: "cycle",
                recordId: record.id,
                cycleId: crypto.randomUUID(),
                service: value(f, "service"),
                period: value(f, "period"),
                revision: Number(value(f, "revision")),
                contractedCents: value(f, "value") ? amount(f, "value") : null,
                advanceEvidence: value(f, "advance"),
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <fieldset disabled={disabled || !record.active} className="grid gap-3 md:grid-cols-2">
            <Field name="service" label="Serviço" required />
            <Field name="period" label="Competência (AAAA-MM) ou número da ordem" required />
            <label className="text-sm">
              Versão contratual aplicável
              <select
                className={inputClass}
                name="revision"
                defaultValue={record.revisions.length - 1}
              >
                {record.revisions.map((r, i) => (
                  <option key={i} value={i}>
                    Revisão {i + 1} · efeito {r.effectiveOn}
                  </option>
                ))}
              </select>
            </label>
            <Field name="value" label="Valor contratado para este ciclo (R$)" type="number" />
            <TextField
              name="advance"
              label="Cláusula e aprovação de sinal/antecipação (opcional)"
            />
            <Button type="submit">Criar seis cards do ciclo</Button>
          </fieldset>
        </form>
      </details>
      <details className="rounded border p-4">
        <summary>Vínculo financeiro e encerramento do contrato</summary>
        <p className="my-2 text-sm">
          Contrato ERP vinculado:{" "}
          {record.financeContractId
            ? finance?.contracts.find((c) => c.id === record.financeContractId)?.name ||
              "Vinculado; consulte o ERP para ver os dados atuais"
            : "Nenhum"}
          . O vínculo exige fluxo do ERP com o mesmo CNPJ e não gera lançamentos.
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await mutate({
              action: "linkFinance",
              recordId: record.id,
              financeContractId: value(f, "financeContractId"),
              reason: value(f, "reason"),
            });
          }}
        >
          <fieldset disabled={disabled || !record.active} className="space-y-3">
            <label className="block text-sm">
              Contrato correspondente no ERP
              <select
                className={inputClass}
                name="financeContractId"
                required
                defaultValue={record.financeContractId}
                key={String(finance?.version)}
                disabled={!finance}
              >
                <option value="">
                  {finance
                    ? "Selecione o contrato do mesmo CNPJ"
                    : "Use Consultar contratos e títulos do ERP acima"}
                </option>
                {finance?.contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client} · {c.name} · {money(c.monthlyCents)}/mês
                  </option>
                ))}
              </select>
            </label>
            <TextField name="reason" label="Evidência da conferência do vínculo" required />
            <Button type="submit" variant="outline">
              Vincular contrato do ERP
            </Button>
          </fieldset>
        </form>
        <form
          className="mt-5 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate({
              action: "active",
              recordId: record.id,
              active: !record.active,
              reason: value(new FormData(e.currentTarget), "reason"),
            });
          }}
        >
          <fieldset disabled={disabled} className="space-y-3">
            <TextField
              name="reason"
              label="Justificativa de encerramento / reativação do contrato"
              required
            />
            <label className="flex gap-2 text-sm">
              <input type="checkbox" required />
              Conferi vigência, recorrência, obrigações e pendências.
            </label>
            <Button type="submit" variant="outline">
              {record.active
                ? record.formalizedAt
                  ? "Encerrar contrato inteiro"
                  : "Encerrar negociação sem contratação"
                : "Reativar registro"}
            </Button>
          </fieldset>
        </form>
      </details>
      <details className="rounded border p-4">
        <summary>Histórico de versões e auditoria</summary>
        {record.revisions.map((r, i) => (
          <div key={i} className="my-3 border-b pb-2">
            <strong>
              Revisão {i + 1} · efeito {r.effectiveOn}
            </strong>
            <p className="text-sm">
              {r.evidence} · {r.actor} · {r.at}
            </p>
            <details>
              <summary>Dados aprovados</summary>
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(r.terms, null, 2)}</pre>
            </details>
          </div>
        ))}
        {book.audit
          .filter((a) => a.recordId === record.id)
          .slice()
          .reverse()
          .map((a) => (
            <details key={a.requestId} className="border-b py-2 text-xs">
              <summary>
                {a.at} · {a.action} · {a.actor} · {a.reason}
              </summary>
              <pre className="whitespace-pre-wrap">{a.details}</pre>
            </details>
          ))}
      </details>
    </div>
  );
}
function CardEditor({
  card,
  disabled,
  save,
}: {
  card: ProductionCard;
  disabled: boolean;
  save: (c: { card: ProductionCard; reason: string }) => Promise<boolean>;
}) {
  const i = instructionFor(card.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{i.title}</CardTitle>
        <p className="text-xs">
          {statusNames[card.status]} · {card.owner || "Responsável pendente"}
          {card.due ? ` · ${card.due}` : ""}
        </p>
      </CardHeader>
      <CardContent>
        <details>
          <summary className="cursor-pointer text-sm">
            Editar card e consultar passo a passo
          </summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await save({
                card: {
                  ...card,
                  owner: value(f, "owner"),
                  due: value(f, "due"),
                  status: value(f, "status") as ProductionCard["status"],
                  checks: i.steps.map((_, n) => f.get(`check${n}`) === "on"),
                  evidence: value(f, "evidence"),
                  blocker: value(f, "blocker"),
                },
                reason: value(f, "reason"),
              });
            }}
          >
            <fieldset disabled={disabled} className="space-y-3">
              <p className="text-xs">
                <strong>Entrada:</strong> {i.input}
              </p>
              {i.steps.map((step, n) => (
                <label key={n} className="flex items-start gap-2 text-xs">
                  <input type="checkbox" name={`check${n}`} defaultChecked={card.checks[n]} />
                  {n + 1}. {step}
                </label>
              ))}
              <p className="text-xs">
                <strong>Saída:</strong> {i.output}
              </p>
              <p className="text-xs">
                <strong>Em caso de pendência:</strong> {i.exception}
              </p>
              <Field name="owner" label="Responsável" defaultValue={card.owner} maxLength={180} />
              <Field name="due" label="Prazo" type="date" defaultValue={card.due} />
              <label className="block text-sm">
                Situação
                <select className={inputClass} name="status" defaultValue={card.status}>
                  {Object.entries(statusNames)
                    .filter(([s]) => s !== "na" || ["budget", "proposal"].includes(card.id))
                    .map(([s, label]) => (
                      <option value={s} key={s}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <TextField
                name="evidence"
                label="Evidências, protocolo ou justificativa"
                defaultValue={card.evidence}
              />
              <TextField
                name="blocker"
                label="Bloqueio e responsável pela resolução"
                defaultValue={card.blocker}
              />
              <TextField name="reason" label="Motivo desta atualização" required />
              <Button type="submit" size="sm">
                Salvar card
              </Button>
            </fieldset>
          </form>
        </details>
      </CardContent>
    </Card>
  );
}
function BillingEditor({
  finance,
  cycle,
  disabled,
  save,
}: {
  cycle: Cycle;
  finance: FinanceOptions | null;
  disabled: boolean;
  save: (d: {
    data: Extract<Command, { action: "billing" }>["data"];
    reason: string;
  }) => Promise<boolean>;
}) {
  const [error, setError] = React.useState("");
  return (
    <details className="rounded border p-4">
      <summary>Registrar medição, NF, recebimento e conciliação</summary>
      <p className="my-3 text-sm">
        Registro de evidências de operações efetivas. Emissão de NF e cobrança são realizadas no
        emissor habilitado. Para corrigir dados de um card concluído, reabra primeiro suas etapas
        dependentes. Saldo:{" "}
        {money(cycle.invoicedCents - cycle.receivedCents - cycle.adjustmentCents)}.
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const f = new FormData(e.currentTarget);
            await save({
              data: {
                measuredCents: amount(f, "measuredCents"),
                invoicedCents: amount(f, "invoicedCents"),
                receivedCents: amount(f, "receivedCents"),
                adjustmentCents: amount(f, "adjustmentCents"),
                measurementEvidence: value(f, "measurementEvidence"),
                invoiceReference: value(f, "invoiceReference"),
                invoiceEvidence: value(f, "invoiceEvidence"),
                receiptEvidence: value(f, "receiptEvidence"),
                adjustmentEvidence: value(f, "adjustmentEvidence"),
                financeTitleId: value(f, "financeTitleId"),
              },
              reason: value(f, "reason"),
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <fieldset disabled={disabled} className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["measuredCents", "Valor medido (R$)"],
              ["invoicedCents", "Valor faturado em NF válida (R$)"],
              ["receivedCents", "Valor recebido conciliado (R$)"],
              ["adjustmentCents", "Retenções/descontos aprovados (R$)"],
            ] as const
          ).map(([name, label]) => (
            <Field
              key={name}
              name={name}
              label={label}
              type="number"
              defaultValue={cycle[name] / 100}
              required
            />
          ))}
          {(
            [
              ["measurementEvidence", "Memória de cálculo e aprovação da medição"],
              ["invoiceEvidence", "Evidência de NF válida e cobrança"],
              ["receiptEvidence", "Extrato / evidência de conciliação"],
              ["adjustmentEvidence", "Aprovação de retenções/descontos"],
            ] as const
          ).map(([name, label]) => (
            <TextField key={name} name={name} label={label} defaultValue={cycle[name]} />
          ))}
          <Field
            name="invoiceReference"
            label="Identificador único da NF (emissor/série/número)"
            defaultValue={cycle.invoiceReference}
            maxLength={180}
          />
          <label className="block text-sm">
            Título aprovado do contrato vinculado (opcional)
            <select
              className={inputClass}
              name="financeTitleId"
              defaultValue={cycle.financeTitleId}
              key={String(finance?.version)}
            >
              <option value="">Sem vínculo com título ERP</option>
              {cycle.financeTitleId &&
                !finance?.titles.some((t) => t.id === cycle.financeTitleId) && (
                  <option value={cycle.financeTitleId}>
                    Título já vinculado; consulte o ERP para conferir
                  </option>
                )}
              {finance?.titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.description} · {t.competence} · faturado {money(t.amountCents)} · recebido{" "}
                  {money(t.receivedCents)} · ajustes {money(t.adjustmentCents)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Consulte os títulos acima e confira os valores da medição/NF e da conciliação. O
              servidor verifica novamente ao salvar.
            </span>
          </label>
          <TextField name="reason" label="Motivo da atualização" required />
          <Button type="submit">Salvar registros financeiros</Button>
          {error && <p role="alert">{error}</p>}
        </fieldset>
      </form>
    </details>
  );
}
function Training() {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">
        Instruções de trabalho · versão {instructionVersion}
      </h2>
      <p className="text-sm">
        Treinamento: leia a entrada, execute cada passo, registre a evidência e peça ao responsável
        a conferência antes de concluir. O checklist de cada card acompanha a execução real.
      </p>
      {stages.map((stage) => (
        <div key={stage}>
          <h3 className="mb-3 text-lg font-semibold">
            {stageNames[stage]} · {agentNames[stage]}
          </h3>
          <div className="grid gap-4 lg:grid-cols-3">
            {instructions
              .filter((i) => i.stage === stage)
              .map((i) => (
                <Card key={i.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{i.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>Responsável:</strong> {i.owner}
                    </p>
                    <p>
                      <strong>Entrada:</strong> {i.input}
                    </p>
                    <ol className="list-decimal space-y-2 pl-5">
                      {i.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    <p>
                      <strong>Critério de conclusão:</strong> {i.output}
                    </p>
                    <p>
                      <strong>Pendências:</strong> {i.exception}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
function Agents({ record }: { record: ProductionRecord }) {
  const [stage, setStage] = React.useState<Stage>("comercial"),
    [question, setQuestion] = React.useState(
      "Revise as pendências desta etapa e indique o próximo passo com as evidências necessárias."
    ),
    [answer, setAnswer] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {stages.map((s) => (
          <Button
            key={s}
            variant={s === stage ? "default" : "outline"}
            disabled={busy}
            onClick={() => {
              setStage(s);
              setAnswer("");
            }}
          >
            {agentNames[s]}
          </Button>
        ))}
      </div>
      <p className="text-sm">
        Cada agente consulta o registro selecionado e sua instrução de trabalho. Respostas são
        orientações e rascunhos para revisão; não alteram dados nem realizam envios.
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setAnswer("");
          try {
            const result = await api("/api/production/assistant", {
              action: "consult",
              stage,
              recordId: record.id,
              question,
            });
            if (active.current)
              setAnswer(
                `${agentNames[stage]} · baseado na versão ${result.basedOnVersion} da central\n\n${result.answer}`
              );
          } catch (e) {
            if (active.current) setError((e as Error).message);
          } finally {
            if (active.current) setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          Consulta ou rascunho solicitado
          <textarea
            className={inputClass}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            maxLength={4000}
            rows={4}
            disabled={busy}
          />
        </label>
        <Button disabled={busy}>
          {busy ? "Consultando agente…" : "Consultar " + agentNames[stage]}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {answer && (
        <div
          role="status"
          className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-5 text-sm"
        >
          {answer}
        </div>
      )}
    </section>
  );
}
