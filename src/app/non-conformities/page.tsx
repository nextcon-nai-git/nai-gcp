"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  ArrowRight,
  Link2,
  Calendar,
  User,
  DollarSign,
  Shield,
  Activity,
  Building2,
  Plus,
  Loader2,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, where, collectionGroup } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";

/**
 * @fileOverview Gestão de Não-Conformidades (RNC) - Auditoria Firestore Real.
 */

export default function NonConformitiesDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [selectedRnc, setSelectedRnc] = React.useState<string | null>(null);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    return ["SUPER_ADMIN", "ADMIN"].includes(role);
  }, [profile]);

  // Query Real-time normalizada para conformidade multi-tenant
  const rncQuery = useMemoFirebase(() => {
    if (!db || activeClientId === "unauthorized" || !activeClientId) return null;
    if (activeClientId === "all") {
      return query(collectionGroup(db, "non_conformities"), orderBy("createdAt", "desc"));
    }
    return query(
      collection(db, "companies", activeClientId, "non_conformities"),
      orderBy("createdAt", "desc")
    );
  }, [db, activeClientId]);

  const { data: rncs, isLoading: loadingRncs } = useCollection(rncQuery);

  const stats = React.useMemo(() => {
    if (!rncs) return { total: 0, pending: 0, overdue: 0, effective: 0 };
    return {
      total: rncs.length,
      pending: rncs.filter((r) => r.efficacy?.status === "pending").length,
      overdue: rncs.filter((r) =>
        r.plan5W2H?.some((p: any) => p.status === "pending" && new Date(p.when) < new Date())
      ).length,
      effective: rncs.filter((r) => r.efficacy?.status === "verified").length,
    };
  }, [rncs]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Gestão de Não-Conformidades (RNC)
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Activity className="size-3 text-accent" /> Motor PDCA 2026:{" "}
            {activeClientId === "all" ? "Rede Global" : "Unidade Ativa"}.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
              <Plus className="size-4" /> Abrir RNC Digital
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-w-lg">
            <DialogHeader className="p-8 bg-primary text-white">
              <DialogTitle className="text-xl font-black uppercase">Nova RNC</DialogTitle>
              <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-1">
                Abertura de desvio para melhoria contínua SGI.
              </DialogDescription>
            </DialogHeader>
            <div className="p-8">
              <p className="text-xs font-medium text-slate-400 italic">
                Interface de preenchimento 5W2H em sincronização com o banco...
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total RNCs"
          value={stats.total}
          icon={FileEdit}
          color="text-slate-800"
          bg="bg-slate-100"
        />
        <StatCard
          label="Ações em Atraso"
          value={stats.overdue}
          icon={AlertTriangle}
          color="text-rose-600"
          bg="bg-rose-50"
        />
        <StatCard
          label="Eficácia Pendente"
          value={stats.pending}
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          label="Resolvidos"
          value={stats.effective}
          icon={CheckCircle2}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50/60 border-b py-6 px-8">
          <CardTitle className="text-lg font-black text-primary uppercase tracking-tight text-left">
            Rastreabilidade de Desvios & RNCs
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1 text-left">
            Plano integrador de melhoria contínua {activeClientId === "all" ? "Consolidado" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loadingRncs ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-primary">
              <Loader2 className="size-12 animate-spin opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                Sincronizando Base SGI...
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30 text-[9px] uppercase font-black tracking-wider">
                <TableRow>
                  <TableHead className="pl-8 w-[120px]">Registro ID</TableHead>
                  <TableHead className="w-[180px]">Origem / Vínculo</TableHead>
                  <TableHead>Descrição do Desvio</TableHead>
                  <TableHead className="text-center w-[120px]">Criticidade</TableHead>
                  <TableHead className="pr-8 text-center w-[120px]">Eficácia SGI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rncs?.map((rnc: any) => (
                  <TableRow
                    key={rnc.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer border-b last:border-0"
                    onClick={() => setSelectedRnc(selectedRnc === rnc.id ? null : rnc.id)}
                  >
                    <TableCell className="pl-8 py-5 font-black text-xs text-primary">
                      {rnc.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                        <Link2 className="size-3 text-slate-400" />
                        <span>{rnc.origin?.type || "AUDITORIA"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-slate-600 font-medium max-w-[400px] truncate">
                      {rnc.description}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase border-none px-3",
                          rnc.priority === "high"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {rnc.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-8 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px] font-black uppercase border-none px-3 h-5",
                          rnc.efficacy?.status === "verified"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        )}
                      >
                        {rnc.efficacy?.status || "PENDENTE"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!rncs || rncs.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest"
                    >
                      Nenhuma não-conformidade registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none bg-white rounded-3xl p-6 shadow-sm border group hover:ring-2 ring-primary/5 transition-all">
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-2xl shadow-inner", bg, color)}>
          <Icon className="size-5" />
        </div>
        <div className="text-left">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
            {label}
          </p>
          <h4 className={cn("text-2xl font-black", color)}>{value}</h4>
        </div>
      </div>
    </Card>
  );
}
