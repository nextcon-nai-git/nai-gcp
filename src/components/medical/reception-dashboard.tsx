"use client";

import * as React from "react";
import { Users, Clock, Activity, CheckCircle, Search, Loader2 } from "lucide-react";
import { useAppointmentsQueue } from "@/hooks/use-appointments-queue";
import { cn } from "@/lib/utils";

export function ReceptionDashboard() {
  const { appointments, loading, error } = useAppointmentsQueue();
  const [searchTerm, setSearchTerm] = React.useState("");

  const stats = React.useMemo(() => {
    if (!appointments) return { total: 0, espera: 0, atendimento: 0, concluido: 0 };
    return {
      total: appointments.length,
      espera: appointments.filter((a) => a.status === "Em Espera").length,
      atendimento: appointments.filter((a) => a.status === "Em Atendimento").length,
      concluido: appointments.filter((a) => a.status === "Concluído").length,
    };
  }, [appointments]);

  const filteredAppointments = (appointments || []).filter((a) =>
    a.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Em Espera":
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-amber-100 text-amber-700 animate-pulse">
            Em Espera
          </span>
        );
      case "Em Atendimento":
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-700">
            Em Atendimento
          </span>
        );
      case "Concluído":
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-700">
            Concluído
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-slate-100 text-slate-500">
            Agendado
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-100 text-red-700 font-bold">
        Falha na sincronização: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Total do Dia"
          value={stats.total}
          icon={Users}
          color="text-slate-600"
          bg="bg-slate-50"
        />
        <StatCard
          label="Aguardando"
          value={stats.espera}
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          label="Em Atendimento"
          value={stats.atendimento}
          icon={Activity}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Concluídos"
          value={stats.concluido}
          icon={CheckCircle}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-black text-primary uppercase">Fila de Atendimento</h2>
          <div className="relative w-full md:w-72">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-300"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary/10 text-sm font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                <th className="p-6 pl-8">Horário</th>
                <th className="p-6">Colaborador</th>
                <th className="p-6">Tipo de Exame</th>
                <th className="p-6">Status</th>
                <th className="p-6 pr-8 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-medium">
              {filteredAppointments.map((apt) => (
                <tr
                  key={apt.agendamento_id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="p-6 pl-8 font-mono text-xs text-slate-500">
                    {apt.data_hora
                      ? new Date(apt.data_hora).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </td>
                  <td className="p-6">
                    <p className="font-black text-primary uppercase text-xs">
                      {apt.colaborador_nome}
                    </p>
                  </td>
                  <td className="p-6">
                    <span className="text-xs text-slate-600">{apt.tipo}</span>
                  </td>
                  <td className="p-6">{getStatusBadge(apt.status)}</td>
                  <td className="p-6 pr-8 text-right">
                    <button className="text-primary hover:text-accent font-black uppercase text-[10px] tracking-widest transition-colors">
                      Ver Ficha
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAppointments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-20 text-center opacity-30 font-black uppercase text-xs tracking-widest"
                  >
                    Nenhum paciente na fila
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div
      className={cn(
        "p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center space-x-4 bg-white hover:ring-2 ring-primary/5 transition-all"
      )}
    >
      <div className={cn("p-4 rounded-2xl", bg, color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">
          {label}
        </p>
        <p className="text-2xl font-black text-primary font-headline">{value}</p>
      </div>
    </div>
  );
}
