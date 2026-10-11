"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  FileText,
  FileUp,
  FolderCheck,
  HardHat,
  History,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  ScanLine,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PgrAgentReview } from "@/components/pgr-agent-review";
import { pgrRequestHeaders } from "@/lib/pgr-request-headers";
import {
  getNaiDocument,
  cleanPgrCnpj,
  isValidPgrCnpj,
  NAI_DOCUMENT_NAMES,
  PGR_AGENT_NAMES,
  PGR_AGENT_ROLES,
  PGR_MAX_FILE_BYTES,
  type PgrAnalysisOutput,
  type PgrCompany,
  type PgrDraftView,
} from "@/lib/pgr-schema";
import { cn } from "@/lib/utils";

type SavedRecord = {
  id: string;
  companyId: string;
  companyName: string;
  fileName: string;
  analysis?: PgrAnalysisOutput;
  taskCount: number;
  riskCount: number;
  checklistCount?: number;
  providerCount?: number;
  restricted?: boolean;
};

type SavedResult = {
  companyId: string;
  cardId: string;
  taskCount: number;
  checklistCount?: number;
  providerCount?: number;
  providerIds?: string[];
  riskCount?: number;
  alreadySaved?: boolean;
  restricted?: boolean;
};

const PRIORITY_LABELS = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Shared by the current NAI importa route and existing document-import bookmarks. */
export default function NaiImportaPage() {
  const { user } = useUser();
  const { activeClientId, setActiveClientId } = useSgi();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [draft, setDraft] = React.useState<PgrDraftView | null>(null);
  const [saved, setSaved] = React.useState<SavedResult | null>(null);
  const [companies, setCompanies] = React.useState<PgrCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [includeProviders, setIncludeProviders] = React.useState(true);
  const [dueDate, setDueDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState("");
  const [records, setRecords] = React.useState<SavedRecord[]>([]);
  const [historyCompany, setHistoryCompany] = React.useState("");
  const [historyBusy, setHistoryBusy] = React.useState(false);
  const [historyError, setHistoryError] = React.useState("");
  const [historyVersion, setHistoryVersion] = React.useState(0);
  const [historyRecord, setHistoryRecord] = React.useState<SavedRecord | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const serial = React.useRef(0);
  const requestRef = React.useRef<AbortController | null>(null);
  const invalidateRequests = React.useCallback(() => {
    serial.current++;
    requestRef.current?.abort();
  }, []);
  const result = draft?.analysis || historyRecord?.analysis || null;
  const document = result ? getNaiDocument(result) : null;
  const agent = document?.agenteResponsavel || null;
  const providers = result?.prestadoresIdentificados || [];
  const documentedProviders = providers.filter(
    (provider) =>
      provider.evidencias.length > 0 &&
      isValidPgrCnpj(provider.cnpj) &&
      cleanPgrCnpj(provider.cnpj) !== cleanPgrCnpj(result?.pgrCardDetalhado.cnpj || "")
  );
  const checklistCount =
    result?.acoesCategorizadas.reduce((count, action) => count + action.checklist.length, 0) || 0;
  const agentComplete = result?.analiseAgente?.status === "concluida";
  const integrationBlock = !result
    ? ""
    : document?.statusClassificacao !== "identificado" || !agent
      ? "O tipo do documento precisa ser identificado antes de organizar os dados."
      : result.identidade.status !== "identificada"
        ? "A identificação do cliente precisa ser resolvida antes de criar os cadastros."
        : result.leitura.modo === "inconclusiva"
          ? "A leitura não trouxe evidências suficientes. Tente um arquivo mais legível."
          : !agentComplete
            ? "A análise do agente ainda não foi concluída. Tente analisar novamente."
            : "";

  React.useEffect(() => {
    const run = ++serial.current;
    const controller = new AbortController();
    requestRef.current?.abort();
    setDraft(null);
    setSaved(null);
    setFile(null);
    setRecords([]);
    setHistoryRecord(null);
    setHistoryCompany("");
    setCompanies([]);
    setSelectedCompany("");
    setConfirmed(false);
    setDueDate("");
    setIncludeProviders(true);
    setError("");
    setBusy(false);
    setSaving(false);
    if (user)
      void (async () => {
        try {
          const response = await fetch("/api/nai-importa/companies", {
            headers: await pgrRequestHeaders(user),
            cache: "no-store",
            signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "Não foi possível consultar os clientes.");
          if (run === serial.current) setCompanies(data.companies || []);
        } catch (e) {
          if (run === serial.current && !controller.signal.aborted)
            setError(errorMessage(e, "Consulta de clientes indisponível."));
        }
      })();
    return () => {
      invalidateRequests();
      controller.abort();
    };
  }, [user, invalidateRequests]);

  React.useEffect(() => {
    if (activeClientId !== "all" && companies.some((company) => company.id === activeClientId))
      setHistoryCompany(activeClientId);
  }, [activeClientId, companies]);

  React.useEffect(() => {
    const controller = new AbortController();
    setRecords([]);
    setHistoryError("");
    setHistoryBusy(!!historyCompany && !!user);
    if (user && historyCompany)
      void (async () => {
        try {
          const response = await fetch(
            "/api/nai-importa/history?companyId=" + encodeURIComponent(historyCompany),
            {
              headers: await pgrRequestHeaders(user),
              cache: "no-store",
              signal: controller.signal,
            }
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Histórico indisponível.");
          if (!controller.signal.aborted) setRecords(data.records || []);
        } catch (e) {
          if (!controller.signal.aborted)
            setHistoryError(errorMessage(e, "Consulta do histórico indisponível."));
        } finally {
          if (!controller.signal.aborted) setHistoryBusy(false);
        }
      })();
    return () => controller.abort();
  }, [historyCompany, historyVersion, user]);

  async function analyze(nextFile: File) {
    if (busy || saving) return;
    if (!user) {
      setError("Entre no NAI para analisar documentos.");
      return;
    }
    if (!nextFile.size || nextFile.size > PGR_MAX_FILE_BYTES) {
      setError("Selecione um arquivo com conteúdo e até 12 MB.");
      return;
    }
    const extension = nextFile.name.split(".").pop()?.toLowerCase() || "";
    const mime = nextFile.type || FILE_TYPES[extension];
    if (!mime || !Object.values(FILE_TYPES).includes(mime)) {
      setError("Use PDF, PNG, JPEG ou WebP. Exporte outros formatos para PDF antes de enviar.");
      return;
    }
    const normalizedFile = nextFile.type
      ? nextFile
      : new File([nextFile], nextFile.name, { type: mime });
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const run = ++serial.current;
    setBusy(true);
    setFile(normalizedFile);
    setDraft(null);
    setHistoryRecord(null);
    setSaved(null);
    setError("");
    setConfirmed(false);
    setSelectedCompany("");
    setIncludeProviders(true);
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const body = new FormData();
      body.set("file", normalizedFile);
      const response = await fetch("/api/nai-importa/analyze", {
        method: "POST",
        headers: await pgrRequestHeaders(user),
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "A análise não foi concluída.");
      if (run !== serial.current) return;
      setDraft(data);
      setCompanies(data.companies || []);
      setSelectedCompany(data.suggestedCompanyId || "");
      toast({
        title:
          data.analysis?.analiseAgente?.status === "concluida"
            ? "Análise pronta para conferência"
            : "Documento recebido para revisão",
        description: "Confira a identificação, o agente e as ações propostas abaixo.",
      });
    } catch (e) {
      if (run === serial.current)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "A leitura foi interrompida. Tente novamente ou envie um documento menor."
            : errorMessage(e, "Não foi possível analisar o documento.")
        );
    } finally {
      clearTimeout(timer);
      if (run === serial.current) setBusy(false);
    }
  }

  function cancelAnalysis() {
    serial.current++;
    requestRef.current?.abort();
    setBusy(false);
    setError("Leitura interrompida. Você pode analisar novamente ou escolher outro documento.");
  }

  async function integrate() {
    if (!user || !draft || !file || !confirmed || !selectedCompany || integrationBlock || saving)
      return;
    const run = serial.current;
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("draftId", draft.draftId);
      body.set("companyId", selectedCompany === "__create" ? "" : selectedCompany);
      body.set("createCompany", String(selectedCompany === "__create"));
      body.set(
        "includeProviders",
        String(includeProviders && !!draft.canRegisterProviders && documentedProviders.length > 0)
      );
      body.set("confirmed", "true");
      body.set("dueDate", dueDate);
      const response = await fetch("/api/nai-importa/save", {
        method: "POST",
        headers: await pgrRequestHeaders(user),
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível organizar o documento.");
      if (run !== serial.current) return;
      setSaved(data);
      setDraft((current) => (current ? { ...current, analysis: data.analysis } : current));
      setActiveClientId(data.companyId);
      setHistoryCompany(data.companyId);
      setHistoryVersion((current) => current + 1);
      toast({
        title: data.alreadySaved ? "Este documento já está organizado" : "Documento organizado",
        description: "O resultado e os links para acompanhar o trabalho estão disponíveis abaixo.",
      });
    } catch (e) {
      if (run === serial.current) setError(errorMessage(e, "Falha ao organizar o documento."));
    } finally {
      if (run === serial.current) setSaving(false);
    }
  }

  function openRecord(record: SavedRecord) {
    if (saving || busy || !record.analysis) return;
    serial.current++;
    requestRef.current?.abort();
    setDraft(null);
    setFile(null);
    setHistoryRecord(record);
    setSaved({
      companyId: record.companyId,
      cardId: record.id,
      taskCount: record.taskCount,
      checklistCount: record.checklistCount,
      riskCount: record.riskCount,
      providerCount: record.providerCount,
      restricted: getNaiDocument(record.analysis).acesso === "clinico_restrito",
    });
    setConfirmed(false);
    setError("");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 text-slate-900">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-slate-500">
          <Link href="/">
            <ArrowLeft className="mr-2 size-4" /> Visão geral
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Central inteligente de documentos
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">NAI importa</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Envie o documento. O NAI identifica o tipo, aciona o agente responsável e prepara
              cadastros, cards e checklists para sua equipe conferir e acompanhar.
            </p>
          </div>
          <div className="hidden rounded-2xl bg-teal-50 p-4 text-teal-700 sm:block">
            <ScanLine className="size-7" />
          </div>
        </div>
      </header>

      <ol aria-label="Etapas da importação" className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Enviar", detail: "Um documento por vez" },
          { label: "Analisar e revisar", detail: "Agente, vínculos e ações" },
          { label: "Organizar", detail: "Cadastros e operação" },
        ].map((step, index) => {
          const currentStep = saved ? 2 : result || busy ? 1 : 0;
          return (
            <li
              key={step.label}
              aria-current={index === currentStep ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-3 sm:gap-3 sm:p-4",
                index === currentStep
                  ? "border-teal-200 bg-teal-50/70"
                  : "border-slate-200 bg-white"
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index <= currentStep ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                {index < currentStep || saved ? <CheckCircle2 className="size-4" /> : index + 1}
              </span>
              <div>
                <p className="text-xs font-semibold sm:text-sm">{step.label}</p>
                <p className="mt-0.5 hidden text-xs text-slate-500 md:block">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <section
        aria-label="Enviar documento para o NAI importa"
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy && !saving) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy || saving) return;
          if (event.dataTransfer.files.length !== 1) {
            setError(
              "Envie um documento por vez para manter cada análise e seus vínculos organizados."
            );
            return;
          }
          void analyze(event.dataTransfer.files[0]);
        }}
        className={cn(
          "rounded-2xl border-2 border-dashed p-5 transition-colors sm:p-7",
          dragging ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"
        )}
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold">
                {file?.name || "Comece por um documento"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Arraste aqui ou selecione um arquivo.
                <br />
                PDF, PNG, JPEG ou WebP · até 12 MB · PDF até 300 páginas
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            aria-label="Arquivo para análise"
            className="hidden"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            disabled={busy || saving || !user}
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (nextFile) void analyze(nextFile);
              event.target.value = "";
            }}
          />
          <Button
            disabled={busy || saving || !user}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 bg-[#102b3b] hover:bg-[#1c4053]"
          >
            <FileUp className="mr-2 size-4" />
            {result || file ? "Selecionar outro documento" : "Selecionar documento"}
          </Button>
        </div>
        {busy && (
          <div className="mt-5 flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <p role="status" aria-live="polite" className="text-sm text-teal-800">
              Identificando o documento e consultando o agente responsável. Aguarde a conclusão da
              análise.
            </p>
            <Button variant="ghost" size="sm" onClick={cancelAnalysis}>
              Interromper leitura
            </Button>
          </div>
        )}
        {!result && !busy && (
          <div className="mt-6 grid gap-3 border-t pt-5 md:grid-cols-3">
            {[
              { name: "Engenheiro de Segurança", types: "PGR e LTCAT", Icon: HardHat },
              {
                name: "Médico do Trabalho",
                types: "PCMSO, ASO e perícias médicas",
                Icon: Stethoscope,
              },
              { name: "Ergonomista", types: "AEP, AET e dados ergonômicos", Icon: UserCheck },
            ].map(({ name, types, Icon }) => (
              <div key={name} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-teal-700" />
                <div>
                  <p className="text-xs font-semibold">{name}</p>
                  <p className="mt-1 text-xs text-slate-500">{types}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0" />
            <p>{error}</p>
          </div>
          {file && !busy && !saving && !saved && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void analyze(file)}>
              <RefreshCw className="mr-2 size-4" /> Tentar analisar novamente
            </Button>
          )}
        </div>
      )}

      {result && document && (
        <>
          <Card className="overflow-hidden border-slate-200">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{NAI_DOCUMENT_NAMES[document.tipo]}</Badge>
                <Badge
                  className={cn(
                    "border-0",
                    agentComplete ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"
                  )}
                >
                  {agentComplete
                    ? "Análise do agente concluída"
                    : result.analiseAgente?.status === "indisponivel"
                      ? "Agente indisponível"
                      : historyRecord && !result.analiseAgente
                        ? "Registro anterior"
                        : "Análise do agente pendente"}
                </Badge>
                {document.acesso === "clinico_restrito" && (
                  <Badge variant="outline" className="gap-1.5 text-violet-800">
                    <LockKeyhole className="size-3" /> Acesso clínico restrito
                  </Badge>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
                  <Bot className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Agente responsável pela análise
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {agent ? PGR_AGENT_NAMES[agent] : "Identificação pendente"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {result.analiseAgente?.resumo || result.parecerTecnicoIA}
                  </p>
                </div>
              </div>
              {document.justificativa && (
                <p className="text-xs leading-5 text-slate-500">{document.justificativa}</p>
              )}
              {document.evidencias.length > 0 && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium">
                    Como o tipo foi identificado
                  </summary>
                  <div className="mt-3 space-y-2">
                    {document.evidencias.map((evidence, index) => (
                      <blockquote key={index} className="border-l-2 border-teal-200 pl-3 leading-5">
                        Página {evidence.pagina}: {evidence.trecho}
                      </blockquote>
                    ))}
                  </div>
                </details>
              )}
              {draft && !saved && integrationBlock && (
                <div role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p>{integrationBlock}</p>
                  {file && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={busy || saving}
                      onClick={() => void analyze(file)}
                    >
                      <RefreshCw className="mr-2 size-4" /> Analisar novamente
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {saved && (
            <section
              aria-label="Resultado da organização"
              className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/70 p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <FolderCheck className="mt-1 size-6 shrink-0 text-teal-700" />
                <div>
                  <h2 className="text-lg font-semibold text-teal-950">
                    {historyRecord
                      ? "Documento do histórico"
                      : saved.alreadySaved
                        ? "Documento já organizado"
                        : "Documento organizado no NAI"}
                  </h2>
                  <p className="mt-1 text-sm text-teal-900">
                    {saved.taskCount}{" "}
                    {saved.taskCount === 1 ? "card vinculado" : "cards vinculados"} ao cliente
                    {typeof saved.checklistCount === "number"
                      ? ` · ${saved.checklistCount} ${saved.checklistCount === 1 ? "item" : "itens"} de checklist`
                      : ""}
                    {typeof saved.providerCount === "number"
                      ? ` · ${saved.providerCount} ${saved.providerCount === 1 ? "prestador vinculado" : "prestadores vinculados"}`
                      : ""}
                    .
                  </p>
                  {saved.alreadySaved && (
                    <p className="mt-2 text-xs text-teal-900">
                      O andamento dos cards existentes foi preservado.
                    </p>
                  )}
                  {saved.restricted && (
                    <p className="mt-2 text-xs leading-5 text-teal-900">
                      Os detalhes clínicos permanecem na área restrita. O quadro operacional recebe
                      apenas os encaminhamentos administrativos.
                    </p>
                  )}
                  <p className="mt-2 break-all text-xs text-teal-800">Protocolo: {saved.cardId}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-teal-800 hover:bg-teal-900">
                  <Link
                    href={`/action-plans?company=${encodeURIComponent(saved.companyId)}&source=pgr`}
                  >
                    <ClipboardList className="mr-2 size-4" /> Acompanhar cards e checklists
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/clients/${encodeURIComponent(saved.companyId)}`}>
                    <Building2 className="mr-2 size-4" /> Abrir cliente
                  </Link>
                </Button>
                {!!saved.providerCount && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/providers">Prestadores</Link>
                  </Button>
                )}
                {document.acesso === "sst" && result.riscosIdentificados.length > 0 && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/risk-management?company=${encodeURIComponent(saved.companyId)}&source=pgr`}
                    >
                      Inventário de riscos
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Cliente identificado",
                value: result.identidade.status === "identificada" ? "1" : "A conferir",
                Icon: Building2,
              },
              { label: "Prestadores extraídos", value: providers.length, Icon: UserCheck },
              {
                label: "Cards propostos",
                value: result.acoesCategorizadas.length,
                Icon: ClipboardList,
              },
              { label: "Itens de checklist", value: checklistCount, Icon: CheckSquare },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">{label}</p>
                  <Icon className="size-4 shrink-0 text-slate-400" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="size-5 text-teal-700" /> Cliente identificado no documento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <h3 className="text-lg font-semibold">
                    {result.pgrCardDetalhado.razaoSocial || "Cliente não identificado"}
                  </h3>
                  <p className="font-mono text-sm text-slate-600">
                    {result.pgrCardDetalhado.cnpj || "CNPJ não identificado"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {result.pgrCardDetalhado.enderecoCompleto || "Endereço não identificado"}
                  </p>
                  {result.identidade.aviso && (
                    <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                      {result.identidade.aviso}
                    </p>
                  )}
                  {result.identidade.evidencias.length > 0 && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer font-medium">
                        Conferir identificação na fonte
                      </summary>
                      <div className="mt-3 space-y-2">
                        {result.identidade.evidencias.map((evidence, index) => (
                          <blockquote key={index} className="border-l-2 pl-3 leading-5">
                            Página {evidence.pagina}: {evidence.trecho}
                          </blockquote>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserCheck className="size-5 text-teal-700" /> Prestadores e responsáveis
                    técnicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {providers.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-500">
                      Nenhum prestador foi identificado com evidência suficiente. A equipe pode
                      completar o vínculo após conferir o documento.
                    </p>
                  ) : (
                    providers.map((provider, index) => {
                      const documented = documentedProviders.includes(provider);
                      return (
                        <div
                          key={provider.id + "_" + index}
                          className="space-y-2 rounded-xl border p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{provider.nome || "Nome a conferir"}</p>
                            <Badge
                              variant="outline"
                              className={documented ? "text-teal-700" : "text-amber-800"}
                            >
                              {documented ? "Candidato ao cadastro" : "Vínculo para revisão"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {provider.papelNoDocumento ||
                              provider.especialidade ||
                              "Papel no documento a conferir"}
                          </p>
                          <p className="text-xs text-slate-600">
                            {[provider.cnpj, provider.registroProfissional, provider.cidadeUf]
                              .filter(Boolean)
                              .join(" · ") || "CNPJ ou registro profissional não identificado"}
                          </p>
                          {provider.evidencias.length > 0 && (
                            <details className="text-xs text-slate-500">
                              <summary className="cursor-pointer">
                                Conferir prestador na fonte
                              </summary>
                              <div className="mt-2 space-y-2">
                                {provider.evidencias.map((evidence, evidenceIndex) => (
                                  <blockquote
                                    key={evidenceIndex}
                                    className="border-l-2 pl-3 leading-5"
                                  >
                                    Página {evidence.pagina}: {evidence.trecho}
                                  </blockquote>
                                ))}
                              </div>
                            </details>
                          )}
                          {!documented && (
                            <p className="text-xs leading-5 text-amber-800">
                              Confira o CNPJ do prestador para completar o cadastro e o vínculo.
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Tabs defaultValue="actions">
                <TabsList className="flex h-auto flex-wrap justify-start gap-1">
                  <TabsTrigger value="actions">Cards e checklists</TabsTrigger>
                  <TabsTrigger value="evidence">Leitura e evidências</TabsTrigger>
                  {saved && agent && <TabsTrigger value="agent">Revisão do agente</TabsTrigger>}
                </TabsList>
                <TabsContent value="actions" className="space-y-4">
                  <p className="text-xs leading-5 text-slate-500">
                    Cada card mantém a origem, o responsável sugerido e os itens necessários para a
                    equipe acompanhar a execução.
                  </p>
                  {result.acoesCategorizadas.length === 0 && (
                    <Card>
                      <CardContent className="p-5 text-sm text-slate-500">
                        Nenhuma ação foi extraída com segurança. Confira a conclusão do agente e a
                        qualidade do arquivo.
                      </CardContent>
                    </Card>
                  )}
                  {result.acoesCategorizadas.map((action, index) => (
                    <Card key={action.id + "_" + index}>
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {action.fundamento === "documento"
                              ? "Consta no documento"
                              : "Sugestão do agente"}
                          </Badge>
                          <Badge variant="secondary">
                            Prioridade {PRIORITY_LABELS[action.prioridade].toLowerCase()}
                          </Badge>
                        </div>
                        <CardTitle className="text-base leading-6">{action.titulo}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p className="leading-6 text-slate-600">{action.descricaoDetalhada}</p>
                        <p className="text-xs font-medium text-teal-800">
                          {PGR_AGENT_NAMES[action.agenteSugerido]}
                          {action.responsavelSugerido ? ` · ${action.responsavelSugerido}` : ""}
                        </p>
                        <ul className="space-y-2">
                          {action.checklist.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex gap-2 text-slate-600">
                              <CheckSquare className="mt-0.5 size-4 shrink-0 text-slate-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        {action.prazoDocumentado && (
                          <p className="text-xs text-slate-500">
                            Prazo no documento: {action.prazoDocumentado}
                          </p>
                        )}
                        {action.evidencia && (
                          <details className="text-xs text-slate-500">
                            <summary className="cursor-pointer">
                              Fonte · página {action.evidencia.pagina}
                            </summary>
                            <p className="mt-2 leading-5">{action.evidencia.trecho}</p>
                          </details>
                        )}
                        {action.referenciaLegal && (
                          <p className="text-xs text-slate-500">
                            Referência extraída para conferência: {action.referenciaLegal}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                <TabsContent value="evidence" className="space-y-4">
                  <Card>
                    <CardContent className="space-y-3 p-5 text-sm">
                      <h3 className="font-semibold">Qualidade da leitura</h3>
                      <p>
                        {result.leitura.paginas} páginas · {result.leitura.paginasComTexto} com
                        texto
                      </p>
                      <Badge variant="outline">
                        {result.leitura.modo === "ia_com_evidencias"
                          ? "IA com evidências"
                          : result.leitura.modo === "extracao_documental"
                            ? "Extração documental"
                            : result.leitura.modo === "leitura_visual_ia"
                              ? "Leitura visual da IA"
                              : "Leitura inconclusiva"}
                      </Badge>
                      {result.leitura.avisos.map((notice, index) => (
                        <p key={index} className="text-xs leading-5 text-slate-500">
                          {notice}
                        </p>
                      ))}
                      <div className="grid gap-2 border-t pt-3 text-xs text-slate-500 sm:grid-cols-2">
                        <p>Emissão: {result.pgrCardDetalhado.dataEmissao || "não identificada"}</p>
                        <p>
                          Validade: {result.pgrCardDetalhado.dataValidade || "não identificada"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  {result.riscosIdentificados.map((risk, index) => (
                    <Card key={risk.id + "_" + index}>
                      <CardContent className="space-y-3 p-5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold">{risk.agente}</h3>
                          <Badge variant="outline">{risk.categoria}</Badge>
                        </div>
                        <p className="text-slate-600">{risk.setorGhe || "Setor/GHE a conferir"}</p>
                        <blockquote className="border-l-2 pl-3 text-xs leading-5 text-slate-500">
                          Página {risk.evidencia.pagina}: {risk.evidencia.trecho}
                        </blockquote>
                        {risk.classificacaoOriginal && (
                          <p className="text-xs">
                            Classificação no original: {risk.classificacaoOriginal}
                          </p>
                        )}
                        {risk.controlesDocumentados.length > 0 && (
                          <p className="text-xs text-slate-500">
                            Controles documentados: {risk.controlesDocumentados.join("; ")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                {saved && agent && (
                  <TabsContent value="agent" className="space-y-3">
                    {(result.documento ? [agent] : PGR_AGENT_ROLES).map((role) => (
                      <PgrAgentReview
                        key={role}
                        companyId={saved.companyId}
                        cardId={saved.cardId}
                        role={role}
                      />
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            </div>

            <aside className="space-y-4">
              {draft && !saved ? (
                <Card className="border-teal-200 lg:sticky lg:top-4">
                  <CardHeader>
                    <CardTitle className="text-base">Conferir e organizar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="nai-company">Vincular ao cliente</Label>
                      <Select
                        disabled={saving}
                        value={selectedCompany}
                        onValueChange={(value) => {
                          setSelectedCompany(value);
                          setConfirmed(false);
                        }}
                      >
                        <SelectTrigger id="nai-company">
                          <SelectValue placeholder="Selecione ou crie o cadastro" />
                        </SelectTrigger>
                        <SelectContent>
                          {draft.companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name} · {company.cnpj || "CNPJ a conferir"}
                            </SelectItem>
                          ))}
                          {draft.canCreateCompany && (
                            <SelectItem value="__create">
                              Criar o cliente identificado no documento
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs leading-5 text-slate-500">
                        Confira a empresa e a unidade para vincular o documento ao cadastro correto.
                      </p>
                    </div>
                    {providers.length > 0 && (
                      <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="nai-include-providers"
                            checked={
                              includeProviders &&
                              !!draft.canRegisterProviders &&
                              documentedProviders.length > 0
                            }
                            disabled={
                              saving ||
                              !draft.canRegisterProviders ||
                              documentedProviders.length === 0
                            }
                            onCheckedChange={(checked) => {
                              setIncludeProviders(checked === true);
                              setConfirmed(false);
                            }}
                          />
                          <Label htmlFor="nai-include-providers" className="text-xs leading-5">
                            Cadastrar ou vincular os prestadores identificados
                          </Label>
                        </div>
                        <p className="text-xs leading-5 text-slate-500">
                          {documentedProviders.length} de {providers.length} com CNPJ disponível
                          para conferência. O vínculo depende da identificação e do papel do
                          prestador no documento; cadastros existentes serão reutilizados.
                        </p>
                        {!draft.canRegisterProviders && (
                          <p className="text-xs leading-5 text-amber-800">
                            O cadastro e o vínculo dos prestadores serão conferidos por um
                            administrador.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="nai-due-date">Prazo da equipe para revisão</Label>
                      <Input
                        id="nai-due-date"
                        type="date"
                        value={dueDate}
                        disabled={saving}
                        onChange={(event) => setDueDate(event.target.value)}
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        Opcional. Os prazos encontrados no documento permanecem nas evidências dos
                        cards.
                      </p>
                    </div>
                    <div className="flex items-start gap-3 border-t pt-4">
                      <Checkbox
                        id="nai-confirmed"
                        checked={confirmed}
                        disabled={saving}
                        onCheckedChange={(checked) => setConfirmed(checked === true)}
                      />
                      <Label htmlFor="nai-confirmed" className="text-xs leading-5">
                        Conferi o cliente, a unidade e os vínculos. Os cards e checklists serão
                        criados como pendentes de revisão da equipe.
                      </Label>
                    </div>
                    <Button
                      className="w-full bg-teal-800 hover:bg-teal-900"
                      onClick={() => void integrate()}
                      disabled={
                        saving || busy || !confirmed || !selectedCompany || !!integrationBlock
                      }
                    >
                      {saving ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      {saving ? "Organizando documento…" : "Organizar no sistema"}
                    </Button>
                    {saving && (
                      <p role="status" className="text-xs leading-5 text-teal-800">
                        Salvando o documento, os vínculos e as ações. Aguarde a confirmação.
                      </p>
                    )}
                    {!saving && (
                      <p className="text-xs leading-5 text-slate-500">
                        A reimportação do mesmo arquivo preserva o andamento dos cards existentes.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <h3 className="text-sm font-semibold">Próximos passos da equipe</h3>
                    <p className="text-xs leading-5 text-slate-500">
                      Distribua os cards, confira os prazos e registre a conclusão de cada checklist
                      com as evidências do atendimento.
                    </p>
                    <Button asChild variant="ghost" size="sm" className="px-0">
                      <Link href="/client-center">
                        Central do cliente <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-5 text-slate-500" /> Documentos já organizados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xl space-y-2">
            <Label htmlFor="nai-history-company">Consultar histórico do cliente</Label>
            <Select
              disabled={busy || saving}
              value={historyCompany}
              onValueChange={setHistoryCompany}
            >
              <SelectTrigger id="nai-history-company">
                <SelectValue placeholder="Selecione um cliente autorizado" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name} · {company.cnpj || "CNPJ a conferir"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {historyBusy && (
            <p role="status" className="text-xs text-slate-500">
              Consultando histórico…
            </p>
          )}
          {historyError && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-rose-700">
              <p>{historyError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryVersion((current) => current + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          {records.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  disabled={busy || saving || !record.analysis}
                  onClick={() => openRecord(record)}
                  className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-70"
                >
                  {record.analysis ? (
                    <FileText className="mt-0.5 size-4 shrink-0 text-teal-700" />
                  ) : (
                    <LockKeyhole className="mt-0.5 size-4 shrink-0 text-violet-700" />
                  )}
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">
                      {record.analysis ? record.fileName : "Documento de saúde ocupacional"}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {record.analysis
                        ? `${NAI_DOCUMENT_NAMES[getNaiDocument(record.analysis).tipo]} · ${record.taskCount || 0} cards`
                        : "Acesso clínico restrito"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {historyCompany && !historyBusy && !historyError && records.length === 0 && (
            <p className="text-xs text-slate-500">
              Nenhum documento deste fluxo foi organizado para o cliente selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
