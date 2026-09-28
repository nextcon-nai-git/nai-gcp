
"use client"

import * as React from "react"
import { 
  CheckSquare, 
  LogOut,
  BarChart3,
  SearchCheck,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  DollarSign,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  HeartPulse,
  Database,
  ShoppingCart,
  Gavel,
  Video,
  HardHat,
  Zap,
  CalendarDays,
  Stethoscope
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

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
} from "@/components/ui/sidebar"
import { useAuth, useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase"
import { signOut } from "firebase/auth"
import { doc } from "firebase/firestore"

const NAV_MODULES = [
  {
    label: "TIME NEXTCON (ESTRATÉGICO)",
    icon: ShieldCheck,
    isRestricted: true,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    items: [
      { title: "Cérebro NAI", icon: Zap, href: "/" },
      { title: "BI & Analytics", icon: BarChart3, href: "/analytics" },
      { title: "Firewall e-Social", icon: SearchCheck, href: "/esocial-audit" },
      { title: "Assistente NAI", icon: Sparkles, href: "/knowledge-base" },
    ]
  },
  {
    label: "TIME NEXTCON (COMERCIAL)",
    icon: DollarSign,
    isRestricted: true,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    items: [
      { title: "Gerador de Propostas", icon: ShoppingCart, href: "/comercial" },
      { title: "ERP Financeiro", icon: Database, href: "/financial" },
      { title: "ROI & Perícias", icon: Gavel, href: "/legal-financial" },
    ]
  },
  {
    label: "SAÚDE OCUPACIONAL",
    icon: HeartPulse,
    roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'PROVIDER', 'CLIENT_ADMIN'],
    items: [
      { title: "Gestão de Saúde", icon: HeartPulse, href: "/medical/health-management" },
      { title: "Clínica Digital (ASO)", icon: Stethoscope, href: "/health-control" },
      { title: "Telemedicina Meet", icon: Video, href: "/telemedicine" },
      { title: "Validador Forense", icon: FileSearch, href: "/medical-certificates" },
    ]
  },
  {
    label: "SEGURANÇA DO TRABALHO",
    icon: HardHat,
    roles: ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'PROVIDER', 'CLIENT_ADMIN'],
    items: [
      { title: "Cards Operação", icon: CheckSquare, href: "/action-plans" },
      { title: "Escala Técnica", icon: CalendarDays, href: "/safety/operational-scale" },
      { title: "Inventário PGR", icon: ClipboardCheck, href: "/risk-management" },
      { title: "Sentinela (NTEP)", icon: ShieldAlert, href: "/absenteeism" },
      { title: "Treinamentos NRs", icon: GraduationCap, href: "/trainings" },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const db = useFirestore()
  const { user } = useUser()
  const router = useRouter()

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "users", user.uid)
  }, [db, user])

  const { data: profile } = useDoc(profileRef)

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/login")
  }

  const role = (profile?.role || '').toUpperCase()
  const userName = profile?.name || user?.email?.split('@')[0] || "Usuário"
  
  return (
    <Sidebar className="border-r border-sidebar-border bg-[#001F3F] text-white">
      <SidebarHeader className="p-8 pb-4">
        <span className="text-3xl font-black tracking-tighter uppercase">NAI</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nextcon AI 2026</span>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        {NAV_MODULES.map((module) => {
          if (module.roles && !module.roles.includes(role)) return null;
          
          return (
            <SidebarGroup key={module.label}>
              <SidebarGroupLabel className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2 px-4">
                {module.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {module.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} className="hover:bg-white/5 rounded-xl px-4 h-10">
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="size-4 opacity-40" />
                        <span className="text-xs font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="p-6 border-t border-white/5">
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
          <div className="size-8 rounded-lg bg-accent text-primary flex items-center justify-center font-black text-xs uppercase">
            {userName.substring(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black truncate uppercase">{userName}</p>
            <p className="text-[8px] text-slate-400 uppercase">{role}</p>
          </div>
          <button onClick={handleLogout} className="p-1 hover:text-red-400 transition-colors">
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
