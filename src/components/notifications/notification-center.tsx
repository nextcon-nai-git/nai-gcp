"use client";

import React, { useState } from "react";
import { Bell, AlertTriangle, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpirationAlert } from "@/services/notification-service";

const MOCK_ALERTS: ExpirationAlert[] = [
  {
    id: "alert_1",
    title: "Exame ASO Vencido",
    description: "ASO Periódico do colaborador Carlos Silva (Mecânico) venceu há 2 dias.",
    type: "aso_expiration",
    severity: "critical",
    employeeName: "",
    companyId: "comp_1",
    dueDate: "2026-08-15",
    daysRemaining: -2,
  },
  {
    id: "alert_2",
    title: "PGR Vencendo em 15 dias",
    description: "Revisão do Programa de Gerenciamento de Riscos da Unidade Matriz.",
    type: "pgr_expiration",
    severity: "warning",
    companyId: "comp_1",
    dueDate: "2026-09-01",
    daysRemaining: 15,
  },
  {
    id: "alert_3",
    title: "Pendência S-2220 eSocial",
    description: "3 ASOs emitidos aguardando assinatura e transmissão ao eSocial.",
    type: "esocial_pending",
    severity: "info",
    companyId: "comp_1",
    dueDate: "2026-08-20",
    daysRemaining: 3,
  },
];

export function NotificationCenter() {
  const [alerts, setAlerts] = useState<ExpirationAlert[]>(MOCK_ALERTS);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
        >
          <Bell className="h-5 w-5 text-slate-300" />
          {alerts.length > 0 && (
            <span
              className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${criticalCount > 0 ? "bg-red-500 animate-pulse" : "bg-amber-500"}`}
            >
              {alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0 bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-sky-400" />
            <span className="font-semibold text-sm">Central de Alertas NAI</span>
          </div>
          <Badge variant="outline" className="text-xs bg-sky-950 text-sky-400 border-sky-800">
            {alerts.length} Notificações
          </Badge>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              Nenhum alerta pendente no momento.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 hover:bg-slate-800/60 transition-colors flex gap-3 items-start"
              >
                {alert.severity === "critical" && (
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                )}
                {alert.severity === "warning" && (
                  <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                {alert.severity === "info" && (
                  <MessageSquare className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-200">{alert.title}</p>
                    <span className="text-[10px] text-slate-400">{alert.dueDate}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{alert.description}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t border-slate-800 text-center">
          <Button
            variant="ghost"
            className="w-full text-xs text-sky-400 hover:text-sky-300 hover:bg-slate-800 h-8"
          >
            Ver Todos os Vencimentos no Dashboard
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
