"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Loader2,
  CheckCircle2,
  Building2,
  Search,
  ChevronRight,
  Database,
  RefreshCw,
  Zap,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  addDoc,
  serverTimestamp,
  setDoc,
  collectionGroup,
} from "firebase/firestore";
import { analyzeContract, type ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QueueItem {
  id: string;
  fileName: string;
  status: "analyzing" | "completed" | "error" | "integrating" | "success";
  result?: ContractAnalysisOutput;
  error?: string;
}

export default function ContractsManagement() {
  const { toast } = useToast();
  const db = useFirestore();

  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [viewingContract, setViewingContract] = React.useState<any | null>(null);

  // Query otimizada para subcoleções de contratos
  const contractsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collectionGroup(db, "contracts"), orderBy("createdAt", "desc"));
  }, [db]);
  const { data: contracts, isLoading: loadingContracts } = useCollection(contractsQuery);

  const processFile = async (file: File) => {
    const id = Math.random().toString(36).substring(2, 9);
    setQueue((prev) => [...prev, { id, fileName: file.name, status: "analyzing" }]);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const analysis = await analyzeContract({ pdfDataUri: base64 });
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "completed", result: analysis } : item
        )
      );
    } catch (error: any) {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "error", error: "Falha na análise neural." } : item
        )
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(processFile);
    e.target.value = "";
  };

  const handleIntegrateSgi = async (item: QueueItem) => {
    if (!item.result || !db) return;
    setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "integrating" } : q)));

    try {
      const result = item.result;
      const companyId = result.clientInfo.cnpj.replace(/\D/g, "");
      const companyRef = doc(db, "companies", companyId);

      // Onboarding de Empresa
      await setDoc(
        companyRef,
        {
          id: companyId,
          name: result.clientInfo.name.toUpperCase(),
          cnpj: result.clientInfo.cnpj,
          risk_degree: result.clientInfo.riskDegree,
          address: result.clientInfo.address,
          segment: result.clientInfo.segment,
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Registro do Contrato na subcoleção da empresa
      await addDoc(collection(db, "companies", companyId, "contracts"), {
        companyId,
        companyName: result.clientInfo.name,
        summary: result.summary,
        clauses: result.clauses,
        operationalTasks: result.operationalTasks,
        createdAt: new Date().toISOString(),
      });

      // Injeção de Backlog no SGI (Subcoleção 'tasks')
      const tasksRef = collection(db, "companies", companyId, "tasks");
      for (const task of result.operationalTasks) {
        await addDocumentNonBlocking(tasksRef, {
          title: task.title,
          description: task.description,
          type: task.category,
          status: "todo",
          priority: "high",
          companyId,
          companyName: result.clientInfo.name,
          progress: 0,
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "success" } : q)));
      toast({ title: "SGI Integrado!", description: `${result.clientInfo.name} cadastrada.` });
    } catch (e) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "completed" } : q)));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary uppercase">
            Onboarding de Contratos
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
            <Zap className="size-3 text-accent" /> Automação Multi-tenant via NAI.
          </p>
        </div>
        <Button
          className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px]"
          onClick={() => document.getElementById("contract-upload")?.click()}
        >
          <Plus className="size-4 mr-2" /> Upload em Lote
        </Button>
        <input
          id="contract-upload"
          type="file"
          className="hidden"
          accept=".pdf"
          multiple
          onChange={handleFileUpload}
        />
      </header>

      {queue.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
            <RefreshCw
              className={cn(
                "size-3",
                queue.some((q) => q.status === "analyzing") && "animate-spin"
              )}
            />{" "}
            Fila de Análise
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {queue.map((item) => (
              <Card
                key={item.id}
                className="border-none shadow-sm rounded-3xl overflow-hidden bg-white"
              >
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div
                      className={cn(
                        "size-10 rounded-xl flex items-center justify-center shrink-0",
                        item.status === "success"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                      )}
                    >
                      {item.status === "analyzing" ? (
                        <Loader2 className="animate-spin size-5" />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-black text-xs text-primary uppercase">{item.fileName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{item.status}</p>
                    </div>
                  </div>
                  {item.status === "completed" && (
                    <Button
                      size="sm"
                      className="bg-primary text-white text-[9px] font-black uppercase rounded-xl h-9"
                      onClick={() => handleIntegrateSgi(item)}
                    >
                      Integrar SGI
                    </Button>
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="text-emerald-500 size-6" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 text-left">
        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">
          Repositório de Contratos (Global)
        </h3>
        <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-0">
            {loadingContracts ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin mx-auto opacity-20" />
              </div>
            ) : (
              contracts?.map((contract) => (
                <div
                  key={contract.id}
                  className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between border-b last:border-none cursor-pointer"
                  onClick={() => setViewingContract(contract)}
                >
                  <div className="flex items-center gap-5">
                    <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="font-black text-sm text-primary uppercase">
                        {contract.companyName}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        Vínculo: {contract.companyId}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewingContract} onOpenChange={() => setViewingContract(null)}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {viewingContract && (
            <>
              <div className="p-8 bg-primary text-white">
                <DialogTitle className="text-2xl font-black uppercase">
                  {viewingContract.companyName}
                </DialogTitle>
                <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-1">
                  Dossiê Jurídico & Operacional NAI
                </DialogDescription>
              </div>
              <ScrollArea className="max-h-[60vh] p-8">
                <div className="space-y-6">
                  <div className="p-6 bg-slate-50 rounded-3xl border italic text-sm text-slate-700">
                    "{viewingContract.summary}"
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-primary">
                      Deveres da Operação
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {viewingContract.operationalTasks?.map((t: any, i: number) => (
                        <div
                          key={i}
                          className="p-4 bg-white border rounded-2xl flex items-center justify-between shadow-sm"
                        >
                          <div>
                            <p className="text-xs font-black text-primary uppercase">{t.title}</p>
                            <Badge
                              variant="outline"
                              className="text-[7px] font-bold uppercase border-slate-100"
                            >
                              {t.category}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-slate-50 border-t flex justify-end">
                <Button
                  onClick={() => setViewingContract(null)}
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
