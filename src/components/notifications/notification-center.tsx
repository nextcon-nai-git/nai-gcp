"use client";

import Link from "next/link";
import { Bell, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NotificationCenter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Abrir central de alertas"
          variant="outline"
          size="icon"
          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
        >
          <Bell className="h-5 w-5 text-slate-300" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl sm:w-96">
        <div className="space-y-2 border-b border-slate-800 p-4">
          <h2 className="text-sm font-semibold">Central de alertas NAI</h2>
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            Consulta indisponível
          </Badge>
        </div>
        <div className="space-y-3 p-4 text-sm text-slate-300">
          <Info className="h-5 w-5 text-sky-400" />
          <p>
            Os alertas da sua empresa ainda não estão conectados a esta central. Não é possível
            confirmar pendências ou vencimentos por este painel.
          </p>
          <p>Consulte os registros disponíveis no módulo de controle de saúde.</p>
        </div>
        <div className="border-t border-slate-800 p-3">
          <Button
            asChild
            variant="ghost"
            className="w-full text-sky-400 hover:bg-slate-800 hover:text-sky-300"
          >
            <Link href="/health-control">Abrir controle de saúde</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
