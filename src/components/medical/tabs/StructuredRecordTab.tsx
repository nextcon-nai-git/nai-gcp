"use client";

import * as React from "react";
import {
  Stethoscope,
  Activity,
  Droplet,
  Scale,
  Accessibility,
  Bone,
  Search,
  Baby,
  HeartPulse,
  Brain,
  UserSearch,
  Lock,
  History,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { REAL_CLINICAL_RECORDS, REAL_EMPLOYEES } from "@/lib/real-data";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";

const iconMap: Record<string, any> = {
  Activity,
  Droplet,
  Scale,
  Accessibility,
  Bone,
  Search,
  Baby,
  HeartPulse,
  Brain,
};

export function StructuredRecordTab() {
  const { user, role } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();

  // FILTRO CRÍTICO MULTI-TENANT: Filtra os prontuários pela empresa ativa
  const filteredRecords = React.useMemo(() => {
    if (!activeClientId || activeClientId === "unauthorized") return [];

    // Identifica os IDs de funcionários que pertencem à unidade selecionada
    const companyEmployeeIds = REAL_EMPLOYEES.filter((e) => e.companyId === activeClientId).map(
      (e) => e.id
    );

    return REAL_CLINICAL_RECORDS.filter((r) =>
      activeClientId === "all" ? true : companyEmployeeIds.includes(r.patientId)
    );
  }, [activeClientId]);

  const [selectedPatientId, setSelectedPatientId] = React.useState<string>("");

  // Reseta seleção ao trocar de unidade para evitar persistência de PHI de outro cliente
  React.useEffect(() => {
    if (filteredRecords.length > 0) {
      const firstId = filteredRecords[0].patientId;
      // Só atualiza se o paciente atual não estiver mais na lista ou se não houver seleção
      if (
        selectedPatientId === "" ||
        !filteredRecords.find((r) => r.patientId === selectedPatientId)
      ) {
        setSelectedPatientId(firstId);
      }
    } else if (selectedPatientId !== "") {
      setSelectedPatientId("");
    }
  }, [filteredRecords, selectedPatientId]);

  const activeClinicalRecord = filteredRecords.find((r) => r.patientId === selectedPatientId);

  // PROTOCOLO GOOGLE HEALTH / HIPAA: Mascaramento Dinâmico
  const isHealthPro = React.useMemo(
    () => ["SUPER_ADMIN", "DOCTOR", "PROVIDER"].includes(role || ""),
    [role]
  );

  const logAccess = async (patientName: string, patientId: string) => {
    if (!db || !user) return;
    await addDoc(collection(db, "phi_audit_logs"), {
      userId: user.uid,
      userName: user.email,
      action: "PHI_FULL_RECORD_ACCESS",
      patientName,
      patientId,
      timestamp: serverTimestamp(),
      platform: "NAI_WEB_2.7",
      compliance: "GOOGLE_HEALTH_HIPAA_V4",
    });
  };

  React.useEffect(() => {
    if (activeClinicalRecord && isHealthPro) {
      logAccess(activeClinicalRecord.name, activeClinicalRecord.patientId);
    }
  }, [selectedPatientId, isHealthPro, activeClinicalRecord]);

  if (filteredRecords.length === 0) {
    return (
      <div className="py-32 text-center opacity-20 flex flex-col items-center gap-4">
        <UserSearch size={64} className="text-primary" />
        <p className="font-black uppercase text-xs tracking-widest text-primary">
          Nenhum prontuário nesta unidade
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-right-4 duration-500">
      <div className="lg:col-span-1 space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4 mb-4 text-left">
          Pacientes da Unidade
        </p>
        <ScrollArea className="h-[500px]">
          <div className="space-y-2 pr-4">
            {filteredRecords.map((record) => (
              <button
                key={record.patientId}
                onClick={() => setSelectedPatientId(record.patientId)}
                className={cn(
                  "w-full text-left p-5 rounded-[2rem] transition-all flex flex-col gap-1 border-2",
                  selectedPatientId === record.patientId
                    ? "bg-white border-primary shadow-xl ring-4 ring-primary/5"
                    : "bg-slate-50 border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <p className="text-xs font-black text-primary uppercase leading-tight">
                  {record.name}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Idade: {record.age} | Sexo: {record.sex}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {!isHealthPro ? (
          <Card className="card-shadow border-none bg-white rounded-[3rem] p-20 flex flex-col items-center justify-center text-center gap-6">
            <div className="size-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 shadow-inner animate-pulse">
              <Lock size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-primary uppercase">
                Sigilo Médico Mandatório
              </h2>
              <p className="text-sm text-slate-500 font-medium italic max-w-sm">
                Seu perfil não possui as credenciais necessárias para visualizar Informações de
                Saúde Identificáveis (PHI) conforme HIPAA e Resolução CFM 2.314.
              </p>
            </div>
          </Card>
        ) : activeClinicalRecord ? (
          <div className="space-y-6">
            <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
              <CardHeader className="bg-[#001F3F] text-white p-10 relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Stethoscope className="size-48 text-accent" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="size-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center text-3xl font-black border border-white/20">
                      {activeClinicalRecord.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-3xl font-headline font-black uppercase tracking-tight leading-none">
                        {activeClinicalRecord.name}
                      </h2>
                      <Badge className="bg-accent text-primary font-black uppercase text-[10px] mt-1 h-6 px-3">
                        Linhas de Cuidado Ativas NAI
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-10">
                <div className="space-y-8 text-left">
                  {activeClinicalRecord.lines.map((line, idx) => {
                    const Icon = iconMap[line.icon] || Activity;
                    return (
                      <div
                        key={idx}
                        className="group animate-in slide-in-from-bottom-2"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="flex gap-6 items-start">
                          <div className="p-4 bg-slate-50 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner shrink-0">
                            <Icon className="size-6" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-black text-primary uppercase tracking-tight leading-none">
                                {line.category}
                              </h4>
                              <Badge
                                variant="outline"
                                className="text-[8px] font-black uppercase border-primary/10 text-slate-400"
                              >
                                Dados Protegidos
                              </Badge>
                            </div>
                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                              <div className="flex gap-2">
                                <span className="text-[9px] font-black uppercase text-slate-400">
                                  Métrica:
                                </span>
                                <span className="text-[11px] font-bold text-primary">
                                  {line.metric}
                                </span>
                              </div>
                              <div className="flex gap-2 items-start">
                                <span className="text-[9px] font-black uppercase text-accent shrink-0 mt-0.5">
                                  Conduta NAI:
                                </span>
                                <span className="text-[11px] font-medium text-slate-600 leading-relaxed italic">
                                  &quot;{line.conduct}&quot;
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {idx < activeClinicalRecord.lines.length - 1 && (
                          <div className="h-8 w-px bg-slate-100 ml-9 my-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-slate-50 p-6 rounded-[2rem] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">
                  <History className="size-5" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Segurança de Acesso
                  </p>
                  <p className="text-xs font-bold text-primary italic">
                    &quot;Sua visualização deste prontuário foi registrada para fins de auditoria
                    HIPAA.&quot;
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-200 text-emerald-700 bg-emerald-50 px-4 h-8 gap-2 font-black uppercase text-[8px]"
              >
                <ShieldCheck className="size-3" /> Sessão Protegida
              </Badge>
            </Card>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30 border-2 border-dashed rounded-[3rem] p-20 bg-white shadow-inner">
            <UserSearch className="size-16" />
            <p className="text-sm font-black uppercase tracking-widest text-primary">
              Selecione um paciente para abrir o PEP
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
