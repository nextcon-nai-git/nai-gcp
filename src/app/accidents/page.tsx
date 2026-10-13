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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCatInfo } from "@/lib/incidents/cat-status";

export default function AccidentsCAT() {
  const db = useFirestore();
  const { activeClientId, isGlobalStaff } = useSgi();
  const [storedIncident, setSelectedIncident] = React.useState<any>(null);
  const selectedIncident =
    isGlobalStaff && (activeClientId === "all" || storedIncident?.companyId === activeClientId)
      ? storedIncident
      : null;

  const incidentsQuery = useMemoFirebase(() => {
    if (!db || !isGlobalStaff || activeClientId === "unauthorized") return null;
    return activeClientId === "all"
      ? query(collection(db, "incidents"), orderBy("createdAt", "desc"), limit(50))
      : query(
          collection(db, "incidents"),
          where("companyId", "==", activeClientId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
  }, [db, activeClientId, isGlobalStaff]);

  const { data: incidents, isLoading, error: incidentsError } = useCollection(incidentsQuery);
  const filteredIncidents = React.useMemo(() => {
    if (!isGlobalStaff || !incidents || activeClientId === "unauthorized") return [];
    return activeClientId === "all"
      ? incidents
      : incidents.filter((item) => item.companyId === activeClientId);
  }, [incidents, activeClientId, isGlobalStaff]);

  // Métricas regulatórias computadas
  const metrics = React.useMemo(() => {
    let pendingCatCount = 0;
    let criticalCount = 0;
    let openCount = 0;

    for (const inc of filteredIncidents) {
      const info = getCatInfo(inc);
      if (["ABERTO", "PROTOCOLADO", "EM_ANALISE"].includes(inc.status)) openCount++;
      if (info.requiresCat && inc.catStatus !== "EMITIDA") pendingCatCount++;
      if (info.severity === "GRAVE" || info.severity === "FATAL" || info.hasLeave) criticalCount++;
    }

    return { openCount, pendingCatCount, criticalCount };
  }, [filteredIncidents]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none text-left">
            Central de Incidentes & CAT
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <FileWarning className="size-3 text-red-500" /> Relatos registrados e análises
            preliminares de IA para revisão da equipe responsável.
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
                CAT pendente conforme registro
              </p>
              <h3 className="text-2xl font-black text-red-700">
                {metrics.pendingCatCount} Registros pendentes
              </h3>
            </div>
          </div>
          <Badge className="mt-4 bg-red-600 text-white border-none text-[8px] font-black uppercase w-fit">
            Dados sujeitos a conferência
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
              Análises de IA exigem revisão humana. Prazos e consequências clínicas não são
              inferidos do relato.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {!isGlobalStaff ? (
            <p className="p-8 text-sm text-muted-foreground">
              A central de incidentes está disponível à equipe interna autorizada.
            </p>
          ) : incidentsError ? (
            <p role="alert" className="p-8 text-sm text-destructive">
              Não foi possível carregar as ocorrências. Confira o acesso e tente novamente.
            </p>
          ) : isLoading ? (
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
                  <TableHead className="text-center">Situação CAT registrada</TableHead>
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
                          {catInfo.severity || "Não informada"}
                        </Badge>
                      </TableCell>

                      {/* Afastamento */}
                      <TableCell className="text-center">
                        {catInfo.hasLeave ? (
                          <Badge
                            variant="outline"
                            className="text-[8px] font-bold uppercase bg-amber-50 text-amber-800 border-amber-300"
                          >
                            Sim
                            {catInfo.daysOfLeave !== null
                              ? ` (${catInfo.daysOfLeave}d)`
                              : " (duração não informada)"}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {catInfo.hasLeave === false ? "Não" : "Não informado"}
                          </span>
                        )}
                      </TableCell>

                      {/* Situação CAT registrada */}
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
                          {inc.status === "ABERTO"
                            ? "Pendente"
                            : (inc.status || "Não informado").replaceAll("_", " ")}
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
                            "{selectedIncident.description}"
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
                                Data do Registro
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
                              Dados registrados para análise da CAT
                            </h4>
                            <Badge
                              className={
                                catInfo.requiresCat
                                  ? "bg-red-600 text-white font-black text-[8px] uppercase"
                                  : "bg-emerald-600 text-white font-black text-[8px] uppercase"
                              }
                            >
                              {catInfo.requiresCat === null
                                ? "A CONFIRMAR"
                                : catInfo.requiresCat
                                  ? "CAT INDICADA NO REGISTRO"
                                  : "NÃO INDICADA NO REGISTRO"}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3 bg-white rounded-xl border space-y-1">
                              <span className="text-[8px] font-black text-slate-400 uppercase">
                                Prazo registrado (sujeito a validação)
                              </span>
                              <p className="text-xs font-bold text-red-700">
                                {catInfo.deadlineTs
                                  ? new Date(catInfo.deadlineTs).toLocaleString("pt-BR")
                                  : "Prazo a confirmar pela equipe responsável com a data real da ocorrência"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-white rounded-xl border">
                                <span className="text-[8px] font-black text-slate-400 uppercase">
                                  Severidade
                                </span>
                                <p className="text-xs font-black text-primary uppercase">
                                  {catInfo.severity || "Não informada"}
                                </p>
                              </div>
                              <div className="p-3 bg-white rounded-xl border">
                                <span className="text-[8px] font-black text-slate-400 uppercase">
                                  Afastamento
                                </span>
                                <p className="text-xs font-black text-primary uppercase">
                                  {catInfo.hasLeave === null
                                    ? "Não informado"
                                    : catInfo.hasLeave
                                      ? catInfo.daysOfLeave !== null
                                        ? `Sim (${catInfo.daysOfLeave} dias)`
                                        : "Sim; duração não informada"
                                      : "Sem afastamento informado"}
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                              A geração e transmissão de CAT ainda dependem da validação do leiaute
                              vigente, dos dados revisados da ocorrência e da integração de
                              assinatura. Nenhum evento é emitido nesta tela.
                            </p>
                          </div>
                        </Card>

                        {/* Fatos extraídos pelo RAG */}
                        {opinion?.extractedFacts && (
                          <Card className="border-none shadow-sm rounded-3xl p-6 bg-white space-y-3 text-left">
                            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                              <Brain size={14} /> Informações apontadas pela IA — revisar
                            </h4>
                            <div className="space-y-2 text-xs text-slate-600">
                              <p>
                                <strong className="text-slate-900 font-bold">Atividade:</strong>{" "}
                                {opinion.extractedFacts.activity || "Não informada"}
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
                            <ShieldCheck size={16} /> Referências propostas pela IA — revisar
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
                                Resumo SHA-256 registrado para conferência:
                              </span>
                              <span className="text-[8px] font-mono text-accent break-all">
                                {opinion.immutableDigest}
                              </span>
                            </div>
                          )}
                        </Card>

                        <Card className="border-none shadow-sm rounded-3xl p-6 bg-white space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-500" /> Pendências para
                            revisão responsável
                          </h4>
                          <ul className="space-y-2 text-xs text-slate-600">
                            <li className="flex items-start gap-2">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500 shrink-0 mt-0.5"
                              />
                              <span>
                                Confirmar a necessidade de CAT, a data real da ocorrência e o prazo
                                aplicável com a equipe responsável.
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500 shrink-0 mt-0.5"
                              />
                              <span>
                                Conferir os documentos e as informações do profissional emitente,
                                mantendo a identidade e os dados clínicos do documento original.
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
                      Análise preliminar. CAT eSocial sem emissão, assinatura ou transmissão nesta
                      tela.
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
    </div>
  );
}
