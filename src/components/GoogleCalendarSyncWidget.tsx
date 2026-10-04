"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  CalendarPlus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  syncNaiEventsToGoogleCalendar,
  CalendarEventPayload,
} from "@/actions/google-calendar-sync";

const GOOGLE_CALENDAR_USER_LINK = "https://calendar.google.com/calendar/u/0/r/month/2026/7/1";

const PROXIMOS_EXAMES_DEMO: CalendarEventPayload[] = [
  {
    title: "ASO Periódico - Carlos Eduardo Silva (CETESB)",
    description: "Exame Médico Ocupacional Periódico + Audiometria + Espirometria",
    location: "Nextcon Saúde SP - Av. Paulista, 1000",
    startDateIso: "2026-07-15T09:00:00",
    endDateIso: "2026-07-15T10:00:00",
    clientName: "CETESB",
    employeeName: "",
  },
  {
    title: "ASO Admissional - Ana Paula Oliveira (ANEEL)",
    description: "Exame Médico Admissional Ocupacional OIT + Laboratório",
    location: "Clínica Saúde & Vida - Rua das Palmeiras, 450",
    startDateIso: "2026-07-20T14:00:00",
    endDateIso: "2026-07-20T15:00:00",
    clientName: "ANEEL",
    employeeName: "",
  },
  {
    title: "Renovação PGR / PCMSO 2026 - Cassi Matriz",
    description: "Auditoria Anual de Engenharia e Segurança do Trabalho",
    location: "Cassi Sede - Brasília DF",
    startDateIso: "2026-07-28T10:00:00",
    endDateIso: "2026-07-28T12:00:00",
    clientName: "CASSI",
    employeeName: "",
  },
];

export function GoogleCalendarSyncWidget() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSynced, setLastSynced] = React.useState<string | null>("2026-07-01 10:00");

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await syncNaiEventsToGoogleCalendar(PROXIMOS_EXAMES_DEMO);
      if (res.sucesso && res.dados) {
        setLastSynced(
          new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        );
        toast({
          title: "Google Calendar Sincronizado!",
          description: res.mensagem,
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro na Sincronização",
        description: e.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden text-left">
      <CardHeader className="p-8 bg-slate-900 text-white relative overflow-hidden space-y-3">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CalendarIcon size={140} className="text-accent" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <Badge className="bg-emerald-500 text-slate-950 border-none text-[8px] font-black uppercase tracking-widest px-3 h-5 mb-1">
              <CheckCircle2 size={12} className="mr-1" /> GOOGLE CALENDAR CONECTADO
            </Badge>
            <CardTitle className="text-2xl font-headline font-black uppercase tracking-tight">
              Sincronização com Google Calendar
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs font-medium">
              Vínculo direto com a sua agenda oficial em{" "}
              <a
                href={GOOGLE_CALENDAR_USER_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent font-mono underline hover:text-white transition-colors"
              >
                calendar.google.com (Julho/2026)
              </a>
            </CardDescription>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="gradient-nextcon text-white h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl"
            >
              {isSyncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw size={14} className="text-accent" />
              )}
              Sincronizar Agenda NAI
            </Button>

            <a
              href={GOOGLE_CALENDAR_USER_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-6 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 transition-all"
            >
              <ExternalLink size={14} className="text-accent" /> Abrir Meu Calendar
            </a>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={14} className="text-accent" /> Próximos Agendamentos Ocupacionais
            (Julho/2026)
          </h4>
          {lastSynced && (
            <span className="text-[10px] text-slate-400 font-bold uppercase">
              Última Sincronização: {lastSynced}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PROXIMOS_EXAMES_DEMO.map((event, idx) => {
            const start = event.startDateIso.replace(/-|:|\.\d\d\d/g, "");
            const end = event.endDateIso.replace(/-|:|\.\d\d\d/g, "");
            const text = encodeURIComponent(event.title);
            const details = encodeURIComponent(
              `${event.description}\n\n` +
                `🏢 Cliente: ${event.clientName || "N/A"}\n` +
                `👤 Colaborador: ${event.employeeName || "N/A"}\n` +
                `⚡ Gerado automaticamente pelo NAI Nextcon Saúde Empresarial`
            );
            const location = encodeURIComponent(event.location);
            const googleEventUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${start}/${end}`;

            return (
              <div
                key={idx}
                className="p-5 bg-slate-50 hover:bg-blue-50/40 border border-slate-100 hover:border-blue-200 rounded-3xl transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-[8px] font-black uppercase border-slate-200 bg-white text-primary"
                    >
                      {event.clientName}
                    </Badge>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      {event.startDateIso.split("T")[0].split("-").reverse().join("/")}
                    </span>
                  </div>
                  <h5 className="font-black text-xs text-primary leading-snug">{event.title}</h5>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    {event.description}
                  </p>
                </div>

                <a
                  href={googleEventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full h-9 bg-primary hover:bg-primary/90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md transition-all hover:scale-105 mt-2"
                >
                  <CalendarPlus size={14} className="text-accent" /> Add ao Google Calendar
                </a>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
