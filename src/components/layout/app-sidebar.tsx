"use client";

import * as React from "react";
import {
  LogOut,
  BarChart3,
  ShieldCheck,
  Sparkles,
  DollarSign,
  ClipboardCheck,
  HardHat,
  Zap,
  CalendarDays,
  HeartPulse,
  Database,
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
  Compass,
  FileSpreadsheet,
  Calculator,
  Lock,
  Target,
  FileSearch,
  Settings,
  GraduationCap,
  Activity,
  History,
  Scan,
  TrendingDown,
  Cpu,
  Video,
  Terminal,
  Binary,
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
import { getActiveNavigationHref, normalizeNavigationSearch } from "@/lib/navigation";
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
  icon: any;
  href: string;
  badge?: string;
  badgeColor?: string;
  parentHref?: string;
}

interface NavModule {
  label: string;
  icon: any;
  items: NavItem[];
}

const NAV_MODULES: NavModule[] = [
  {
    label: "PAINEL EXECUTIVO",
    icon: Zap,
    items: [
      { title: "Grupo AVP · Mapa e fila", icon: MapPin, href: "/clients/grupo-avp" },
      { title: "Agendamento de ASO", icon: CalendarDays, href: "/aso-scheduler" },
      { title: "Agentes SST", icon: Bot, href: "/agentes-ia" },
      {
        title: "Dashboard Geral",
        icon: Zap,
        href: "/",
        badge: "Live",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
    ],
  },
  {
    label: "OPERACIONAL — SAÚDE",
    icon: HeartPulse,
    items: [
      {
        title: "Clínica (ASO Digital)",
        icon: Stethoscope,
        href: "/health-control",
        badge: "NR-07",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
      { title: "Prontuário Médico (PEP)", icon: HeartPulse, href: "/medical/health-management" },
      {
        title: "Atestados Médicos (CFM)",
        icon: FileText,
        href: "/medical-certificates",
        badge: "IA",
        badgeColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      },
      { title: "Operação CASSI BB", icon: Building2, href: "/clients/cassi" },
      { title: "Faturamento CASSI (TISS)", icon: FileSpreadsheet, href: "/cassi-billing" },
      { title: "Sentinela (NTEP)", icon: History, href: "/absenteeism" },
      { title: "Biomecânica", icon: Video, href: "/medical/biomechanics" },
    ],
  },
  {
    label: "OPERACIONAL — ENGENHARIA",
    icon: HardHat,
    items: [
      {
        title: "Inventário de Riscos (PGR)",
        icon: ClipboardCheck,
        href: "/risk-management",
        badge: "NR-01",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      },
      {
        title: "Auditoria PGR (Upload)",
        icon: HardHat,
        href: "/risk-management/pgr-analysis",
        badge: "Auto",
        badgeColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      },
      { title: "Centro de Operação (5W2H)", icon: LayoutGrid, href: "/action-plans" },
      { title: "Relatórios & Laudos SGI", icon: FileText, href: "/reports" },
      {
        title: "Entrega de EPI Digital",
        icon: HardHat,
        href: "/ppe-management",
        badge: "NR-06",
        badgeColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      },
      {
        title: "Ordens de Serviço (NR-01)",
        icon: LifeBuoy,
        href: "/work-orders",
        badge: "Construfam",
        badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      },
      { title: "Auditoria de NRs", icon: Gavel, href: "/governance/compliance-audit" },
    ],
  },
  {
    label: "DADOS MESTRE",
    icon: Database,
    items: [
      { title: "Financeiro", icon: BarChart3, href: "/financial" },
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
      {
        title: "Unidades & Clientes",
        icon: Globe,
        href: "/clients",
        badgeColor: "bg-white/10 text-slate-300 border-white/10",
      },
      { title: "Quadro de Vidas", icon: Users, href: "/employees" },
      { title: "Middleware ERPs (TOTVS)", icon: Network, href: "/integrations" },
      { title: "Ponto Eletrônico CLT", icon: Clock, href: "/time-tracking" },
      { title: "Colaboradores NXC", icon: UserCheck, href: "/nxc-team" },
      { title: "Prestadores", icon: Users, href: "/providers" },
      { title: "Rede Credenciada", icon: MapPin, href: "/accredited-network" },
      { title: "Academia NRs", icon: GraduationCap, href: "/trainings" },
    ],
  },
  {
    label: "INTELIGÊNCIA DE CAMPO",
    icon: Cpu,
    items: [
      {
        title: "Inspeção de Campo (Câmera)",
        icon: Camera,
        href: "/field-inspection",
        badge: "Foto",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
      {
        title: "WhatsApp Bot (3358-0818)",
        icon: Bot,
        href: "/whatsapp-hub",
        badge: "IA",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      },
      { title: "Data Lab (OCR Hub)", icon: Binary, href: "/data-lab" },
      { title: "Firewall Físico (Catraca)", icon: Scan, href: "/field-control" },
    ],
  },
  {
    label: "ESTRATÉGICO C-LEVEL",
    icon: Scale,
    items: [
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
    ],
  },
  {
    label: "GOVERNANÇA & IT",
    icon: Lock,
    items: [
      { title: "Canal de Ética", icon: ShieldAlert, href: "/compliance" },
      { title: "Segurança ISO 27001", icon: Lock, href: "/governance" },
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

  const isHealthProvider = isProvider && !isEngineeringProvider;

  const userName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Usuário";

  // Filtragem dos módulos de acordo com o texto digitado
  const filteredModules = React.useMemo(() => {
    const query = normalizeNavigationSearch(filterText);
    return NAV_MODULES.map((module) => {
      if (isEngineeringProvider && module.label !== "OPERACIONAL — ENGENHARIA") return null;
      if (isHealthProvider && module.label !== "OPERACIONAL — SAÚDE") return null;

      if (!query) return module;

      const matchedItems = module.items.filter(
        (item) =>
          normalizeNavigationSearch(item.title).includes(query) ||
          item.href.toLowerCase().includes(query) ||
          (item.badge && normalizeNavigationSearch(item.badge).includes(query))
      );

      if (matchedItems.length === 0 && !normalizeNavigationSearch(module.label).includes(query)) {
        return null;
      }

      return {
        ...module,
        items: matchedItems.length > 0 ? matchedItems : module.items,
      };
    }).filter(Boolean) as NavModule[];
  }, [filterText, isEngineeringProvider, isHealthProvider]);

  const activeHref = getActiveNavigationHref(
    pathname,
    NAV_MODULES.flatMap((module) => module.items.map((item) => item.href))
  );

  return (
    <Sidebar className="border-r border-sidebar-border bg-[#001F3F] text-white">
      <SidebarHeader className="p-5 md:p-6 pb-3 md:pb-4 flex flex-row items-center justify-between border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 md:gap-3.5 group">
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
              <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 rounded border border-amber-400/30">
                v4.2
              </span>
            </div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
              Intelligence SST
            </span>
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
            placeholder="Filtrar módulos..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all"
          />
          {filterText && (
            <button
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
          filteredModules.map((module) => {
            return (
              <SidebarGroup key={module.label} className="py-2">
                <SidebarGroupLabel className="text-slate-400/80 text-[9px] font-black uppercase tracking-[0.2em] mb-1.5 px-3 flex items-center justify-between">
                  <span>{module.label}</span>
                  <span className="text-[8px] opacity-40 font-mono">({module.items.length})</span>
                </SidebarGroupLabel>
                <SidebarMenu className="space-y-0.5">
                  {module.items.map((item) => {
                    const isActive = activeHref === item.href;
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "rounded-xl px-3 h-10 transition-all duration-200 group",
                            item.parentHref && "ml-4 w-[calc(100%-1rem)] border-l border-white/10",
                            isActive
                              ? "bg-gradient-to-r from-amber-400/20 to-transparent text-white font-black border-l-4 border-amber-400 shadow-md"
                              : "hover:bg-white/5 text-slate-300 hover:text-white opacity-85 hover:opacity-100"
                          )}
                        >
                          <Link
                            href={item.href}
                            className="flex items-center justify-between w-full"
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Icon
                                className={cn(
                                  "size-4 shrink-0 transition-colors",
                                  isActive
                                    ? "text-amber-400"
                                    : "text-slate-400 group-hover:text-slate-200"
                                )}
                              />
                              <span className="text-[11px] font-bold uppercase tracking-tight truncate">
                                {item.title}
                              </span>
                            </div>
                            {item.badge && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md border shrink-0",
                                  item.badgeColor || "bg-white/10 text-slate-300 border-white/10"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            );
          })
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
            className="p-2 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-xl transition-all shadow-sm"
            title="Encerrar Sessão"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
