"use client";
import { pgrRequestHeaders } from "@/lib/pgr-request-headers";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  FileUp,
  Loader2,
  CheckSquare,
  Bot,
  AlertTriangle,
  FileText,
  Save,
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
import {
  PGR_AGENT_NAMES,
  PGR_AGENT_ROLES,
  PGR_MAX_FILE_BYTES,
  type PgrAnalysisOutput,
  type PgrCompany,
  type PgrDraftView,
} from "@/lib/pgr-schema";

type SavedRecord = {
  id: string;
  companyId: string;
  companyName: string;
  fileName: string;
  analysis: PgrAnalysisOutput;
  taskCount: number;
  riskCount: number;
};
export default function PgrAnalysisPage() {
  const { user } = useUser();
  const { activeClientId, setActiveClientId } = useSgi();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [draft, setDraft] = React.useState<PgrDraftView | null>(null);
  const [saved, setSaved] = React.useState<{ companyId: string; cardId: string } | null>(null);
  const [companies, setCompanies] = React.useState<PgrCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [dueDate, setDueDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [records, setRecords] = React.useState<SavedRecord[]>([]);
  const [historyCompany, setHistoryCompany] = React.useState("");
  const [historyBusy, setHistoryBusy] = React.useState(false);
  const [historyError, setHistoryError] = React.useState("");
  const [historyRecord, setHistoryRecord] = React.useState<SavedRecord | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const serial = React.useRef(0);
  const requestRef = React.useRef<AbortController | null>(null);
  const result = draft?.analysis || historyRecord?.analysis || null;

  React.useEffect(() => {
    const run = ++serial.current;
    requestRef.current?.abort();
    setDraft(null);
    setSaved(null);
    setFile(null);
    setRecords([]);
    setHistoryRecord(null);
    setCompanies([]);
    setSelectedCompany("");
    setConfirmed(false);
    setError("");
    setBusy(false);
    setSaving(false);
    if (user)
      void (async () => {
        try {
          const r = await fetch("/api/pgr/records", {
            headers: await pgrRequestHeaders(user),
            cache: "no-store",
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Não foi possível consultar os clientes.");
          if (run === serial.current) setCompanies(d.companies || []);
        } catch (e) {
          if (run === serial.current)
            setError(e instanceof Error ? e.message : "Consulta indisponível.");
        }
      })();
    return () => {
      serial.current++;
      requestRef.current?.abort();
    };
  }, [user?.uid]);
  React.useEffect(() => {
    if (activeClientId !== "all" && companies.some((c) => c.id === activeClientId))
      setHistoryCompany(activeClientId);
  }, [activeClientId, companies]);
  React.useEffect(() => {
    let cancelled = false;
    setRecords([]);
    setHistoryError("");
    setHistoryBusy(!!historyCompany && !!user);
    if (user && historyCompany)
      void (async () => {
        try {
          const r = await fetch(
            "/api/pgr/records?companyId=" + encodeURIComponent(historyCompany),
            { headers: await pgrRequestHeaders(user), cache: "no-store" }
          );
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Histórico indisponível.");
          if (!cancelled) setRecords(d.records || []);
        } catch (e) {
          if (!cancelled)
            setHistoryError(e instanceof Error ? e.message : "Consulta indisponível.");
        } finally {
          if (!cancelled) setHistoryBusy(false);
        }
      })();
    return () => {
      cancelled = true;
    };
  }, [historyCompany, user?.uid]);

  async function analyze(nextFile: File) {
    if (!user) {
      setError("Entre no NAI para analisar documentos.");
      return;
    }
    if (!nextFile.size || nextFile.size > PGR_MAX_FILE_BYTES) {
      setError("Selecione um arquivo de até 12 MB.");
      return;
    }
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(nextFile.type)) {
      setError("Use PDF, PNG, JPEG ou WebP.");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const run = ++serial.current;
    setBusy(true);
    setFile(nextFile);
    setDraft(null);
    setHistoryRecord(null);
    setSaved(null);
    setError("");
    setConfirmed(false);
    setSelectedCompany("");
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const body = new FormData();
      body.set("file", nextFile);
      const response = await fetch("/api/pgr/analyze", {
        method: "POST",
        headers: await pgrRequestHeaders(user),
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "A análise não foi concluída.");
      if (run !== serial.current) return;
      setDraft(data);
      setCompanies(data.companies);
      setSelectedCompany(data.suggestedCompanyId || "");
      toast({
        title: "Leitura preparada",
        description: "Confira o cliente, as evidências e as ações antes de integrar.",
      });
    } catch (e) {
      if (run === serial.current)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "A leitura foi interrompida. Tente novamente ou divida o documento."
            : e instanceof Error
              ? e.message
              : "Não foi possível ler o PGR."
        );
    } finally {
      clearTimeout(timer);
      if (run === serial.current) setBusy(false);
    }
  }
  async function integrate() {
    if (!user || !draft || !file || !confirmed || !selectedCompany) return;
    const run = serial.current;
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("draftId", draft.draftId);
      body.set("companyId", selectedCompany === "__create" ? "" : selectedCompany);
      body.set("createCompany", String(selectedCompany === "__create"));
      body.set("confirmed", "true");
      body.set("dueDate", dueDate);
      const r = await fetch("/api/pgr/save", {
        method: "POST",
        headers: await pgrRequestHeaders(user),
        body,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível integrar.");
      if (run !== serial.current) return;
      setSaved({ companyId: d.companyId, cardId: d.cardId });
      setDraft((current) => (current ? { ...current, analysis: d.analysis } : current));
      setActiveClientId(d.companyId);
      toast({
        title: d.alreadySaved ? "Este PGR já está integrado" : "PGR integrado ao cliente",
        description:
          String(d.taskCount) +
          " cards e " +
          d.riskCount +
          " riscos disponíveis. Todos aguardam revisão; a reimportação preserva o andamento.",
      });
    } catch (e) {
      if (run === serial.current) setError(e instanceof Error ? e.message : "Falha ao integrar.");
    } finally {
      if (run === serial.current) setSaving(false);
    }
  }
  function openRecord(record: SavedRecord) {
    serial.current++;
    requestRef.current?.abort();
    setDraft(null);
    setFile(null);
    setHistoryRecord(record);
    setSaved({ companyId: record.companyId, cardId: record.id });
    setBusy(false);
    setSaving(false);
    setError("");
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/risk-management">
            <ArrowLeft className="mr-2 size-4" />
            Inventário de riscos
          </Link>
        </Button>
        <div>
          <Badge variant="outline">PGR / LTCAT · Fonte e evidências</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary">
            Do documento ao plano de trabalho
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Identifique o cliente, confira os riscos e organize cards e checklists para a equipe SST
            e os cinco agentes IA.
          </p>
        </div>
      </header>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <FileUp className="size-9 text-primary" />
            <div>
              <p className="font-semibold">{file?.name || "Importar PGR ou LTCAT"}</p>
              <p className="text-xs text-muted-foreground">
                PDF, PNG, JPEG ou WebP · até 12 MB · PDF até 300 páginas
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyze(f);
              e.target.value = "";
            }}
          />
          <Button disabled={busy || saving || !user} onClick={() => inputRef.current?.click()}>
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 size-4" />
            )}
            {busy ? "Lendo páginas e preparando ações…" : "Selecionar documento"}
          </Button>
        </CardContent>
      </Card>
      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle className="size-5 shrink-0" />
          {error}
        </div>
      )}
      <Card>
        <CardContent className="space-y-3 p-5">
          <Label>Consultar PGRs já integrados</Label>
          <Select value={historyCompany} onValueChange={setHistoryCompany}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente autorizado" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.cnpj || "CNPJ a conferir"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {historyBusy && <p className="text-xs">Consultando histórico…</p>}
          {historyError && (
            <p role="alert" className="text-xs text-red-700">
              {historyError}
            </p>
          )}
          {records.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {records.map((r) => (
                <Button key={r.id} size="sm" variant="outline" onClick={() => openRecord(r)}>
                  <FileText className="mr-2 size-4" />
                  {r.fileName} · {r.riskCount || 0} riscos
                </Button>
              ))}
            </div>
          )}
          {historyCompany && !historyBusy && !historyError && records.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum PGR deste fluxo foi integrado ao cliente selecionado.
            </p>
          )}
        </CardContent>
      </Card>
      {result && (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Cliente identificado no documento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {result.pgrCardDetalhado.razaoSocial || "Cliente não identificado"}
                  </h2>
                  <p className="font-mono text-sm">
                    {result.pgrCardDetalhado.cnpj || "CNPJ não identificado"}
                  </p>
                  <p className="mt-2 text-sm">
                    {result.pgrCardDetalhado.enderecoCompleto || "Endereço não identificado"}
                  </p>
                </div>
                <div className="grid gap-3 text-xs sm:grid-cols-3">
                  <p>CNAE: {result.pgrCardDetalhado.cnae || "não identificado"}</p>
                  <p>Grau de risco: {result.pgrCardDetalhado.grauDeRisco ?? "não identificado"}</p>
                  <p>Emissão: {result.pgrCardDetalhado.dataEmissao || "não identificada"}</p>
                </div>
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {result.identidade.aviso}
                </p>
                {result.identidade.evidencias.map((e, i) => (
                  <blockquote key={i} className="border-l-2 pl-3 text-xs text-muted-foreground">
                    p. {e.pagina}: {e.trecho}
                  </blockquote>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado da leitura</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Badge variant="outline">
                  {result.leitura.modo === "ia_com_evidencias"
                    ? "IA com evidências"
                    : result.leitura.modo === "extracao_documental"
                      ? "Extração documental"
                      : result.leitura.modo === "leitura_visual_ia"
                        ? "Leitura visual da IA"
                        : "Leitura inconclusiva"}
                </Badge>
                <p>
                  {result.leitura.paginas} páginas · {result.leitura.paginasComTexto} com texto
                </p>
                <p>
                  {result.riscosIdentificados.length} riscos extraídos ·{" "}
                  {result.acoesCategorizadas.length} cards propostos
                </p>
                {result.leitura.avisos.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {a}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
          {draft && !saved && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Vincular ao cliente e gerar os cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedCompany}
                  onValueChange={(v) => {
                    setSelectedCompany(v);
                    setConfirmed(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cadastro correspondente ao PGR" />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.cnpj || "CNPJ a conferir"}
                      </SelectItem>
                    ))}
                    {draft.canCreateCompany && (
                      <SelectItem value="__create">
                        Criar o cadastro identificado no documento
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="pgr-due-date">Prazo operacional para revisão (opcional)</Label>
                  <Input
                    id="pgr-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    É um prazo da equipe. O cronograma original permanece nas evidências.
                  </p>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
                  <span>
                    Conferi o cliente e a unidade do documento. Os riscos e ações serão salvos como
                    pendentes de revisão.
                  </span>
                </label>
                <Button
                  onClick={integrate}
                  disabled={
                    saving ||
                    !confirmed ||
                    !selectedCompany ||
                    result.identidade.status !== "identificada" ||
                    result.leitura.modo === "inconclusiva"
                  }
                >
                  {saving ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Integrar PGR, riscos e cards
                </Button>
                <p className="text-xs text-muted-foreground">
                  Um CNPJ incompatível bloqueia a gravação. Reimportar o mesmo arquivo preserva os
                  cards existentes.
                </p>
              </CardContent>
            </Card>
          )}
          {saved && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <CheckSquare className="size-5 text-emerald-700" />
              <span>Documento e cards integrados ao cliente.</span>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={
                    "/action-plans?company=" + encodeURIComponent(saved.companyId) + "&source=pgr"
                  }
                >
                  Abrir cards da equipe
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={
                    "/risk-management?company=" +
                    encodeURIComponent(saved.companyId) +
                    "&source=pgr"
                  }
                >
                  Abrir inventário
                </Link>
              </Button>
            </div>
          )}
          <Tabs defaultValue="risks">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="risks">Riscos e evidências</TabsTrigger>
              <TabsTrigger value="actions">Cards e checklists</TabsTrigger>
              <TabsTrigger value="agents">Agentes IA</TabsTrigger>
            </TabsList>
            <TabsContent value="risks">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Riscos documentados para conferência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.riscosIdentificados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Não foram extraídos riscos com evidência suficiente. Isso não comprova
                      ausência de riscos; confira o original e a qualidade da leitura.
                    </p>
                  ) : (
                    result.riscosIdentificados.map((r, i) => (
                      <div key={r.id + "_" + i} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{r.agente}</p>
                          <Badge variant="outline">
                            {r.categoria} · p. {r.evidencia.pagina}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm">{r.setorGhe || "Setor/GHE a conferir"}</p>
                        <blockquote className="mt-3 border-l-2 pl-3 text-xs text-muted-foreground">
                          {r.evidencia.trecho}
                        </blockquote>
                        <p className="mt-2 text-xs">
                          {r.classificacaoOriginal
                            ? "Classificação no original: " + r.classificacaoOriginal
                            : "Classificação técnica pendente."}
                        </p>
                        {r.controlesDocumentados.length > 0 && (
                          <p className="mt-2 text-xs">
                            Controles no documento: {r.controlesDocumentados.join("; ")}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="actions">
              <div className="grid gap-4 md:grid-cols-2">
                {result.acoesCategorizadas.map((a, i) => (
                  <Card key={a.id + "_" + i}>
                    <CardHeader>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {a.fundamento === "documento" ? "Ação documental" : "Sugestão de revisão"}
                        </Badge>
                        <Badge variant="secondary">Prioridade proposta: {a.prioridade}</Badge>
                      </div>
                      <CardTitle className="text-base">{a.titulo}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>{a.descricaoDetalhada}</p>
                      <p className="font-medium">{a.responsavelSugerido}</p>
                      <ul className="space-y-2">
                        {a.checklist.map((c, n) => (
                          <li key={n} className="flex gap-2">
                            <CheckSquare className="mt-0.5 size-4 shrink-0 text-slate-400" />
                            {c}
                          </li>
                        ))}
                      </ul>
                      {a.evidencia && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            Fonte · página {a.evidencia.pagina}
                          </summary>
                          <p className="mt-2">{a.evidencia.trecho}</p>
                        </details>
                      )}
                      <p className="text-xs text-muted-foreground">{a.referenciaLegal}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="agents">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Os agentes recebem a empresa e as evidências deste PGR. Cada resposta é um
                  rascunho para a equipe, sem execução automática de medidas clínicas ou técnicas.
                </p>
                {PGR_AGENT_ROLES.map((role) => (
                  <div key={role}>
                    {saved ? (
                      <PgrAgentReview
                        companyId={saved.companyId}
                        cardId={saved.cardId}
                        role={role}
                      />
                    ) : (
                      <Card>
                        <CardContent className="flex gap-3 p-5">
                          <Bot className="size-5" />
                          <div>
                            <p className="font-semibold">{PGR_AGENT_NAMES[role]}</p>
                            <p className="text-sm text-muted-foreground">
                              Checklist e tarefas preparados. Integre o PGR para solicitar e salvar
                              a revisão deste agente.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">Síntese para revisão técnica</p>
              <p className="text-sm">{result.parecerTecnicoIA}</p>
              <p className="text-xs text-muted-foreground">
                {result.pgrCardDetalhado.esocialS2240Status}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
