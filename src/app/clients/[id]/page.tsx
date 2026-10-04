"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  HardHat,
  Stethoscope,
  Users,
  Phone,
  Mail,
  Globe,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Activity,
  FileText,
  ExternalLink,
  MessageCircle,
  Download,
  ArrowRight,
  Clock,
  ClipboardCheck,
  BadgeCheck,
  FileSpreadsheet,
  Layers,
  Scale,
  Search,
  Share2,
  Check,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Printer,
  Copy,
  AlertCircle,
  HelpCircle,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES, REAL_EMPLOYEES, REAL_PROVIDERS } from "@/lib/real-data";
import { getConsolidatedProviders, ConsolidatedProvider } from "@/lib/all-consolidated-providers";
import { cn } from "@/lib/utils";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ClientCockpitPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const { role } = useUser();
  const { activeClientId, setActiveClientId } = useSgi();

  const rawId = params?.id as string;
  const clientId = decodeURIComponent(rawId || "");

  const [company, setCompany] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [providerSearch, setProviderSearch] = React.useState("");
  const [employeeSearch, setEmployeeSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<string>("engenharia");
  const [copiedContact, setCopiedContact] = React.useState<string | null>(null);

  // 1. Sincronização do Cliente & Base Mestra
  React.useEffect(() => {
    if (!clientId) return;

    let found: any = null;

    // A. Buscar na Base Real Mestra NextCon
    found = REAL_COMPANIES.find(
      (c) =>
        c.id.toLowerCase() === clientId.toLowerCase() ||
        c.name.toLowerCase() === clientId.toLowerCase()
    );

    // B. Buscar no LocalStorage se não encontrou
    if (!found && typeof window !== "undefined") {
      try {
        const rawCustom = localStorage.getItem("nai_custom_companies");
        const rawRegistered = localStorage.getItem("nai_registered_clients");
        const list = [
          ...(rawCustom ? JSON.parse(rawCustom) : []),
          ...(rawRegistered ? JSON.parse(rawRegistered) : []),
        ];
        found = list.find(
          (c: any) =>
            c.id?.toLowerCase() === clientId.toLowerCase() ||
            c.name?.toLowerCase() === clientId.toLowerCase()
        );
      } catch (e) {
        console.warn("Aviso ao ler storage local:", e);
      }
    }

    if (found) {
      setCompany(found);
      setLoading(false);
      // Definir aba padrão com base no segmento/grau de risco
      const seg = (found.segment || "").toUpperCase();
      const risk = Number(found.risk_degree || 2);
      if (seg === "CONSTRUCTION" || seg === "INDUSTRY" || risk >= 3) {
        setActiveTab("engenharia");
      } else {
        setActiveTab("saude");
      }
    } else if (db) {
      // C. Buscar no Firestore
      getDoc(doc(db, "companies", clientId))
        .then((snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            setCompany(data);
            const seg = ((data as any).segment || "").toUpperCase();
            const risk = Number((data as any).risk_degree || 2);
            if (seg === "CONSTRUCTION" || seg === "INDUSTRY" || risk >= 3) {
              setActiveTab("engenharia");
            } else {
              setActiveTab("saude");
            }
          } else {
            // Fallback genérico para empresa desconhecida
            setCompany({
              id: clientId,
              name: clientId.replace(/_/g, " ").toUpperCase(),
              segment: "SERVICES",
              risk_degree: 2,
              city: "Curitiba",
              state: "PR",
              scope: "Gestão Integrada de SST, Engenharia & Saúde Ocupacional",
            });
          }
        })
        .catch(() => {
          setCompany({
            id: clientId,
            name: clientId.replace(/_/g, " ").toUpperCase(),
            segment: "SERVICES",
            risk_degree: 2,
            city: "Curitiba",
            state: "PR",
            scope: "Gestão Integrada de SST, Engenharia & Saúde Ocupacional",
          });
        })
        .finally(() => setLoading(false));
    } else {
      setCompany({
        id: clientId,
        name: clientId.replace(/_/g, " ").toUpperCase(),
        segment: "SERVICES",
        risk_degree: 2,
        city: "Curitiba",
        state: "PR",
        scope: "Gestão Integrada de SST, Engenharia & Saúde Ocupacional",
      });
      setLoading(false);
    }

    // Sincronizar o activeClientId no SGI
    if (activeClientId !== clientId) {
      setActiveClientId(clientId);
    }
  }, [clientId, db]);

  // Prestadores específicos vinculados a este cliente
  const clientProviders = React.useMemo(() => {
    if (!company) return [];
    const all = getConsolidatedProviders();
    const cId = company.id.toLowerCase();
    const cCity = (company.city || "").toLowerCase();
    const cState = (company.state || "").toLowerCase();

    return all.filter((p) => {
      // 1. Prestador expressamente vinculado via servedCompanies ou companyId
      const matchesDirect =
        (p.servedCompanies &&
          Array.isArray(p.servedCompanies) &&
          p.servedCompanies.some((sc) => sc.toLowerCase() === cId)) ||
        p.id.toLowerCase() === cId;

      if (matchesDirect) return true;

      // 2. Prestadores localizados na mesma cidade/estado
      const pCity = (p.city || "").toLowerCase();
      const pState = (p.state || "").toLowerCase();
      if (cCity && pCity && cCity === pCity && (!cState || pState === cState)) {
        return true;
      }

      // 3. Prestadores centrais corporativos de SST (médicos e engenheiros mestre)
      if (p.type === "DOCTOR" || p.type === "ENGINEER") {
        return true;
      }

      return false;
    });
  }, [company]);

  const filteredProviders = React.useMemo(() => {
    if (!providerSearch.trim()) return clientProviders;
    const term = providerSearch.toLowerCase();
    return clientProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.specialty.toLowerCase().includes(term) ||
        p.profession.toLowerCase().includes(term) ||
        (p.city && p.city.toLowerCase().includes(term))
    );
  }, [clientProviders, providerSearch]);

  // Colaboradores vinculados a este cliente
  const clientEmployees = React.useMemo(() => {
    if (!company) return [];
    const cId = (company.id || "").toLowerCase();

    const matched = (REAL_EMPLOYEES as any[])
      .filter((emp) => {
        const eComp = (emp.companyId || "").toLowerCase();
        return eComp === cId;
      })
      .map((emp) => ({
        id: String(emp.id),
        name: String(emp.name),
        role: String(emp.job_role?.title || "Colaborador Operacional"),
        department: "Operações",
        companyId: String(emp.companyId || company.id),
        status: "ACTIVE" as const,
        admissionDate: "2024-01-15",
        cpf: String(emp.cpf || "000.000.000-00"),
        asoStatus: (emp.fitnessStatus === "Inapto" ? "PENDING" : "VALID") as "VALID" | "PENDING",
        asoValidUntil: "2027-01-15",
      }));

    if (matched.length > 0) return matched;

    // Se a empresa não tem na lista mock, gerar colaboradores representativos do setor
    return [
      {
        id: `emp_${cId}_1`,
        name: company.responsible_name || "Coordenador de Unidade",
        role: company.responsible_role || "Responsável Técnico / Gestor",
        department: "Diretoria / Operações",
        companyId: company.id,
        status: "ACTIVE" as const,
        admissionDate: "2024-01-15",
        cpf: "",
        asoStatus: "VALID" as const,
        asoValidUntil: "2027-01-15",
      },
      {
        id: `emp_${cId}_2`,
        name: "Carlos Eduardo Silva",
        role:
          company.segment === "CONSTRUCTION"
            ? "Mestre de Obras"
            : company.segment === "INDUSTRY"
              ? "Operador Industrial"
              : "Assistente Administrativo",
        department: "Operações",
        companyId: company.id,
        status: "ACTIVE" as const,
        admissionDate: "2024-03-10",
        cpf: "",
        asoStatus: "VALID" as const,
        asoValidUntil: "2026-11-20",
      },
      {
        id: `emp_${cId}_3`,
        name: "Mariana Souza Santos",
        role:
          company.segment === "CONSTRUCTION"
            ? "Técnica em Segurança do Trabalho"
            : "Supervisora Operacional",
        department: "Segurança e Saúde",
        companyId: company.id,
        status: "ACTIVE" as const,
        admissionDate: "2024-05-01",
        cpf: "",
        asoStatus: "PENDING" as const,
        asoValidUntil: "2026-09-30",
      },
    ];
  }, [company]);

  const filteredEmployees = React.useMemo(() => {
    if (!employeeSearch.trim()) return clientEmployees;
    const term = employeeSearch.toLowerCase();
    return clientEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.role.toLowerCase().includes(term) ||
        (e.department && e.department.toLowerCase().includes(term))
    );
  }, [clientEmployees, employeeSearch]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContact(label);
    setTimeout(() => setCopiedContact(null), 2500);
    toast({
      title: "Copiado para a área de transferência",
      description: text,
    });
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Activity className="size-10 animate-spin mx-auto text-primary opacity-30" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-4">
          Carregando Cockpit do Cliente...
        </p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="py-20 text-center max-w-lg mx-auto">
        <Building2 className="size-12 mx-auto text-slate-300 mb-3" />
        <h2 className="text-lg font-black uppercase text-primary">Cliente não encontrado</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          A unidade solicitada ({clientId}) não está cadastrada na base mestre.
        </p>
        <Button onClick={() => router.push("/clients")} className="rounded-xl font-bold">
          Ver Todas as Unidades
        </Button>
      </div>
    );
  }

  const isHighRisk = Number(company.risk_degree || 1) >= 3;
  const isConstruction = company.segment === "CONSTRUCTION";
  const isIndustry = company.segment === "INDUSTRY";

  return (
    <div className="space-y-6 pb-20 text-left animate-in fade-in duration-300">
      {/* 1. BREADCRUMB & VOLTAR */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Link
            href="/clients"
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <Building2 size={14} /> Unidades & Clientes
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-primary font-bold uppercase truncate max-w-[200px] sm:max-w-md">
            {company.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {company.phone && (
            <a
              href={`https://wa.me/55${company.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Sou do suporte técnico da Nextcon NAI. Estou entrando em contato a respeito da gestão de SST da empresa ${company.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all"
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-[10px] font-bold uppercase gap-1"
            onClick={() => handleCopy(company.cnpj || "", "cnpj")}
          >
            <Copy size={12} /> {copiedContact === "cnpj" ? "CNPJ Copiado!" : "Copiar CNPJ"}
          </Button>
        </div>
      </div>

      {/* 2. HEADER EXECUTIVO DO CLIENTE */}
      <div className="rounded-[2.5rem] bg-gradient-to-br from-[#001f3f] via-[#002b5c] to-[#001830] text-white p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 opacity-5 pointer-events-none">
          <Building2 size={320} />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                "font-black text-[9px] uppercase tracking-wider px-3 h-6 border-none",
                isHighRisk ? "bg-red-500 text-white" : "bg-emerald-500 text-slate-950"
              )}
            >
              GRAU DE RISCO {company.risk_degree || 2} (NR-04)
            </Badge>

            <Badge className="bg-white/10 text-white font-black text-[9px] uppercase tracking-wider px-3 h-6 border border-white/20">
              SEGMENTO: {company.segment || "GERAL"}
            </Badge>

            <Badge className="bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase tracking-wider px-3 h-6 border border-emerald-500/40 flex items-center gap-1">
              <CheckCircle2 size={12} /> eSocial Sincronizado
            </Badge>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-headline tracking-tight uppercase text-white">
              {company.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-medium mt-1">
              <span>
                <strong>CNPJ:</strong> {company.cnpj || "Em cadastramento"}
              </span>
              {company.city && (
                <span>
                  • <strong>Localização:</strong> {company.city} - {company.state}
                </span>
              )}
              {company.address && <span>• {company.address}</span>}
            </div>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase text-amber-300 tracking-wider">
                Escopo de Atendimento SST Nextcon
              </p>
              <p className="text-slate-200 font-medium">
                {company.scope ||
                  "Gestão Completa de Engenharia de Segurança do Trabalho (PGR), Saúde Ocupacional (PCMSO) e Transmissão eSocial."}
              </p>
            </div>
            {company.responsible_name && (
              <div className="text-right shrink-0 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-4">
                <p className="text-[9px] font-black uppercase text-slate-400">
                  Responsável Operacional
                </p>
                <p className="font-bold text-white">{company.responsible_name}</p>
                <p className="text-[10px] text-slate-300">
                  {company.responsible_role || "Gestor da Unidade"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. CARDS DE INDICADORES CHAVE DO CLIENTE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl p-4 bg-white shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Inventário PGR
            </span>
            <div className="p-2 bg-blue-50 text-primary rounded-xl">
              <HardHat size={18} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-primary">VIGENTE</span>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              GHEs mapeados e validados
            </p>
          </div>
        </Card>

        <Card className="rounded-2xl p-4 bg-white shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Saúde / PCMSO
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Stethoscope size={18} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-600">100% OK</span>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              ASOs periódicos e clínicos
            </p>
          </div>
        </Card>

        <Card className="rounded-2xl p-4 bg-white shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Prestadores Vinculados
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <MapPin size={18} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-purple-700">{clientProviders.length}</span>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Clínicas e peritos credenciados
            </p>
          </div>
        </Card>

        <Card className="rounded-2xl p-4 bg-white shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Quadro de Vidas
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-amber-700">{clientEmployees.length}</span>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Colaboradores ativos monitorados
            </p>
          </div>
        </Card>
      </div>

      {/* 4. ABAS ESPECIALIZADAS (ENGENHARIA / SAÚDE / PRESTADORES / COLABORADORES / ESOCIAL) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 w-full justify-start border border-slate-200/60 shadow-inner">
          <TabsTrigger
            value="engenharia"
            className="rounded-xl font-black text-xs uppercase tracking-wider py-2.5 px-4 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white shadow-sm"
          >
            <HardHat size={16} /> Engenharia (PGR & NRs)
          </TabsTrigger>

          <TabsTrigger
            value="saude"
            className="rounded-xl font-black text-xs uppercase tracking-wider py-2.5 px-4 gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white shadow-sm"
          >
            <Stethoscope size={16} /> Saúde (PCMSO & ASO)
          </TabsTrigger>

          <TabsTrigger
            value="prestadores"
            className="rounded-xl font-black text-xs uppercase tracking-wider py-2.5 px-4 gap-2 data-[state=active]:bg-purple-700 data-[state=active]:text-white shadow-sm"
          >
            <MapPin size={16} /> Prestadores ({clientProviders.length})
          </TabsTrigger>

          <TabsTrigger
            value="colaboradores"
            className="rounded-xl font-black text-xs uppercase tracking-wider py-2.5 px-4 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white shadow-sm"
          >
            <Users size={16} /> Quadro de Vidas ({clientEmployees.length})
          </TabsTrigger>

          <TabsTrigger
            value="esocial"
            className="rounded-xl font-black text-xs uppercase tracking-wider py-2.5 px-4 gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white shadow-sm"
          >
            <ShieldCheck size={16} /> eSocial SST
          </TabsTrigger>
        </TabsList>

        {/* ================= ABA ENGENHARIA ================= */}
        <TabsContent value="engenharia" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CARDS ESPECÍFICOS DE ENGENHARIA */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black font-headline uppercase text-primary flex items-center gap-2">
                      <HardHat className="text-amber-500" /> Inventário de Riscos Ocupacionais (GRO
                      / PGR)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mapeamento de agentes físicos, químicos, biológicos, ergonômicos e mecânicos
                      específico desta unidade.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-bold text-xs uppercase border-primary/20 text-primary"
                  >
                    NR-01 • Vigência 2026/2027
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-500">
                        Agentes Físicos
                      </span>
                      <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[9px]">
                        {isHighRisk ? "Monitoramento Crítico" : "Sob Controle"}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      {isHighRisk
                        ? "Ruído contínuo/intermitente (dosimetria requerida) e vibração."
                        : "Níveis de ruído abaixo do limite de tolerância."}
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      EPI Compulsório: Protetor auricular tipo concha / plugue.
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-500">
                        Agentes Químicos
                      </span>
                      <Badge className="bg-blue-100 text-blue-800 border-none font-bold text-[9px]">
                        {isIndustry ? "Poeiras & Fumos" : "Saneantes / Baixo"}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      {isIndustry
                        ? "Exposição a poeiras minerais, névoas de óleo e fumos de solda."
                        : "Produtos de limpeza e asseio geral sem agentes de insalubridade."}
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Proteção: Respirador PFF2 / Luvas nitrílicas.
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-500">
                        Riscos de Acidentes (Mecânicos)
                      </span>
                      <Badge className="bg-red-100 text-red-800 border-none font-bold text-[9px]">
                        {isConstruction ? "NR-18 / NR-35" : "Sob Inspeção"}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      {isConstruction
                        ? "Trabalho em altura, escavações, andaimes e movimentação de cargas pesadas."
                        : "Partes móveis de equipamentos e circulação de veículos."}
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Proteção: Cinto paraquedista, talabarte duplo, capacete jugular e calçado com
                      biqueira.
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-500">
                        Agentes Ergonômicos
                      </span>
                      <Badge className="bg-purple-100 text-purple-800 border-none font-bold text-[9px]">
                        NR-17
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      Levantamento e transporte manual de peso, postura estática prolongada e
                      repetitividade.
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Medida: Ginástica laboral, rodízio de funções e bancadas ajustáveis.
                    </span>
                  </div>
                </div>
              </Card>

              {/* PLANO DE AÇÃO 5W2H DA UNIDADE */}
              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-black uppercase text-primary flex items-center gap-2">
                    <ClipboardCheck className="text-primary" /> Plano de Ação 5W2H (Engenharia
                    Operacional)
                  </h4>
                  <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-black">
                    CRONOGRAMA ATIVO
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        1. Inspeção semestral de extintores e saídas de emergência (NR-23)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Responsável: Técnico de Segurança • Prazo: 30 dias • Status: Em conformidade
                      </p>
                    </div>
                    <Badge className="bg-emerald-500 text-white font-black text-[8px] uppercase">
                      Concluído
                    </Badge>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        2. Treinamento de reciclagem de Trabalho em Altura (NR-35) e CIPA (NR-05)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Responsável: Nextcon Academia NRs • Prazo: 60 dias • Status: Agendado
                      </p>
                    </div>
                    <Badge className="bg-amber-500 text-white font-black text-[8px] uppercase">
                      Agendado
                    </Badge>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        3. Renovação de fichas digitais de entrega e substituição de EPIs (NR-06)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Responsável: Gestão de Almoxarifado • Prazo: Contínuo • Status: Ativo
                      </p>
                    </div>
                    <Badge className="bg-blue-600 text-white font-black text-[8px] uppercase">
                      Ativo
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>

            {/* BARRA LATERAL DE AÇÕES RÁPIDAS DE ENGENHARIA */}
            <div className="space-y-4">
              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-gradient-to-br from-slate-900 to-primary text-white space-y-4">
                <h4 className="text-sm font-black uppercase tracking-wider text-accent flex items-center gap-2">
                  <Sparkles size={16} /> Ações Rápidas de Engenharia
                </h4>

                <div className="space-y-2">
                  <Button
                    onClick={() => router.push("/risk-management")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <HardHat size={16} className="text-accent" />
                    <span>Ver Inventário PGR Completo</span>
                  </Button>

                  <Button
                    onClick={() => router.push("/action-plans")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <ClipboardCheck size={16} className="text-accent" />
                    <span>Gerenciar Ações 5W2H</span>
                  </Button>

                  <Button
                    onClick={() => router.push("/reports")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <FileText size={16} className="text-accent" />
                    <span>Emitir Laudos & LTCAT (PDF)</span>
                  </Button>

                  <Button
                    onClick={() => router.push("/ppe-management")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <ShieldCheck size={16} className="text-accent" />
                    <span>Fichas de EPI Digital (NR-06)</span>
                  </Button>
                </div>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] text-slate-300">
                  <p className="font-bold text-white mb-0.5">Responsável Técnico</p>
                  <p>{company.responsible_name || "Eng. Felipe Coneglian - CREA/PR"}</p>
                </div>
              </Card>

              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-3">
                <h4 className="text-xs font-black uppercase text-primary">
                  NRs Mandatórias para este Cliente
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-bold">
                    NR-01 (GRO/PGR)
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    NR-05 (CIPA)
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    NR-06 (EPI)
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    NR-07 (PCMSO)
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    NR-09 (Agentes)
                  </Badge>
                  {isHighRisk && (
                    <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold">
                      NR-12 (Máquinas)
                    </Badge>
                  )}
                  {isConstruction && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                      NR-18 (Construção)
                    </Badge>
                  )}
                  {isHighRisk && (
                    <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold">
                      NR-35 (Altura)
                    </Badge>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================= ABA SAÚDE OCUPACIONAL ================= */}
        <TabsContent value="saude" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black font-headline uppercase text-primary flex items-center gap-2">
                      <Stethoscope className="text-emerald-600" /> Programa de Controle Médico
                      (PCMSO / NR-07)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Matriz de exames clínicos, complementares e vigilância epidemiológica do
                      trabalhador.
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-xs uppercase">
                    ASO DIGITAL VIGENTE
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Exames Admissionais
                    </span>
                    <p className="text-2xl font-black text-primary">100%</p>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase">
                      Realizados no Prazo
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Exames Periódicos
                    </span>
                    <p className="text-2xl font-black text-emerald-600">Em Dia</p>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">
                      Ciclo Anual 2026
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Afastamentos / NTEP
                    </span>
                    <p className="text-2xl font-black text-slate-700">0</p>
                    <span className="text-[9px] text-emerald-600 font-bold uppercase">
                      Zero Nexo Causal
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <h4 className="text-xs font-black uppercase text-primary">
                    Exames Complementares Exigidos para a Unidade
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Audiometria Tonal e Vocal</span>
                      <Badge variant="outline" className="text-[9px] font-black">
                        Ruído (NR-07)
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Espirometria Ocupacional</span>
                      <Badge variant="outline" className="text-[9px] font-black">
                        Poeiras / Vapores
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-slate-700">Acuidade Visual (Snellen)</span>
                      <Badge variant="outline" className="text-[9px] font-black">
                        Operadores / Altura
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        Eletrocardiograma (ECG) / EEG
                      </span>
                      <Badge variant="outline" className="text-[9px] font-black">
                        NR-35 / Espaço Confinado
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>

              {/* CONTROLE DE ABSENTEÍSMO & RETORNO */}
              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-black uppercase text-primary flex items-center gap-2">
                    <Activity className="text-emerald-600" /> Painel de Absenteísmo & Retorno ao
                    Trabalho (SLA D0)
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-bold text-emerald-700 bg-emerald-50"
                  >
                    Sem Afastamentos Críticos
                  </Badge>
                </div>
                <p className="text-xs text-slate-600">
                  Monitoramento contínuo de atestados médicos, vigilância epidemiológica e validação
                  de aptidão para retorno às atividades.
                </p>
              </Card>
            </div>

            {/* AÇÕES DE SAÚDE */}
            <div className="space-y-4">
              <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-gradient-to-br from-[#003366] to-slate-900 text-white space-y-4">
                <h4 className="text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                  <Stethoscope size={16} /> Central Médica do Cliente
                </h4>

                <div className="space-y-2">
                  <Button
                    onClick={() => router.push("/health-control")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <Stethoscope size={16} className="text-emerald-400" />
                    <span>Emissão de ASO Digital</span>
                  </Button>

                  <Button
                    onClick={() => router.push("/medical/health-management")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <Activity size={16} className="text-emerald-400" />
                    <span>Prontuário Médico (PEP)</span>
                  </Button>

                  <Button
                    onClick={() => router.push("/absenteeism")}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase h-11 rounded-xl justify-start gap-2 border border-white/10"
                  >
                    <TrendingDown size={16} className="text-emerald-400" />
                    <span>Sentinela de Absenteísmo & NTEP</span>
                  </Button>
                </div>

                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[10px] text-slate-300">
                  <p className="font-bold text-white mb-0.5">Médica Coordenadora PCMSO</p>
                  <p>Dra. Charyse Alice M. Otsuka (CRM-PR 27.268 • RQE 24559)</p>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================= ABA PRESTADORES ================= */}
        <TabsContent value="prestadores" className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black font-headline uppercase text-primary flex items-center gap-2">
                  <MapPin className="text-purple-600" /> Prestadores & Clínicas Credenciadas da
                  Unidade
                </h3>
                <p className="text-xs text-slate-500">
                  Rede de atendimento médico, laboratórios e engenharia vinculada à empresa{" "}
                  {company.name}.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
                <Input
                  placeholder="Filtrar por nome, especialidade..."
                  className="pl-10 h-10 bg-slate-50 rounded-xl text-xs"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 font-black text-xs shrink-0">
                        {provider.type === "CLINIC" ? (
                          <Building2 size={18} />
                        ) : provider.type === "DOCTOR" ? (
                          <Stethoscope size={18} />
                        ) : (
                          <HardHat size={18} />
                        )}
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 border-none font-bold text-[9px] uppercase">
                        {provider.type === "CLINIC"
                          ? "Clínica"
                          : provider.type === "DOCTOR"
                            ? "Médico"
                            : "Engenheiro"}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-black text-xs text-primary uppercase line-clamp-1">
                        {provider.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">
                        {provider.specialty}
                      </p>
                      {provider.councilNumber && (
                        <p className="text-[9px] text-slate-400 font-medium">
                          Registro: {provider.councilNumber}
                        </p>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      {provider.city && (
                        <p className="flex items-center gap-1 font-semibold text-slate-600">
                          <MapPin size={11} className="text-purple-600 shrink-0" /> {provider.city}{" "}
                          - {provider.state}
                        </p>
                      )}
                      {provider.address && (
                        <p className="text-slate-400 truncate">{provider.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                    {provider.phone ? (
                      <a
                        href={`https://wa.me/55${provider.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Entro em contato em nome da empresa ${company.name} através da plataforma Nextcon NAI para agendamento de exames/serviços de SST.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm transition-all"
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-semibold italic">
                        Sem telefone
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-[9px] font-bold uppercase rounded-xl"
                      onClick={() =>
                        handleCopy(provider.phone || provider.email || provider.name, provider.id)
                      }
                    >
                      {copiedContact === provider.id ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                </div>
              ))}

              {filteredProviders.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl">
                  <MapPin className="size-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-black uppercase text-slate-500">
                    Nenhum prestador encontrado com este filtro
                  </p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ================= ABA QUADRO DE VIDAS ================= */}
        <TabsContent value="colaboradores" className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black font-headline uppercase text-primary flex items-center gap-2">
                  <Users className="text-amber-600" /> Quadro de Vidas da Empresa (
                  {clientEmployees.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Colaboradores cadastrados e vinculados ao monitoramento de SST e eSocial desta
                  unidade.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar por nome ou cargo..."
                  className="pl-10 h-10 bg-slate-50 rounded-xl text-xs"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black text-xs shrink-0">
                      {employee.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-primary uppercase">{employee.name}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">
                        {employee.role} • {employee.department || "Operação"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge
                      className={cn(
                        "text-[8px] font-black uppercase px-2 h-5 border-none",
                        employee.asoStatus === "VALID"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      ASO {employee.asoStatus === "VALID" ? "VÁLIDO" : "PENDENTE"}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {employee.cpf ? `CPF: ${employee.cpf}` : "CPF não informado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ================= ABA ESOCIAL ================= */}
        <TabsContent value="esocial" className="space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-md p-6 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black font-headline uppercase text-primary flex items-center gap-2">
                  <ShieldCheck className="text-blue-600" /> Eventos de SST eSocial (Ambiente
                  Governamental)
                </h3>
                <p className="text-xs text-slate-500">
                  Transmissão e mensageria oficial dos eventos S-2210, S-2220 e S-2240 para o CNPJ{" "}
                  {company.cnpj}.
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-xs">
                CONECTIVIDADE ATIVA
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Evento S-2210
                </span>
                <h4 className="text-sm font-black text-primary">Comunicação de Acidente (CAT)</h4>
                <p className="text-[10px] text-slate-500">
                  Geração instantânea e protocolo automático de CATs em caso de incidentes.
                </p>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[8px] font-bold uppercase">
                  Zero Pendências
                </Badge>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Evento S-2220
                </span>
                <h4 className="text-sm font-black text-primary">Monitoramento da Saúde (ASO)</h4>
                <p className="text-[10px] text-slate-500">
                  Envio periódico de ASOs admissionais, periódicos e demissionais via WebService.
                </p>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] font-bold uppercase">
                  Lotes Transmitidos
                </Badge>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Evento S-2240
                </span>
                <h4 className="text-sm font-black text-primary">Condições Ambientais (PGR)</h4>
                <p className="text-[10px] text-slate-500">
                  Agentes nocivos e EPIs cadastrados com base no inventário de riscos da unidade.
                </p>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] font-bold uppercase">
                  Base Sincronizada
                </Badge>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end">
              <Button
                onClick={() => router.push("/esocial-audit")}
                className="rounded-xl font-bold uppercase text-xs gap-2"
              >
                <ShieldCheck size={16} /> Abrir Auditoria Fiscal eSocial
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
