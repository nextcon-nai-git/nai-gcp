"use client";

import * as React from "react";
import {
  Scale,
  Calculator,
  TrendingDown,
  Landmark,
  FileText,
  Loader2,
  Gavel,
  DollarSign,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useCollection, useUser, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy, collectionGroup, doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function LegalFinancial() {
  const { user } = useUser();
  const db = useFirestore();
  const [fapValue, setFapValue] = React.useState([0.74]);
  const [payroll, setPayroll] = React.useState(150000);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    const companyId = profile.companyId;
    return (
      ["SUPER_ADMIN", "ENGINEER", "DOCTOR", "ADMIN"].includes(role) &&
      (!companyId || companyId === "")
    );
  }, [profile]);

  // Busca perícias reais do Firestore protegendo a hierarquia multi-tenant
  const expertisesQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;

    // Se for Administrador Global, vê todas via Collection Group
    if (isGlobalAdmin) {
      return query(collectionGroup(db, "legalExpertises"), orderBy("date", "desc"));
    }

    // Se for cliente, vê apenas as suas
    if (profile.companyId) {
      return query(
        collection(db, "companies", profile.companyId, "legalExpertises"),
        orderBy("date", "desc")
      );
    }

    return null;
  }, [db, profile, isGlobalAdmin]);

  const { data: expertises, isLoading: loadingExpertises } = useCollection(expertisesQuery);

  const totalRiskValue = React.useMemo(() => {
    if (!expertises) return 0;
    return expertises.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [expertises]);

  const potentialSavings = (payroll * 0.02 * (1 - fapValue[0])).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight uppercase">
            ROI Jurídico & Estratégico
          </h1>
          <p className="text-muted-foreground">
            Gestão de passivo trabalhista e performance tributária (RAT/FAP).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#090e24] text-[#f59e0b] font-black uppercase text-[10px] tracking-widest px-4 h-10 flex items-center border border-[#f59e0b]/20 shadow-lg">
            Risco Total em Monitoramento:{" "}
            {totalRiskValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-shadow border-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="size-5 text-accent" />
              <CardTitle className="text-lg">Calculadora de Economia FAP</CardTitle>
            </div>
            <CardDescription>
              Simule reduções de impostos baseadas no desempenho de segurança.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase font-black text-[10px] text-muted-foreground">
                  Folha de Pagamento Estimada (Mensal)
                </label>
                <span className="text-sm font-bold">R$ {payroll.toLocaleString("pt-BR")}</span>
              </div>
              <Input
                type="number"
                value={payroll}
                onChange={(e) => setPayroll(Number(e.target.value))}
                className="bg-muted border-none h-12 text-lg font-bold"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase font-black text-[10px] text-muted-foreground">
                  Multiplicador FAP Alvo
                </label>
                <span className="text-sm font-bold text-primary">{fapValue[0].toFixed(2)}</span>
              </div>
              <Slider value={fapValue} onValueChange={setFapValue} max={2} min={0.5} step={0.01} />
              <div className="flex justify-between text-[8px] text-muted-foreground uppercase font-black tracking-widest">
                <span>Bônus (0.50)</span>
                <span>Malus (2.00)</span>
              </div>
            </div>

            <div className="p-6 bg-primary/5 rounded-2xl border-2 border-primary/10 flex flex-col items-center gap-2 shadow-inner">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                Economia Tributária Anual
              </p>
              <h2 className="text-4xl font-headline font-bold text-primary">{potentialSavings}</h2>
              <p className="text-[10px] text-green-600 font-bold flex items-center gap-1 uppercase">
                <TrendingDown className="size-3" /> Potencial de Redução Direta
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow border-none flex flex-col bg-white overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <Scale className="size-5 text-primary" />
              <CardTitle className="text-lg font-headline font-bold">
                Controle de Perícias (Operacional)
              </CardTitle>
            </div>
            <CardDescription>
              Acompanhamento detalhado de processos judiciais reais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
            {loadingExpertises ? (
              <div className="flex flex-col items-center py-20 gap-2">
                <Loader2 className="size-8 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Buscando Base Jurídica...
                </p>
              </div>
            ) : expertises && expertises.length > 0 ? (
              <div className="divide-y">
                {expertises.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-primary/5 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary text-white rounded-lg shadow-sm group-hover:bg-accent transition-colors">
                          <Gavel className="size-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                            Processo {item.caseNumber}
                          </p>
                          <p className="text-sm font-bold text-primary">{item.employeeName}</p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase border-none",
                          item.status === "Concluído"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {item.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase">
                          Alegado
                        </p>
                        <p className="text-[10px] font-medium text-primary leading-tight line-clamp-1">
                          {item.disease}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black text-muted-foreground uppercase">
                          Valor da Causa
                        </p>
                        <p className="text-xs font-bold text-primary">
                          {(Number(item.value) || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-dashed flex justify-between items-center">
                      <div className="flex gap-2">
                        <Badge
                          variant="outline"
                          className="text-[8px] font-bold border-primary/20 text-primary/60"
                        >
                          {item.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[8px] font-bold border-primary/20 text-primary/60"
                        >
                          CID: {item.cid || "---"}
                        </Badge>
                      </div>
                      <p className="text-[9px] font-black text-primary/40 uppercase">
                        {item.date ? new Date(item.date).toLocaleDateString("pt-BR") : "---"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 space-y-4 opacity-50">
                <Landmark className="size-12 mx-auto text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase tracking-widest">
                    Base de Perícias Vazia
                  </p>
                  <p className="text-xs">Aguardando registros na base multi-tenant.</p>
                </div>
              </div>
            )}
          </CardContent>
          <div className="p-4 bg-gray-50 border-t mt-auto">
            <Button className="w-full gap-2 font-bold h-12 shadow-lg shadow-primary/10">
              <FileText className="size-4" /> Exportar Dossiê Jurídico (PDF)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
