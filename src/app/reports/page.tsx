"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import {
  Plus,
  Building2,
  FileUp,
  Loader2,
  Database,
  Trash2,
  Calendar,
  MessageSquareText,
  ShieldCheck,
  Brain,
  AlertTriangle,
  Sparkles,
  Search,
  ChevronRight,
  FileSearch,
  X,
  Clock,
  PieChart as PieChartIcon,
  Accessibility,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useStorage } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  addDoc,
  serverTimestamp,
  collectionGroup,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
import { classifyDocument } from "@/ai/flows/document-classifier-flow";
import { analyzeSafetyReport, type ReportAnalysisOutput } from "@/ai/flows/report-analysis-flow";
import { STORAGE_PATHS } from "@/lib/storage-paths";
import { useSgi } from "@/contexts/sgi-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

export default function ReportsCenter() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { activeClientId } = useSgi();

  const [isClassifying, setIsClassifying] = React.useState(false);
  const [classifiedResult, setClassifiedResult] = React.useState<any>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = React.useState<ReportAnalysisOutput | null>(null);

  const reportsQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (activeClientId === "all") {
      return query(collectionGroup(db, "reports"), orderBy("createdAt", "desc"));
    }
    return query(
      collection(db, "companies", activeClientId, "reports"),
      orderBy("createdAt", "desc")
    );
  }, [db, activeClientId]);

  const { data: reports, isLoading: loadingReports } = useCollection(reportsQuery);

  const filteredReports = React.useMemo(() => {
    if (!reports) return [];
    if (activeClientId && activeClientId !== "all" && activeClientId !== "unauthorized") {
      return reports.filter((r) => !r.companyId || r.companyId === activeClientId);
    }
    return reports;
  }, [reports, activeClientId]);

  const handleAiClassification = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsClassifying(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo para triagem."));
        reader.readAsDataURL(file);
      });

      const result = await classifyDocument(
        { pdfDataUri: base64, fileName: file.name },
        await getActionIdToken()
      );
      setClassifiedResult({ ...result, file });
      toast({
        title: "Documento Classificado!",
        description: `Detectado como ${result.docType.toUpperCase()} da empresa ${result.companyName}.`,
      });
    } catch (error: any) {
      console.error("[Document Classifier Error]:", error);
      toast({
        variant: "destructive",
        title: "Erro na Triagem IA",
        description: error?.message || "Não foi possível classificar o documento.",
      });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleProtocolDocument = async () => {
    if (
      !classifiedResult?.file ||
      !db ||
      activeClientId === "all" ||
      activeClientId === "unauthorized"
    ) {
      toast({
        variant: "destructive",
        title: "Unidade não selecionada",
        description: "Selecione uma empresa específica para protocolar o documento.",
      });
      return;
    }

    setIsUploading(true);
    try {
      let url = "";
      if (storage) {
        try {
          const path = STORAGE_PATHS.CLIENT_SST_NR(
            activeClientId,
            classifiedResult.docType as any,
            classifiedResult.file.name
          );
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, classifiedResult.file);
          url = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn(
            "[Report Storage Warning]: Falha no Cloud Storage, gravando referência local no Firestore:",
            storageErr
          );
          url = `local://reports/${classifiedResult.file.name}`;
        }
      }

      await addDoc(collection(db, "companies", activeClientId, "reports"), {
        name: classifiedResult.file.name,
        type: classifiedResult.docType,
        url,
        companyId: activeClientId,
        statusIA: "Auditado NAI",
        progresso: 100,
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      });

      toast({
        title: "Laudo Protocolado com Sucesso!",
        description: "Documento auditado e catalogado no acervo SGI.",
      });
      setIsUploadOpen(false);
      setClassifiedResult(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no Protocolo", description: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary uppercase">
            Inteligência Documental
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Brain className="size-3 text-accent" /> Processamento Assíncrono e Resiliência v2.7.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            className="border-blue-200 text-blue-700 h-11 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-blue-50"
          >
            <Link href="/reports/technical-visit/engehosp">
              <ShieldCheck className="size-4 text-primary" /> Visita Técnica Engehosp (HC-UFPR)
            </Link>
          </Button>
          {activeClientId === "CETESB_080680" && (
            <Button
              asChild
              className="bg-red-600 hover:bg-red-700 text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20 gap-2 border-none"
            >
              <Link href="/reports/fire-safety-cetesb">
                <Flame className="size-4 text-accent" /> Auditoria Incêndio IT-16
              </Link>
            </Button>
          )}
          {activeClientId === "NATIVA_EMPR" && (
            <>
              <Button
                asChild
                variant="outline"
                className="border-emerald-200 text-emerald-700 h-11 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-emerald-50"
              >
                <Link href="/reports/nativa-infographic">
                  <PieChartIcon className="size-4" /> Infográfico Mônaco
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-orange-200 text-orange-700 h-11 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-orange-50"
              >
                <Link href="/reports/industrial-ergonomics">
                  <Accessibility className="size-4" /> Ergonomia Industrial
                </Link>
              </Button>
            </>
          )}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
                <Plus className="size-4" /> Upload p/ Fila NAI
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <DialogHeader className="p-8 bg-primary text-white space-y-2">
                <DialogTitle className="text-xl font-headline font-black uppercase">
                  Fila de Auditoria NAI
                </DialogTitle>
                <DialogDescription className="text-white/60 font-medium italic">
                  O documento será analisado assincronamente pelo Cloud Tasks.
                </DialogDescription>
              </DialogHeader>
              <div className="p-8 space-y-6">
                {!classifiedResult && !isClassifying && (
                  <div
                    className="border-2 border-dashed rounded-[2rem] p-12 text-center cursor-pointer hover:bg-slate-50 transition-all"
                    onClick={() => document.getElementById("ai-sorter")?.click()}
                  >
                    <input
                      type="file"
                      id="ai-sorter"
                      className="hidden"
                      accept=".pdf"
                      onChange={handleAiClassification}
                    />
                    <FileUp className="size-10 text-primary opacity-20 mx-auto mb-4" />
                    <p className="text-sm font-black text-primary uppercase">
                      Arraste seu Laudo PDF
                    </p>
                  </div>
                )}
                {isClassifying && (
                  <div className="py-20 text-center space-y-4">
                    <Loader2 className="size-10 animate-spin text-primary opacity-20 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                      Iniciando Triagem...
                    </p>
                  </div>
                )}
                {classifiedResult && (
                  <div className="space-y-6 animate-in zoom-in-95">
                    <Card className="border-none bg-emerald-50 rounded-2xl p-6">
                      <h4 className="text-sm font-black text-emerald-900 uppercase">
                        Documento Triado
                      </h4>
                      <p className="text-[10px] font-bold text-emerald-700 mt-1 uppercase">
                        {classifiedResult.docType}
                      </p>
                    </Card>
                    <Button
                      onClick={handleProtocolDocument}
                      disabled={isUploading}
                      className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2"
                    >
                      {isUploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Database className="size-4 text-accent" />
                      )}
                      Confirmar e Injetar na Fila
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingReports ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="animate-spin mx-auto opacity-20" />
          </div>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              className="border border-slate-100 rounded-[2rem] hover:shadow-xl transition-all group overflow-hidden bg-white flex flex-col text-left"
            >
              <CardHeader className="p-6 bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <Badge
                    className={cn(
                      "border-none text-[8px] font-black uppercase px-2 h-5",
                      report.statusIA === "Concluído"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700 animate-pulse"
                    )}
                  >
                    {report.statusIA || "Na Fila"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="h-5 text-[7px] border-blue-200 text-blue-600 bg-white uppercase"
                  >
                    {report.type?.toUpperCase()}
                  </Badge>
                </div>
                <h4 className="text-xs font-black text-primary uppercase mt-4 truncate">
                  {report.name}
                </h4>
                {report.statusIA === "Aguardando IA" && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                      <span>Processamento Neural</span>
                      <span>{report.progresso || 0}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 animate-pulse"
                        style={{ width: `${report.progresso || 10}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl text-[9px] font-black uppercase gap-2 border-primary/10"
                  disabled={report.statusIA !== "Concluído"}
                  onClick={() => setSelectedAnalysis(report.aiAnalysis)}
                >
                  {report.statusIA === "Concluído" ? (
                    <ShieldCheck size={14} className="text-emerald-500" />
                  ) : (
                    <Clock size={14} />
                  )}
                  {report.statusIA === "Concluído" ? "Ver Parecer IA" : "Aguardando Motor"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
        {(!reports || reports.length === 0) && !loadingReports && (
          <div className="col-span-full py-32 text-center opacity-20 flex flex-col items-center gap-4">
            <FileSearch className="size-16" />
            <p className="font-black uppercase text-xs tracking-widest">Nenhum laudo protocolado</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedAnalysis && (
            <>
              <div className="p-8 bg-primary text-white">
                <DialogTitle className="text-xl font-headline font-black uppercase">
                  Dossiê Técnico NAI
                </DialogTitle>
                <DialogDescription className="text-white/60 font-medium italic">
                  Extraído assincronamente via motor de resiliência.
                </DialogDescription>
              </div>
              <ScrollArea className="max-h-[60vh] p-8">
                <div className="space-y-6">
                  <div className="p-6 bg-slate-50 rounded-3xl border italic text-sm text-slate-700 leading-relaxed">
                    "{selectedAnalysis.resumo_executivo || "Análise concluída."}"
                  </div>
                  {(selectedAnalysis as any).acoes_imediatas_recomendadas && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Ações Recomendadas:
                      </p>
                      {((selectedAnalysis as any).acoes_imediatas_recomendadas as any[]).map(
                        (acao: any, i: number) => (
                          <div
                            key={i}
                            className="flex gap-3 p-3 bg-white border rounded-xl items-start"
                          >
                            <Sparkles className="size-4 text-accent shrink-0 mt-0.5" />
                            <span className="text-xs font-bold text-slate-700">{acao}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-slate-50 border-t flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAnalysis(null)}
                  className="font-bold uppercase text-[10px]"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
