"use client";

import * as React from "react";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Cloud,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  Copy,
  ExternalLink,
  Database,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info,
  Layers,
  Link as LinkIcon,
  Play,
  Square,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import {
  formatGoogleSheetsCsvUrl,
  parseSpreadsheetText,
  parseExcelBuffer,
  mergeSpreadsheetData,
  SheetImportResult,
  SheetDiffEntry,
} from "@/lib/avp-sheet-importer";

interface GrupoAvpSheetSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAsos: GrupoAvpAso[];
  onApplyUpdate: (newAsos: GrupoAvpAso[], diffSummary?: string) => void | boolean;
  managedSync?: { status: string; checkedAt: string | null; error: string | null };
  onManagedRefresh?: () => Promise<void>;
  onResetOriginal?: () => void;
  onSyncActivityChange?: (enabled: boolean) => void;
}

const STORAGE_SYNC_KEY = "nai_grupo_avp_sheet_sync_config";
export const DEFAULT_AVP_SHEET_URL = AVP_SOURCE.url;

export function GrupoAvpSheetSyncModal({
  open,
  onOpenChange,
  currentAsos,
  onApplyUpdate,
  onResetOriginal,
  onSyncActivityChange,
  managedSync,
  onManagedRefresh,
}: GrupoAvpSheetSyncModalProps) {
  const { toast } = useToast();
  const auth = useAuth();
  const { user } = useUser();
  const storageKey = `${STORAGE_SYNC_KEY}:${user?.uid || "signed-out"}`;
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const [configOwner, setConfigOwner] = useState<string | null>(null);

  // Estados de Sincronização Google Sheets
  const [sheetUrl, setSheetUrl] = useState<string>(DEFAULT_AVP_SHEET_URL);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(false);
  const [pollInterval, setPollInterval] = useState<number>(600); // segundos
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "CONNECTED" | "ERROR">("IDLE");
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [liveDiffLogs, setLiveDiffLogs] = useState<SheetDiffEntry[]>([]);

  // Estados de Importação Manual (Arquivo ou Colar)
  const [pastedText, setPastedText] = useState<string>("");
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<SheetImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const context = {
    storageKey,
    userId: user?.uid,
    sheetUrl,
    autoSyncEnabled,
    pollInterval,
    currentAsos,
  };
  const latestRef = useRef(context);
  useLayoutEffect(() => {
    latestRef.current = context;
  });
  const importRowsRef = useRef<Record<string, unknown>[] | null>(null);
  const manualGeneration = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      manualGeneration.current++;
    };
  }, []);

  useEffect(() => {
    setIsSyncing(false);
    setSyncStatus("IDLE");
    setSyncErrorMessage(null);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [storageKey, sheetUrl]);

  useEffect(() => {
    onSyncActivityChange?.(
      !!user?.uid && configOwner === storageKey && autoSyncEnabled && !!sheetUrl.trim()
    );
  }, [user?.uid, configOwner, storageKey, autoSyncEnabled, sheetUrl, onSyncActivityChange]);

  // Carrega configuração salva no localStorage
  useEffect(() => {
    setSheetUrl(DEFAULT_AVP_SHEET_URL);
    setAutoSyncEnabled(false);
    setPollInterval(600);
    setImportResult(null);
    setPastedText("");
    setIsProcessingFile(false);
    importRowsRef.current = null;
    manualGeneration.current++;
    try {
      setLastSyncTime(null);
      setSyncErrorMessage(null);
      setLiveDiffLogs([]);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.sheetUrl === "string") setSheetUrl(parsed.sheetUrl);
        else setSheetUrl(DEFAULT_AVP_SHEET_URL);
        if (typeof parsed.autoSyncEnabled === "boolean") setAutoSyncEnabled(parsed.autoSyncEnabled);
        if ([60, 120, 300, 600].includes(parsed.pollInterval)) setPollInterval(parsed.pollInterval);
        if (
          typeof parsed.lastSyncTime === "string" &&
          Number.isFinite(Date.parse(parsed.lastSyncTime))
        )
          setLastSyncTime(new Date(parsed.lastSyncTime));
        setSyncStatus("IDLE");
      } else {
        setSheetUrl(DEFAULT_AVP_SHEET_URL);
        setAutoSyncEnabled(false);
        setSyncStatus("IDLE");
      }
    } catch (e) {
      console.warn("Não foi possível carregar config de sync do localStorage", e);
    } finally {
      setConfigOwner(storageKey);
    }
  }, [storageKey]);

  // Salva configuração no localStorage sempre que houver mudança
  const saveConfig = (
    url: string,
    enabled: boolean,
    interval: number,
    lastSync: Date | null = lastSyncTime
  ) => {
    if (!user?.uid || latestRef.current.storageKey !== storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          sheetUrl: url,
          autoSyncEnabled: enabled,
          pollInterval: interval,
          lastSyncTime: lastSync?.toISOString(),
        })
      );
    } catch (e) {
      console.warn("Erro ao salvar config de sync", e);
    }
  };

  // Ignora respostas de outra conta, outro link ou uma versão antiga da fila.
  const handleFetchGoogleSheet = async (showToast = true) => {
    if (!user?.uid || configOwner !== storageKey || requestRef.current) return;
    const snapshot = latestRef.current;
    const { error: urlError } = formatGoogleSheetsCsvUrl(snapshot.sheetUrl);
    if (urlError) {
      setSyncStatus("ERROR");
      setSyncErrorMessage(urlError);
      if (showToast)
        toast({
          title: "Confira o link da planilha",
          description: urlError,
          variant: "destructive",
        });
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const isCurrent = () =>
      mountedRef.current &&
      requestRef.current === controller &&
      latestRef.current.storageKey === snapshot.storageKey &&
      latestRef.current.sheetUrl === snapshot.sheetUrl;
    const timeout = setTimeout(
      () => controller.abort(new Error("A consulta demorou mais de 30 segundos. Tente novamente.")),
      30_000
    );
    controller.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
    setIsSyncing(true);
    setSyncErrorMessage(null);

    try {
      const account = auth.currentUser;
      if (!account || account.uid !== snapshot.userId)
        throw new Error("Entre novamente para sincronizar.");
      const token = await account.getIdToken();
      if (!isCurrent()) return;
      const requestedRows = latestRef.current.currentAsos;
      const res = await fetch("/api/clients/grupo-avp/sync-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        signal: controller.signal,
        body: JSON.stringify({ sheetUrl: snapshot.sheetUrl.trim(), currentAsos: requestedRows }),
      });
      const data = await res.json();
      if (!isCurrent()) return;
      if (!res.ok || !data.success)
        throw new Error(data.error || "Não foi possível consultar a planilha.");
      const result: SheetImportResult = data.mergeResult;
      if (!result?.success || !Array.isArray(result.mergedAsos))
        throw new Error(result?.errors?.[0] || "A resposta da planilha é inválida.");
      if (latestRef.current.currentAsos !== requestedRows)
        throw new Error(
          "A fila foi alterada durante a consulta. Sincronize novamente para preservar suas alterações."
        );

      const now = new Date();
      setLastSyncTime(now);
      setSyncStatus("CONNECTED");
      const latest = latestRef.current;
      saveConfig(snapshot.sheetUrl, latest.autoSyncEnabled, latest.pollInterval, now);
      if (result.errors.length)
        setSyncErrorMessage("Confira as linhas não importadas: " + result.errors.join(" "));
      if (result.diffLog.length)
        setLiveDiffLogs((prev) => [...result.diffLog, ...prev].slice(0, 50));
      if (result.updatedCount || result.addedCount) {
        onApplyUpdate(
          result.mergedAsos,
          "Google Planilhas: " +
            result.updatedCount +
            " atualizado(s), " +
            result.addedCount +
            " adicionado(s)"
        );
        if (showToast)
          toast({
            title: "Fila atualizada",
            description:
              result.updatedCount + " atualizado(s) e " + result.addedCount + " novo(s).",
          });
      } else if (showToast)
        toast({
          title: "Consulta concluída",
          description: result.totalParsed + " linhas consultadas; nenhuma alteração detectada.",
        });
    } catch (err) {
      if (!isCurrent()) return;
      const message = controller.signal.aborted
        ? "A consulta demorou mais de 30 segundos. Tente novamente."
        : err instanceof SyntaxError
          ? "Não foi possível ler a resposta do servidor. Tente novamente."
          : err instanceof Error
            ? err.message
            : "Não foi possível conectar ao serviço de sincronização.";
      setSyncStatus("ERROR");
      setSyncErrorMessage(message);
      if (showToast)
        toast({
          title: "Sincronização não concluída",
          description: message,
          variant: "destructive",
        });
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (mountedRef.current) setIsSyncing(false);
      }
    }
  };
  const fetchRef = useRef(handleFetchGoogleSheet);
  useLayoutEffect(() => {
    fetchRef.current = handleFetchGoogleSheet;
  });

  // O intervalo não reinicia quando a fila muda; ao voltar à aba, consulta a versão atual.
  useEffect(() => {
    if (
      onManagedRefresh ||
      !user?.uid ||
      configOwner !== storageKey ||
      !autoSyncEnabled ||
      !sheetUrl.trim()
    )
      return;
    const syncVisible = () => {
      if (document.visibilityState !== "hidden") void fetchRef.current(false);
    };
    syncVisible();
    const timer = setInterval(syncVisible, Math.max(60, pollInterval) * 1000);
    document.addEventListener("visibilitychange", syncVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", syncVisible);
    };
  }, [
    user?.uid,
    configOwner,
    storageKey,
    autoSyncEnabled,
    sheetUrl,
    pollInterval,
    onManagedRefresh,
  ]);

  // Upload Manual de Arquivo (.xlsx, .csv, .tsv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      toast({ title: "Arquivo excede 5 MB", variant: "destructive" });
      return;
    }

    const generation = ++manualGeneration.current;
    const owner = storageKey;
    setIsProcessingFile(true);
    setImportResult(null);
    importRowsRef.current = null;

    try {
      const fileName = file.name.toLowerCase();
      let rows: Record<string, any>[] = [];

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xlsm")) {
        const buffer = await file.arrayBuffer();
        rows = await parseExcelBuffer(buffer);
      } else {
        const text = await file.text();
        rows = parseSpreadsheetText(text);
      }

      if (
        !mountedRef.current ||
        latestRef.current.storageKey !== owner ||
        manualGeneration.current !== generation
      )
        return;
      if (rows.length === 0) {
        toast({
          title: "Arquivo Vazio ou Incompatível",
          description: "Não foram encontradas linhas válidas no arquivo.",
          variant: "destructive",
        });
        setIsProcessingFile(false);
        return;
      }

      const result = mergeSpreadsheetData(latestRef.current.currentAsos, rows);
      importRowsRef.current = rows;
      setImportResult(result);

      toast({
        title: "Arquivo Processado!",
        description: `Planilha lida com sucesso: ${result.updatedCount} ASO(s) com mudanças de status/dados e ${result.addedCount} novos detectados. Revise o preview antes de aplicar.`,
      });
    } catch (err: any) {
      if (
        !mountedRef.current ||
        latestRef.current.storageKey !== owner ||
        manualGeneration.current !== generation
      )
        return;
      toast({
        title: "Erro ao Ler Arquivo",
        description: err?.message || "Ocorreu um erro ao processar a planilha.",
        variant: "destructive",
      });
    } finally {
      if (
        mountedRef.current &&
        latestRef.current.storageKey === owner &&
        manualGeneration.current === generation
      )
        setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Processamento de Texto Colado (Ctrl+V)
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      toast({
        title: "Nenhum Texto Informado",
        description: "Cole o conteúdo da planilha copiado do Google Sheets ou Excel.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingFile(true);
    try {
      const rows = parseSpreadsheetText(pastedText);
      if (rows.length === 0) {
        toast({
          title: "Formato Inválido",
          description:
            "Certifique-se de copiar incluindo a linha de cabeçalhos (Nº, Status, Colaborador, etc.).",
          variant: "destructive",
        });
        setIsProcessingFile(false);
        return;
      }

      manualGeneration.current++;
      const result = mergeSpreadsheetData(currentAsos, rows);
      importRowsRef.current = rows;
      setImportResult(result);

      toast({
        title: "Dados Processados!",
        description: `${result.updatedCount} para atualizar e ${result.addedCount} novos encontrados.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro no Processamento",
        description: err?.message || "Erro ao ler texto colado.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Confirmação da aplicação da importação manual
  const handleApplyImport = () => {
    if (!importResult || !importRowsRef.current) return;
    const latestResult = mergeSpreadsheetData(currentAsos, importRowsRef.current);
    if (!latestResult.success) {
      toast({
        title: "Confira a importação",
        description: latestResult.errors[0] || "Nenhuma linha válida encontrada.",
        variant: "destructive",
      });
      return;
    }
    const accepted = onApplyUpdate(
      latestResult.mergedAsos,
      `Importação Manual: ${latestResult.updatedCount} atualizado(s), ${latestResult.addedCount} adicionado(s)`
    );
    if (accepted === false) {
      toast({
        variant: "destructive",
        title: "Alteração não aplicada",
        description:
          "Confira a faixa de sincronização. Para adicionar solicitações, edite a planilha original.",
      });
      return;
    }
    importRowsRef.current = null;

    toast({
      title: "Atualização encaminhada",
      description:
        "As alterações da planilha foram aplicadas com sucesso no sistema e no mapa interativo.",
      className: "bg-emerald-950 border-emerald-500 text-white",
    });

    setImportResult(null);
    setPastedText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-2 border-slate-800 text-slate-100 rounded-3xl p-6 md:p-8 shadow-2xl">
        <DialogHeader className="space-y-2 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 h-6">
              <Cloud size={12} className="mr-1" /> Google Drive & Sheets Sync Hub
            </Badge>
            {autoSyncEnabled && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest px-2.5 h-6 animate-pulse">
                <span className="size-2 rounded-full bg-emerald-400 mr-1.5" /> Auto-Sync Ativo (
                {pollInterval}s)
              </Badge>
            )}
          </div>
          <DialogTitle className="text-2xl font-black font-headline uppercase tracking-tight text-white flex items-center gap-2.5">
            <FileSpreadsheet className="text-emerald-400 size-6" />
            Importação Automática & Sincronização Google Drive
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-medium">
            Atualize a fila do Grupo AVP por consultas periódicas à planilha online do Google Drive
            ou realize upload manual de arquivos Excel e CSV.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="online-drive" className="w-full mt-4 space-y-6">
          <TabsList className="grid grid-cols-2 bg-slate-900 border border-slate-800 p-1 rounded-2xl h-11">
            <TabsTrigger
              value="online-drive"
              className="rounded-xl text-xs font-black uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Cloud size={14} /> Sincronização Online (Google Drive)
            </TabsTrigger>
            <TabsTrigger
              value="manual-import"
              className="rounded-xl text-xs font-black uppercase tracking-wider data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <UploadCloud size={14} /> Importação de Arquivo / Colar
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: SINCRONIZAÇÃO EM TEMPO REAL COM GOOGLE DRIVE */}
          <TabsContent value="online-drive" className="space-y-6 focus-visible:outline-none">
            {managedSync && onManagedRefresh ? (
              <div className="space-y-3 rounded-xl border border-slate-700 p-4 text-sm">
                <h4 className="font-semibold">Planilha de pendencias Grupo AVP</h4>
                <p>
                  A fila e o mapa consultam a fonte a cada 10 minutos. Edite solicitações na
                  planilha Google para manter a base oficial atualizada.
                </p>
                <p>
                  {managedSync.status === "CONNECTED"
                    ? "Última leitura confirmada"
                    : "Conexão pendente"}
                  {managedSync.checkedAt
                    ? `: ${new Date(managedSync.checkedAt).toLocaleString("pt-BR")}`
                    : ""}
                </p>
                {managedSync.error && <p className="text-amber-400">{managedSync.error}</p>}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => void onManagedRefresh()}>
                    Atualizar agora
                  </Button>
                  <Button asChild variant="secondary">
                    <a href={AVP_SOURCE.url} target="_blank" rel="noopener noreferrer">
                      Abrir planilha original
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  As edições feitas no NAI ficam na fila compartilhada. Se a mesma informação mudar
                  na fonte, o sistema sinaliza o conflito.
                </p>
              </div>
            ) : (
              <>
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase text-white tracking-tight">
                        Monitoramento Contínuo da Planilha no Google Drive
                      </h4>
                      <p className="text-xs text-slate-400">
                        Ao ativar a sincronização contínua, o sistema consulta a planilha do Google
                        Drive periodicamente. Assim que qualquer pessoa alterar um status, remarcar
                        um ASO ou adicionar um novo colaborador, o sistema e o mapa atualizam
                        automaticamente sem necessidade de recarregar a página!
                      </p>
                    </div>
                  </div>

                  {/* CAMPO DE URL DO GOOGLE SHEETS */}
                  <div className="space-y-2 pt-2">
                    <Label
                      htmlFor="avp-sheet-url"
                      className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
                    >
                      <LinkIcon size={13} className="text-blue-400" /> Link Compartilhável da
                      Planilha Google (Drive / Sheets):
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit"
                        id="avp-sheet-url"
                        value={sheetUrl}
                        onChange={(e) => {
                          setLastSyncTime(null);
                          setLiveDiffLogs([]);
                          setSheetUrl(e.target.value);
                          saveConfig(e.target.value, autoSyncEnabled, pollInterval, null);
                        }}
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl text-xs font-mono h-11"
                      />
                      <Button
                        onClick={() => handleFetchGoogleSheet(true)}
                        disabled={isSyncing || !sheetUrl.trim()}
                        className="h-11 px-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl gap-2 shadow-lg shadow-blue-500/20 shrink-0"
                      >
                        <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
                        {isSyncing ? "Consultando..." : "Sincronizar Agora"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Info size={12} className="text-slate-400" /> Use um link CSV que já permita
                      leitura pelo servidor. Para planilhas restritas, importe XLSX/CSV pelas
                      permissões existentes.
                    </p>
                  </div>

                  {/* CONTROLES DE AUTO-SYNC */}
                  <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={autoSyncEnabled}
                        onCheckedChange={(checked) => {
                          setAutoSyncEnabled(checked);
                          saveConfig(sheetUrl, checked, pollInterval);
                          toast({
                            title: checked ? "Auto-Sync Ativado!" : "Auto-Sync Desativado",
                            description: checked
                              ? `O sistema irá consultar a planilha a cada ${pollInterval} segundos em segundo plano.`
                              : "A consulta automática em segundo plano foi pausada.",
                          });
                        }}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                      <div>
                        <div className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                          Consulta Automática em Segundo Plano (Auto-Sync)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Consulta enquanto esta página estiver aberta; o padrão é a cada 10 minutos
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-400 font-bold uppercase whitespace-nowrap">
                        Intervalo:
                      </Label>
                      <Select
                        value={String(pollInterval)}
                        onValueChange={(val) => {
                          const num = Number(val);
                          setPollInterval(num);
                          saveConfig(sheetUrl, autoSyncEnabled, num);
                        }}
                      >
                        <SelectTrigger className="w-36 h-9 bg-slate-950 border-slate-800 text-xs rounded-xl text-slate-200">
                          <SelectValue placeholder="Intervalo" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="60">A cada 1 min</SelectItem>
                          <SelectItem value="120">A cada 2 min</SelectItem>
                          <SelectItem value="300">A cada 5 min</SelectItem>
                          <SelectItem value="600">A cada 10 min (Padrão)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* PAINEL DE STATUS DA CONEXÃO */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "size-2.5 rounded-full",
                          syncStatus === "CONNECTED" &&
                            autoSyncEnabled &&
                            "bg-emerald-400 animate-pulse",
                          syncStatus === "CONNECTED" && !autoSyncEnabled && "bg-blue-400",
                          syncStatus === "ERROR" && "bg-rose-500",
                          syncStatus === "IDLE" && "bg-slate-500"
                        )}
                      />
                      <span className="font-bold text-slate-300">
                        {syncStatus === "CONNECTED"
                          ? autoSyncEnabled
                            ? "Conectado e Monitorando Ativamente"
                            : "Conectado (Consulta Manual)"
                          : syncStatus === "ERROR"
                            ? "Erro na Conexão com a Planilha"
                            : "Aguardando Configuração de Link"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                      <Clock size={12} className="text-slate-500" />
                      Última sincronização:{" "}
                      <strong className="text-slate-200">
                        {lastSyncTime ? lastSyncTime.toLocaleTimeString("pt-BR") : "Nunca"}
                      </strong>
                    </div>
                  </div>

                  {/* MENSAGEM DE ERRO SE HOUVER */}
                  {syncErrorMessage && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                      <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Aviso:</span> {syncErrorMessage}
                      </div>
                    </div>
                  )}
                </div>

                {/* AUDITORIA DE ALTERAÇÕES EM TEMPO REAL DETECTADAS */}
                {liveDiffLogs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Layers size={13} className="text-emerald-400" /> Registro de Alterações
                      Detectadas na Planilha Online:
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-xs">
                      {liveDiffLogs.slice(0, 15).map((log, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-950/60 border border-slate-850 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono font-bold text-slate-400 text-[10px]">
                              #{log.numero}
                            </span>
                            <span className="font-bold text-white truncate max-w-[180px]">
                              {log.colaborador}
                            </span>
                            <span className="text-[10px] text-slate-400">({log.cidade})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            <span className="text-slate-400">{log.campo}:</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] line-through text-slate-500 border-slate-700"
                            >
                              {log.valorAnterior}
                            </Badge>
                            <ArrowRight size={10} className="text-emerald-400" />
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                              {log.valorNovo}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ABA 2: IMPORTAÇÃO MANUAL (ARQUIVO EXCEL/CSV OU COLAR CTRL+V) */}
          <TabsContent value="manual-import" className="space-y-6 focus-visible:outline-none">
            {/* ZONA DE DROP / UPLOAD DE ARQUIVO */}
            <div className="p-6 rounded-2xl bg-slate-900/70 border-2 border-dashed border-slate-700 text-center space-y-3 hover:border-emerald-500/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xlsm, .csv, .tsv, .txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload-input"
              />
              <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <UploadCloud size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase text-white tracking-tight">
                  Selecione ou Arraste o Arquivo da Planilha
                </h4>
                <p className="text-xs text-slate-400">
                  Formatos suportados: <strong>Excel (.xlsx)</strong> ou{" "}
                  <strong>CSV / TSV (.csv, .tsv, .txt)</strong>.
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl h-10 px-5 gap-2 shadow-lg shadow-emerald-500/20"
              >
                <FileSpreadsheet size={15} />
                {isProcessingFile ? "Processando..." : "Escolher Arquivo no Computador"}
              </Button>
            </div>

            {/* SEPARADOR: OU COLE O CONTEÚDO */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-950 px-3 text-[10px] font-black uppercase text-slate-500 tracking-widest shrink-0">
                Ou Cole Dados Diretamente
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            {/* TEXTAREA PARA COLAR DADOS DA PLANILHA (CTRL+V) */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileText size={13} className="text-emerald-400" />
                Copie da Planilha e Cole Aqui (Ctrl+V):
              </Label>
              <Textarea
                placeholder={
                  "Nº\tURGÊNCIA\tDATA DO PEDIDO\tCIDADE\tCOLABORADOR\tSTATUS\tRESPONSÁVEL\n47\t\t01/09/2026\tItuiutaba MG\tBRENDA STEPHANIE\tAGENDADO\tKELLY\n..."
                }
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 font-mono text-[11px] rounded-xl h-28"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleProcessPastedText}
                  disabled={isProcessingFile || !pastedText.trim()}
                  variant="outline"
                  className="h-9 px-4 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl gap-2"
                >
                  <Sparkles size={13} className="text-emerald-400" /> Processar Texto Colado
                </Button>
              </div>
            </div>

            {/* PREVIEW DO RESULTADO DO MERGE MANUAL */}
            {importResult && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Resumo das Alterações Detectadas na Planilha:
                    </h4>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                    {importResult.totalParsed} Linhas Lidas
                  </Badge>
                </div>

                {/* KPI METRICS DESTAQUES */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black font-mono text-emerald-400">
                      {importResult.updatedCount}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                      ASOs Atualizados
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black font-mono text-blue-400">
                      {importResult.addedCount}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                      Novos ASOs
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black font-mono text-slate-400">
                      {importResult.unchangedCount}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">
                      Sem Alterações
                    </div>
                  </div>
                </div>

                {/* LISTA DE DIFFS */}
                {importResult.diffLog.length > 0 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto p-1">
                    {importResult.diffLog.map((diff, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono font-bold text-slate-400 text-[10px]">
                            #{diff.numero}
                          </span>
                          <span className="font-bold text-white truncate max-w-[150px]">
                            {diff.colaborador}
                          </span>
                          <span className="text-[10px] text-slate-500">({diff.cidade})</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] shrink-0">
                          <span className="text-slate-400">{diff.campo}:</span>
                          <span className="line-through text-slate-500 text-[10px]">
                            {diff.valorAnterior}
                          </span>
                          <ArrowRight size={10} className="text-emerald-400" />
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            {diff.valorNovo}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* BOTÃO DE CONFIRMAÇÃO */}
                <Button
                  onClick={handleApplyImport}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Check size={16} /> Aplicar Alterações na Fila do Sistema (
                  {importResult.updatedCount + importResult.addedCount})
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* RODAPÉ DO MODAL COM OPÇÃO DE RESTAURAÇÃO */}
        <DialogFooter className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Validação e proteção contra sobrescrita indevida ativa.</span>
          </div>

          <div className="flex items-center gap-2">
            {onResetOriginal && (
              <Button
                variant="ghost"
                onClick={() => {
                  onResetOriginal();
                  toast({
                    title: "Fila Restaurada",
                    description:
                      "A lista de ASOs foi restaurada para a versão original de 223 itens.",
                  });
                }}
                className="text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl"
              >
                Restaurar Lista Padrão (223 ASOs)
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-bold"
            >
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
