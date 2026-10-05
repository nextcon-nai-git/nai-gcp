"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Search,
  Settings,
  ChevronDown,
  Building2,
  ShieldCheck,
  UserCircle,
  WifiOff,
  ShieldAlert,
  Menu,
  Sparkles,
  Command,
  Plus,
  Stethoscope,
  HardHat,
  FileText,
  LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useUser, useAuth, useMemoFirebase, useFirestore, useCollection, useDoc } from "@/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { collection, query, orderBy, where, doc, limit } from "firebase/firestore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlatformFeedback } from "@/components/feedback/platform-feedback";
import { OfflineSyncBadge } from "@/components/layout/offline-sync-badge";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES } from "@/lib/real-data";
import { useSidebar } from "@/components/ui/sidebar";
import { GlobalCommandPalette } from "@/components/layout/global-command-palette";

/**
 * TOPNAV v3.1 - GESTÃO MESTRE MULTI-TENANT & CLIENT SELECTION
 * Sincroniza em tempo real todas as unidades cadastradas (Base Mestra + Firestore + Local).
 */
export function TopNav() {
  const { user, role, companyId: userCompanyId } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const handleSignOut = async () => {
    if (!auth) return;
    try {
      const uid = user?.uid;
      await signOut(auth);
      if (uid) {
        try {
          localStorage.removeItem("nai_grupo_avp_asos_cache:" + uid);
        } catch {
          /* Session is already closed. */
        }
      }
      router.replace("/login");
      router.refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível encerrar a sessão",
        description: "Tente novamente.",
      });
    }
  };
  const db = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeClientId,
    setActiveClientId,
    isGlobalStaff,
    authorizedCompanies,
    isLoading: isSgiLoading,
  } = useSgi();
  const { toggleSidebar } = useSidebar();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [localCustomCompanies, setLocalCustomCompanies] = React.useState<any[]>([]);

  // Atalho de Teclado Global: Cmd + K / Ctrl + K para abrir o Command Palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sincronização reativa de empresas customizadas salvas localmente
  React.useEffect(() => {
    const loadLocalCompanies = () => {
      if (typeof window === "undefined") return;
      try {
        const rawCustom = localStorage.getItem("nai_custom_companies");
        const rawRegistered = localStorage.getItem("nai_registered_clients");
        const listCustom = rawCustom ? JSON.parse(rawCustom) : [];
        const listReg = rawRegistered ? JSON.parse(rawRegistered) : [];

        const map = new Map<string, any>();
        for (const item of [...listReg, ...listCustom]) {
          if (item?.id) map.set(item.id, item);
        }
        setLocalCustomCompanies(Array.from(map.values()));
      } catch (e) {
        console.warn("Aviso ao carregar empresas locais no TopNav:", e);
      }
    };

    loadLocalCompanies();
    window.addEventListener("nai_clients_updated", loadLocalCompanies);
    window.addEventListener("storage", loadLocalCompanies);
    return () => {
      window.removeEventListener("nai_clients_updated", loadLocalCompanies);
      window.removeEventListener("storage", loadLocalCompanies);
    };
  }, []);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const BRASAO_URL =
    "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/logo%2FBrasa%CC%83o%20Logo%20NXC%20Branco.png?alt=media&token=c47decf6-fa71-4f99-b4fe-0200d3159de7";

  const rawUserName =
    profile?.name || user?.displayName || user?.email?.split("@")[0] || "Usuário NAI";
  const userPhotoUrl = BRASAO_URL;

  const companiesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "companies"), orderBy("name", "asc"));
  }, [db]);

  const { data: rawCompanies } = useCollection(companiesQuery);

  // Consolidação completa: REAL_COMPANIES (25 base) + LocalStorage Custom + Firestore
  const filteredCompanies = React.useMemo(() => {
    const map = new Map<string, any>();

    // 1. Inserir todos os 25 clientes reais mestre da NextCon
    for (const comp of REAL_COMPANIES) {
      if (comp?.id) {
        map.set(comp.id, { ...comp });
      }
    }

    // 2. Inserir empresas cadastradas localmente pelo usuário
    for (const comp of localCustomCompanies) {
      if (!comp?.id) continue;
      const existing = map.get(comp.id) || {};
      map.set(comp.id, { ...existing, ...comp });
    }

    // 3. Inserir / sobrepor dados em tempo real vindos do Firestore
    if (rawCompanies && rawCompanies.length > 0) {
      for (const comp of rawCompanies) {
        if (!comp?.id) continue;
        const existing = map.get(comp.id) || {};
        map.set(comp.id, { ...existing, ...comp });
      }
    }

    let allList = Array.from(map.values());

    // Se o usuário tiver restrição de tenant (ex: prestador restrito)
    if (!isGlobalStaff && authorizedCompanies && authorizedCompanies.length > 0) {
      allList = allList.filter((c) => authorizedCompanies.includes(c.id));
    }

    // Ordenar alfabeticamente pelo nome exibido
    return allList.filter(Boolean).sort((a, b) => {
      const nameA = (a?.displayName || a?.name || a?.razaoSocial || a?.id || "").toUpperCase();
      const nameB = (b?.displayName || b?.name || b?.razaoSocial || b?.id || "").toUpperCase();
      return nameA.localeCompare(nameB);
    });
  }, [rawCompanies, localCustomCompanies, isGlobalStaff, authorizedCompanies]);

  const activeCompanyName = React.useMemo(() => {
    if (activeClientId === "all" || !activeClientId) return "Rede Global Nextcon";
    if (activeClientId === "unauthorized") return "Acesso Restrito";
    const found = filteredCompanies?.find((c) => c?.id === activeClientId);
    if (found) return found?.displayName || found?.name || found?.razaoSocial || found?.id;
    return "Rede Global Nextcon";
  }, [activeClientId, filteredCompanies]);

  const canSwitchCompany = true;

  const handleClientChange = (newClientId: string) => {
    setActiveClientId(newClientId);
    if (!newClientId || newClientId === "all") {
      router.push("/");
      return;
    }
    const lower = newClientId.toLowerCase();
    if (lower === "cassi_matriz" || lower.includes("cassi")) {
      router.push("/clients/cassi");
    } else if (lower === "grupo_avp" || lower.includes("grupo-avp") || lower.includes("avp")) {
      router.push("/clients/grupo-avp");
    } else {
      router.push(`/clients/${encodeURIComponent(newClientId)}`);
    }
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-3 md:px-6 sticky top-0 z-40 gap-2">
      {/* Botão de Menu Lateral (Hamburger no Mobile / Toggle no Desktop) + Breadcrumb */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSidebar()}
          className="size-9 rounded-xl hover:bg-slate-100 flex items-center justify-center border border-slate-200/80 shadow-sm transition-all"
          title="Menu Principal"
          aria-label="Abrir ou recolher Menu Lateral"
        >
          <Menu className="size-6 text-primary" />
        </Button>

        <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs font-medium">
          <span className="font-black uppercase tracking-widest text-[9px] text-primary/40">
            SGI
          </span>
          <span className="opacity-30">/</span>
          {!isOnline && (
            <Badge
              variant="destructive"
              className="bg-red-600 border-none font-black text-[8px] uppercase px-2 gap-1.5 h-6"
            >
              <WifiOff className="size-3" /> Offline
            </Badge>
          )}
          {isOnline && (
            <span className="text-slate-900 font-bold capitalize">
              {pathname === "/" ? "Dashboard" : pathname.split("/").pop()?.replace(/-/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Seletor de Unidades & Barra de Pesquisa Responsiva */}
      <div className="flex-1 max-w-xl mx-1 md:mx-4 flex items-center gap-2 md:gap-4 min-w-0">
        <div className="flex-1 sm:w-72 md:w-80 min-w-0 animate-in fade-in zoom-in-95">
          <Select value={activeClientId} onValueChange={handleClientChange} disabled={isSgiLoading}>
            <SelectTrigger className="h-10 bg-slate-50 border border-slate-200/70 rounded-xl font-black uppercase text-[9px] tracking-wider shadow-inner focus:ring-primary/10 flex items-center justify-between w-full">
              <div className="flex items-center gap-2 truncate">
                <Building2 className="size-3.5 text-primary/60 shrink-0" />
                <span className="truncate">{activeCompanyName}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 shadow-2xl max-h-96 overflow-y-auto w-80">
              <SelectItem
                value="all"
                className="text-[10px] font-black uppercase text-primary border-b border-slate-100 py-2.5 cursor-pointer"
              >
                🌐 Rede Global (Filtro Zero)
              </SelectItem>
              {filteredCompanies.filter(Boolean).map((c) => {
                const label = c?.displayName || c?.name || c?.razaoSocial || c?.id || "Empresa";
                return (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className="text-[9px] font-bold uppercase py-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="truncate">{label}</span>
                      {c.city && (
                        <span className="text-[8px] font-medium text-slate-400 lowercase shrink-0">
                          ({c.city}/{c.state || "BR"})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Barra de Pesquisa Rápida / Command Palette Trigger (Cmd+K) */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="relative group flex-1 hidden md:flex items-center justify-between h-10 px-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl transition-all cursor-pointer text-left shadow-inner"
          title="Abrir busca global e comandos rápidos (⌘K)"
        >
          <div className="flex items-center gap-2.5 text-slate-400 group-hover:text-primary transition-colors min-w-0">
            <Search className="size-4 shrink-0 text-slate-400 group-hover:text-primary" />
            <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 truncate">
              Buscar ações, clientes, documentos (ASO, PGR)...
            </span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400 group-hover:text-primary bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs shrink-0">
            <Command className="size-2.5 mr-0.5" /> K
          </kbd>
        </button>

        {/* Botão de Ação Rápida: Novo Documento */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 bg-[#001F3F] hover:bg-slate-900 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider shadow-sm transition-all hover:scale-[1.02]"
            >
              <Plus className="size-3.5 text-amber-400" />
              <span>Novo</span>
              <ChevronDown className="size-3 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 rounded-2xl p-2 shadow-2xl border-slate-200 bg-white"
          >
            <div className="px-3 py-2 border-b mb-1">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Ações de Importação & SST
              </p>
            </div>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl"
              onClick={() => router.push("/health-control")}
            >
              <Stethoscope className="size-4 text-emerald-600" /> Ingestão de ASO (NR-07)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl"
              onClick={() => router.push("/risk-management/pgr-analysis")}
            >
              <HardHat className="size-4 text-amber-500" /> Importar PGR (NR-01)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl"
              onClick={() => router.push("/reports")}
            >
              <FileText className="size-4 text-blue-600" /> Triagem PCMSO / LTCAT
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl"
              onClick={() => router.push("/medical-certificates")}
            >
              <ShieldCheck className="size-4 text-purple-600" /> Atestados Médicos (CFM)
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl"
              onClick={() => router.push("/work-orders")}
            >
              <LifeBuoy className="size-4 text-cyan-600" /> Ordem de Serviço (NR-01)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl text-primary font-black"
              onClick={() => setCommandOpen(true)}
            >
              <Command className="size-4" /> Ver Todas as Ações (⌘K)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
        {isGlobalStaff && (
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-primary rounded-xl"
            asChild
          >
            <Link href="/audit-setup" title="Auditoria do Motor">
              <ShieldAlert className="size-5" />
            </Link>
          </Button>
        )}

        <OfflineSyncBadge />
        <PlatformFeedback />

        {/* Mensagem de Boas-vindas + Avatar Foto no Canto Superior Direito */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-100">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">
              Bem-vindo(a),
            </span>
            <span className="text-xs font-black text-primary uppercase tracking-tight mt-0.5 truncate max-w-[180px]">
              {rawUserName}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="hover:bg-slate-50 gap-2 p-1.5 h-11 rounded-2xl transition-all border border-slate-100 shadow-sm"
              >
                <div className="relative size-8 rounded-xl overflow-hidden bg-[#001F3F] text-white flex items-center justify-center font-black text-xs uppercase shadow-sm shrink-0 border border-primary/10">
                  {userPhotoUrl ? (
                    <Image
                      src={userPhotoUrl}
                      alt={rawUserName}
                      fill
                      className="object-contain p-1"
                      sizes="32px"
                      unoptimized
                    />
                  ) : (
                    <span>{rawUserName.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <ChevronDown className="size-3.5 text-slate-400 mr-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 mt-2 rounded-2xl border-none shadow-2xl p-2"
            >
              <div className="px-3 py-2 border-b mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Sessão Ativa
                </p>
                <p className="text-xs font-black uppercase text-primary truncate mt-0.5">
                  {rawUserName}
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  {user?.email}
                </p>
              </div>
              <DropdownMenuItem
                className="gap-3 py-2.5 text-xs font-bold uppercase cursor-pointer rounded-xl"
                onClick={() => router.push("/settings")}
              >
                <Settings className="size-4 opacity-50" /> Perfil & Config
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 font-black uppercase text-[10px] py-2.5 cursor-pointer rounded-xl"
                onClick={handleSignOut}
              >
                Encerrar Sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modal de Busca Global e Ações Rápidas (Cmd+K) */}
      <GlobalCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
