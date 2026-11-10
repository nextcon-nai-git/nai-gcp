"use client";

import * as React from "react";
import {
  type LucideIcon,
  LogOut,
  ChevronRight,
  BarChart3,
  ShieldCheck,
  DollarSign,
  ClipboardCheck,
  HardHat,
  Zap,
  HeartPulse,
  ShoppingCart,
  Stethoscope,
  Users,
  Globe,
  LayoutGrid,
  FileText,
  MapPin,
  Scale,
  ShieldAlert,
  Bot,
  FileSpreadsheet,
  Lock,
  FileSearch,
  GraduationCap,
  History,
  TrendingDown,
  Video,
  Gavel,
  UserCheck,
  Clock,
  Network,
  Camera,
  Building2,
  Search,
  X,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  getActiveNavigationHref,
  matchesNavigationTask,
  normalizeNavigationSearch,
} from "@/lib/navigation";
import { usePathname, useRouter } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

const BRASAO_URL =
  "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/logo%2FBrasa%CC%83o%20Logo%20NXC%20Branco.png?alt=media&token=c47decf6-fa71-4f99-b4fe-0200d3159de7";

interface NavItem {
  title: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
  badgeColor?: string;
  parentHref?: string;
  providerAudience?: "health" | "engineering" | "all";
}

interface NavModule {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const NAV_CATALOG: NavModule[] = [
  {
    label: "Dashboard Executivo",
    icon: Zap,
    items: [
      {
        title: "Dashboard Executivo",
        icon: Zap,
        href: "/",
        badge: "Live",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
      {
        title: "Superauditoria eSocial",
        icon: ShieldAlert,
        href: "/esocial/audit",
        badge: "S-2240",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      },
      { title: "Contestação FAP/NTEP", icon: Scale, href: "/legal-financial/ntep-contestation" },
      {
        title: "Simulador FAP/RAT",
        icon: TrendingDown,
        href: "/simulator",
        badge: "ROI",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
      { title: "Hub ISO (Auditorias)", icon: ShieldCheck, href: "/audits" },
      { title: "Inteligência Fiscal", icon: BarChart3, href: "/esocial-audit" },
      { title: "ROI Jurídico", icon: Scale, href: "/legal-financial" },
      { title: "Canal de Ética", icon: ShieldAlert, href: "/compliance" },
      { title: "Segurança ISO 27001", icon: Lock, href: "/governance" },
    ],
  },
  {
    label: "Comercial",
    icon: ShoppingCart,
    items: [
      { title: "Central do Cliente", icon: LifeBuoy, href: "/client-center", badge: "Novo" },
      { title: "RD Conversas · Tallos", icon: Network, href: "/integrations/rd-conversas" },
      { title: "Central de Contratos e Produção", icon: ClipboardCheck, href: "/production" },
      {
        title: "Unidades & Clientes",
        icon: Globe,
        href: "/clients",
        badgeColor: "bg-white/10 text-slate-300 border-white/10",
      },
    ],
  },
  {
    label: "Operacional",
    icon: HardHat,
    items: [
      {
        title: "Homologação de fornecedores",
        icon: ClipboardCheck,
        href: "/suppliers/qualification",
        providerAudience: "all",
      },
      { title: "NAI importa", icon: FileSearch, href: "/nai-importa", badge: "IA" },
      { title: "Assistente NAI · Clínicas e kits", icon: Bot, href: "/assistente", badge: "IA" },
      { title: "Grupo AVP · Mapa e fila", icon: MapPin, href: "/clients/grupo-avp" },
      { title: "Agentes SST", icon: Bot, href: "/agentes-ia" },
      {
        title: "ASO — Agendamento e Clínica",
        icon: Stethoscope,
        href: "/health-control",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        providerAudience: "health",
      },
      {
        title: "Prontuário Médico (PEP)",
        icon: HeartPulse,
        href: "/medical/health-management",
        providerAudience: "health",
      },
      {
        title: "Atestados Médicos (CFM)",
        icon: FileText,
        href: "/medical-certificates",
        badge: "IA",
        badgeColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
        providerAudience: "health",
      },
      {
        title: "Operação CASSI BB",
        icon: Building2,
        href: "/clients/cassi",
        providerAudience: "health",
      },
      {
        title: "Sentinela (NTEP)",
        icon: History,
        href: "/absenteeism",
        providerAudience: "health",
      },
      {
        title: "Biomecânica",
        icon: Video,
        href: "/medical/biomechanics",
        providerAudience: "health",
      },
      {
        title: "Inventário de Riscos (PGR)",
        icon: ClipboardCheck,
        href: "/risk-management",
        badge: "NR-01",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        providerAudience: "engineering",
      },
      {
        title: "Importações de documentos",
        icon: HardHat,
        href: "/risk-management/pgr-analysis",
        badge: "Auto",
        badgeColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
        providerAudience: "engineering",
      },
      {
        title: "Centro de Operação (5W2H)",
        icon: LayoutGrid,
        href: "/action-plans",
        providerAudience: "engineering",
      },
      {
        title: "Relatórios & Laudos SGI",
        icon: FileText,
        href: "/reports",
        providerAudience: "engineering",
      },
      {
        title: "Entrega de EPI Digital",
        icon: HardHat,
        href: "/ppe-management",
        badge: "NR-06",
        badgeColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
        providerAudience: "engineering",
      },
      {
        title: "Ordens de Serviço (NR-01)",
        icon: LifeBuoy,
        href: "/work-orders",
        providerAudience: "engineering",
      },
      {
        title: "Auditoria de NRs",
        icon: Gavel,
        href: "/governance/compliance-audit",
        providerAudience: "engineering",
      },
      { title: "Quadro de Vidas", icon: Users, href: "/employees" },
      { title: "Middleware ERPs (TOTVS)", icon: Network, href: "/integrations" },
      {
        title: "Painel SOC",
        icon: ClipboardCheck,
        href: "/integrations/soc",
        parentHref: "/integrations",
      },
      { title: "Ponto Eletrônico CLT", icon: Clock, href: "/time-tracking" },
      { title: "Colaboradores NXC", icon: UserCheck, href: "/nxc-team" },
      { title: "Prestadores", icon: Users, href: "/providers" },
      { title: "Rede Credenciada", icon: MapPin, href: "/accredited-network" },
      { title: "Academia NRs", icon: GraduationCap, href: "/trainings" },
      {
        title: "Inspeção de Campo (Câmera)",
        icon: Camera,
        href: "/field-inspection",
        badge: "Foto",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
    ],
  },
  {
    label: "Faturamento",
    icon: DollarSign,
    items: [
      {
        title: "Faturamento CASSI (TISS)",
        icon: FileSpreadsheet,
        href: "/cassi-billing",
        providerAudience: "health",
      },
      { title: "Financeiro", icon: BarChart3, href: "/financial" },
      { title: "Notas fiscais", icon: FileText, href: "/financial/notas-fiscais" },
      { title: "Conectores Omie", icon: BarChart3, href: "/financial/omie/conectores" },
      { title: "ERP financeiro", icon: BarChart3, href: "/financial/operacoes" },
      {
        title: "Ações financeiras",
        icon: ClipboardCheck,
        href: "/financial/actions",
        parentHref: "/financial",
      },
      {
        title: "DRE pelo Omie",
        icon: BarChart3,
        href: "/financial/omie/dre",
        parentHref: "/financial",
      },
      {
        title: "Balanço 2025",
        icon: FileSpreadsheet,
        href: "/financial/balanco",
        parentHref: "/financial",
        badge: "Contábil",
      },
      {
        title: "Livro Diário",
        icon: FileSpreadsheet,
        href: "/financial/livro-diario",
        parentHref: "/financial",
        badge: "Contábil",
      },
    ],
  },
];

const itemsByHref = new Map(
  NAV_CATALOG.flatMap((section) => section.items).map((item) => [item.href, item])
);
const additions: NavItem[] = [
  { title: "Propostas", href: "/comercial", icon: ShoppingCart },
  { title: "CRM comercial", href: "/crm", icon: Users },
  { title: "Contratos", href: "/contracts", icon: FileText },
  { title: "Faturamento e recebimentos", href: "/financial/faturamento", icon: DollarSign },
  {
    title: "Faturamento mensal por grupo",
    href: "/financial/monthly-billing",
    icon: FileSpreadsheet,
  },
  { title: "Mensageria eSocial", href: "/esocial/messaging", icon: ShieldCheck },
];
additions.forEach((item) => itemsByHref.set(item.href, item));
function group(title: string, hrefs: string[]) {
  return {
    title,
    items: hrefs.map((href) => {
      const item = itemsByHref.get(href);
      if (!item) throw new Error("Destino ausente no catálogo de navegação: " + href);
      return item;
    }),
  };
}
const areas = [
  {
    label: "Comercial",
    groups: [
      group("Vendas e contratos", ["/comercial", "/crm", "/contracts", "/production"]),
      group("Clientes e atendimento", ["/clients", "/client-center", "/integrations/rd-conversas"]),
    ],
  },
  {
    label: "Operacional",
    groups: [
      group("ASOs e clínicas", [
        "/health-control",
        "/clients/grupo-avp",
        "/accredited-network",
        "/providers",
        "/suppliers/qualification",
        "/medical/health-management",
        "/medical-certificates",
        "/clients/cassi",
        "/absenteeism",
        "/medical/biomechanics",
      ]),
      group("Documentos e segurança", [
        "/nai-importa",
        "/reports",
        "/risk-management",
        "/risk-management/pgr-analysis",
        "/action-plans",
        "/ppe-management",
        "/work-orders",
        "/governance/compliance-audit",
        "/trainings",
        "/field-inspection",
        "/audits",
      ]),
      group("Equipe e sistemas", [
        "/assistente",
        "/agentes-ia",
        "/employees",
        "/nxc-team",
        "/time-tracking",
        "/integrations/soc",
        "/integrations",
      ]),
      group("eSocial e governança", [
        "/esocial/messaging",
        "/esocial/audit",
        "/esocial-audit",
        "/legal-financial",
        "/legal-financial/ntep-contestation",
        "/simulator",
        "/compliance",
        "/governance",
      ]),
    ],
  },
  {
    label: "Faturamento",
    groups: [
      group("Cobrança e notas", [
        "/financial/faturamento",
        "/financial/monthly-billing",
        "/financial/notas-fiscais",
        "/cassi-billing",
      ]),
      group("Financeiro e Omie", [
        "/financial",
        "/financial/operacoes",
        "/financial/actions",
        "/financial/omie/conectores",
      ]),
      group("Contabilidade", [
        "/financial/omie/dre",
        "/financial/balanco",
        "/financial/livro-diario",
      ]),
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();
  const [filterText, setFilterText] = React.useState("");

  // Auto-fechar o menu lateral móvel ao navegar
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);

  const handleLogout = async () => {
    if (isMobile) setOpenMobile(false);
    await signOut(auth);
    if (user?.uid) {
      try {
        localStorage.removeItem("nai_grupo_avp_asos_cache:" + user.uid);
      } catch {
        /* Sessão encerrada. */
      }
    }
    router.replace("/login");
    router.refresh();
  };

  const role = (profile?.role || "USER").toUpperCase();
  const isProvider = role === "PROVIDER";

  // Identificação do tipo de prestador (Engenharia/TST vs Saúde Ocupacional)
  const pType = (profile?.type || profile?.providerType || "").toUpperCase();
  const specialtyValue = profile?.specialty || profile?.profession || profile?.job_role;
  const pSpecialty = (
    typeof specialtyValue === "string" ? specialtyValue : specialtyValue?.title || ""
  ).toUpperCase();

  const isEngineeringProvider =
    isProvider &&
    (pType.includes("ENGINEER") ||
      pSpecialty.includes("SEGURANÇA") ||
      pSpecialty.includes("ENGENHARIA") ||
      pSpecialty.includes("TST") ||
      pSpecialty.includes("TÉCNICO"));

  const userName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Usuário";

  const query = normalizeNavigationSearch(filterText);
  const filteredModules = areas
    .map((area) => ({
      ...area,
      groups: area.groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (
              isProvider &&
              /^\/(financial|cassi-billing|contracts|production|comercial|crm)(\/|$)/.test(
                item.href
              )
            )
              return false;
            if (
              isProvider &&
              item.providerAudience !== "all" &&
              item.providerAudience !== (isEngineeringProvider ? "engineering" : "health")
            )
              return false;
            return (
              !query ||
              matchesNavigationTask(
                query,
                [area.label, group.title, item.title, item.href, item.badge]
                  .filter(Boolean)
                  .join(" "),
                item.href
              )
            );
          }),
        }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((area) => area.groups.length > 0);
  const activeHref = getActiveNavigationHref(pathname, [...itemsByHref.keys()]);
  return (
    <Sidebar className="border-r border-sidebar-border bg-[#001F3F] text-white">
      <SidebarHeader className="p-5 md:p-6 pb-3 md:pb-4 flex flex-row items-center justify-between border-b border-white/5">
        <Link
          href="/"
          aria-label="NAI · Painel inicial"
          className="flex items-center gap-3 md:gap-3.5 group"
        >
          <div className="relative size-10 md:size-11 shrink-0 p-1 bg-white/5 rounded-2xl border border-white/10 group-hover:border-amber-400/50 transition-all shadow-md">
            <Image
              src={BRASAO_URL}
              alt="Nextcon"
              fill
              className="object-contain p-1"
              priority
              sizes="44px"
            />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none text-white">
                NAI
              </span>
            </div>
          </div>
        </Link>
        {isMobile && (
          <button
            onClick={() => setOpenMobile(false)}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            aria-label="Fechar Menu"
          >
            <X className="size-5" />
          </button>
        )}
      </SidebarHeader>

      {/* Campo de Filtro Rápido de Módulos */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar uma tarefa…"
            aria-label="Buscar uma tarefa no menu"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400/50 focus:bg-white/10 transition-all"
          />
          {filterText && (
            <button
              aria-label="Limpar busca"
              onClick={() => setFilterText("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <SidebarContent className="px-3 space-y-2">
        {filteredModules.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs px-4">
            Nenhum módulo encontrado para &ldquo;{filterText}&rdquo;
          </div>
        ) : (
          filteredModules.map((area) => (
            <SidebarGroup key={area.label} className="py-2">
              <SidebarGroupLabel className="px-3 text-xs font-semibold text-slate-300">
                {area.label}
              </SidebarGroupLabel>
              {area.groups.map((group) => (
                <details
                  key={group.title + pathname + Boolean(query)}
                  open={Boolean(query) || group.items.some((i) => i.href === activeHref)}
                  className="group/nav"
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium text-slate-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-amber-400">
                    {group.title}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 transition-transform group-open/nav:rotate-90"
                    />
                  </summary>
                  <SidebarMenu className="mb-2 border-l border-white/15 ml-3 pl-2">
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeHref === item.href}
                          className={cn(
                            "h-auto min-h-10 rounded-lg text-sm",
                            activeHref === item.href
                              ? "bg-white/10 text-amber-300"
                              : "text-slate-300 hover:bg-white/10"
                          )}
                        >
                          <Link
                            href={item.href}
                            aria-current={activeHref === item.href ? "page" : undefined}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <item.icon aria-hidden="true" className="size-4 shrink-0" />
                            <span className="whitespace-normal">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </details>
              ))}
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10">
          <div className="size-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs uppercase shadow-md shrink-0">
            {userName.substring(0, 2)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-black truncate uppercase tracking-tight text-white">
              {userName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                {role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-xl transition-all shadow-xs"
            title="Encerrar Sessão"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
