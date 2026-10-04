"use client";

import * as React from "react";
import {
  Search,
  Filter,
  Download,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  DollarSign,
  CreditCard,
  MessageSquare,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  Cloud,
  UploadCloud,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUser } from "@/firebase";
import { useAvpQueue } from "@/hooks/use-avp-queue";
import { buildAvpQueueCsv } from "@/lib/avp-queue-export";
import { normalizeNavigationSearch } from "@/lib/navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GRUPO_AVP_ASO_LIST, GrupoAvpAso, AsoStatus, AsoUrgency } from "@/lib/grupo-avp-asos-data";
import { GrupoAvpQueueMap } from "@/components/clients/grupo-avp-queue-map";
import { GrupoAvpSheetSyncModal } from "@/components/clients/grupo-avp-sheet-sync-modal";
import { GrupoAvpRedundancyModal } from "@/components/clients/grupo-avp-redundancy-modal";
import {
  parseClinicAndPhoneCells,
  generateWhatsAppAppointmentMessage,
} from "@/lib/avp-clinic-intelligence";

export function GrupoAvpAsoManager({
  onQueueSummaryChange,
}: {
  onQueueSummaryChange?: (summary: {
    total: number;
    urgentes: number;
    cidades: number;
    concluidos: number;
  }) => void;
} = {}) {
  const { toast } = useToast();
  const { user } = useUser();
  const { asosList, updateAsos } = useAvpQueue(user?.uid ?? null);

  // Modal de Sincronização Google Sheets / Importação
  const [isSyncModalOpen, setIsSyncModalOpen] = React.useState<boolean>(false);
  const [isAutoSyncActive, setIsAutoSyncActive] = React.useState<boolean>(false);
  // Modal do Radar de Contingência (2+ Clínicas por Polo)
  const [isRedundancyModalOpen, setIsRedundancyModalOpen] = React.useState<boolean>(false);

  const reportStorageFailure = () =>
    toast({
      title: "Alteração disponível nesta aba",
      description:
        "O navegador não permitiu salvar a fila localmente. Exporte a planilha antes de fechar a página.",
      variant: "destructive",
    });

  const handleApplyBatchUpdate = (newAsos: GrupoAvpAso[]) => {
    if (!updateAsos(newAsos)) reportStorageFailure();
  };

  const handleResetOriginal = () => {
    if (!updateAsos(GRUPO_AVP_ASO_LIST)) reportStorageFailure();
    setSelectedAso(null);
  };

  const handleUpdateSingleAso = (updated: GrupoAvpAso) => {
    const saved = updateAsos((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAso(updated);
    if (!saved) reportStorageFailure();
    else
      toast({
        title: "ASO atualizado",
        description: "A alteração foi salva na fila deste navegador.",
      });
  };

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [responsibleFilter, setResponsibleFilter] = React.useState<string>("ALL");
  const [urgencyFilter, setUrgencyFilter] = React.useState<string>("ALL");
  const [ufFilter, setUfFilter] = React.useState<string>("ALL");

  // Paginação
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  // Modal de Detalhes
  const [selectedAso, setSelectedAso] = React.useState<GrupoAvpAso | null>(null);

  React.useEffect(() => {
    setSelectedAso(null);
    setCurrentPage(1);
  }, [user?.uid]);

  // Contatos de WhatsApp e Clínicas parseados para o ASO selecionado
  const selectedAsoClinics = React.useMemo(() => {
    if (!selectedAso) return [];
    const defaultMsg = generateWhatsAppAppointmentMessage(selectedAso);
    return parseClinicAndPhoneCells(
      selectedAso.nomeClinica,
      selectedAso.telefoneClinica,
      defaultMsg
    );
  }, [selectedAso]);

  // Lista de UFs disponíveis
  const availableUfs = React.useMemo(() => {
    const ufs = new Set<string>();
    asosList.forEach((item) => {
      if (item.uf) ufs.add(item.uf);
    });
    return Array.from(ufs).sort();
  }, [asosList]);

  // Lista de Responsáveis únicos
  const availableResponsibles = React.useMemo(() => {
    const set = new Set<string>();
    asosList.forEach((item) => {
      if (item.responsavel && item.responsavel !== "NÃO ATRIBUÍDO") {
        set.add(item.responsavel);
      }
    });
    return Array.from(set).sort();
  }, [asosList]);

  // Métricas Consolidadas
  const metrics = React.useMemo(() => {
    const total = asosList.length;
    let agendados = 0;
    let naoIniciados = 0;
    let urgentes = 0;
    let concluidos = 0;
    let emTratamento = 0;
    let cancelados = 0;

    asosList.forEach((item) => {
      if (item.urgencia === "URGENTE") urgentes++;
      if (item.status === "AGENDADO") agendados++;
      else if (item.status === "NÃO INICIADO") naoIniciados++;
      else if (item.status === "EXAME FEITO") concluidos++;
      else if (item.status === "GESTOR CANCELOU" || item.status === "DESISTIU DA VAGA")
        cancelados++;
      else emTratamento++;
    });

    return { total, agendados, naoIniciados, urgentes, concluidos, emTratamento, cancelados };
  }, [asosList]);

  React.useEffect(() => {
    onQueueSummaryChange?.({
      total: metrics.total,
      urgentes: metrics.urgentes,
      concluidos: metrics.concluidos,
      cidades: new Set(asosList.map((item) => item.cidade + "|" + item.uf)).size,
    });
  }, [metrics, asosList, onQueueSummaryChange]);

  // Filtragem
  const filteredList = React.useMemo(() => {
    return asosList.filter((item) => {
      // Busca textual
      if (searchTerm.trim()) {
        const query = normalizeNavigationSearch(searchTerm);
        const matchColab = normalizeNavigationSearch(item.colaborador).includes(query);
        const matchCidade = normalizeNavigationSearch(item.cidade).includes(query);
        const matchClinica = normalizeNavigationSearch(item.nomeClinica).includes(query);
        const matchGestor = item.telefoneGestor.includes(query);
        const matchNum = item.numero.includes(query);
        if (!matchColab && !matchCidade && !matchClinica && !matchGestor && !matchNum) {
          return false;
        }
      }

      // Filtro Status
      if (statusFilter !== "ALL") {
        if (statusFilter === "URGENTES") {
          if (item.urgencia !== "URGENTE") return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // Filtro Responsável
      if (responsibleFilter !== "ALL") {
        if (responsibleFilter === "SEM_RESPONSAVEL") {
          if (item.responsavel && item.responsavel !== "NÃO ATRIBUÍDO") return false;
        } else if (item.responsavel !== responsibleFilter) {
          return false;
        }
      }

      // Filtro Urgência
      if (urgencyFilter !== "ALL") {
        if (item.urgencia !== urgencyFilter) return false;
      }

      // Filtro UF
      if (ufFilter !== "ALL") {
        if (item.uf !== ufFilter) return false;
      }

      return true;
    });
  }, [asosList, searchTerm, statusFilter, responsibleFilter, urgencyFilter, ufFilter]);

  // Itens da Página Atual
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  // Resetar página ao mudar filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, responsibleFilter, urgencyFilter, ufFilter, pageSize]);

  // Copiar Informações para WhatsApp
  const handleCopyAsoDetails = (item: GrupoAvpAso) => {
    const text =
      `*SOLICITAÇÃO DE ASO - GRUPO AVP*\n` +
      `📋 *Nº:* ${item.numero || "S/N"} | *Urgência:* ${item.urgencia}\n` +
      `👤 *Colaborador:* ${item.colaborador}\n` +
      `🏥 *Exame:* ${item.tipoExame}\n` +
      `📍 *Cidade/UF:* ${item.cidade} - ${item.uf}\n` +
      `📅 *Data Pedido:* ${item.dataPedido} (${item.diasParado} dias parado)\n` +
      `📌 *Status Atual:* ${item.status}\n` +
      `👩‍💼 *Responsável NextCon:* ${item.responsavel}\n` +
      (item.dataAgendada ? `🗓️ *Data Agendada:* ${item.dataAgendada}\n` : "") +
      (item.nomeClinica ? `🏢 *Clínica:* ${item.nomeClinica}\n` : "") +
      (item.telefoneClinica ? `📞 *Tel. Clínica:* ${item.telefoneClinica}\n` : "") +
      (item.enderecoClinica ? `🗺️ *Endereço Clínica:* ${item.enderecoClinica}\n` : "") +
      (item.valorAso ? `💰 *Valor ASO:* R$ ${item.valorAso}\n` : "") +
      (item.chavePix
        ? `🔑 *Chave PIX:* ${item.chavePix} (${item.pixRealizado === "SIM" ? "PAGO" : "PENDENTE"})\n`
        : "") +
      (item.oQueFazer ? `📝 *Observação:* ${item.oQueFazer}\n` : "");

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado com Sucesso! 📋",
      description: `Dados de ${item.colaborador} prontos para envio via WhatsApp ou E-mail.`,
    });
  };

  // Exporta somente a seleção atual, com caracteres e fórmulas tratados como texto.
  const handleExportCsv = () => {
    try {
      const blob = new Blob([buildAvpQueueCsv(filteredList)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ASOs_Grupo_AVP_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      toast({
        title: "Planilha preparada",
        description: `${filteredList.length} registros na seleção exportada.`,
      });
    } catch {
      toast({
        title: "Não foi possível exportar",
        description: "Tente novamente neste navegador.",
        variant: "destructive",
      });
    }
  };

  // Cores de Status
  const getStatusBadge = (status: AsoStatus) => {
    switch (status) {
      case "AGENDADO":
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider">
            Agendado
          </Badge>
        );
      case "NÃO INICIADO":
        return (
          <Badge
            variant="outline"
            className="border-amber-400 text-amber-700 bg-amber-50 font-black text-[9px] uppercase tracking-wider"
          >
            Não Iniciado
          </Badge>
        );
      case "EXAME FEITO":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] uppercase tracking-wider">
            Exame Feito
          </Badge>
        );
      case "2 VIA ASO":
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-black text-[9px] uppercase tracking-wider">
            2ª Via ASO
          </Badge>
        );
      case "CADASTRANDO NO SOC":
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider">
            Cadastrando SOC
          </Badge>
        );
      case "REAGENDAMENTO":
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] uppercase tracking-wider">
            Reagendamento
          </Badge>
        );
      case "AG. RETORNO CLINICA":
        return (
          <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white font-black text-[9px] uppercase tracking-wider">
            Ag. Retorno
          </Badge>
        );
      case "ENVIAR COMPROV. PAG":
        return (
          <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider">
            Comprovante PIX
          </Badge>
        );
      case "GESTOR CANCELOU":
      case "DESISTIU DA VAGA":
        return (
          <Badge
            variant="secondary"
            className="bg-slate-200 text-slate-700 font-black text-[9px] uppercase tracking-wider"
          >
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-black text-[9px] uppercase tracking-wider">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "rounded-3xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md",
            statusFilter === "ALL"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Total ASOs</span>
            <FileSpreadsheet size={16} />
          </div>
          <div className="text-2xl font-black font-headline text-slate-900">{metrics.total}</div>
          <span className="text-[10px] text-slate-500 font-medium">102 Municípios</span>
        </Card>

        <Card
          onClick={() => setStatusFilter("AGENDADO")}
          className={cn(
            "rounded-3xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md",
            statusFilter === "AGENDADO"
              ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Agendados</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-black font-headline text-emerald-700">
            {metrics.agendados}
          </div>
          <span className="text-[10px] text-emerald-600/80 font-medium">Data Confirmada</span>
        </Card>

        <Card
          onClick={() => setStatusFilter("NÃO INICIADO")}
          className={cn(
            "rounded-3xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md",
            statusFilter === "NÃO INICIADO"
              ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20"
              : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Não Iniciados</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-black font-headline text-amber-700">
            {metrics.naoIniciados}
          </div>
          <span className="text-[10px] text-amber-600/80 font-medium">Fila Operacional</span>
        </Card>

        <Card
          onClick={() => setStatusFilter("URGENTES")}
          className={cn(
            "rounded-3xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md",
            statusFilter === "URGENTES"
              ? "border-rose-500 bg-rose-50 ring-2 ring-rose-500/20"
              : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Urgentes</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-2xl font-black font-headline text-rose-700">{metrics.urgentes}</div>
          <span className="text-[10px] text-rose-600/80 font-medium">Prioridade Máxima</span>
        </Card>

        <Card
          onClick={() => setStatusFilter("EXAME FEITO")}
          className={cn(
            "rounded-3xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md",
            statusFilter === "EXAME FEITO"
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
              : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Exames Feitos</span>
            <Sparkles size={16} />
          </div>
          <div className="text-2xl font-black font-headline text-blue-700">
            {metrics.concluidos}
          </div>
          <span className="text-[10px] text-blue-600/80 font-medium">Concluídos / SOC</span>
        </Card>

        <Card className="rounded-3xl p-4 border bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Em Tratamento</span>
            <RefreshCw size={16} />
          </div>
          <div className="text-2xl font-black font-headline text-purple-700">
            {metrics.emTratamento}
          </div>
          <span className="text-[10px] text-purple-600/80 font-medium">SOC / 2ª Via / Retorno</span>
        </Card>
      </div>

      {/* RESUMO EXECUTIVO COM MAPA CARTOGRÁFICO DE PINS COLORIDOS POR STATUS */}
      <GrupoAvpQueueMap
        asos={asosList}
        onSelectCityFilter={(cityName) => {
          setSearchTerm(cityName);
          const tableElem = document.getElementById("avp-queue-table-section");
          if (tableElem) {
            tableElem.scrollIntoView({ behavior: "smooth" });
          }
        }}
        selectedCityFilter={searchTerm}
      />

      {/* TOOLBAR: SEARCH & FILTERS */}
      <Card
        id="avp-queue-table-section"
        className="rounded-[2.5rem] border-slate-200 shadow-sm bg-white p-6 space-y-4"
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* SEARCH INPUT */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Buscar por colaborador, cidade, clínica, telefone ou nº..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Limpar
              </button>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setIsSyncModalOpen(true)}
              className="rounded-2xl h-11 px-4 gap-2 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
            >
              <Cloud size={16} /> Importar / Google Drive
            </Button>

            {isAutoSyncActive && (
              <Badge
                onClick={() => setIsSyncModalOpen(true)}
                className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-3 h-11 rounded-2xl cursor-pointer hover:bg-emerald-500/25 flex items-center gap-1.5 transition-all"
                title="Clique para abrir configurações da sincronização"
              >
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Google Drive Conectado
              </Badge>
            )}

            <Button
              onClick={() => setIsRedundancyModalOpen(true)}
              variant="outline"
              className="rounded-2xl h-11 px-4 gap-2 text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-500/10 border-amber-300 hover:bg-amber-500/20"
              title="Auditoria de contingência: garantir mínimo de 2 clínicas por cidade"
            >
              <ShieldAlert size={15} className="text-amber-600" /> Rede & Contingência (2+ Clínicas)
            </Button>

            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="rounded-2xl h-11 px-4 gap-2 text-xs font-black uppercase tracking-wider border-slate-200 hover:bg-slate-50"
            >
              <Download size={15} /> Exportar CSV ({filteredList.length})
            </Button>
          </div>
        </div>

        {/* SELECT FILTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* STATUS */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-slate-50">
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Status ({metrics.total})</SelectItem>
                <SelectItem value="AGENDADO">Agendado ({metrics.agendados})</SelectItem>
                <SelectItem value="NÃO INICIADO">Não Iniciado ({metrics.naoIniciados})</SelectItem>
                <SelectItem value="URGENTES">Urgentes ({metrics.urgentes})</SelectItem>
                <SelectItem value="EXAME FEITO">Exame Feito ({metrics.concluidos})</SelectItem>
                <SelectItem value="2 VIA ASO">2ª Via ASO</SelectItem>
                <SelectItem value="CADASTRANDO NO SOC">Cadastrando SOC</SelectItem>
                <SelectItem value="REAGENDAMENTO">Reagendamento</SelectItem>
                <SelectItem value="AG. RETORNO CLINICA">Ag. Retorno Clínica</SelectItem>
                <SelectItem value="ENVIAR COMPROV. PAG">Enviar Comprov. Pag</SelectItem>
                <SelectItem value="GESTOR CANCELOU">Gestor Cancelou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* RESPONSÁVEL */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Responsável NextCon
            </Label>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-slate-50">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Atendentes</SelectItem>
                {availableResponsibles.map((resp) => (
                  <SelectItem key={resp} value={resp}>
                    {resp}
                  </SelectItem>
                ))}
                <SelectItem value="SEM_RESPONSAVEL">Sem Atendente Atribuído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* UF */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Estado (UF)
            </Label>
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-slate-50">
                <SelectValue placeholder="Todas as UFs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as UFs ({availableUfs.length})</SelectItem>
                {availableUfs.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URGÊNCIA */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Urgência
            </Label>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-slate-50">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Prioridades</SelectItem>
                <SelectItem value="URGENTE">🔴 Urgente ({metrics.urgentes})</SelectItem>
                <SelectItem value="E-MAIL">🟡 E-mail</SelectItem>
                <SelectItem value="NORMAL">🔵 Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* TABLE LISTING */}
      <Card className="rounded-[2.5rem] border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Solicitações Filtradas:
            </span>
            <Badge className="bg-primary text-white font-black text-xs px-2.5 h-6">
              {filteredList.length} de {asosList.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium hidden sm:inline">Exibir:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-20 rounded-xl text-xs bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-4 w-12 text-center">Nº</th>
                <th className="py-3.5 px-4">Colaborador / Tipo</th>
                <th className="py-3.5 px-4">Cidade / UF</th>
                <th className="py-3.5 px-4">Pedido / SLA</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Responsável</th>
                <th className="py-3.5 px-4">Data Agendada</th>
                <th className="py-3.5 px-4">Clínica Credenciada</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    Nenhuma solicitação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedList.map((item) => {
                  const isHighDelay = item.diasParado >= 4 && item.status === "NÃO INICIADO";
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors group cursor-pointer",
                        item.urgencia === "URGENTE" ? "bg-rose-50/20" : ""
                      )}
                      onClick={() => setSelectedAso(item)}
                    >
                      {/* Nº & URGÊNCIA */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-bold text-slate-700 text-xs">
                            {item.numero ? `#${item.numero}` : "-"}
                          </span>
                          {item.urgencia === "URGENTE" && (
                            <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-100 px-1 rounded mt-0.5">
                              URGENTE
                            </span>
                          )}
                          {item.urgencia === "E-MAIL" && (
                            <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-100 px-1 rounded mt-0.5">
                              E-MAIL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* COLABORADOR */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 leading-tight">
                          {item.colaborador}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {item.tipoExame}
                          </span>
                          {item.telefoneGestor && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Gestor: {item.telefoneGestor}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* CIDADE / UF */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                          <MapPin size={13} className="text-primary shrink-0" />
                          <span>{item.cidade}</span>
                        </div>
                        {item.uf && (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-black uppercase px-1.5 h-4 border-slate-300 mt-0.5 text-slate-600"
                          >
                            {item.uf}
                          </Badge>
                        )}
                      </td>

                      {/* PEDIDO / DIAS PARADO */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-medium">{item.dataPedido || "-"}</div>
                        {item.diasParado > 0 && (
                          <div
                            className={cn(
                              "text-[10px] font-black flex items-center gap-1 mt-0.5",
                              isHighDelay ? "text-rose-600" : "text-amber-600"
                            )}
                          >
                            {isHighDelay && <AlertTriangle size={11} />}
                            {item.diasParado} dias parado
                          </div>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>

                      {/* RESPONSÁVEL */}
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "text-xs font-bold",
                            item.responsavel.includes("KELLY")
                              ? "text-primary"
                              : item.responsavel.includes("LETICIA")
                                ? "text-emerald-700"
                                : item.responsavel.includes("FELIPE")
                                  ? "text-blue-700"
                                  : "text-slate-600"
                          )}
                        >
                          {item.responsavel || "Não atribuído"}
                        </span>
                      </td>

                      {/* DATA AGENDADA */}
                      <td className="py-3 px-4">
                        {item.dataAgendada ? (
                          <div className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                            <Calendar size={12} className="text-emerald-600" />
                            {item.dataAgendada}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Aguardando</span>
                        )}
                      </td>

                      {/* CLÍNICA */}
                      <td className="py-3 px-4 max-w-[200px]">
                        {item.nomeClinica ? (
                          <div
                            className="truncate font-semibold text-slate-800"
                            title={item.nomeClinica}
                          >
                            {item.nomeClinica}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">A credenciar</span>
                        )}
                        {item.valorAso && (
                          <span className="text-[10px] font-mono font-bold text-slate-500 block">
                            R$ {item.valorAso}
                          </span>
                        )}
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedAso(item)}
                            title="Ver detalhes completos"
                            className="h-8 w-8 rounded-xl text-slate-600 hover:text-primary hover:bg-slate-100"
                          >
                            <Eye size={15} />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopyAsoDetails(item)}
                            title="Copiar dados para WhatsApp"
                            className="h-8 w-8 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Copy size={15} />
                          </Button>

                          {item.telefoneGestor && (
                            <Button
                              size="icon"
                              variant="ghost"
                              asChild
                              title="Abrir WhatsApp do Gestor"
                              className="h-8 w-8 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                            >
                              <a
                                href={`https://wa.me/55${item.telefoneGestor.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageSquare size={15} />
                              </a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="text-xs text-slate-500 font-medium">
            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> • Mostrando{" "}
            {paginatedList.length} de {filteredList.length} itens
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-xl h-8 px-3 text-xs gap-1"
            >
              <ChevronLeft size={14} /> Anterior
            </Button>

            <span className="text-xs font-bold text-slate-700 px-2">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-xl h-8 px-3 text-xs gap-1"
            >
              Próxima <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>

      {/* MODAL DE DETALHES COMPLETOS DO ASO */}
      <Dialog open={!!selectedAso} onOpenChange={(open) => !open && setSelectedAso(null)}>
        {selectedAso && (
          <DialogContent className="max-w-2xl rounded-[2.5rem] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary text-white font-mono text-xs">
                  {selectedAso.numero ? `SOLICITAÇÃO Nº ${selectedAso.numero}` : selectedAso.id}
                </Badge>
                {selectedAso.urgencia === "URGENTE" && (
                  <Badge className="bg-rose-600 text-white font-black text-xs uppercase">
                    🔴 URGENTE
                  </Badge>
                )}
                {getStatusBadge(selectedAso.status)}
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black font-headline text-primary uppercase mt-2">
                {selectedAso.colaborador}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Exame {selectedAso.tipoExame} • {selectedAso.cidade} / {selectedAso.uf}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4 text-xs">
              {/* ALTERAÇÃO RÁPIDA DE STATUS */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-primary/5 rounded-2xl border border-primary/20">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles size={13} /> Atualizar Status Deste ASO:
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Altera imediatamente no sistema, mapa e cache local
                  </span>
                </div>
                <div className="w-full sm:w-56">
                  <Select
                    value={selectedAso.status}
                    onValueChange={(newStatus: AsoStatus) => {
                      handleUpdateSingleAso({ ...selectedAso, status: newStatus });
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-white border-slate-300">
                      <SelectValue placeholder="Selecione o Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENDADO">Agendado</SelectItem>
                      <SelectItem value="NÃO INICIADO">Não Iniciado</SelectItem>
                      <SelectItem value="EXAME FEITO">Exame Feito</SelectItem>
                      <SelectItem value="2 VIA ASO">2ª Via ASO</SelectItem>
                      <SelectItem value="CADASTRANDO NO SOC">Cadastrando no SOC</SelectItem>
                      <SelectItem value="REAGENDAMENTO">Reagendamento</SelectItem>
                      <SelectItem value="AG. RETORNO CLINICA">Ag. Retorno Clínica</SelectItem>
                      <SelectItem value="ENVIAR COMPROV. PAG">Enviar Comprov. Pag</SelectItem>
                      <SelectItem value="GESTOR CANCELOU">Gestor Cancelou</SelectItem>
                      <SelectItem value="DESISTIU DA VAGA">Desistiu da Vaga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* BLOCO 1: DADOS DA SOLICITAÇÃO & SLA */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-black text-primary uppercase text-[11px] flex items-center gap-1.5">
                  <Clock size={15} className="text-primary" /> Dados do Pedido & Prazos
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Data do Pedido
                    </span>
                    <strong className="text-slate-800 text-xs">
                      {selectedAso.dataPedido || "Não informada"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Dias Parado
                    </span>
                    <strong
                      className={cn(
                        "text-xs font-bold",
                        selectedAso.diasParado >= 4 ? "text-rose-600" : "text-slate-800"
                      )}
                    >
                      {selectedAso.diasParado} dias
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Data Agendada
                    </span>
                    <strong className="text-emerald-700 text-xs font-bold">
                      {selectedAso.dataAgendada || "Pendente de Agendamento"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Responsável NextCon
                    </span>
                    <strong className="text-slate-800 text-xs">{selectedAso.responsavel}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Telefone do Gestor
                    </span>
                    <strong className="text-slate-800 text-xs font-mono">
                      {selectedAso.telefoneGestor || "Não informado"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Tipo Solicitação
                    </span>
                    <strong className="text-slate-800 text-xs">
                      {selectedAso.tipoSolicitacao || "Padrão"}
                    </strong>
                  </div>
                </div>

                {selectedAso.oQueFazer && (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 text-amber-900 mt-2">
                    <span className="text-[10px] font-black uppercase text-amber-700 block">
                      Observação Operacional:
                    </span>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed">
                      {selectedAso.oQueFazer}
                    </p>
                  </div>
                )}
              </div>

              {/* BLOCO 2: CLÍNICA CREDENCIADA & FINANCEIRO */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-black text-primary uppercase text-[11px] flex items-center gap-1.5">
                  <Building2 size={15} className="text-primary" /> Clínica Credenciada & Dados
                  Financeiros
                </h4>

                {selectedAso.nomeClinica ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Nome da Clínica
                        </span>
                        <strong className="text-slate-900 text-xs">
                          {selectedAso.nomeClinica}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          CNPJ da Clínica
                        </span>
                        <strong className="text-slate-800 text-xs font-mono">
                          {selectedAso.cnpjClinica || "Aguardando cadastro"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Telefone Clínica
                        </span>
                        <strong className="text-slate-800 text-xs font-mono">
                          {selectedAso.telefoneClinica || "Não informado"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          E-mail Clínica
                        </span>
                        <strong className="text-slate-800 text-xs">
                          {selectedAso.emailClinica || "Não informado"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Valor Negociado ASO
                        </span>
                        <strong className="text-emerald-700 text-xs font-mono">
                          {selectedAso.valorAso ? `R$ ${selectedAso.valorAso}` : "Sob consulta"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Status PIX
                        </span>
                        <Badge
                          className={
                            selectedAso.pixRealizado === "SIM"
                              ? "bg-emerald-600"
                              : "bg-slate-300 text-slate-700"
                          }
                        >
                          {selectedAso.pixRealizado === "SIM"
                            ? "PIX Realizado"
                            : "Aguardando Pagamento"}
                        </Badge>
                      </div>
                    </div>

                    {selectedAso.chavePix && (
                      <div className="p-2.5 bg-white rounded-xl border flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-black uppercase text-slate-400 block">
                            Chave PIX
                          </span>
                          <strong className="font-mono text-xs text-slate-800">
                            {selectedAso.chavePix}
                          </strong>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedAso.chavePix);
                            toast({ title: "Chave PIX copiada!" });
                          }}
                          className="h-7 text-[10px] gap-1"
                        >
                          <Copy size={12} /> Copiar
                        </Button>
                      </div>
                    )}

                    {selectedAso.enderecoClinica && (
                      <div className="p-3 bg-white rounded-xl border space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">
                          Endereço de Atendimento
                        </span>
                        <p className="text-xs text-slate-700 font-medium">
                          {selectedAso.enderecoClinica}
                        </p>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedAso.enderecoClinica)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 pt-1"
                        >
                          <ExternalLink size={12} /> Ver no Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-white rounded-xl border border-dashed text-center text-slate-500">
                    <p className="font-medium">Nenhuma clínica fixa atribuída ainda.</p>
                    <span className="text-[10px] text-slate-400">
                      A equipe de credenciamento da NextCon selecionará a melhor clínica na cidade
                      de {selectedAso.cidade} ({selectedAso.uf}).
                    </span>
                  </div>
                )}
              </div>

              {/* BOTÕES DE AÇÃO DO MODAL */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleCopyAsoDetails(selectedAso)}
                  className="rounded-xl h-10 gap-1.5 text-xs font-bold"
                >
                  <Copy size={14} /> Copiar Mensagem WhatsApp
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  {/* BOTÕES DE WHATSAPP DAS CLÍNICAS IDENTIFICADAS */}
                  {selectedAsoClinics.map((clinic, idx) =>
                    clinic.whatsappUrl ? (
                      <Button
                        key={idx}
                        asChild
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-10 gap-1.5 text-xs font-bold shadow-md"
                      >
                        <a
                          href={clinic.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Enviar solicitação oficial de ASO para ${clinic.nome}`}
                        >
                          <MessageSquare size={14} /> WhatsApp: {clinic.nome || "Clínica"}
                        </a>
                      </Button>
                    ) : null
                  )}

                  {/* BUSCA DE ALTERNATIVAS NO GOOGLE MAPS SE NÃO TIVER OU QUISER CONTINGÊNCIA */}
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl h-10 gap-1.5 text-xs font-bold border-slate-300 hover:bg-slate-50"
                  >
                    <a
                      href={`https://www.google.com/maps/search/clinica+medicina+do+trabalho+saude+ocupacional+aso+${encodeURIComponent(selectedAso.cidade)}+${encodeURIComponent(selectedAso.uf)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} /> Alternativas em {selectedAso.cidade}
                    </a>
                  </Button>

                  {/* CONTATAR GESTOR */}
                  {selectedAso.telefoneGestor && (
                    <Button
                      asChild
                      className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white h-10 gap-1.5 text-xs font-bold shadow-md"
                    >
                      <a
                        href={`https://wa.me/55${selectedAso.telefoneGestor.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageSquare size={14} /> Contatar Gestor
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* MODAL DE IMPORTAÇÃO AUTOMÁTICA & SINCRONIZAÇÃO GOOGLE DRIVE */}
      <GrupoAvpSheetSyncModal
        open={isSyncModalOpen}
        onOpenChange={setIsSyncModalOpen}
        currentAsos={asosList}
        onApplyUpdate={handleApplyBatchUpdate}
        onResetOriginal={handleResetOriginal}
        onSyncActivityChange={setIsAutoSyncActive}
      />

      {/* MODAL DO RADAR DE CONTINGÊNCIA (2+ CLÍNICAS POR POLO) */}
      <GrupoAvpRedundancyModal
        open={isRedundancyModalOpen}
        onOpenChange={setIsRedundancyModalOpen}
        currentAsos={asosList}
      />
    </div>
  );
}
