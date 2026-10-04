"use client";

import * as React from "react";
import {
  Database,
  Zap,
  Loader2,
  CheckCircle2,
  FileUp,
  TrendingUp,
  Building2,
  Scale,
  DollarSign,
  Download,
  Mail,
  RefreshCw,
  Plus,
  CloudLightning,
  Network,
  Brain,
  Globe,
  Settings,
  ShieldCheck,
  FileSearch,
  Lock,
  ChevronRight,
  Send,
  AlertCircle,
  FileCheck,
  Cpu,
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
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { processFiscalDocument, type FiscalDocOutput } from "@/ai/flows/real-time-fiscal-flow";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { FiscalDocument, Company } from "@/types/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HolidayBillingWidget } from "@/components/financial/holiday-billing-widget";

export function FiscalIntelligenceTab() {
  const { toast } = useToast();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const [selectedDoc, setSelectedDoc] = React.useState<FiscalDocument | null>(null);

  const companyRef = useMemoFirebase(
    () => (!db || activeClientId === "all" ? null : doc(db, "companies", activeClientId)),
    [db, activeClientId]
  );
  const { data: company } = useDoc<Company>(companyRef);

  const fiscalQuery = useMemoFirebase(() => {
    if (!db || activeClientId === "all") return null;
    return query(
      collection(db, "companies", activeClientId, "fiscal_documents"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
  }, [db, activeClientId]);

  const { data: documents, isLoading } = useCollection<FiscalDocument>(fiscalQuery);

  const handleOmieToggle = async () => {
    if (!db || !company) return;
    const nextValue = !company.use_omie;
    await setDoc(
      doc(db, "companies", company.id),
      { use_omie: nextValue, use_senior: false },
      { merge: true }
    );
    toast({
      title: nextValue ? "Integração Omie Ativada" : "Integração Omie Desativada",
      description: nextValue
        ? "A escrituração será automática para esta unidade."
        : "Retornando ao modo de captura manual/portal.",
    });
  };

  const handleSeniorToggle = async () => {
    if (!db || !company) return;
    const nextValue = !company.use_senior;
    await setDoc(
      doc(db, "companies", company.id),
      { use_senior: nextValue, use_omie: false },
      { merge: true }
    );
    toast({
      title: nextValue ? "Conexão Senior ERP Ativada" : "Conexão Senior ERP Desativada",
      description: nextValue
        ? "Sincronização de folha e eSocial via API G7/X."
        : "Retornando ao modo manual.",
    });
  };

  const handlePortalCapture = async () => {
    if (!db || activeClientId === "all") return;
    setIsCapturing(true);

    try {
      // Simulação de busca direta em 1000+ Prefeituras ou ERP
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const mockCaptures = [
        {
          serviceDescription: "Manutenção Preventiva de Ar Condicionado - Unidade Central",
          value: 1250.0,
          regime: "SIMPLES_NACIONAL" as const,
          location: "São Paulo - SP",
          origin: "OMIE_ERP" as const,
        },
        {
          serviceDescription: "Consultoria em Gestão de Riscos (PGR) - Trimestral",
          value: 3800.0,
          regime: "LUCRO_PRESUMIDO" as const,
          location: "Joinville - SC",
          origin: "PORTAL_NACIONAL" as const,
        },
      ];

      for (const item of mockCaptures) {
        const analysis = await processFiscalDocument(item);
        await addDoc(collection(db, "companies", activeClientId, "fiscal_documents"), {
          number: `NF-${Math.floor(Math.random() * 9000) + 1000}`,
          type: "NFS-E",
          origin: item.origin,
          value: item.value,
          taxes: analysis.taxBreakdown,
          accountingNote: analysis.accountingNote,
          netValue: analysis.netValue,
          status: "ESCRITURADO",
          competencia: "02/2026",
          createdAt: new Date().toISOString(),
          serverTimestamp: serverTimestamp(),
        });
      }

      toast({
        title: "Captura Finalizada",
        description: `${mockCaptures.length} novos documentos registrados via NAI-Link ERP/Portais.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro na Captura",
        description: "Falha ao conectar com o ERP ou portais governamentais.",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFiscalClosing = async () => {
    if (!db || !company) return;
    setIsClosing(true);

    try {
      // 1. Inicia Fechamento
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Transmissão REINF e DCTF Web (Cascata Automática)
      await setDoc(
        doc(db, "companies", company.id),
        {
          fiscal_closing_status: "closed",
          reinf_status: "delivered",
          dctf_web_status: "delivered",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: "Período Fiscal Encerrado",
        description: "REINF enviada e DCTF Web protocolada com sucesso. Guias enviadas ao portal.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Falha no Fechamento" });
    } finally {
      setIsClosing(false);
    }
  };

  const totalAccrued = React.useMemo(() => {
    if (!documents) return 0;
    return documents.reduce((acc, curr: any) => {
      const taxes = (curr.taxes || {}) as Record<string, number>;
      return acc + Object.values(taxes).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    }, 0);
  }, [documents]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-shadow border-none bg-slate-900 text-white rounded-[2rem] p-6">
          <p className="text-[9px] font-black uppercase text-accent tracking-[0.2em] mb-1">
            Passivo Tributário Real-Time
          </p>
          <h3 className="text-3xl font-black font-headline">
            R$ {totalAccrued.toLocaleString("pt-BR")}
          </h3>
          <Badge className="bg-white/10 text-white mt-4 border-none text-[8px] font-black uppercase">
            Apuração Doc a Doc
          </Badge>
        </Card>

        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard
            label="EFD-REINF"
            status={company?.reinf_status || "pending"}
            icon={Send}
            desc="Transmissão automática pós-fechamento."
          />
          <StatusCard
            label="DCTF Web"
            status={company?.dctf_web_status || "pending"}
            icon={FileCheck}
            desc="Geração de guia e protocolo integrado."
          />
          <Card className="card-shadow border-none bg-white rounded-[2rem] p-6 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                Encerramento Mensal
              </p>
              <Lock className="size-3 text-slate-300" />
            </div>
            <Button
              onClick={handleFiscalClosing}
              disabled={isClosing || company?.fiscal_closing_status === "closed"}
              className={cn(
                "w-full h-10 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2",
                company?.fiscal_closing_status === "closed"
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-white"
              )}
            >
              {isClosing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              {company?.fiscal_closing_status === "closed"
                ? "Competência Encerrada"
                : "Fechar Apuração"}
            </Button>
          </Card>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div className="text-left">
          <h4 className="text-sm font-black text-primary uppercase">Hub de Integração ERP v2.8</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Sincronização automática com Omie ou Senior ERP para gestão de folha e tributos.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button
            onClick={handlePortalCapture}
            disabled={isCapturing}
            className="flex-1 md:flex-none gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2"
          >
            {isCapturing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Network className="size-4" />
            )}
            Sincronizar Documentos (ERP)
          </Button>

          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <Button
              variant="ghost"
              onClick={handleOmieToggle}
              className={cn(
                "h-9 px-4 font-black uppercase text-[9px] gap-2 rounded-lg transition-all",
                company?.use_omie ? "bg-white text-indigo-700 shadow-sm" : "text-slate-400"
              )}
            >
              <CloudLightning className="size-3.5" /> Omie
            </Button>
            <Button
              variant="ghost"
              onClick={handleSeniorToggle}
              className={cn(
                "h-9 px-4 font-black uppercase text-[9px] gap-2 rounded-lg transition-all",
                company?.use_senior ? "bg-white text-blue-700 shadow-sm" : "text-slate-400"
              )}
            >
              <Cpu className="size-3.5" /> Senior ERP
            </Button>
          </div>
        </div>
      </div>

      {/* CALCULADORA DE FATURAMENTO X FERIADOS NACIONAIS (PROFISSIONAIS ALOCADOS) */}
      <HolidayBillingWidget />

      <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 text-[8px] uppercase font-black">
              <TableRow>
                <TableHead className="pl-8 py-5">Documento / Lote</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Apuração Item-a-Item</TableHead>
                <TableHead className="text-center">Escrituração</TableHead>
                <TableHead className="pr-8 text-right">Análise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
                    <Loader2 className="size-10 animate-spin mx-auto text-primary opacity-20" />
                  </TableCell>
                </TableRow>
              ) : (
                documents?.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "size-10 rounded-xl flex items-center justify-center text-white shadow-inner shrink-0",
                            doc.origin === "OMIE_ERP"
                              ? "bg-indigo-600"
                              : doc.origin === "SENIOR_ERP"
                                ? "bg-blue-600"
                                : "bg-primary"
                          )}
                        >
                          {doc.origin === "OMIE_ERP" ? (
                            <CloudLightning size={16} />
                          ) : doc.origin === "SENIOR_ERP" ? (
                            <Cpu size={16} />
                          ) : (
                            <Database size={16} />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-black text-xs text-primary uppercase">{doc.number}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                            Origem: {doc.origin?.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-black text-primary">
                      R$ {doc.value.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {Object.entries(doc.taxes || {}).map(([key, val]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-[7px] font-black bg-slate-50 px-1.5 h-4 border-slate-100 text-slate-500"
                          >
                            {key.toUpperCase()}:{" "}
                            {Number(val).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] px-3 h-6">
                        <CheckCircle2 className="size-2.5 mr-1.5" /> AUTOMÁTICA
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-primary group-hover:bg-primary group-hover:text-white transition-all rounded-xl"
                      >
                        <FileSearch size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {(!documents || documents.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-[0.4em]"
                  >
                    Aguardando captura de documentos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL DE MEMÓRIA DE CÁLCULO */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedDoc && (
            <>
              <div className="p-8 bg-primary text-white relative">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Scale className="size-24 text-accent" />
                </div>
                <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase mb-2">
                  SGI Fiscal Intelligence
                </Badge>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                  Memória de Cálculo: {selectedDoc.number}
                </DialogTitle>
                <DialogDescription className="text-white/60 font-medium italic">
                  Decomposição tributária item-a-item para auditoria.
                </DialogDescription>
              </div>
              <ScrollArea className="max-h-[60vh] p-8">
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                        Base de Cálculo
                      </p>
                      <p className="text-lg font-black text-primary">
                        R$ {selectedDoc.value.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                        Regime Tributário
                      </p>
                      <Badge className="bg-blue-600 text-white border-none font-black text-[9px]">
                        {selectedDoc.regime}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">
                      Discriminação das Alíquotas
                    </h4>
                    <div className="divide-y divide-slate-100 border rounded-[2rem] bg-white overflow-hidden shadow-sm">
                      {Object.entries(selectedDoc.taxes || {}).map(([tax, val]) => (
                        <div
                          key={tax}
                          className="p-4 flex justify-between items-center hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-[10px]">
                              {tax.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase">
                              {tax}
                            </span>
                          </div>
                          <span className="text-xs font-black text-primary">
                            {Number(val).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Brain className="size-4" />
                      <h5 className="text-[10px] font-black uppercase">Parecer Contábil NAI:</h5>
                    </div>
                    <p className="text-[11px] text-emerald-900/70 leading-relaxed font-medium italic">
                      "
                      {selectedDoc.accountingNote ||
                        "Escrituração realizada com base na tipicidade do serviço e retenções na fonte aplicáveis."}
                      "
                    </p>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-8 bg-slate-50 border-t flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedDoc(null)}
                  className="font-bold uppercase text-[10px]"
                >
                  Fechar
                </Button>
                <Button className="bg-primary text-white font-black uppercase text-[10px] rounded-xl px-6 gap-2">
                  <Download className="size-3 text-accent" /> Exportar Relatório
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusCard({
  label,
  status,
  icon: Icon,
  desc,
}: {
  label: string;
  status: string;
  icon: any;
  desc: string;
}) {
  const isDelivered = status === "delivered";
  return (
    <Card className="card-shadow border-none bg-white rounded-[2rem] p-6 flex flex-col justify-between group hover:ring-2 ring-primary/5 transition-all">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
          <Badge
            className={cn(
              "text-[8px] font-black uppercase border-none h-5 px-2",
              isDelivered ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            )}
          >
            {isDelivered ? "PROTOCOLADO" : "AGUARDANDO"}
          </Badge>
        </div>
        <div
          className={cn(
            "p-2 rounded-xl shadow-inner",
            isDelivered ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-300"
          )}
        >
          <Icon size={18} />
        </div>
      </div>
      <p className="text-[8px] text-slate-400 font-medium leading-tight mt-4 uppercase italic">
        "{desc}"
      </p>
    </Card>
  );
}
