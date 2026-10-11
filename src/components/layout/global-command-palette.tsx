"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Building2,
  HardHat,
  Stethoscope,
  ShieldCheck,
  FileText,
  Users,
  MapPin,
  TrendingDown,
  ArrowRight,
  Command,
  Bot,
  Upload,
  Clock,
  Zap,
  CheckCircle2,
  Calendar,
  LifeBuoy,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES } from "@/lib/real-data";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "actions" | "companies" | "modules";
  icon: any;
  href?: string;
  action?: () => void;
  badge?: string;
}

export function GlobalCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { setActiveClientId } = useSgi();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Ações Rápidas (1-Clique)
  const quickActions: CommandItem[] = [
    {
      id: "action-aso",
      title: "Ingestão e Auditoria de ASO Digital",
      subtitle: "Importar ASO, auditar NR-07 e exames complementares",
      category: "actions",
      icon: Stethoscope,
      href: "/health-control",
      badge: "NR-07",
    },
    {
      id: "action-nai-importa",
      title: "NAI importa",
      subtitle: "PGR, PCMSO, ASO, perícias, AEP e AET: agentes, cadastros, cards e checklists",
      category: "actions",
      icon: Upload,
      href: "/nai-importa",
      badge: "IA",
    },
    {
      id: "action-credenciamento",
      title: "Credenciamento Brasil (WhatsApp 1-Clique)",
      subtitle: "117+ clínicas ocupacionais e disparo automático de proposta",
      category: "actions",
      icon: Zap,
      href: "/clients/grupo-avp",
      badge: "1-Clique",
    },
    {
      id: "action-esocial",
      title: "Superauditoria eSocial (S-2210 / S-2220 / S-2240)",
      subtitle: "Conformidade fiscal, lote de eventos e validação XML",
      category: "actions",
      icon: ShieldCheck,
      href: "/esocial/audit",
      badge: "eSocial",
    },
    {
      id: "action-reports",
      title: "Triagem e Protocolo de Relatórios SGI",
      subtitle: "Classificação automática de PCMSO, LTCAT, laudos e APRs",
      category: "actions",
      icon: FileText,
      href: "/reports",
      badge: "IA",
    },
    {
      id: "action-atestados",
      title: "Validador Forense de Atestados Médicos",
      subtitle: "Detecção de fraudes, validação de CRM e CID-10",
      category: "actions",
      icon: FileText,
      href: "/medical-certificates",
      badge: "CFM",
    },
    {
      id: "action-epi",
      title: "Entrega de EPI Digital e Biometria",
      subtitle: "Gestão de CA, fichas de EPI e conformidade NR-06",
      category: "actions",
      icon: HardHat,
      href: "/ppe-management",
      badge: "NR-06",
    },
    {
      id: "action-fap",
      title: "Simulador de Economia FAP / RAT",
      subtitle: "Cálculo de alíquota previdenciária e redução de custos",
      category: "actions",
      icon: TrendingDown,
      href: "/simulator",
      badge: "C-Level",
    },
    {
      id: "action-os-nr01",
      title: "Ordem de Serviço NR-01 (Construfam / Trabalho Embarcado)",
      subtitle: "Geração de PDF oficial, salvatagem e diretrizes de trabalho embarcado",
      category: "actions",
      icon: LifeBuoy,
      href: "/work-orders",
      badge: "PDF / NR-01",
    },
  ];

  // Empresas Cadastradas (Base Mestre)
  const companyItems: CommandItem[] = REAL_COMPANIES.slice(0, 15).map((comp) => ({
    id: `comp-${comp.id}`,
    title: ("displayName" in comp ? comp.displayName : "") || comp.name,
    subtitle: `${comp.city ? `${comp.city} - ${comp.state || "BR"}` : "Unidade Operacional"} • CNPJ: ${comp.cnpj || "Cadastrado"}`,
    category: "companies",
    icon: Building2,
    badge: comp.segment || "Cliente",
    action: () => {
      setActiveClientId(comp.id);
      if (comp.id === "grupo_avp") {
        router.push("/clients/grupo-avp");
      } else if (comp.id === "cassi_matriz" || comp.id.includes("cassi")) {
        router.push("/clients/cassi");
      } else {
        router.push(`/clients/${encodeURIComponent(comp.id)}`);
      }
    },
  }));

  // Módulos do Sistema
  const moduleItems: CommandItem[] = [
    {
      id: "mod-dashboard",
      title: "Painel Executivo Dashboard",
      subtitle: "Métricas globais, KPIs SST e status eSocial",
      category: "modules",
      icon: Zap,
      href: "/",
    },
    {
      id: "mod-clients",
      title: "Unidades & Clientes",
      subtitle: "Gestão de empresas, filiais e estabelecimentos",
      category: "modules",
      icon: Building2,
      href: "/clients",
    },
    {
      id: "mod-employees",
      title: "Quadro de Vidas (Colaboradores)",
      subtitle: "Gestão cadastral, exames ocupacionais e ASOs",
      category: "modules",
      icon: Users,
      href: "/employees",
    },
    {
      id: "mod-risk",
      title: "Inventário de Riscos Ocupacionais",
      subtitle: "Matriz de riscos, perigos e planos 5W2H",
      category: "modules",
      icon: HardHat,
      href: "/risk-management",
    },
    {
      id: "mod-action-plans",
      title: "Centro de Operações (Kanban 5W2H)",
      subtitle: "Tarefas, planos preventivos e ações corretivas",
      category: "modules",
      icon: CheckCircle2,
      href: "/action-plans",
    },
    {
      id: "mod-providers",
      title: "Buscador Nacional de Clínicas",
      subtitle: "Rede credenciada em mais de 100 municípios",
      category: "modules",
      icon: MapPin,
      href: "/providers",
    },
    {
      id: "mod-whatsapp",
      title: "WhatsApp Bot de Atendimento",
      subtitle: "Canal inteligente para colaboradores e agendamentos",
      category: "modules",
      icon: Bot,
      href: "/whatsapp-hub",
      badge: "Bot",
    },
    {
      id: "mod-cassi",
      title: "Operação CASSI (Banco do Brasil)",
      subtitle: "Atendimento especializado e faturamento TISS",
      category: "modules",
      icon: Building2,
      href: "/clients/cassi",
    },
    {
      id: "mod-integrations",
      title: "Middleware ERPs (TOTVS / SAP / Senior)",
      subtitle: "Integração via Webhooks e API REST",
      category: "modules",
      icon: Zap,
      href: "/integrations",
    },
  ];

  // Filtro inteligente
  const allItems = [...quickActions, ...companyItems, ...moduleItems];

  const filteredItems = React.useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [query, allItems]);

  // Reset selected index on query change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeItem = (item: CommandItem) => {
    onOpenChange(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  // Teclado (Up, Down, Enter, Esc)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          executeItem(selected);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredItems, selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] border-slate-200/80 shadow-2xl bg-white/95 backdrop-blur-2xl">
        <DialogTitle className="sr-only">Busca Global e Ações Rápidas NAI</DialogTitle>

        {/* Input de Busca */}
        <div className="flex items-center px-6 py-4 border-b border-slate-100 gap-3">
          <Search className="size-5 text-primary/60 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="O que você deseja fazer ou acessar? (ex: ASO, PGR, Grupo AVP, eSocial)..."
            className="w-full bg-transparent text-sm md:text-base font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 px-2 py-1 rounded-md bg-slate-100"
            >
              Limpar
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase text-slate-400 bg-slate-100 rounded-md border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4 scrollbar-thin">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Command className="size-8 mx-auto opacity-30" />
              <p className="text-sm font-semibold">
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs">Tente buscar por ASO, PGR, Empresa, eSocial ou Relatórios.</p>
            </div>
          ) : (
            <>
              {/* Grupo: Ações Rápidas */}
              {filteredItems.some((i) => i.category === "actions") && (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="size-3 text-amber-500" /> Ações Rápidas & Importação
                  </p>
                  {filteredItems
                    .filter((i) => i.category === "actions")
                    .map((item) => {
                      const idx = filteredItems.indexOf(item);
                      const isSelected = idx === selectedIndex;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => executeItem(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group",
                            isSelected
                              ? "bg-[#001F3F] text-white shadow-md translate-x-1"
                              : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-white/10 text-white"
                                  : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary"
                              )}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-black uppercase tracking-tight truncate",
                                  isSelected ? "text-white" : "text-slate-900"
                                )}
                              >
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p
                                  className={cn(
                                    "text-[10px] truncate",
                                    isSelected ? "text-slate-300" : "text-slate-400"
                                  )}
                                >
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                  isSelected
                                    ? "bg-white/20 text-white border-white/20"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                            <ArrowRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isSelected
                                  ? "text-white translate-x-1"
                                  : "text-slate-300 opacity-0 group-hover:opacity-100"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Grupo: Empresas & Unidades */}
              {filteredItems.some((i) => i.category === "companies") && (
                <div className="space-y-1 pt-2">
                  <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 flex items-center gap-1.5">
                    <Building2 className="size-3 text-primary" /> Unidades & Clientes Conectados
                  </p>
                  {filteredItems
                    .filter((i) => i.category === "companies")
                    .map((item) => {
                      const idx = filteredItems.indexOf(item);
                      const isSelected = idx === selectedIndex;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => executeItem(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group",
                            isSelected
                              ? "bg-[#001F3F] text-white shadow-md translate-x-1"
                              : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-white/10 text-white"
                                  : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary"
                              )}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-black uppercase tracking-tight truncate",
                                  isSelected ? "text-white" : "text-slate-900"
                                )}
                              >
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p
                                  className={cn(
                                    "text-[10px] truncate",
                                    isSelected ? "text-slate-300" : "text-slate-400"
                                  )}
                                >
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                  isSelected
                                    ? "bg-white/20 text-white border-white/20"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                            <ArrowRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isSelected
                                  ? "text-white translate-x-1"
                                  : "text-slate-300 opacity-0 group-hover:opacity-100"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Grupo: Módulos do Sistema */}
              {filteredItems.some((i) => i.category === "modules") && (
                <div className="space-y-1 pt-2">
                  <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 flex items-center gap-1.5">
                    <Command className="size-3 text-slate-500" /> Módulos da Plataforma
                  </p>
                  {filteredItems
                    .filter((i) => i.category === "modules")
                    .map((item) => {
                      const idx = filteredItems.indexOf(item);
                      const isSelected = idx === selectedIndex;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => executeItem(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group",
                            isSelected
                              ? "bg-[#001F3F] text-white shadow-md translate-x-1"
                              : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-white/10 text-white"
                                  : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary"
                              )}
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-black uppercase tracking-tight truncate",
                                  isSelected ? "text-white" : "text-slate-900"
                                )}
                              >
                                {item.title}
                              </p>
                              {item.subtitle && (
                                <p
                                  className={cn(
                                    "text-[10px] truncate",
                                    isSelected ? "text-slate-300" : "text-slate-400"
                                  )}
                                >
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                  isSelected
                                    ? "bg-white/20 text-white border-white/20"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                            <ArrowRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isSelected
                                  ? "text-white translate-x-1"
                                  : "text-slate-300 opacity-0 group-hover:opacity-100"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé com Dicas de Navegação */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-50/80 border-t border-slate-100 text-[10px] text-slate-400 font-semibold">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold">
                ↓
              </kbd>
              Navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold">
                ↵
              </kbd>
              Acessar
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-primary/70 font-bold">
            <Zap className="size-3 text-amber-500 fill-amber-500" /> NAI Quick Command
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
