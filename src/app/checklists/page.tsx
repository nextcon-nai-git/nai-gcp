"use client";

import * as React from "react";
import {
  ClipboardCheck,
  Loader2,
  ShieldAlert,
  HeartPulse,
  CheckCircle2,
  FileText,
  Sparkles,
  Search,
  ChevronRight,
  AlertTriangle,
  Save,
  Zap,
  X,
  PenTool,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useStorage,
  useDoc,
} from "@/firebase";
import {
  collection,
  query,
  orderBy,
  addDoc,
  doc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { NR_CHECKLISTS, getGenericChecklist, NRChecklist, ChecklistItem } from "@/lib/nr-data";
import { STORAGE_PATHS } from "@/lib/storage-paths";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

type ChecklistStatus = "CONFORME" | "NÃO CONFORME" | "NÃO AVALIADO" | null;

export default function ChecklistsPage() {
  const { toast } = useToast();
  const { user, role, companyId: userCompanyId } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("");

  const [isChecklistOpen, setIsChecklistOpen] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [activeNR, setActiveNR] = React.useState<NRChecklist | null>(null);
  const [responses, setResponses] = React.useState<Record<string, ChecklistStatus>>({});

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(
    () => ["SUPER_ADMIN", "ADMIN", "ENGINEER"].includes(role || ""),
    [role]
  );

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !role) return null;
    if (isGlobalAdmin) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (userCompanyId) {
      return query(collection(db, "companies"), where("__name__", "==", userCompanyId));
    }
    return null;
  }, [db, isGlobalAdmin, userCompanyId, role]);

  const { data: availableCompanies, isLoading: loadingCompanies } = useCollection(companiesQuery);

  React.useEffect(() => {
    if (availableCompanies && availableCompanies.length === 1) {
      setSelectedCompanyId(availableCompanies[0].id);
    }
  }, [availableCompanies]);

  const handleOpenChecklist = (nrId: string, title: string) => {
    if (!selectedCompanyId) {
      toast({
        variant: "destructive",
        title: "Unidade Obrigatória",
        description: "Selecione uma unidade para iniciar.",
      });
      return;
    }
    const config = NR_CHECKLISTS[nrId] || getGenericChecklist(nrId.toUpperCase(), title);
    setActiveNR(config);
    setResponses({});
    setIsChecklistOpen(true);
  };

  const checklistProgress = React.useMemo(() => {
    if (!activeNR) return 0;
    const answered = Object.values(responses).filter((v) => v !== null).length;
    return (answered / activeNR.items.length) * 100;
  }, [responses, activeNR]);

  const handleFinalizeAuditoria = async () => {
    if (!user || !storage || !db || !activeNR || !selectedCompanyId) return;

    setIsFinalizing(true);
    try {
      const company = availableCompanies?.find((c) => c.id === selectedCompanyId);
      const auditData = {
        nr: activeNR.nr,
        companyId: selectedCompanyId,
        auditorId: user.uid,
        timestamp: new Date().toISOString(),
        responses: responses,
        progress: Math.round(checklistProgress),
      };

      const storagePath = STORAGE_PATHS.CLIENT_SST_NR(
        selectedCompanyId,
        activeNR.nr.toLowerCase().replace("-", "") as any,
        `protocolo_${Date.now()}.json`
      );
      const storageRef = ref(storage, storagePath);
      const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
      await uploadBytes(storageRef, blob);

      await addDoc(collection(db, "companies", selectedCompanyId, "reports"), {
        name: `Laudo Técnico - ${activeNR.nr}`,
        reportType: activeNR.nr.toLowerCase().replace("-", ""),
        companyId: selectedCompanyId,
        companyName: company?.name,
        storagePath: storagePath,
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      });

      toast({ title: "Laudo Protocolado com Sucesso!" });
      setIsChecklistOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao Salvar Protocolo" });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Central de Laudos
          </h1>
          <p className="text-muted-foreground font-medium">
            Gere PGR, PCMSO e LTCAT em conformidade com as NRs.
          </p>
        </div>
        <div className="w-full md:w-72 text-left">
          <label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block">
            Unidade em Inspeção:
          </label>
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="bg-white border-muted h-11 text-xs shadow-sm">
              <SelectValue
                placeholder={loadingCompanies ? "Carregando..." : "Selecione o Cliente"}
              />
            </SelectTrigger>
            <SelectContent>
              {availableCompanies?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-left">
        {[
          {
            id: "nr01",
            category: "Geral",
            title: "PGR - NR-01",
            icon: ShieldAlert,
            color: "text-red-600",
          },
          {
            id: "nr07",
            category: "Saúde",
            title: "PCMSO - NR-07",
            icon: HeartPulse,
            color: "text-emerald-600",
          },
          {
            id: "nr09",
            category: "Ambiental",
            title: "LTCAT - NR-09",
            icon: Layers,
            color: "text-blue-600",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.id}
              className="cursor-pointer hover:ring-2 ring-primary/10 transition-all group bg-white border-none card-shadow"
              onClick={() => handleOpenChecklist(item.id, item.title)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className={cn(
                    "p-3 rounded-xl bg-muted/50 group-hover:bg-primary group-hover:text-white transition-all shrink-0",
                    item.color
                  )}
                >
                  <Icon className="size-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase opacity-50 truncate">
                    {item.category}
                  </p>
                  <h3 className="text-[11px] font-bold text-primary leading-tight line-clamp-2">
                    {item.title}
                  </h3>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={isChecklistOpen}
        onOpenChange={(open) => !isFinalizing && setIsChecklistOpen(open)}
      >
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
          <DialogHeader className="p-8 bg-primary text-white shrink-0 relative space-y-2 text-left">
            <button
              onClick={() => setIsChecklistOpen(false)}
              className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors z-20"
            >
              <X className="size-5" />
            </button>
            <div className="flex items-center gap-3">
              <PenTool className="size-8 text-accent" />
              <DialogTitle className="text-2xl font-headline font-black uppercase">
                Elaborar {activeNR?.nr}
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/70 font-bold uppercase text-[10px] mt-2">
              Usuário: {profile?.name || user?.email} | Preenchimento técnico de conformidade legal.
            </DialogDescription>
            <Progress value={checklistProgress} className="h-2 mt-4 bg-white/10" />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
            {activeNR?.items.map((item) => (
              <div
                key={item.id}
                className="p-6 bg-white rounded-3xl border mb-4 shadow-sm group hover:border-primary/20 transition-all text-left"
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1">
                    <Badge
                      variant="outline"
                      className="text-[8px] font-black uppercase border-primary/20 text-primary/60 mb-2"
                    >
                      {item.category}
                    </Badge>
                    <h4 className="text-sm font-bold text-primary leading-tight">
                      {item.id}. {item.question}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["CONFORME", "NÃO CONFORME", "NÃO AVALIADO"] as ChecklistStatus[]).map(
                    (status) => (
                      <Button
                        key={status}
                        variant={responses[item.id] === status ? "default" : "outline"}
                        className={cn(
                          "h-10 text-[9px] font-black uppercase rounded-xl transition-all",
                          responses[item.id] === status
                            ? "bg-primary"
                            : "hover:bg-primary/5 border-slate-200"
                        )}
                        onClick={() => setResponses((prev) => ({ ...prev, [item.id]: status }))}
                      >
                        {status}
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="p-6 bg-white border-t shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-[10px] font-black uppercase text-slate-400 italic">
              "Este preenchimento alimenta o laudo PDF automático."
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="font-bold uppercase text-[10px]"
                onClick={() => setIsChecklistOpen(false)}
                disabled={isFinalizing}
              >
                Salvar Rascunho
              </Button>
              <Button
                onClick={handleFinalizeAuditoria}
                disabled={checklistProgress < 100 || isFinalizing}
                className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 rounded-xl shadow-lg"
              >
                {isFinalizing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Finalizar e Protocolar"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
