"use client";
import * as React from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
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
  const fieldClass = "mt-1 w-full rounded border bg-background p-2 text-foreground";
  const valid = KitSelection.safeParse(selection).success;
  return (
    <section className="space-y-4 rounded-xl border p-4" aria-label="Emissão de kits no NAI">
      <h2 className="text-lg font-semibold">Preparar e emitir kits</h2>
      <p className="text-sm">
        Selecione até 10 colaboradores do mesmo cargo e setor. Preencha o protocolo conferido no PGR
        e PCMSO. Você pode preparar pelo botão ou pedir na conversa: “Prepare os kits selecionados”.
      </p>
      <p className="text-sm text-muted-foreground">
        O PDF contém pedido de exames, fichas em branco e minuta de ASO. Horário, envio à clínica e
        pedido no SOC são etapas separadas.
      </p>
      <div className="flex flex-wrap gap-4 text-sm underline">
        <Link href="/providers">Credenciar ou vincular clínica</Link>
        <Link href={`/clients/${encodeURIComponent(companyId)}`}>
          Cadastrar documentos do cliente
        </Link>
        <Link href="/health-control?tab=agendamento">Acompanhar solicitações e kits</Link>
        {companyId === "GRUPO_AVP" && <Link href="/clients/grupo-avp">Conferir campanha AVP</Link>}
      </div>
      {catalog?.campaign && (
        <p className="text-sm">
          Campanha AVP: {catalog.campaign.people} participantes, {catalog.campaign.review} em
          revisão, {catalog.campaign.cities} municípios. Consulta: {catalog.campaign.checkedAt} ·{" "}
          {catalog.campaign.status}. Confira na campanha os participantes e a clínica; nomes da
          planilha não são vinculados automaticamente ao cadastro.
        </p>
      )}
      {catalog?.campaignWarning && <p role="status">{catalog.campaignWarning}</p>}
      {!catalog && !error && <p role="status">Carregando cadastros…</p>}
      {catalog && (
        <fieldset disabled={busy || disabled} className="space-y-4">
          <label className="block text-sm">
            Buscar colaborador por nome, cargo ou setor
            <input
              className={fieldClass}
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
                      !selection.employeeIds.includes(e.id) && selection.employeeIds.length >= 10
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
              <p>Nenhum colaborador ativo cadastrado para este cliente.</p>
            )}
          </div>
          <p className="text-sm">{selection.employeeIds.length} colaboradores selecionados</p>
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
              Competência da campanha (não alterar para repetir emissão)
              <input
                className={fieldClass}
                type="month"
                value={selection.cycle}
                onChange={(e) => update({ cycle: e.target.value })}
              />
            </label>
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
                PDF {label} conferido
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
              Médico responsável pelo PCMSO
              <input
                className={fieldClass}
                maxLength={200}
                value={selection.pcmsoDoctor}
                onChange={(e) => update({ pcmsoDoctor: e.target.value })}
              />
            </label>
            <label className="text-sm">
              CRM/UF (ex.: 12345/SP)
              <input
                className={fieldClass}
                maxLength={20}
                value={selection.pcmsoCrm}
                onChange={(e) => update({ pcmsoCrm: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            Exames conferidos no PCMSO — um por linha
            <textarea
              className={fieldClass}
              maxLength={6000}
              rows={3}
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
            Riscos conforme PGR/PCMSO — um por linha, incluindo ausência quando expressamente
            documentada
            <textarea
              className={fieldClass}
              maxLength={6000}
              rows={3}
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
          <Button disabled={!valid || busy} onClick={() => void execute("prepare")}>
            Preparar prévia
          </Button>
          {!valid && (
            <p className="text-sm text-muted-foreground">
              Complete os campos e selecione colaboradores, clínica e os dois documentos para
              preparar.
            </p>
          )}
        </fieldset>
      )}
      {preview && (
        <div className="space-y-3 rounded border p-4">
          <h3 className="font-semibold">Conferir antes de gerar</h3>
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
            Prévia válida por 30 minutos. As referências dos documentos foram conferidas no
            cadastro; conteúdo, vigência e adequação ao trabalhador precisam da sua revisão.
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
          <summary>Últimos 50 kits arquivados deste cliente</summary>
          <div className="space-y-2 mt-3">
            {catalog.history.map((r) => (
              <Button key={r.id} disabled={busy || disabled} onClick={() => void download(r)}>
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
