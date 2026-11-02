"use client";

import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { TopNav } from "@/components/layout/top-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { NaiFloatingWidget } from "@/components/commercial/nai-floating-widget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EXPERT_ROLE } from "@/lib/expert-workspace";
import Link from "next/link";

/**
 * @fileOverview Gatekeeper de Autenticação da Plataforma NAI.
 * Garante que a aplicação sempre inicie com o login para usuários não autenticados.
 */
export function AppContent({ children }: { children: React.ReactNode }) {
  const { user, role, isUserLoading, userError } = useUser();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  const isClinicPortal = /^\/portal-clinica\/[a-f0-9]{48}$/.test(pathname);
  const isInfoPage = pathname === "/privacy" || pathname === "/terms";
  const isLoginPage = React.useMemo(() => pathname === "/login", [pathname]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (
      mounted &&
      !isUserLoading &&
      role === EXPERT_ROLE &&
      !isLoginPage &&
      !isInfoPage &&
      pathname !== "/expert"
    )
      router.replace("/expert");
  }, [mounted, isUserLoading, role, isLoginPage, isInfoPage, pathname, router]);

  // Lógica de Redirecionamento Estrito
  React.useEffect(() => {
    if (mounted && !isUserLoading && !user && !isLoginPage && !isInfoPage && !isClinicPortal) {
      router.replace("/login");
    }
  }, [user, isUserLoading, isLoginPage, pathname, router, mounted, isInfoPage, isClinicPortal]);

  if (isClinicPortal) return <>{children}</>;

  if (isInfoPage) return <main className="min-h-screen bg-white p-6 md:p-12">{children}</main>;

  // 1. Splash Screen durante a verificação de sessão ou montagem
  if (!mounted || (isUserLoading && !isLoginPage)) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#001F3F] z-[9999] overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_#334155_0%,_transparent_70%)]" />
        </div>

        <div className="relative animate-in zoom-in duration-500">
          <div className="size-24 rounded-[2.5rem] bg-[#090e24] flex items-center justify-center text-white font-black text-5xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-bounce border-2 border-white/10">
            N
          </div>
          <div className="absolute -inset-4 bg-slate-500/20 blur-2xl rounded-full -z-10 animate-pulse" />
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-xs font-black text-white/60 uppercase tracking-[0.4em]">
              NextCon Intelligence
            </span>
          </div>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  // Do not mount protected children while a redirect to login is pending.
  if (!isLoginPage && !user && !userError) return null;

  if (!isLoginPage && (userError || !role || role === "USER")) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <section
          aria-labelledby="profile-status"
          className="w-full max-w-lg rounded-2xl border bg-white p-8 shadow-sm"
        >
          <h1 id="profile-status" className="text-2xl font-bold text-slate-900">
            {userError ? "Não foi possível carregar seu acesso" : "Sua conta aguarda liberação"}
          </h1>
          <p role="status" className="mt-3 text-sm leading-6 text-slate-600">
            {userError
              ? "Tente novamente para sincronizar seu perfil."
              : "Seu cadastro foi preparado. Peça ao administrador a definição do seu perfil e das empresas que você pode acessar."}
          </p>
          {user?.email && (
            <p className="mt-4 break-all text-sm text-slate-600">
              Conta conectada: <strong>{user.email}</strong>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white"
            >
              Verificar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                void signOut(auth).catch(() => window.location.reload());
              }}
              className="rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              Entrar com outra conta
            </button>
          </div>
        </section>
      </main>
    );
  }

  // 2. Renderiza apenas a tela de login se não autenticado
  if (isLoginPage) {
    return <div className="min-h-screen w-full bg-white">{children}</div>;
  }

  // No global navigation, search, tenant switcher, assistant or financial shell
  // is mounted for this role, including on a direct forbidden URL.
  if (role === EXPERT_ROLE)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <span className="font-bold">NAI · Portal de prestadores</span>
          <span className="text-sm">{user?.email}</span>
          <button className="rounded-lg border px-4 py-2" onClick={() => void signOut(auth)}>
            Sair
          </button>
        </header>
        <main className="mx-auto max-w-6xl p-5 md:p-8">
          {pathname === "/expert" ? (
            <ErrorBoundary key={user?.uid}>{children}</ErrorBoundary>
          ) : (
            <p role="status">Abrindo seus CNPJs e cards autorizados…</p>
          )}
        </main>
      </div>
    );

  if (
    role === "PROVIDER" &&
    /^\/(financial|cassi-billing|contracts|production|comercial|crm)(\/|$)/.test(pathname)
  )
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p>Este módulo não está liberado para prestadores.</p>
        <Link href="/">Voltar ao portal</Link>
      </main>
    );

  // 3. Renderiza a Shell da aplicação para usuários autenticados
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-slate-900 focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>
      <div className="flex h-screen w-full bg-background overflow-hidden relative">
        <AppSidebar />
        <SidebarInset className="flex flex-col h-full overflow-hidden">
          <TopNav />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin"
          >
            <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
              <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
            </div>
          </main>
        </SidebarInset>
        <NaiFloatingWidget />
      </div>
    </SidebarProvider>
  );
}
