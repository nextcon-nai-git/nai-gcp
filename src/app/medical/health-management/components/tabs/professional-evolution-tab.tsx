"use client";

import * as React from "react";
import {
  HeartPulse,
  Activity,
  Stethoscope,
  Brain,
  Thermometer,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROFESSIONAL_EVOLUTION = {
  medico: {
    title: "Médico do Trabalho",
    role: "Coordenação PCMSO (NR-07)",
    icon: Stethoscope,
    color: "text-blue-600",
    bg: "bg-blue-50",
    checklist: [
      { id: "m1", label: "Validar ASOs pendentes e emitir pareceres de aptidão.", ref: "NR-07" },
      {
        id: "m2",
        label: "Coordenar investigação de nexo causal em afastamentos B91.",
        ref: "NR-01",
      },
      {
        id: "m3",
        label: "Realizar busca ativa de doenças ocupacionais via indicadores.",
        ref: "Epidemiologia",
      },
      {
        id: "m4",
        label: "Participar de reunião do comitê de gestão de riscos.",
        ref: "Estratégico",
      },
    ],
  },
  fisio: {
    title: "Fisioterapeuta Ergonomista",
    role: "Gestão de Ergonomia (NR-17)",
    icon: Activity,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    checklist: [
      {
        id: "f1",
        label: "Realizar Blitz Postural nos postos de armação/carpintaria.",
        ref: "NR-17",
      },
      { id: "f2", label: "Atualizar Análise Ergonômica Preliminar (AEP) do setor A.", ref: "GRO" },
      {
        id: "f3",
        label: "Treinar equipe sobre levantamento e transporte de cargas.",
        ref: "Treinamento",
      },
      { id: "f4", label: "Acompanhar retorno ao trabalho de pós-cirúrgicos.", ref: "Reabilitação" },
    ],
  },
  psico: {
    title: "Psicólogo do Trabalho",
    role: "Saúde Mental & Clima (NR-01)",
    icon: Brain,
    color: "text-purple-600",
    bg: "bg-purple-50",
    checklist: [
      { id: "p1", label: "Realizar plantão de escuta para colaboradores em stress.", ref: "NR-01" },
      { id: "p2", label: "Aplicar Pulse Survey de satisfação e clima por setor.", ref: "Cultura" },
      { id: "p3", label: "Mediar conflitos em equipes de alta rotatividade.", ref: "Social" },
      { id: "p4", label: "Avaliar riscos psicossociais em espaços confinados.", ref: "NR-33" },
    ],
  },
  enfermeiro: {
    title: "Enfermeiro do Trabalho",
    role: "Gestão Ambulatorial & SAE",
    icon: HeartPulse,
    color: "text-red-600",
    bg: "bg-red-50",
    checklist: [
      { id: "e1", label: "Implementar SAE (Sistematização da Assistência de Enf.).", ref: "COFEN" },
      {
        id: "e2",
        label: "Gerenciar estoque de medicamentos e validade de insumos.",
        ref: "Logística",
      },
      {
        id: "e3",
        label: "Auditar registros de triagem realizados pelos técnicos.",
        ref: "Qualidade",
      },
      { id: "e4", label: "Promover campanha mensal de saúde preventiva (SIPAT).", ref: "Educação" },
    ],
  },
  tecnico: {
    title: "Técnico de Enfermagem",
    role: "Triagem & Primeiros Socorros",
    icon: Thermometer,
    color: "text-orange-600",
    bg: "bg-orange-50",
    checklist: [
      {
        id: "t1",
        label: "Executar aferição de sinais vitais e anamnese inicial.",
        ref: "Assistencial",
      },
      {
        id: "t2",
        label: "Realizar curativos e cuidados imediatos em intercorrências.",
        ref: "Primeiros Socorros",
      },
      { id: "t3", label: "Manter kit de emergência prontos p/ uso.", ref: "Campo" },
      { id: "t4", label: "Registrar ocorrências no prontuário eletrônico.", ref: "Prontuário" },
    ],
  },
};

type ProfKey = keyof typeof PROFESSIONAL_EVOLUTION;

interface ProfessionalEvolutionTabProps {
  onNavigateToOperation?: () => void;
}

export function ProfessionalEvolutionTab({ onNavigateToOperation }: ProfessionalEvolutionTabProps) {
  const { toast } = useToast();
  const [activeProfessional, setActiveProfessional] = React.useState<ProfKey>("medico");
  const [checklistProgress, setChecklistProgress] = React.useState<Record<string, boolean>>({});
  const [isProtocolLoading, setIsProtocolLoading] = React.useState(false);

  const handleToggleCheck = (id: string) => {
    setChecklistProgress((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPercent = (profKey: ProfKey) => {
    const items = PROFESSIONAL_EVOLUTION[profKey].checklist;
    const checked = items.filter((item) => checklistProgress[item.id]).length;
    return Math.round((checked / items.length) * 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4 mb-4">
          Selecione o Profissional
        </p>
        {(
          Object.entries(PROFESSIONAL_EVOLUTION) as [
            ProfKey,
            (typeof PROFESSIONAL_EVOLUTION)[ProfKey],
          ][]
        ).map(([key, prof]) => {
          const Icon = prof.icon;
          const isActive = activeProfessional === key;
          const progress = getPercent(key);

          return (
            <Card
              key={key}
              className={cn(
                "cursor-pointer border-none shadow-sm transition-all duration-300 rounded-2xl overflow-hidden",
                isActive
                  ? "ring-2 ring-primary bg-white scale-[1.02] shadow-lg"
                  : "bg-slate-50 opacity-60 hover:opacity-100"
              )}
              onClick={() => setActiveProfessional(key)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={cn(
                    "p-2.5 rounded-xl",
                    isActive ? "bg-primary text-white" : prof.bg + " " + prof.color
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-primary uppercase truncate leading-none">
                    {prof.title}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden mr-3">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-black text-primary">{progress}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="lg:col-span-3 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-primary text-white p-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                {React.createElement(PROFESSIONAL_EVOLUTION[activeProfessional].icon, {
                  className: "size-8 text-accent",
                })}
              </div>
              <div>
                <CardTitle className="text-2xl font-headline font-black uppercase tracking-tight">
                  {PROFESSIONAL_EVOLUTION[activeProfessional].title}
                </CardTitle>
                <CardDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">
                  {PROFESSIONAL_EVOLUTION[activeProfessional].role}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase opacity-40">Status do Plantão</p>
              <h3 className="text-3xl font-black text-accent">{getPercent(activeProfessional)}%</h3>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Protocolo de Evolução Técnica:
            </p>
            {PROFESSIONAL_EVOLUTION[activeProfessional].checklist.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group",
                  checklistProgress[item.id]
                    ? "bg-emerald-50 border-emerald-100"
                    : "bg-white border-slate-50 hover:border-primary/10 shadow-sm"
                )}
                onClick={() => handleToggleCheck(item.id)}
              >
                <Checkbox
                  checked={!!checklistProgress[item.id]}
                  onCheckedChange={() => handleToggleCheck(item.id)}
                  className="size-5 rounded-md border-slate-300"
                />
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      checklistProgress[item.id] ? "text-emerald-800" : "text-primary"
                    )}
                  >
                    {item.label}
                  </p>
                  <Badge
                    variant="outline"
                    className="text-[8px] font-black border-none bg-slate-100 text-slate-400 mt-1"
                  >
                    Ref: {item.ref}
                  </Badge>
                </div>
                {checklistProgress[item.id] && <CheckCircle2 className="size-5 text-emerald-500" />}
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-dashed flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-slate-400 italic font-medium">
              "O preenchimento deste checklist alimenta os KPIs de performance tributária da
              unidade."
            </p>
            <Button
              disabled={isProtocolLoading}
              onClick={() => {
                const hasItems = PROFESSIONAL_EVOLUTION[activeProfessional].checklist.some(
                  (item) => checklistProgress[item.id]
                );
                if (!hasItems) {
                  toast({
                    variant: "destructive",
                    title: "Checklist Vazio",
                    description: "Marque ao menos um item da evolução técnica para protocolar.",
                  });
                  return;
                }
                setIsProtocolLoading(true);
                setTimeout(() => {
                  setIsProtocolLoading(false);
                  setChecklistProgress({});
                  toast({
                    title: "Evolução Protocolada",
                    description: "Os KPIs foram atualizados com sucesso e salvos no histórico.",
                  });
                  onNavigateToOperation?.();
                }, 1500);
              }}
              className="h-12 px-8 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-xl gap-2 transition-all hover:scale-105"
            >
              {isProtocolLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isProtocolLoading ? "Protocolando..." : "Protocolar Evolução"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
