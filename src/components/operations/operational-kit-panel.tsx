"use client";
import * as React from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  Building2,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Download,
  Eye,
  FileCheck2,
  FolderOpen,
  History,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  KitSelection,
  type KitSelectionData,
  type KitPreview,
  type KitCatalog,
  type KitResult,
} from "@/lib/operational-kits";

export function OperationalKitPanel({
  companyId,
  preview,
  onPreview,
  onSelection,
  disabled = false,
  onBusy,
}: {
  companyId: string;
  preview: KitPreview | null;
  onPreview: (preview: KitPreview | null) => void;
  onSelection: (selection: KitSelectionData | undefined) => void;
  disabled?: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { user } = useUser();
  const [catalog, setCatalog] = React.useState<KitCatalog | null>(null);
  const [selection, setSelection] = React.useState<KitSelectionData>({
    employeeIds: [],
    clinicId: "",
    cycle: "",
    examType: "periodico",
    pcmsoDocumentId: "",
    pgrDocumentId: "",
    exams: [],
    risks: [],
    pcmsoDoctor: "",
    pcmsoCrm: "",
  });
  const [exams, setExams] = React.useState(""),
    [risks, setRisks] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [reviewed, setReviewed] = React.useState(false);
  const [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const [results, setResults] = React.useState<KitResult[]>([]);
  const active = React.useRef(true),
    locked = React.useRef(false);
  const request = React.useCallback(
    async (body?: unknown, download?: string) => {
      if (!user) throw new Error("Entre no NAI para continuar.");
      const token = await user.getIdToken();
      if (!active.current) throw new Error("Sessão encerrada.");
      const query = new URLSearchParams({ companyId, ...(download ? { download } : {}) });
      const response = await fetch(`/api/work-assistant/kits?${query}`, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Operação não concluída.");
      return response;
    },
    [user, companyId]
  );
  React.useEffect(() => {
    active.current = true;
    void request()
      .then((r) => r.json())
      .then((data) => {
        if (active.current) setCatalog(data);
      })
      .catch((e) => {
        if (active.current) setError(e.message);
      });
    return () => {
      active.current = false;
    };
  }, [request]);
  React.useEffect(() => {
    setReviewed(false);
  }, [preview]);
  const update = (patch: Partial<KitSelectionData>) => {
    const next = { ...selection, ...patch };
    setSelection(next);
    onPreview(null);
    setReviewed(false);
    setResults([]);
    const valid = KitSelection.safeParse(next);
    onSelection(valid.success ? valid.data : undefined);
  };
  const execute = async (action: "prepare" | "confirm") => {
    if (disabled || locked.current || (action === "confirm" && (!preview || !reviewed))) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const data = await (
        await request(
          action === "prepare"
            ? { action, companyId, selection }
            : { action, companyId, proposalId: preview!.proposalId, reviewed: true }
        )
      ).json();
      if (!active.current) return;
      if (action === "prepare") {
        onPreview(data);
        setResults([]);
      } else {
        setResults(data.results);
        onPreview(null);
        setReviewed(false);
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
      if (active.current) onBusy(false);
    }
  };
  const download = async (item: KitResult) => {
    if (disabled || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await (await request(undefined, item.id)).blob();
      if (!active.current) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = item.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Falha no download.");
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };
  const fieldClass = "mt-1 w-full rounded-md border bg-background p-2 text-foreground";
  const summaryClass =
    "flex cursor-pointer list-none items-center gap-2 rounded-lg p-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 [&::-webkit-details-marker]:hidden";
  const valid = KitSelection.safeParse(selection).success;
  return (
    <section className="space-y-4 rounded-xl border p-4" aria-label="Emissão de kits no NAI">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileCheck2 aria-hidden="true" className="h-5 w-5 text-primary" /> Novo kit
        </h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs">
          {selection.employeeIds.length}/10 selecionados
        </span>
      </div>
      <details className="text-sm text-muted-foreground">
        <summary className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 focus-visible:outline focus-visible:outline-2">
          <CircleHelp aria-hidden="true" className="h-4 w-4" /> Como funciona
        </summary>
        <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3">
          <p>
            Selecione até 10 colaboradores do mesmo cargo e setor. Confira exames e riscos no PGR e
            PCMSO. Para usar a conversa, peça: “Prepare os kits selecionados”.
          </p>
          <p>
            O PDF contém pedido de exames, fichas em branco e minuta de ASO. Agendamento, envio à
            clínica e pedido SOC são etapas separadas.
          </p>
          <p>
            Use a competência real da campanha. Não altere o período para repetir uma emissão.
            Ausência de riscos só pode ser informada quando documentada.
          </p>
        </div>
      </details>
      {catalog?.campaign && (
        <details className="rounded-lg bg-muted/40 text-sm">
          <summary className={`${summaryClass} flex-wrap`}>
            <MapPin aria-hidden="true" className="h-4 w-4 text-primary" /> AVP
            <span className="rounded-full border px-2 py-0.5 text-xs font-normal">
              {catalog.campaign.people} participantes
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs font-normal">
              {catalog.campaign.review} em revisão
            </span>
            <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4" />
          </summary>
          <div className="space-y-2 px-3 pb-3 text-muted-foreground">
            <p>
              {catalog.campaign.cities} municípios · Consulta: {catalog.campaign.checkedAt} ·{" "}
              {catalog.campaign.status}
            </p>
            <p>Nomes da planilha não são vinculados automaticamente ao cadastro.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/clients/grupo-avp">
                <MapPin aria-hidden="true" /> Abrir campanha
              </Link>
            </Button>
          </div>
        </details>
      )}
      {catalog?.campaignWarning && <p role="status">{catalog.campaignWarning}</p>}
      {!catalog && !error && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Carregando cadastros…
        </p>
      )}
      {catalog && (
        <fieldset disabled={busy || disabled} className="space-y-3">
          <details open className="rounded-lg border">
            <summary className={summaryClass}>
              <Users aria-hidden="true" className="h-4 w-4 text-primary" /> 1. Colaboradores
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {selection.employeeIds.length}/10
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </summary>
            <div className="space-y-3 border-t p-3">
              <label className="block text-sm">
                <span className="flex items-center gap-2">
                  <Search aria-hidden="true" className="h-4 w-4" /> Buscar colaborador
                </span>
                <input
                  className={fieldClass}
                  placeholder="Nome, cargo ou setor"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="max-h-52 overflow-auto rounded border p-3 space-y-2">
                {catalog.employees
                  .filter((e) =>
                    `${e.name} ${e.role} ${e.department}`
                      .toLocaleLowerCase("pt-BR")
                      .includes(search.toLocaleLowerCase("pt-BR"))
                  )
                  .map((e) => (
                    <label key={e.id} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selection.employeeIds.includes(e.id)}
                        disabled={
                          !selection.employeeIds.includes(e.id) &&
                          selection.employeeIds.length >= 10
                        }
                        onChange={(event) =>
                          update({
                            employeeIds: event.target.checked
                              ? [...selection.employeeIds, e.id]
                              : selection.employeeIds.filter((id) => id !== e.id),
                          })
                        }
                      />
                      {e.name} · {e.role || "Cargo pendente"} · {e.department || "Setor pendente"}
                    </label>
                  ))}
                {!catalog.employees.length && (
                  <p className="text-sm text-muted-foreground">Nenhum colaborador ativo.</p>
                )}
                {!!catalog.employees.length &&
                  !catalog.employees.some((e) =>
                    `${e.name} ${e.role} ${e.department}`
                      .toLocaleLowerCase("pt-BR")
                      .includes(search.toLocaleLowerCase("pt-BR"))
                  ) && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum resultado para esta busca.
                    </p>
                  )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Mesmo cargo e setor · até 10 por lote
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link href="/employees">
                    <Plus aria-hidden="true" /> Colaboradores
                  </Link>
                </Button>
              </div>
            </div>
          </details>
          <details className="rounded-lg border">
            <summary className={summaryClass}>
              <Building2 aria-hidden="true" className="h-4 w-4 text-primary" /> 2. Clínica e período
              {selection.clinicId && selection.cycle && (
                <CheckCheck aria-label="Preenchido" className="ml-auto h-4 w-4 text-primary" />
              )}
              <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4" />
            </summary>
            <div className="space-y-3 border-t p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Clínica ativa vinculada
                  <select
                    className={fieldClass}
                    value={selection.clinicId}
                    onChange={(e) => update({ clinicId: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {catalog.clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Competência da campanha
                  <input
                    className={fieldClass}
                    type="month"
                    value={selection.cycle}
                    onChange={(e) => update({ cycle: e.target.value })}
                  />
                </label>
              </div>
              {!catalog.clinics.length && (
                <p className="text-xs text-muted-foreground">Nenhuma clínica ativa vinculada.</p>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/providers">
                  <Plus aria-hidden="true" /> Vincular clínica
                </Link>
              </Button>
            </div>
          </details>
          <details className="rounded-lg border">
            <summary className={summaryClass}>
              <Stethoscope aria-hidden="true" className="h-4 w-4 text-primary" /> 3. Documentos e
              protocolo
              <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4" />
            </summary>
            <div className="space-y-3 border-t p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Tipo de exame
                  <select
                    className={fieldClass}
                    value={selection.examType}
                    onChange={(e) =>
                      update({ examType: e.target.value as KitSelectionData["examType"] })
                    }
                  >
                    {Object.entries({
                      periodico: "Periódico",
                      admissional: "Admissional",
                      demissional: "Demissional",
                      retorno_trabalho: "Retorno ao trabalho",
                      mudanca_funcao: "Mudança de riscos",
                    }).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    ["pcmsoDocumentId", "PCMSO"],
                    ["pgrDocumentId", "PGR"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-sm">
                    {label}
                    <select
                      className={fieldClass}
                      value={selection[key]}
                      onChange={(e) => update({ [key]: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {catalog.documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="text-sm">
                  Médico do PCMSO
                  <input
                    className={fieldClass}
                    maxLength={200}
                    value={selection.pcmsoDoctor}
                    onChange={(e) => update({ pcmsoDoctor: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  CRM/UF
                  <input
                    className={fieldClass}
                    maxLength={20}
                    placeholder="12345/SP"
                    value={selection.pcmsoCrm}
                    onChange={(e) => update({ pcmsoCrm: e.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Exames do PCMSO
                <textarea
                  className={fieldClass}
                  maxLength={6000}
                  rows={3}
                  placeholder="Um exame por linha"
                  value={exams}
                  onChange={(e) => {
                    setExams(e.target.value);
                    update({
                      exams: e.target.value
                        .split("\n")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    });
                  }}
                />
              </label>
              <label className="block text-sm">
                Riscos do PGR/PCMSO
                <textarea
                  className={fieldClass}
                  maxLength={6000}
                  rows={3}
                  placeholder="Um risco por linha, conforme os documentos"
                  value={risks}
                  onChange={(e) => {
                    setRisks(e.target.value);
                    update({
                      risks: e.target.value
                        .split("\n")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    });
                  }}
                />
              </label>
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients/${encodeURIComponent(companyId)}`}>
                  <FolderOpen aria-hidden="true" /> Documentos do cliente
                </Link>
              </Button>
            </div>
          </details>
          <Button disabled={!valid || busy} onClick={() => void execute("prepare")}>
            {busy ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Eye aria-hidden="true" />
            )}
            Preparar prévia
          </Button>
          {!valid && (
            <p className="text-sm text-muted-foreground">
              Preencha os três blocos para preparar a prévia.
            </p>
          )}
        </fieldset>
      )}
      {preview && (
        <div className="space-y-3 rounded border p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" /> Conferir antes de
            gerar
          </h3>
          <p>
            {preview.company} · {preview.examType} · {preview.cycle}
          </p>
          <p>
            Clínica: {preview.clinic} — {preview.clinicAddress}
          </p>
          <ul className="list-disc pl-5">
            {preview.employees.map((e) => (
              <li key={e.id}>
                {e.name} · {e.role} · {e.department}
              </li>
            ))}
          </ul>
          <p>Exames: {preview.exams.join("; ")}</p>
          <p>Riscos: {preview.risks.join("; ")}</p>
          <p>Fontes: {preview.documents.map((d) => d.name).join("; ")}</p>
          <p>
            Médico do PCMSO: {preview.pcmsoDoctor} · {preview.pcmsoCrm}
          </p>
          <p className="text-sm">
            Válida por 30 min. Confira conteúdo, vigência e adequação dos documentos ao trabalhador.
          </p>
          <p className="text-sm text-muted-foreground">
            Gera PDF e minuta de ASO. Não agenda, envia ou cria pedido SOC.
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
              disabled={busy || disabled}
            />
            Conferi os cadastros, a clínica, a vigência dos documentos e o protocolo de exames e
            riscos para todos os colaboradores selecionados.
          </label>
          <Button disabled={busy || disabled || !reviewed} onClick={() => void execute("confirm")}>
            {busy ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <FileCheck2 aria-hidden="true" />
            )}
            Confirmar e gerar {preview.employees.length} kits no NAI
          </Button>
        </div>
      )}
      {!!results.length && (
        <div role="status" className="space-y-2">
          <p>Kits disponíveis. Nenhum envio ou pedido SOC realizado.</p>
          {results.map((r) => (
            <div key={r.id}>
              <Button disabled={busy || disabled} onClick={() => void download(r)}>
                <Download aria-hidden="true" />
                Baixar · {r.employeeName}
              </Button>
              <span className="ml-2 text-sm">
                {r.reused ? "Kit existente reutilizado" : "PDF emitido e auditado"}
              </span>
            </div>
          ))}
        </div>
      )}
      {!!catalog?.history.length && (
        <details>
          <summary className={summaryClass}>
            <History aria-hidden="true" className="h-4 w-4" /> Histórico de kits{" "}
            <span className="text-xs text-muted-foreground">Últimos 50</span>
            <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4" />
          </summary>
          <div className="space-y-2 mt-3">
            {catalog.history.map((r) => (
              <Button key={r.id} disabled={busy || disabled} onClick={() => void download(r)}>
                <Download aria-hidden="true" />
                {r.filename}
              </Button>
            ))}
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
