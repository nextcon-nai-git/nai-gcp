"use client"

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { 
  Bell,
  Search,
  Settings,
  ChevronDown,
  Building2,
  ShieldCheck,
  UserCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from '@/components/ui/badge';
import { PlatformFeedback } from '@/components/feedback/platform-feedback';
import { cn } from '@/lib/utils';

export function TopNav() {
  const { user } = useUser();
  const db = useFirestore();
  const pathname = usePathname();

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(profileRef);
  
  const role = (profile?.role || 'AGUARDANDO LIBERAÇÃO').toUpperCase();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(role);

  const getUnitLabel = () => {
    if (isAdmin) return "Gestão da Rede";
    if (profile?.companyName) return profile.companyName;
    if (profile?.companyId) return `Unidade ID: ${profile.companyId}`;
    return "Acesso Seguro NAI";
  };

  const unitLabel = getUnitLabel();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
          <span className="font-black uppercase tracking-widest text-[9px] text-primary/40">
            NAI
          </span>
          <span className="opacity-30">/</span>
          <span className="text-slate-900 font-bold capitalize">
            {pathname === '/' ? 'Dashboard' : pathname.split('/').pop()?.replace('-', ' ')}
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8">
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder={isAdmin ? "Pesquisar em toda a rede..." : "Pesquisar em seus registros..."} 
            className="pl-10 h-10 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 transition-all text-sm"
          />
          <div className="absolute right-3 top-2.5">
            <Sparkles className="size-4 text-accent/40 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge 
          variant="outline" 
          className={cn(
            "border-slate-200 text-slate-600 font-bold text-[10px] px-3 py-1 uppercase hidden md:flex h-9 items-center gap-2",
            isAdmin ? "bg-primary/5 border-primary/10 text-primary" : "bg-emerald-50 border-emerald-100 text-emerald-700"
          )}
        >
          <Building2 className="size-3" />
          {unitLabel}
        </Badge>

        <PlatformFeedback />

        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:bg-slate-50">
          <Bell className="size-5" />
          <span className="absolute top-2.5 right-2.5 size-2 bg-destructive rounded-full border-2 border-white"></span>
        </Button>

        <div className="h-8 w-px bg-slate-200 mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="hover:bg-slate-50 gap-3 px-2 h-10 rounded-lg">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-none mb-1">{profile?.name || user?.email?.split('@')[0]}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{role.replace('_', ' ')}</p>
              </div>
              <div className={cn(
                "size-8 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-sm",
                isAdmin ? "bg-primary" : "bg-accent"
              )}>
                {isAdmin ? <ShieldCheck className="size-4" /> : <UserCircle className="size-4" />}
              </div>
              <ChevronDown className="size-3 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl border-none shadow-2xl">
            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-4 py-3">Minha Conta</DropdownMenuLabel>
            <DropdownMenuItem className="gap-3 cursor-pointer text-sm px-4 py-3"><Settings className="size-4 opacity-50" /> Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive gap-3 cursor-pointer text-sm font-bold px-4 py-3">Encerrar Sessão</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
