"use client";

import * as React from "react";
import {
  FileText,
  HeartPulse,
  Download,
  Search,
  Filter,
  FolderOpen,
  Settings,
  Hammer,
  Building2,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, collectionGroup, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ReportItem {
  id: string;
  legacyId: string;
  name: string;
  description: string;
  icon: any;
  href?: string;
}

const REPORTS_MAPPING: Record<string, ReportItem[]> = {
  general: [
    {
      id: "pgr",
      legacyId: "1422",
      name: "PGR - Gerenciamento de Riscos",
      description: "Documento base NR-01.",
      icon: FileText,
    },
    {
      id: "pcmso",
      legacyId: "307",
      name: "PCMSO - Controle Médico",
      description: "Protocolos de saúde NR-07.",
      icon: HeartPulse,
    },
  ],
  legal: [
    {
      id: "ltcat",
      legacyId: "431",
      name: "LTCAT - Aposentadoria",
      description: "Enquadramento para Aposentadoria Especial.",
      icon: FileText,
    },
    {
      id: "nr15",
      legacyId: "150",
      name: "Laudo NR-15 (Insalubridade)",
      description: "Análise de exposição.",
      icon: Hammer,
    },
  ],
  visits: [
    {
      id: "visit_nativa",
      legacyId: "NV01",
      name: "Visita Técnica - Nativa",
      description: "Relatório de inspeção Laguna/Mônaco.",
      icon: ClipboardList,
      href: "/reports/technical-visit/nativa",
    },
  ],
};

export default function ReportsCenter() {
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState("general");
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("all");

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

  const isProvider = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    return ["PROVIDER", "ENGINEER", "DOCTOR"].includes(role);
  }, [profile]);

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;
    if (isGlobalAdmin) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (isProvider && profile.servedCompanies && profile.servedCompanies.length > 0) {
      return query(
        collection(db, "companies"),
        where("__name__", "in", profile.servedCompanies.slice(0, 10))
      );
    }
    if (profile.companyId) {
      return query(collection(db, "companies"), where("__name__", "==", profile.companyId));
    }
    return null;
  }, [db, profile, isGlobalAdmin, isProvider]);
  const { data: availableCompanies, isLoading: loadingCompanies } = useCollection(companiesQuery);

  React.useEffect(() => {
    if (availableCompanies && availableCompanies.length === 1) {
      setSelectedCompanyId(availableCompanies[0].id);
    } else if ((isGlobalAdmin || isProvider) && selectedCompanyId === "") {
      setSelectedCompanyId("all");
    }
  }, [availableCompanies, isGlobalAdmin, isProvider]);

  const uploadedReportsQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;
    if (selectedCompanyId === "all" && isGlobalAdmin) {
      return query(collectionGroup(db, "reports"), orderBy("createdAt", "desc"));
    }
    if (selectedCompanyId !== "all") {
      return query(
        collection(db, "companies", selectedCompanyId, "reports"),
        orderBy("createdAt", "desc")
      );
    }
    if (isProvider && profile.servedCompanies && profile.servedCompanies.length > 0) {
      return query(
        collectionGroup(db, "reports"),
        where("companyId", "in", profile.servedCompanies.slice(0, 10)),
        orderBy("createdAt", "desc")
      );
    }
    if (profile.companyId) {
      return query(
        collection(db, "companies", profile.companyId, "reports"),
        orderBy("createdAt", "desc")
      );
    }
    return null;
  }, [db, profile, selectedCompanyId, isGlobalAdmin, isProvider]);

  const { data: uploadedReports } = useCollection(uploadedReportsQuery);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Central de Documentos
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Gestão de Laudos e Programas Técnicos.
          </p>
        </div>
      </div>

      <Card className="card-shadow border-none bg-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                Unidade / Cliente Selecionado
              </label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="bg-muted/30 border-none h-12">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-4 opacity-50" />
                    <SelectValue
                      placeholder={loadingCompanies ? "Carregando..." : "Selecione a Unidade"}
                    />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(isGlobalAdmin || isProvider) && (
                    <SelectItem value="all">Todas as Minhas Unidades</SelectItem>
                  )}
                  {availableCompanies?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-[11px] uppercase">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full gap-2 bg-primary font-bold h-12 uppercase text-[10px] tracking-widest shadow-lg text-white rounded-xl">
                <Filter className="size-4" /> Filtrar Documentação
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-14">
          <TabsTrigger value="general" className="rounded-lg gap-2 text-xs font-bold uppercase">
            Gestão Geral
          </TabsTrigger>
          <TabsTrigger value="legal" className="rounded-lg gap-2 text-xs font-bold uppercase">
            Laudos Legais
          </TabsTrigger>
          <TabsTrigger
            value="visits"
            className="rounded-lg gap-2 text-xs font-bold uppercase text-accent"
          >
            Visitas Técnicas
          </TabsTrigger>
        </TabsList>

        {Object.entries(REPORTS_MAPPING).map(([category, reports]) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {reports.map((report) => {
                const realFile = uploadedReports?.find((r) => r.reportType === report.id);
                const ReportIcon = report.icon;

                return (
                  <Card
                    key={report.id}
                    className="card-shadow border-none bg-white group hover:ring-2 ring-primary/10 transition-all"
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <ReportIcon className="size-6 text-primary" />
                        {(realFile || report.href) && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none uppercase text-[8px] font-black px-2">
                            Disponível
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm font-black text-primary mt-3 uppercase">
                        {report.name}
                      </CardTitle>
                      <CardDescription className="text-[10px] leading-tight mt-1">
                        {report.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2 border-t mt-2">
                      {report.href ? (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="w-full text-[9px] font-black uppercase bg-primary/5 hover:bg-primary hover:text-white transition-all"
                        >
                          <Link href={report.href}>
                            Acessar Relatório Digital <ChevronRight className="size-3 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-[9px] font-black uppercase bg-primary/5 hover:bg-primary hover:text-white transition-all"
                        >
                          {realFile ? "Visualizar Dossiê" : "Aguardando Elaboração"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
