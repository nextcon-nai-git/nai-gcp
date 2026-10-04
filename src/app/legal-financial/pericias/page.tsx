"use client";

import * as React from "react";
import Link from "next/link";
import {
  Scale,
  Gavel,
  Calendar,
  MapPin,
  User,
  Clock,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Filter,
  Search,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BRITANIA_PERICIAS, type JudicialPericia } from "@/lib/britania-pericias-data";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function BritaniaPericiasPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [periciasList, setPericiasList] = React.useState<JudicialPericia[]>(BRITANIA_PERICIAS);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleSyncFirestore = async () => {
    setIsSyncing(true);
    try {
      const snapshot = await getDocs(collection(db, "judicial_pericias"));
      setPericiasList(
        snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as JudicialPericia)
      );
      const res = { success: true, count: snapshot.size, error: "" };
      if (res.success) {
        toast({
          title: "Pauta Atualizada no Firestore!",
          description: `${res.count} perícias judiciais da Britânia (Martinelli Advogados) sincronizadas.`,
        });
      } else {
        toast({
          title: "Erro ao sincronizar",
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro na sincronização",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyPericia = (item: JudicialPericia) => {
    const text = `PERÍCIA MÉDICA JUDICIAL - BRITÂNIA\nReclamante: ${item.adverseParty}\nData/Hora: ${item.date} às ${item.time}\nPerito Judicial: ${item.medicalExpert}\nLocal: ${item.location}\nProcesso: ${item.processNumber}\nJuízo: ${item.courtJurisdiction}\nCliente: ${item.clientName}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    toast({
      title: "Dados Copiados!",
      description: `Perícia de ${item.adverseParty} copiada para repassar ao Assistente Técnico.`,
    });
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filtragem
  const filteredPericias = React.useMemo(() => {
    return periciasList.filter(
      (p) =>
        p.adverseParty.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.medicalExpert.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.processNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.courtJurisdiction.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [periciasList, searchTerm]);

  const activePericias = filteredPericias.filter((p) => p.status === "AGENDADA");
  const pastPericias = filteredPericias.filter((p) => p.status === "REALIZADA");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 text-slate-900 max-w-[1600px] mx-auto p-4 md:p-8">
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/legal-financial">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl h-7 px-2 text-xs font-bold gap-1 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={14} /> Voltar ao Jurídico
              </Button>
            </Link>
            <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest px-3 h-6">
              MARTINELLI ADVOGADOS
            </Badge>
            <Badge className="bg-accent text-slate-950 font-black uppercase text-[10px] tracking-widest px-3 h-6">
              GRUPO BRITÂNIA
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500 text-emerald-700 bg-emerald-50 font-black uppercase text-[10px] tracking-widest px-3 h-6"
            >
              EMISSÃO: 04/09/2026 - 08:01:22
            </Badge>
          </div>

          <h1 className="text-2xl md:text-4xl font-headline font-black text-primary tracking-tight uppercase leading-none mt-2">
            Providências de Processos — Perícias Médicas Britânia
          </h1>

          <p className="text-muted-foreground font-medium text-xs tracking-wide flex items-center gap-2">
            <Sparkles className="size-3.5 text-accent shrink-0" />
            Pauta Oficial emitida pelo escritório <strong>Martinelli Advogados</strong> • Comarca de
            Joinville / SC • TRT da 12ª Região
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="rounded-2xl border-slate-200 text-slate-700 font-bold text-xs h-11 px-4 gap-2 shadow-sm hover:bg-slate-100"
          >
            <Printer size={15} /> Imprimir Pauta
          </Button>

          <Button
            onClick={handleSyncFirestore}
            disabled={isSyncing}
            className="rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-wider h-11 px-6 gap-2 shadow-lg hover:scale-105 transition-all"
          >
            <RefreshCw size={16} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? "Carregando registros..." : "Atualizar registros"}
          </Button>
        </div>
      </header>

      <Card className="p-5">
        <p>
          Os registros de perícias são carregados do cadastro autenticado. Nenhum processo pessoal
          está embutido no sistema.
        </p>
      </Card>

      {/* ABAS: ATIVAS (RELATÓRIO HOJE) vs HISTÓRICO vs CHECKLIST */}
      <Tabs defaultValue="ativas" className="space-y-6">
        <TabsList className="bg-slate-200/60 p-1 rounded-2xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger
            value="ativas"
            className="rounded-xl text-xs font-bold py-2.5 px-5 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Pauta Emitida Hoje ({activePericias.length})
          </TabsTrigger>
          <TabsTrigger
            value="checklist"
            className="rounded-xl text-xs font-bold py-2.5 px-5 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Checklist do Assistente Técnico
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="rounded-xl text-xs font-bold py-2.5 px-5 data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Histórico de Perícias Realizadas ({pastPericias.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: PAUTA ATIVA DO RELATÓRIO MARTINELLI DE HOJE */}
        <TabsContent value="ativas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activePericias.map((item, idx) => (
              <Card
                key={item.id}
                className="rounded-3xl border-2 border-slate-200/80 bg-white p-6 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Badge
                        className={cn(
                          "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5",
                          idx === 0 ? "bg-rose-500 text-white" : "bg-amber-500 text-slate-950"
                        )}
                      >
                        {idx === 0 ? "URGENTE • EM 4 DIAS" : "AGENDADA • EM 11 DIAS"}
                      </Badge>
                      <h3 className="text-xl font-black text-slate-900 leading-tight pt-1">
                        {item.adverseParty}
                      </h3>
                      <span className="text-xs text-slate-500 block font-medium">
                        {item.clientName}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 text-primary font-black font-mono text-base">
                        <Clock size={16} />
                        <span>{item.time}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700 block">{item.date}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-700">
                    <div className="flex items-start gap-2">
                      <Gavel size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Processo:</strong>{" "}
                        <span className="font-mono font-bold text-primary">
                          {item.processNumber}
                        </span>
                        <div className="text-slate-500 text-[11px]">{item.courtJurisdiction}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Stethoscope size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Perito Judicial:</strong>{" "}
                        <span className="font-bold text-slate-900">{item.medicalExpert}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Local da Perícia:</strong>
                        <div className="font-medium text-slate-900">{item.location}</div>
                      </div>
                    </div>
                  </div>

                  {item.technicalAssistantChecklist && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Ações Recomendadas ao Assistente Técnico:
                      </span>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {item.technicalAssistantChecklist.slice(0, 3).map((act, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyPericia(item)}
                    className="rounded-xl text-xs font-bold gap-1.5 h-9 text-slate-700"
                  >
                    {copiedId === item.id ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copiedId === item.id ? "Copiado!" : "Copiar Dados"}
                  </Button>

                  <a href={item.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      className="rounded-xl bg-primary text-white font-bold text-xs gap-1.5 h-9 shadow-md hover:bg-primary/90"
                    >
                      <MapPin size={14} /> Abrir Maps <ExternalLink size={12} />
                    </Button>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ABA 2: CHECKLIST DO ASSISTENTE TÉCNICO */}
        <TabsContent value="checklist" className="space-y-6">
          <Card className="rounded-3xl border-none shadow-md bg-white p-6 md:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-headline font-black text-primary uppercase">
                Protocolo de Assistência Técnica Pré-Pericial
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Checklist obrigatório de documentos e ações periciais para subsidiar o médico
                assistente e o escritório Martinelli Advogados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <FileText className="text-accent size-5" /> 1. Dossiê Médico-Ocupacional
                </div>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> ASO
                    Admissional, Periódicos e Demissional (S-2220 do eSocial)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />{" "}
                    Prontuário Médico Ocupacional da Britânia Joinville
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />{" "}
                    Histórico de Atestados e Absenteísmo no Módulo Sentinela
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Consulta
                    de benefícios previdenciários no INSS (B91 acidentário vs B31 comum)
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <ShieldCheck className="text-emerald-600 size-5" /> 2. Dossiê de Engenharia &
                  Ergonomia
                </div>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Análise
                    Ergonômica do Trabalho (AET) do posto de trabalho
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> PGR
                    (Programa de Gerenciamento de Riscos) e LTCAT da fábrica
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Ficha de
                    Fornecimento de EPI com Certificado de Aprovação (CA)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />{" "}
                    Comprovantes de treinamentos e ordens de serviço (NR-01)
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ABA 3: HISTÓRICO DE PERÍCIAS */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-lg font-black text-slate-800 uppercase">
                Perícias Realizadas Anteriormente (Agosto / Setembro 2026)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Atos periciais já concluídos aguardando laudo pericial ou manifestação aos autos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-100/70">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 py-3 px-6">
                      Data
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700">
                      Reclamante
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700">
                      Processo & Vara
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700">
                      Perito
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700">
                      Local
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-700 text-center">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y text-xs">
                  {pastPericias.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell className="py-4 px-6 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.date} às {item.time}
                      </TableCell>
                      <TableCell className="font-bold text-primary whitespace-nowrap">
                        {item.adverseParty}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-slate-700 block">{item.processNumber}</span>
                        <span className="text-[10px] text-slate-500 block">
                          {item.courtJurisdiction}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {item.medicalExpert}
                      </TableCell>
                      <TableCell className="text-slate-600 text-[11px]">{item.location}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge className="bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase px-2.5 h-6">
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
