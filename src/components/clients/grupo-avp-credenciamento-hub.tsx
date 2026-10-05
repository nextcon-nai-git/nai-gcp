"use client";

import * as React from "react";
import {
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Building2,
  Send,
  Copy,
  ExternalLink,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  RefreshCw,
  Eye,
  Check,
  Globe,
  Share2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  NationalOccupationalClinic,
  OutreachStatus,
  getStoredNationalClinics,
  saveCustomNationalClinic,
  updateClinicOutreachStatus,
  getNationalClinicsStats,
  searchNationalClinics,
  generateOneClickCredenciamentoUrl,
  generateCredenciamentoProposalText,
  formatBrazilianPhoneDisplay,
  OFFICIAL_CREDENCIAMENTO_SENDER,
} from "@/lib/avp-national-clinics-directory";

const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export function GrupoAvpCredenciamentoHub() {
  const { toast } = useToast();

  // Estados de dados
  const [clinics, setClinics] = React.useState<NationalOccupationalClinic[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Estados de filtros
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedUf, setSelectedUf] = React.useState("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<OutreachStatus | "ALL">("ALL");
  const [onlyAvpPolos, setOnlyAvpPolos] = React.useState(false);
  const [onlyUrgent, setOnlyUrgent] = React.useState(false);

  // Modais
  const [previewClinic, setPreviewClinic] = React.useState<NationalOccupationalClinic | null>(null);
  const [customProposalText, setCustomProposalText] = React.useState("");

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [newClinicForm, setNewClinicForm] = React.useState({
    nome: "",
    cidade: "",
    uf: "SP",
    telefone: "",
    whatsapp: "",
    endereco: "",
    email: "",
    especialidades: "ASO, Audiometria, Espirometria, Raio-X OIT",
    horarioFuncionamento: "Segunda a Sexta: 07:30 às 17:30",
    isPoloAvp: true,
    totalAsosPolo: 2,
    observacoes: "",
  });

  const [copiedClinicId, setCopiedClinicId] = React.useState<string | null>(null);

  // Carrega clínicas armazenadas no cache local
  React.useEffect(() => {
    const loaded = getStoredNationalClinics();
    setClinics(loaded);
    setIsLoaded(true);
  }, []);

  // Estatísticas calculadas
  const stats = React.useMemo(() => {
    return getNationalClinicsStats(clinics);
  }, [clinics]);

  // Lista filtrada em tempo real
  const filteredClinics = React.useMemo(() => {
    return searchNationalClinics(clinics, {
      query: searchQuery,
      uf: selectedUf,
      status: selectedStatus,
      onlyAvpPolos,
      onlyUrgent,
    });
  }, [clinics, searchQuery, selectedUf, selectedStatus, onlyAvpPolos, onlyUrgent]);

  // Disparo oficial em 1-clique via WhatsApp
  const handleSendWhatsApp = (clinic: NationalOccupationalClinic, customMsg?: string) => {
    const { waUrl, messageText } = generateOneClickCredenciamentoUrl(clinic, {
      customMessage: customMsg,
    });

    if (!waUrl) {
      toast({
        title: "WhatsApp Inválido",
        description: "Esta clínica ainda não possui número de WhatsApp com DDD cadastrado.",
        variant: "destructive",
      });
      return;
    }

    // Abre a conversa no WhatsApp Web / Desktop / Mobile
    window.open(waUrl, "_blank", "noopener,noreferrer");

    // Copia o texto para garantia do operador
    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText).catch(() => {});
    }

    // Abrir uma conversa não confirma que uma mensagem foi enviada.

    toast({
      title: "WhatsApp Aberto em 1-Clique! 📲",
      description: `Proposta oficial gerada para ${clinic.nome} (${clinic.cidade}/${clinic.uf}). Mensagem copiada para a área de transferência.`,
    });

    if (previewClinic) {
      setPreviewClinic(null);
    }
  };

  // Copia mensagem institucional sem abrir WhatsApp
  const handleCopyMessage = (clinic: NationalOccupationalClinic) => {
    const text = generateCredenciamentoProposalText(clinic);
    navigator.clipboard.writeText(text);
    setCopiedClinicId(clinic.id);
    setTimeout(() => setCopiedClinicId(null), 2500);

    toast({
      title: "Mensagem Copiada! 📋",
      description: `Proposta B2B para ${clinic.nome} pronta para envio por outros canais.`,
    });
  };

  // Abertura do modal de visualização e edição de mensagem
  const handleOpenPreview = (clinic: NationalOccupationalClinic) => {
    setPreviewClinic(clinic);
    setCustomProposalText(generateCredenciamentoProposalText(clinic));
  };

  // Atualização rápida de status da clínica
  const handleStatusUpdate = (clinicId: string, status: OutreachStatus) => {
    const updated = updateClinicOutreachStatus(clinicId, status);
    setClinics(updated);
    toast({
      title: "Status Atualizado",
      description: `O credenciamento da clínica agora está como: ${status.replace("_", " ")}.`,
    });
  };

  // Salvar nova clínica adicionada manualmente
  const handleSaveNewClinic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClinicForm.nome || !newClinicForm.cidade || !newClinicForm.whatsapp) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha Nome da Clínica, Cidade e WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const specs = newClinicForm.especialidades
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const saved = saveCustomNationalClinic({
      nome: newClinicForm.nome,
      cidade: newClinicForm.cidade,
      uf: newClinicForm.uf.toUpperCase(),
      telefone: newClinicForm.telefone || newClinicForm.whatsapp,
      whatsapp: newClinicForm.whatsapp,
      endereco: newClinicForm.endereco || "Endereço comercial informado no credenciamento",
      email:
        newClinicForm.email ||
        `credenciamento.${newClinicForm.cidade.toLowerCase()}@saudeocupacional.com.br`,
      especialidades: specs.length > 0 ? specs : ["ASO", "Audiometria", "Espirometria"],
      horarioFuncionamento: newClinicForm.horarioFuncionamento,
      isPoloAvp: newClinicForm.isPoloAvp,
      totalAsosPolo: Number(newClinicForm.totalAsosPolo) || 1,
      observacoes: newClinicForm.observacoes,
    });

    const refreshed = getStoredNationalClinics();
    setClinics(refreshed);
    setIsAddModalOpen(false);

    // Limpa formulário
    setNewClinicForm({
      nome: "",
      cidade: "",
      uf: "SP",
      telefone: "",
      whatsapp: "",
      endereco: "",
      email: "",
      especialidades: "ASO, Audiometria, Espirometria, Raio-X OIT",
      horarioFuncionamento: "Segunda a Sexta: 07:30 às 17:30",
      isPoloAvp: true,
      totalAsosPolo: 2,
      observacoes: "",
    });

    toast({
      title: "Clínica Cadastrada com Sucesso! 🏥",
      description: `${saved.nome} adicionada ao diretório com botão de 1-clique ativo!`,
    });
  };

  // Busca externa no Google Maps / CNES para cidades não cadastradas
  const handleSearchMapsExternal = (cityQuery: string, ufQuery?: string) => {
    const term = [
      "clinica medicina do trabalho saude ocupacional exames aso",
      cityQuery,
      ufQuery && ufQuery !== "ALL" ? ufQuery : "",
    ]
      .filter(Boolean)
      .join(" ");

    const url = `https://www.google.com/maps/search/${encodeURIComponent(term)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      {/* HEADER & METRICAS NACIONAIS */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-700/60 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase px-2.5 py-0.5 tracking-wider">
                🚀 WhatsApp 1-Clique Ativo
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-700 text-xs">
                Cobertura Nacional 27 UFs
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight text-white flex items-center gap-2.5">
              <Building2 className="text-emerald-400" size={28} />
              Central Nacional de Credenciamento & Expansão de Rede
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Busque prestadores de saúde ocupacional em qualquer cidade do Brasil, filtre contatos
              diretos de WhatsApp e dispare a proposta B2B oficial do Grupo AVP em 1 único clique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 gap-2 transition-all"
            >
              <Plus size={16} /> Cadastrar Nova Clínica (+ WhatsApp)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSearchMapsExternal(searchQuery || "cidades", selectedUf)}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs px-4 py-2.5 rounded-xl gap-2 transition-all"
            >
              <ExternalLink size={15} /> Descobrir no Maps / CNES
            </Button>
          </div>
        </div>

        {/* CARDS DE KPIS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Clínicas
            </span>
            <strong className="text-xl sm:text-2xl font-black text-white">
              {stats.totalClinicas}
            </strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">prestadores no catálogo</span>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
              Com WhatsApp
            </span>
            <strong className="text-xl sm:text-2xl font-black text-emerald-400">
              {stats.totalComWhatsapp}
            </strong>
            <span className="text-[10px] text-emerald-300/80 block mt-0.5">
              prontos para 1-clique
            </span>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
              Polos Grupo AVP
            </span>
            <strong className="text-xl sm:text-2xl font-black text-amber-400">
              {stats.totalPolosAvp}
            </strong>
            <span className="text-[10px] text-amber-300/80 block mt-0.5">com demanda ativa</span>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
              Propostas Enviadas
            </span>
            <strong className="text-xl sm:text-2xl font-black text-blue-400">
              {stats.totalMensagensEnviadas}
            </strong>
            <span className="text-[10px] text-blue-300/80 block mt-0.5">
              disparadas via WhatsApp
            </span>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
              Em Negociação
            </span>
            <strong className="text-xl sm:text-2xl font-black text-purple-400">
              {stats.totalEmNegociacao}
            </strong>
            <span className="text-[10px] text-purple-300/80 block mt-0.5">
              em cotação de tabela
            </span>
          </div>

          <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-3.5 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 block">
              Credenciadas
            </span>
            <strong className="text-xl sm:text-2xl font-black text-teal-400">
              {stats.totalCredenciadas}
            </strong>
            <span className="text-[10px] text-teal-300/80 block mt-0.5">rede ativa no SOC</span>
          </div>
        </div>
      </div>

      {/* FILTROS E PESQUISA EM TEMPO REAL */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* INPUT DE BUSCA */}
            <div className="md:col-span-5 relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <Input
                placeholder="Buscar por Cidade, Estado, Nome da Clínica ou Exame..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* SELETOR DE ESTADO / UF */}
            <div className="md:col-span-3">
              <Select value={selectedUf} onValueChange={setSelectedUf}>
                <SelectTrigger className="rounded-xl h-10 text-xs bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Todos os Estados (27 UFs)" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="ALL">Todas as UFs do Brasil (27)</SelectItem>
                  {BRAZIL_STATES.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      Estado: {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SELETOR DE STATUS */}
            <div className="md:col-span-4">
              <Select
                value={selectedStatus}
                onValueChange={(val) => setSelectedStatus(val as OutreachStatus | "ALL")}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Status de Contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="NAO_CONTATADO">Pendente de Contato (Não enviado)</SelectItem>
                  <SelectItem value="MENSAGEM_ENVIADA">Mensagem Enviada (WhatsApp)</SelectItem>
                  <SelectItem value="EM_NEGOCIACAO">Em Negociação / Tabela</SelectItem>
                  <SelectItem value="CREDENCIADA">Credenciada (Ativa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TOGGLES RAPIDOS */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <Switch
                  checked={onlyAvpPolos}
                  onCheckedChange={setOnlyAvpPolos}
                  className="data-[state=checked]:bg-emerald-600"
                />
                <span>Apenas Polos com Demanda Grupo AVP</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <Switch
                  checked={onlyUrgent}
                  onCheckedChange={setOnlyUrgent}
                  className="data-[state=checked]:bg-amber-600"
                />
                <span>Polos com Volume Crítico (≥ 3 ASOs)</span>
              </label>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Exibindo <strong className="text-slate-900">{filteredClinics.length}</strong> clínicas
              encontradas
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LISTAGEM DE CLÍNICAS */}
      {filteredClinics.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-slate-200 p-8 text-center bg-slate-50/50">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Search size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nenhuma clínica encontrada para este filtro
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Não encontramos prestadores para o termo pesquisado. Você pode descobrir prestadores
                locais no Google Maps e cadastrar o WhatsApp com 1 clique.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => handleSearchMapsExternal(searchQuery || "cidades", selectedUf)}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs gap-2"
              >
                <ExternalLink size={14} /> Buscar no Google Maps
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNewClinicForm((prev) => ({
                    ...prev,
                    cidade: searchQuery || "",
                    uf: selectedUf !== "ALL" ? selectedUf : "SP",
                  }));
                  setIsAddModalOpen(true);
                }}
                className="rounded-xl text-xs gap-2"
              >
                <Plus size={14} /> Cadastrar Clínica para este Polo
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClinics.map((clinic) => {
            const hasWa = clinic.whatsapp && clinic.whatsapp.replace(/\D/g, "").length >= 10;
            const isSent = clinic.statusCredenciamento === "MENSAGEM_ENVIADA";
            const isNegotiating = clinic.statusCredenciamento === "EM_NEGOCIACAO";
            const isCredenciada = clinic.statusCredenciamento === "CREDENCIADA";

            return (
              <Card
                key={clinic.id}
                className={cn(
                  "rounded-2xl border transition-all duration-200 flex flex-col justify-between hover:shadow-md",
                  isCredenciada && "border-emerald-200 bg-emerald-50/20",
                  isSent && "border-blue-200 bg-blue-50/15",
                  isNegotiating && "border-purple-200 bg-purple-50/15",
                  !isSent && !isNegotiating && !isCredenciada && "border-slate-200 bg-white"
                )}
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-slate-900 text-white font-bold text-[10px] px-2 py-0.5">
                          {clinic.cidade} - {clinic.uf}
                        </Badge>
                        {clinic.isPoloAvp && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[9px] px-2 py-0.5">
                            📍 Polo AVP{" "}
                            {clinic.totalAsosPolo ? `(${clinic.totalAsosPolo} ASOs)` : ""}
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug pt-1">
                        {clinic.nome}
                      </h4>
                    </div>

                    {/* STATUS BADGE */}
                    {isCredenciada ? (
                      <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 shrink-0 gap-1">
                        <CheckCircle2 size={10} /> Credenciada
                      </Badge>
                    ) : isNegotiating ? (
                      <Badge className="bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 shrink-0 gap-1">
                        <Clock size={10} /> Em Negociação
                      </Badge>
                    ) : isSent ? (
                      <Badge className="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 shrink-0 gap-1">
                        <Send size={10} /> Enviado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-slate-500 border-slate-300 text-[9px] font-bold px-2 py-0.5 shrink-0"
                      >
                        Não Contatado
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5 line-clamp-1">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span>{clinic.endereco}</span>
                  </p>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
                  {/* ESPECIALIDADES */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {clinic.especialidades.slice(0, 4).map((spec, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200"
                      >
                        {spec}
                      </span>
                    ))}
                    {clinic.especialidades.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 font-medium">
                        +{clinic.especialidades.length - 4}
                      </span>
                    )}
                  </div>

                  {/* CONTATOS */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <MessageSquare size={13} className="text-emerald-600" /> WhatsApp:
                      </span>
                      <strong className="font-bold text-slate-900 font-mono">
                        {formatBrazilianPhoneDisplay(clinic.whatsapp)}
                      </strong>
                    </div>

                    {clinic.telefone && clinic.telefone !== clinic.whatsapp && (
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} /> Fixo/Comercial:
                        </span>
                        <span>{clinic.telefone}</span>
                      </div>
                    )}

                    {clinic.dataEnvioMensagem && (
                      <div className="text-[10px] text-blue-700 pt-1 border-t border-slate-200/60 flex items-center gap-1 font-medium">
                        <Clock size={10} /> Disparado em: {clinic.dataEnvioMensagem}
                      </div>
                    )}
                  </div>

                  {/* BOTOES DE AÇÃO */}
                  <div className="space-y-2 pt-1">
                    {/* BOTAO PRIMARIO 1-CLIQUE */}
                    <Button
                      onClick={() => handleSendWhatsApp(clinic)}
                      disabled={!hasWa}
                      className={cn(
                        "w-full h-10 rounded-xl font-bold text-xs gap-2 shadow-sm transition-all text-white",
                        isSent
                          ? "bg-[#25D366] hover:bg-[#20ba59]"
                          : "bg-[#25D366] hover:bg-[#20ba59]"
                      )}
                    >
                      <Send size={14} />
                      {isSent ? "Reenviar WhatsApp (1-Clique)" : "Enviar WhatsApp (1-Clique)"}
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPreview(clinic)}
                        className="h-8 rounded-xl text-[11px] font-semibold gap-1 text-slate-700 border-slate-300 hover:bg-slate-50"
                      >
                        <Eye size={12} /> Ver / Editar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMessage(clinic)}
                        className="h-8 rounded-xl text-[11px] font-semibold gap-1 text-slate-700 border-slate-300 hover:bg-slate-50"
                      >
                        {copiedClinicId === clinic.id ? (
                          <>
                            <Check size={12} className="text-emerald-600" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copiar Texto
                          </>
                        )}
                      </Button>
                    </div>

                    {/* SELECT RAPIDO DE STATUS */}
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Alterar estágio:</span>
                      <Select
                        value={clinic.statusCredenciamento}
                        onValueChange={(val) =>
                          handleStatusUpdate(clinic.id, val as OutreachStatus)
                        }
                      >
                        <SelectTrigger className="h-6 w-36 text-[10px] rounded-lg border-slate-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NAO_CONTATADO">Não Contatado</SelectItem>
                          <SelectItem value="MENSAGEM_ENVIADA">Mensagem Enviada</SelectItem>
                          <SelectItem value="EM_NEGOCIACAO">Em Negociação</SelectItem>
                          <SelectItem value="CREDENCIADA">Credenciada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE PREVIEW E EDIÇÃO DE MENSAGEM */}
      <Dialog open={!!previewClinic} onOpenChange={(open) => !open && setPreviewClinic(null)}>
        <DialogContent className="max-w-xl rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MessageSquare className="text-emerald-500" size={20} />
              Personalizar Proposta de Credenciamento
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {previewClinic?.nome} ({previewClinic?.cidade}/{previewClinic?.uf})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Texto da Mensagem (WhatsApp B2B)
              </Label>
              <Textarea
                rows={11}
                value={customProposalText}
                onChange={(e) => setCustomProposalText(e.target.value)}
                className="font-mono text-xs rounded-xl border-slate-300 leading-relaxed"
              />
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
              <div>
                <strong>Destinatário:</strong> {previewClinic?.nome}
                <div className="font-mono text-[11px] text-emerald-700 font-bold">
                  WhatsApp: {previewClinic?.whatsapp}
                </div>
              </div>
              <Badge className="bg-[#25D366] text-white font-bold text-[10px]">
                Pronto para envio
              </Badge>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPreviewClinic(null)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => previewClinic && handleSendWhatsApp(previewClinic, customProposalText)}
              className="bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-xl text-xs gap-2"
            >
              <Send size={14} /> Disparar Agora via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CADASTRO RÁPIDO DE NOVA CLÍNICA */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Plus className="text-emerald-500" size={20} />
              Cadastrar Nova Clínica com WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Adicione prestadores de qualquer cidade do Brasil para habilitar o envio em 1-clique.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveNewClinic} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-bold text-slate-700">Nome da Clínica *</Label>
                <Input
                  required
                  placeholder="Ex: Clínica MedTrabalho do Sul"
                  value={newClinicForm.nome}
                  onChange={(e) => setNewClinicForm({ ...newClinicForm, nome: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Cidade *</Label>
                <Input
                  required
                  placeholder="Ex: Caxias do Sul"
                  value={newClinicForm.cidade}
                  onChange={(e) => setNewClinicForm({ ...newClinicForm, cidade: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Estado (UF) *</Label>
                <Select
                  value={newClinicForm.uf}
                  onValueChange={(val) => setNewClinicForm({ ...newClinicForm, uf: val })}
                >
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {BRAZIL_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">WhatsApp (com DDD) *</Label>
                <Input
                  required
                  placeholder="Ex: 54991234567"
                  value={newClinicForm.whatsapp}
                  onChange={(e) => setNewClinicForm({ ...newClinicForm, whatsapp: e.target.value })}
                  className="rounded-xl h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400">Apenas números com DDD nacional.</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Telefone Comercial / Fixo
                </Label>
                <Input
                  placeholder="Ex: (54) 3214-5000"
                  value={newClinicForm.telefone}
                  onChange={(e) => setNewClinicForm({ ...newClinicForm, telefone: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-bold text-slate-700">Endereço Completo</Label>
                <Input
                  placeholder="Ex: Av. Júlio de Castilhos, 1400 - Centro"
                  value={newClinicForm.endereco}
                  onChange={(e) => setNewClinicForm({ ...newClinicForm, endereco: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-bold text-slate-700">Especialidades Atendidas</Label>
                <Input
                  placeholder="Ex: ASO, Audiometria, Espirometria, Raio-X OIT, Toxicológico"
                  value={newClinicForm.especialidades}
                  onChange={(e) =>
                    setNewClinicForm({ ...newClinicForm, especialidades: e.target.value })
                  }
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-2"
              >
                <Check size={14} /> Salvar e Habilitar 1-Clique
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
