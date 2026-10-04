"use client";

import * as React from "react";
import {
  FileWarning,
  Plus,
  Loader2,
  Zap,
  Brain,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Gavel,
  ChevronRight,
  ShieldCheck,
  Clock,
  FileCode,
  Download,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, collectionGroup } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EsocialXmlService } from "@/services/esocial/xml-generator";

interface CatStatusInfo {
  requiresCat: boolean;
  severity: "LEVE" | "GRAVE" | "FATAL";
  hasLeave: boolean;
  daysOfLeave: number;
  label: string;
  badgeClass: string;
  isExpired: boolean;
  isCritical: boolean;
  deadlineTs?: number;
}

function getCatInfo(incident: any): CatStatusInfo {
  const requiresCat =
    incident.requiresCatS2210 ??
    (incident.type?.toLowerCase().includes("acidente") ||
      incident.description?.toLowerCase().includes("lesão") ||
      incident.description?.toLowerCase().includes("lesao") ||
      incident.description?.toLowerCase().includes("fratura") ||
      incident.description?.toLowerCase().includes("queda") ||
      incident.description?.toLowerCase().includes("choque") ||
      incident.description?.toLowerCase().includes("óbito") ||
      incident.description?.toLowerCase().includes("obito"));

  const severity: "LEVE" | "GRAVE" | "FATAL" =
    incident.severity ||
    (incident.description?.toLowerCase().includes("óbito") ||
    incident.description?.toLowerCase().includes("obito") ||
    incident.description?.toLowerCase().includes("morte")
      ? "FATAL"
      : incident.description?.toLowerCase().includes("fratura") ||
          incident.description?.toLowerCase().includes("grave") ||
          incident.hasLeave
        ? "GRAVE"
        : "LEVE");

  const hasLeave =
    incident.hasLeave ??
    (severity === "GRAVE" || incident.description?.toLowerCase().includes("afastamento"));
  const daysOfLeave = incident.daysOfLeave ?? (hasLeave ? 15 : 0);

  if (!requiresCat) {
    return {
      requiresCat: false,
      severity,
      hasLeave: false,
      daysOfLeave: 0,
      label: "Não Requer CAT",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      isExpired: false,
      isCritical: false,
    };
  }

  if (incident.catStatus === "EMITIDA") {
    return {
      requiresCat: true,
      severity,
      hasLeave,
      daysOfLeave,
      label: "CAT S-2210 Emitida",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      isExpired: false,
      isCritical: false,
    };
  }

  // Prazo Legal: até o primeiro dia útil seguinte (Art. 22 Lei 8.213/91) ou imediato se óbito
  const createdDate = incident.createdAt ? new Date(incident.createdAt) : new Date();
  let deadlineTs = incident.catDeadlineTimestamp;
  if (!deadlineTs) {
    const isFatal = severity === "FATAL";
    if (isFatal) {
      deadlineTs = createdDate.getTime() + 4 * 3600 * 1000;
    } else {
      const d = new Date(createdDate);
      const day = d.getDay();
      const daysToAdd = day === 5 ? 3 : day === 6 ? 2 : 1;
      d.setDate(d.getDate() + daysToAdd);
      d.setHours(23, 59, 59, 999);
      deadlineTs = d.getTime();
    }
  }

  const now = Date.now();
  const diffMs = deadlineTs - now;

  if (diffMs <= 0) {
    return {
      requiresCat: true,
      severity,
      hasLeave,
      daysOfLeave,
      label: "EXPIRADO (Risco de Multa)",
      badgeClass: "bg-red-600 text-white font-black animate-pulse border-red-700",
      isExpired: true,
      isCritical: true,
      deadlineTs,
    };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours < 6 || severity === "FATAL") {
    return {
      requiresCat: true,
      severity,
      hasLeave,
      daysOfLeave,
      label: `Resta ${hours}h ${mins}m (Crítico)`,
      badgeClass: "bg-red-100 text-red-700 border-red-300 font-black animate-pulse",
      isExpired: false,
      isCritical: true,
      deadlineTs,
    };
  }

  return {
    requiresCat: true,
    severity,
    hasLeave,
    daysOfLeave,
    label: `Resta ${hours}h ${mins}m`,
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300 font-bold",
    isExpired: false,
    isCritical: false,
    deadlineTs,
  };
}

export default function AccidentsCAT() {
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [selectedIncident, setSelectedIncident] = React.useState<any>(null);
  const [xmlModalOpen, setXmlModalOpen] = React.useState(false);
  const [generatedXml, setGeneratedXml] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  const incidentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (activeClientId === "all") {
      return query(collectionGroup(db, "incidents"), orderBy("createdAt", "desc"), limit(50));
    }
    return query(collection(db, "incidents"), orderBy("createdAt", "desc"), limit(50));
  }, [db, activeClientId]);

  const { data: incidents, isLoading } = useCollection(incidentsQuery);

  const filteredIncidents = React.useMemo(() => {
    if (!incidents) return [];
    if (activeClientId && activeClientId !== "all" && activeClientId !== "unauthorized") {
      return incidents.filter((i) => i.companyId === activeClientId);
    }
    return incidents;
  }, [incidents, activeClientId]);

  // Métricas regulatórias computadas
  const metrics = React.useMemo(() => {
    let pendingCatCount = 0;
    let criticalCount = 0;
    let openCount = 0;

    for (const inc of filteredIncidents) {
      const info = getCatInfo(inc);
      if (inc.status === "ABERTO") openCount++;
      if (info.requiresCat && inc.catStatus !== "EMITIDA") pendingCatCount++;
      if (info.severity === "GRAVE" || info.severity === "FATAL" || info.hasLeave) criticalCount++;
    }

    return { openCount, pendingCatCount, criticalCount };
  }, [filteredIncidents]);

  const handleOpenXml = (inc: any) => {
    try {
      const xml = EsocialXmlService.generateS2210({
        id: `ID100000000000000${Date.now()}`.slice(0, 30),
        cnpjEmpregador: inc.companyId || "12.345.678/0001-90",
        cpfTrabalhador: "000.000.000-00",
        dtAcid: inc.createdAt
          ? new Date(inc.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        tpCat: inc.severity === "FATAL" ? 3 : 1,
        iniciatCAT: 1,
        tpAcid: 1,
        afastamento: inc.hasLeave ?? true,
        durTrat: inc.daysOfLeave || 15,
        medicoNome: "Dra. Mariana Orth & Associados",
        medicoCrm: "145892",
        medicoUf: "SP",
        dscLocal: inc.location || "Área Operacional",
        obsCAT: inc.description || "Acidente de trabalho comunicado formalmente.",
      });
      setGeneratedXml(xml);
      setXmlModalOpen(true);
    } catch (err) {
      console.error("Erro ao gerar XML da CAT S-2210:", err);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadXml = () => {
    const blob = new Blob([generatedXml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `S2210_CAT_${selectedIncident?.id || "evento"}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none text-left">
            Central de Incidentes & CAT
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <FileWarning className="size-3 text-red-500" /> Parecer Técnico de IA, Prazos da Lei
            8.213/91 e eSocial S-2210.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            asChild
            className="bg-red-600 hover:bg-red-700 text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2"
          >
            <Link href="/accidents/report">
              <Plus className="size-4" /> Reportar Ocorrência
            </Link>
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-shadow border-none bg-white rounded-3xl p-6 flex flex-col justify-between">
          <div className="space-y-4 text-left">
            <div className="p-3 bg-red-50 rounded-xl w-fit text-red-600">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Aguardando Triagem</p>
              <h3 className="text-2xl font-black text-primary">{metrics.openCount} Incidentes</h3>
            </div>
          </div>
          <Badge className="mt-4 bg-red-100 text-red-700 border-none text-[8px] font-black uppercase w-fit">
            Ação Requerida
          </Badge>
        </Card>

        <Card className="card-shadow border-none bg-white rounded-3xl p-6 flex flex-col justify-between border-2 border-red-100">
          <div className="space-y-4 text-left">
            <div className="p-3 bg-red-100 rounded-xl w-fit text-red-700">
              <Clock className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-red-600">
                CAT S-2210 Pendente (Prazo Legal)
              </p>
              <h3 className="text-2xl font-black text-red-700">
                {metrics.pendingCatCount} Requerem Envio
              </h3>
            </div>
          </div>
          <Badge className="mt-4 bg-red-600 text-white border-none text-[8px] font-black uppercase w-fit">
            Art. 22 Lei 8.213/91
          </Badge>
        </Card>

        <Card className="bg-[#090e24] text-white border-none rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-1000">
            <ShieldCheck size={120} />
          </div>
          <div className="space-y-4 relative z-10 text-left">
            <div className="p-3 bg-white/10 rounded-xl w-fit text-accent">
              <Zap className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-white/40">
                Gravidade Alta / Afastamento
              </p>
              <h3 className="text-2xl font-black text-white">
                {metrics.criticalCount} Casos Notificados
              </h3>
            </div>
          </div>
          <Badge className="mt-4 bg-white/10 text-accent border-none text-[8px] font-black uppercase w-fit">
            Monitoramento Médico
          </Badge>
        </Card>
      </div>

      {/* Tabela de Incidentes com Severidade e Contagem de Prazo da CAT */}
      <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-black text-primary uppercase text-left">
              Fila Operacional de Ocorrências & Pareceres
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">
              Auditoria neural de evidências e controle de prazo regulatório para emissão de CAT.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-primary">
              <Loader2 className="size-12 animate-spin opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                Sincronizando Sinistros...
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50 text-[9px] uppercase font-black">
                <TableRow>
                  <TableHead className="pl-8">Data / Tipo</TableHead>
                  <TableHead>Local / Unidade</TableHead>
                  <TableHead className="text-center">Severidade</TableHead>
                  <TableHead className="text-center">Afastamento</TableHead>
                  <TableHead className="text-center">Prazo Legal CAT S-2210</TableHead>
                  <TableHead className="text-center">Status Parecer</TableHead>
                  <TableHead className="pr-8 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncidents.map((inc) => {
                  const catInfo = getCatInfo(inc);
                  return (
                    <TableRow
                      key={inc.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedIncident(inc)}
                    >
                      <TableCell className="pl-8 py-5">
                        <p className="font-bold text-xs text-primary">
                          {new Date(inc.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[8px] font-black uppercase border-none bg-slate-100 mt-1 h-5"
                        >
                          {inc.type}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <p className="font-black text-xs text-primary uppercase">{inc.location}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                          ID Unidade: {inc.companyId}
                        </p>
                      </TableCell>

                      {/* Severidade */}
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-[8px] font-black uppercase px-2.5 h-6 border",
                            catInfo.severity === "FATAL"
                              ? "bg-red-700 text-white border-red-800 animate-pulse"
                              : catInfo.severity === "GRAVE"
                                ? "bg-orange-100 text-orange-800 border-orange-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          )}
                        >
                          {catInfo.severity}
                        </Badge>
                      </TableCell>

                      {/* Afastamento */}
                      <TableCell className="text-center">
                        {catInfo.hasLeave ? (
                          <Badge
                            variant="outline"
                            className="text-[8px] font-bold uppercase bg-amber-50 text-amber-800 border-amber-300"
                          >
                            Sim ({catInfo.daysOfLeave}d)
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            Não
                          </span>
                        )}
                      </TableCell>

                      {/* Prazo Legal CAT S-2210 */}
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-bold uppercase px-3 h-6 border",
                            catInfo.badgeClass
                          )}
                        >
                          <Clock className="size-3 mr-1.5 inline-block" />
                          {catInfo.label}
                        </Badge>
                      </TableCell>

                      {/* Status Parecer */}
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-[9px] font-black uppercase px-3 h-6 border-none",
                            inc.status === "ABERTO"
                              ? "bg-red-100 text-red-700"
                              : inc.status === "EM_ANALISE"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {inc.status === "ABERTO" ? "Pendente" : inc.status.replace("_", " ")}
                        </Badge>
                      </TableCell>

                      <TableCell className="pr-8 text-right">
                        <ChevronRight className="size-5 text-slate-300 group-hover:text-primary transition-all inline-block" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!filteredIncidents || filteredIncidents.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-32 text-center opacity-40 font-black uppercase text-xs tracking-[0.4em]"
                    >
                      Aguardando reporte de incidentes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE DETALHES, PARECER TÉCNICO E CAT S-2210 */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedIncident &&
            (() => {
              const catInfo = getCatInfo(selectedIncident);
              const opinion = selectedIncident.technicalOpinion;

              return (
                <div className="flex flex-col h-full max-h-[90vh]">
                  <div className="p-8 bg-[#001F3F] text-white shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <ShieldAlert size={160} className="text-accent" />
                    </div>
                    <div className="relative z-10 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-accent text-primary font-black uppercase text-[8px] h-6 px-3">
                          Dossiê de Incidente & Parecer IA
                        </Badge>
                        <Badge
                          className={cn(
                            "text-[8px] font-black uppercase h-6 px-3 border",
                            catInfo.badgeClass
                          )}
                        >
                          {catInfo.label}
                        </Badge>
                      </div>
                      <DialogTitle className="text-2xl font-black uppercase tracking-tight font-headline">
                        Audit Trail ID: {selectedIncident.id.substring(0, 8)}
                      </DialogTitle>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-8 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
                      {/* Coluna Esquerda: Relato e Impacto Regulatório da CAT */}
                      <div className="space-y-6">
                        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white space-y-4">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <FileWarning size={14} className="text-red-500" /> Relato Original do
                            Incidente
                          </h4>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                            &quot;{selectedIncident.description}&quot;
                          </p>
                          <div className="pt-4 grid grid-cols-2 gap-4 border-t">
                            <div className="space-y-1">
                              <p className="text-[8px] font-black text-slate-400 uppercase">
                                Localização
                              </p>
                              <p className="text-[10px] font-bold text-primary uppercase">
                                {selectedIncident.location}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[8px] font-black text-slate-400 uppercase">
                                Data da Ocorrência
                              </p>
                              <p className="text-[10px] font-bold text-primary">
                                {new Date(selectedIncident.createdAt).toLocaleString("pt-BR")}
                              </p>
                            </div>
                          </div>
                        </Card>

                        {/* Card de Parecer de CAT eSocial S-2210 */}
                        <Card
                          className={cn(
                            "border-none shadow-md rounded-3xl p-6 text-left space-y-4",
                            catInfo.requiresCat
                              ? "bg-red-50/60 border border-red-200"
                              : "bg-emerald-50/60 border border-emerald-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                              <Clock
                                size={16}
                                className={
                                  catInfo.requiresCat ? "text-red-600" : "text-emerald-600"
                                }
                              />
                              Parecer Regulatório eSocial S-2210
                            </h4>
                            <Badge
                              className={
                                catInfo.requiresCat
                                  ? "bg-red-600 text-white font-black text-[8px] uppercase"
                                  : "bg-emerald-600 text-white font-black text-[8px] uppercase"
                              }
                            >
                              {catInfo.requiresCat ? "CAT OBRIGATÓRIA" : "DISPENSADO"}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3 bg-white rounded-xl border space-y-1">
                              <span className="text-[8px] font-black text-slate-400 uppercase">
                                Prazo Legal Improrrogável (Lei 8.213/91 Art. 22)
                              </span>
                              <p className="text-xs font-bold text-red-700">
                                {opinion?.esocialImpact?.deadlineCat ||
                                  (catInfo.severity === "FATAL"
                                    ? "Imediato (em caso de óbito)"
                                    : "Até o primeiro dia útil seguinte ao acidente")}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-white rounded-xl border">
                                <span className="text-[8px] font-black text-slate-400 uppercase">
                                  Severidade
                                </span>
                                <p className="text-xs font-black text-primary uppercase">
                                  {catInfo.severity}
                                </p>
                              </div>
                              <div className="p-3 bg-white rounded-xl border">
                                <span className="text-[8px] font-black text-slate-400 uppercase">
                                  Afastamento
                                </span>
                                <p className="text-xs font-black text-primary uppercase">
                                  {catInfo.hasLeave
                                    ? `Sim (${catInfo.daysOfLeave} dias)`
                                    : "Sem Afastamento"}
                                </p>
                              </div>
                            </div>

                            {catInfo.requiresCat && (
                              <Button
                                onClick={() => handleOpenXml(selectedIncident)}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] rounded-xl h-10 shadow-md gap-2 mt-2"
                              >
                                <FileCode className="size-4" /> Gerar XML S-2210 Oficial (eSocial)
                              </Button>
                            )}
                          </div>
                        </Card>

                        {/* Fatos extraídos pelo RAG */}
                        {opinion?.extractedFacts && (
                          <Card className="border-none shadow-sm rounded-3xl p-6 bg-white space-y-3 text-left">
                            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                              <Brain size={14} /> Fatos Técnicos Extraídos
                            </h4>
                            <div className="space-y-2 text-xs text-slate-600">
                              <p>
                                <strong className="text-slate-900 font-bold">Atividade:</strong>{" "}
                                {opinion.extractedFacts.activity || "Operação padrão"}
                              </p>
                              <p>
                                <strong className="text-slate-900 font-bold">Tipo de Lesão:</strong>{" "}
                                {opinion.extractedFacts.injuryType || "Não especificada"}
                              </p>
                              {opinion.extractedFacts.equipment?.length > 0 && (
                                <p>
                                  <strong className="text-slate-900 font-bold">
                                    Equipamentos:
                                  </strong>{" "}
                                  {opinion.extractedFacts.equipment.join(", ")}
                                </p>
                              )}
                            </div>
                          </Card>
                        )}
                      </div>

                      {/* Coluna Direita: Normas Violadas e Parecer Legal */}
                      <div className="space-y-6 text-left">
                        <Card className="border-none shadow-lg rounded-3xl p-6 bg-[#090e24] text-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Gavel size={64} />
                          </div>
                          <h4 className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2 mb-4">
                            <ShieldCheck size={16} /> Enquadramento em Normas Regulamentadoras
                          </h4>

                          <div className="space-y-4">
                            {opinion?.findings && opinion.findings.length > 0 ? (
                              opinion.findings.map((f: any, i: number) => (
                                <div
                                  key={i}
                                  className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <Badge className="bg-amber-400/20 text-amber-300 border-none font-bold text-[8px] uppercase">
                                      {f.legalBasis?.source || "NR"} - Item{" "}
                                      {f.legalBasis?.section || "Norma"}
                                    </Badge>
                                    <span className="text-[8px] font-mono text-white/50">
                                      {f.severity}
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold leading-relaxed">{f.finding}</p>
                                  {f.recommendedAction && (
                                    <p className="text-[10px] text-white/70 italic border-l-2 border-accent pl-2">
                                      Ação: {f.recommendedAction}
                                    </p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs text-white/70 space-y-1">
                                <p className="font-bold">Investigação Preliminar</p>
                                <p className="text-[10px] text-white/50">
                                  Incidente sob análise normativa e correlação com PGR/PCMSO.
                                </p>
                              </div>
                            )}
                          </div>

                          {opinion?.immutableDigest && (
                            <div className="mt-6 pt-4 border-t border-white/10">
                              <span className="text-[7px] font-mono uppercase text-white/40 block">
                                Hash Imutável SHA-256 (Não-Repúdio):
                              </span>
                              <span className="text-[8px] font-mono text-accent break-all">
                                {opinion.immutableDigest}
                              </span>
                            </div>
                          )}
                        </Card>

                        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-500" /> Ações Imediatas
                            Recomendadas
                          </h4>
                          <ul className="space-y-2 text-xs text-slate-600">
                            <li className="flex items-start gap-2">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500 shrink-0 mt-0.5"
                              />
                              <span>
                                Emitir e assinar digitalmente o evento S-2210 no ambiente de SST
                                antes do prazo limite.
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500 shrink-0 mt-0.5"
                              />
                              <span>
                                Vincular atestado médico com CID-10 e CRM do médico emitente.
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500 shrink-0 mt-0.5"
                              />
                              <span>
                                Revisar matriz de risco do PGR e inventário da NR-01 referente ao
                                local da ocorrência.
                              </span>
                            </li>
                          </ul>
                        </Card>
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="p-8 bg-white border-t shrink-0 flex justify-between items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 italic">
                      &quot;Integração contínua eSocial v_S_01_02_00 (CAT S-2210).&quot;
                    </p>
                    <Button
                      onClick={() => setSelectedIncident(null)}
                      className="bg-primary text-white font-black uppercase text-[10px] rounded-xl h-11 px-8 shadow-xl"
                    >
                      Fechar Dossiê
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* DIALOG DE PREVIEW DO XML OFICIAL S-2210 */}
      <Dialog open={xmlModalOpen} onOpenChange={setXmlModalOpen}>
        <DialogContent className="max-w-3xl rounded-[2rem] border-none shadow-2xl p-6 bg-slate-900 text-white text-left">
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Badge className="bg-red-500 text-white font-black uppercase text-[8px]">
                Schema eSocial Oficial
              </Badge>
              <div className="flex gap-2">
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-slate-200 hover:text-white hover:bg-white/10 h-8 text-[10px] font-black uppercase gap-1"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? "Copiado!" : "Copiar XML"}
                </Button>
                <Button
                  onClick={downloadXml}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-[10px] font-black uppercase gap-1"
                >
                  <Download size={12} /> Baixar .xml
                </Button>
              </div>
            </div>
            <DialogTitle className="text-lg font-black uppercase font-headline tracking-tight text-white">
              XML do Evento S-2210 (Comunicação de Acidente de Trabalho)
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              Conforme manual de orientação do eSocial v_S_01_02_00 com sanitização de campos.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-white/10 font-mono text-[11px] text-emerald-400 max-h-96 overflow-y-auto whitespace-pre">
            {generatedXml}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
