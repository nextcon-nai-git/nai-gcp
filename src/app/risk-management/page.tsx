"use client";

import * as React from "react";
import {
  ShieldAlert,
  Zap,
  ShieldCheck,
  Building2,
  Loader2,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  Activity,
  ArrowRight,
  Brain,
  Sparkles,
  FileDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useUser, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  collectionGroup,
  where,
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MOCK_RISKS = [
  {
    id: "R1",
    category: "físico",
    hazard: "Ruído Contínuo",
    intensity: "87 dB(A)",
    control: "Protetor Auricular Plug",
    ghe: "Operacional A",
  },
  {
    id: "R2",
    category: "ergonômico",
    hazard: "Postura Inadequada",
    intensity: "N/A",
    control: "Pausa Ativa / Ginástica",
    ghe: "Administrativo",
  },
  {
    id: "R3",
    category: "acidente",
    hazard: "Queda de Nível",
    intensity: "Alta",
    control: "Cinto 5 Pontos / NR-35",
    ghe: "Engenharia",
  },
];

export default function RiskInventoryPGR() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState("inventory");

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    return ["SUPER_ADMIN", "ADMIN", "ENGINEER"].includes(role);
  }, [profile]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Inventário de Riscos (NR-01)
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <Brain className="size-4 text-accent" /> Gestão de PGR, PCMAT e Matriz de Riscos 2026.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              toast({
                title: "Exportar Inventário",
                description: "Gerando arquivo XLS do PGR em conformidade com a NR-01...",
              })
            }
            variant="outline"
            className="gap-2 border-primary text-primary h-11 font-black uppercase text-[10px] tracking-widest"
          >
            <FileDown className="size-4" /> Exportar Inventário
          </Button>
          <Button
            onClick={() =>
              toast({
                title: "Novo Risco",
                description: "Painel de identificação de perigos e riscos em desenvolvimento.",
              })
            }
            className="gradient-nextcon text-white gap-2 h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg"
          >
            <Plus className="size-4" /> Novo Risco
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[500px] grid-cols-2 bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="inventory"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <ShieldAlert className="size-4" /> Inventário PGR
          </TabsTrigger>
          <TabsTrigger
            value="heatmap"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <Activity className="size-4" /> Matriz de Calor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Card className="lg:col-span-3 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    Riscos em Monitoramento
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                    Mapeamento de GHEs e exposições ocupacionais.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] px-2 h-5 uppercase">
                  S-2240 Sincronizado
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black">
                    <TableRow>
                      <TableHead className="pl-8">Perigo / Agente</TableHead>
                      <TableHead>Setor / GHE</TableHead>
                      <TableHead>Intensidade</TableHead>
                      <TableHead className="pr-8 text-right">Controle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_RISKS.map((risk) => (
                      <TableRow key={risk.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="pl-8">
                          <p className="font-black text-xs text-primary uppercase">{risk.hazard}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[8px] font-black uppercase border-none px-2 h-4 mt-1",
                              risk.category === "físico"
                                ? "bg-blue-50 text-blue-600"
                                : risk.category === "ergonômico"
                                  ? "bg-orange-50 text-orange-600"
                                  : "bg-red-50 text-red-600"
                            )}
                          >
                            {risk.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-bold text-slate-500 uppercase">{risk.ghe}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-black text-primary">{risk.intensity}</p>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <p className="text-[10px] font-bold text-slate-400 italic">
                            "{risk.control}"
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Sparkles className="size-32 text-accent" />
                </div>
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                    <Brain className="size-4" /> Auditoria NAI
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <p className="text-[11px] leading-relaxed opacity-80 italic font-medium">
                    "A IA NAI está monitorando as atualizações da NR-01. Mantenha seu inventário
                    sincronizado com o eSocial S-2240 para evitar multas."
                  </p>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-[9px] font-black uppercase text-accent mb-1">
                      Status Compliance
                    </p>
                    <p className="text-xs font-bold">100% CONFORME</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-8">
          <Card className="card-shadow border-none h-[500px] flex flex-col items-center justify-center bg-white rounded-[3rem] text-muted-foreground italic border-2 border-dashed">
            <Activity className="size-16 text-primary opacity-10 mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.3em]">
              Matriz de Probabilidade x Severidade
            </p>
            <p className="text-[10px] mt-2 font-bold uppercase opacity-40">
              Processando Cruzamento de GHEs...
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
