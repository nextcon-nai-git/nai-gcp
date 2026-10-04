"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, ShieldCheck, MessageSquare, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * @fileOverview MobileBottomNav (Dock Inferior Nativo para iOS & Android)
 * Oferece ergonomia com o polegar em smartphones, atalhos rápidos para as
 * tarefas mais frequentes de SST e acionamento instantâneo do menu lateral.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { toggleSidebar, openMobile } = useSidebar();

  const navItems = [
    {
      title: "Início",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      title: "Inspeção",
      href: "/field-inspection",
      icon: Camera,
      isActive: pathname.startsWith("/field-inspection"),
      badge: "IA",
    },
    {
      title: "eSocial",
      href: "/esocial/audit",
      icon: ShieldCheck,
      isActive: pathname.startsWith("/esocial"),
    },
    {
      title: "WhatsApp",
      href: "/whatsapp-hub",
      icon: MessageSquare,
      isActive: pathname.startsWith("/whatsapp"),
    },
  ];

  return (
    <nav
      aria-label="Navegação Rápida Móvel"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_25px_rgba(0,31,63,0.08)] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-2 select-none"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-2xl transition-all duration-200 group active:scale-90",
                item.isActive
                  ? "text-primary font-black"
                  : "text-slate-400 hover:text-slate-600 font-bold"
              )}
            >
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "p-1.5 rounded-xl transition-all duration-300",
                    item.isActive
                      ? "bg-[#001F3F] text-accent shadow-md scale-105"
                      : "group-hover:bg-slate-100"
                  )}
                >
                  <Icon
                    className={cn("size-5", item.isActive ? "text-amber-400" : "text-slate-500")}
                  />
                </div>
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 text-[8px] font-black uppercase tracking-tighter bg-amber-400 text-slate-950 rounded-full border border-white shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-tight mt-0.5 leading-none">
                {item.title}
              </span>
            </Link>
          );
        })}

        {/* Botão de Menu Completo (Abre Gaveta Lateral de 25+ Módulos) */}
        <button
          type="button"
          onClick={() => toggleSidebar()}
          className={cn(
            "relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-2xl transition-all duration-200 group active:scale-90 cursor-pointer",
            openMobile ? "text-primary font-black" : "text-slate-400 hover:text-slate-600 font-bold"
          )}
          aria-label="Abrir Menu Completo"
        >
          <div
            className={cn(
              "p-1.5 rounded-xl transition-all duration-300",
              openMobile
                ? "bg-[#001F3F] text-accent shadow-md scale-105"
                : "group-hover:bg-slate-100"
            )}
          >
            <Menu className={cn("size-5", openMobile ? "text-amber-400" : "text-slate-500")} />
          </div>
          <span className="text-[10px] uppercase tracking-tight mt-0.5 leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
