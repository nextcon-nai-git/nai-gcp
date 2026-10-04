"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  Brain,
  Loader2,
  AlertTriangle,
  Dna,
  Gauge,
  ClipboardList,
  Camera,
  Play,
  Video,
  Scan,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { useUser, useFirestore } from "@/firebase";

type SeverityLevel = "NENHUM" | "BAIXO" | "MÉDIO" | "ALTO" | "CRÍTICO";

interface BodyZone {
  id: string;
  name: string;
  level: SeverityLevel;
  clicks: number;
}

const BORG_SCALE = [
  { value: 0, label: "Repouso Total", color: "bg-slate-100 text-slate-500" },
  { value: 2, label: "Muito Leve", color: "bg-emerald-50 text-emerald-600" },
  { value: 4, label: "Moderado", color: "bg-blue-50 text-blue-600" },
  { value: 6, label: "Pesado", color: "bg-amber-50 text-amber-600" },
  { value: 8, label: "Muito Pesado", color: "bg-orange-50 text-orange-600" },
  { value: 10, label: "Esforço Máximo", color: "bg-red-50 text-red-600 animate-pulse" },
];

export default function BiomechanicsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<"manual" | "video">("manual");
  const [isVideoScanning, setIsVideoScanning] = useState(false);
  const [videoResult, setVideoResult] = useState<any>(null);

  const [bodyZones, setBodyZones] = useState<Record<string, BodyZone>>({
    head: { id: "head", name: "Craniana / Cervical", level: "NENHUM", clicks: 0 },
    neck: { id: "neck", name: "Pescoço / Escapular", level: "NENHUM", clicks: 0 },
    leftShoulder: { id: "leftShoulder", name: "Ombro Esquerdo", level: "NENHUM", clicks: 0 },
    rightShoulder: { id: "rightShoulder", name: "Ombro Direito", level: "NENHUM", clicks: 0 },
    thoracic: { id: "thoracic", name: "Coluna Torácica", level: "NENHUM", clicks: 0 },
    lumbar: { id: "lumbar", name: "Região Lombar", level: "NENHUM", clicks: 0 },
    leftArm: { id: "leftArm", name: "Braço Esquerdo", level: "NENHUM", clicks: 0 },
    rightArm: { id: "rightArm", name: "Braço Direito", level: "NENHUM", clicks: 0 },
    leftHand: { id: "leftHand", name: "Mão / Punho Esquerdo", level: "NENHUM", clicks: 0 },
    rightHand: { id: "rightHand", name: "Mão / Punho Direito", level: "NENHUM", clicks: 0 },
    leftKnee: { id: "leftKnee", name: "Joelho Esquerdo", level: "NENHUM", clicks: 0 },
    rightKnee: { id: "rightKnee", name: "Joelho Direito", level: "NENHUM", clicks: 0 },
    leftFootAnkle: {
      id: "leftFootAnkle",
      name: "Pés e Tornozelos (E)",
      level: "NENHUM",
      clicks: 0,
    },
    rightFootAnkle: {
      id: "rightFootAnkle",
      name: "Pés e Tornozelos (D)",
      level: "NENHUM",
      clicks: 0,
    },
    legs: { id: "legs", name: "Membros Inferiores (Geral)", level: "NENHUM", clicks: 0 },
  });

  const [borgValue, setBorgValue] = useState(0);
  const [checklist, setChecklist] = useState({
    repetitiveness: false,
    static_posture: false,
    heavy_lifting: false,
    vibration: false,
    extreme_temp: false,
    compression: false,
  });

  const [aiText, setAiText] = useState("");
  const [isAiStreaming, setIsAiStreaming] = useState(false);

  const consolidatedRiskScore = React.useMemo(() => {
    if (mode === "video" && videoResult) return videoResult.score;
    let score = 0;
    const activePains = Object.values(bodyZones).filter((z) => z.level !== "NENHUM").length;
    score += activePains * 5;
    score += borgValue * 3;
    const activeChecks = Object.values(checklist).filter((v) => v === true).length;
    score += activeChecks * 10;
    return Math.min(score, 100);
  }, [bodyZones, borgValue, checklist, mode, videoResult]);

  const handleZoneClick = (zoneId: string) => {
    if (mode === "video") return;
    setBodyZones((prev) => {
      const zone = prev[zoneId];
      const nextClicks = (zone.clicks + 1) % 5;
      const levels: SeverityLevel[] = ["NENHUM", "BAIXO", "MÉDIO", "ALTO", "CRÍTICO"];
      const nextLevel = levels[nextClicks];
      return { ...prev, [zoneId]: { ...zone, clicks: nextClicks, level: nextLevel } };
    });
  };

  const startVideoScan = () => {
    setIsVideoScanning(true);
    setVideoResult(null);
    setTimeout(() => {
      setIsVideoScanning(false);
      setVideoResult({
        score: 78,
        methodology: "RULA / REBA",
        findings: [
          "Tronco: Flexão > 20° (Score 3)",
          "Pescoço: Extensão Significativa (Score 4)",
          "Punhos: Desvio Ulnar Crítico (Score 4)",
        ],
        diagnosis: "Alto Risco de Lesão Ocupacional detectado via Visão Computacional.",
      });
      toast({
        title: "Scan de Vídeo Concluído",
        description: "Parecer ergonômico gerado via IA 3D.",
      });
    }, 4000);
  };

  const getZoneColorClass = (level: SeverityLevel) => {
    switch (level) {
      case "BAIXO":
        return "fill-emerald-500/40 stroke-emerald-400";
      case "MÉDIO":
        return "fill-amber-500/40 stroke-amber-400";
      case "ALTO":
        return "fill-orange-500/50 stroke-orange-400";
      case "CRÍTICO":
        return "fill-red-600/60 stroke-red-500 animate-pulse";
      default:
        return "fill-slate-100 stroke-slate-200";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Auditoria Biomecânica
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
            <Video className="size-3 text-accent" /> Análise Cinemática & Postural NR-17 High-End
            Analytics.
          </p>
        </div>
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("manual")}
            className={cn(
              "h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest",
              mode === "manual" ? "bg-primary text-white" : "text-slate-400"
            )}
          >
            Mapeamento Manual
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("video")}
            className={cn(
              "h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2",
              mode === "video" ? "bg-accent text-primary" : "text-slate-400"
            )}
          >
            <Camera className="size-3" /> Scan de Vídeo Neural
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden flex flex-col items-center">
            <CardHeader className="w-full bg-slate-900 text-white py-6 px-8 flex flex-row items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-sm font-black uppercase text-white flex items-center gap-2">
                  <Scan className="size-4 text-accent" /> Análise de Postura{" "}
                  {mode === "video" ? "Neural" : "Corporal"}
                </CardTitle>
                <CardDescription className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                  Rastreamento Articular RULA/REBA 2026
                </CardDescription>
              </div>
              <Badge className="bg-emerald-500 text-slate-950 font-black text-[8px] uppercase tracking-widest border-none">
                {mode === "video" ? "SCAN 3D ATIVO" : "MANUAL"}
              </Badge>
            </CardHeader>

            <CardContent className="p-6 w-full flex flex-col items-center relative">
              {/* IMAGEM HD DA ANÁLISE BIOMECÂNICA DO PACIENTE */}
              <div className="w-full relative rounded-3xl overflow-hidden shadow-2xl border border-slate-100 bg-slate-950 group">
                <img
                  src="/images/ergonomic_patient_scan.png"
                  alt="Análise Biomecânica do Paciente"
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* OVERLAY DE HUD BIOMECÂNICO / HUD DA IA */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                  <Badge className="bg-emerald-500/90 text-slate-950 text-[8px] font-black uppercase tracking-widest backdrop-blur-md">
                    Ângulo Coluna: 15° (Normal)
                  </Badge>
                  <Badge className="bg-amber-500/90 text-slate-950 text-[8px] font-black uppercase tracking-widest backdrop-blur-md">
                    Flexão Ombro: 45° (Moderado)
                  </Badge>
                </div>

                <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between text-white text-left">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-accent">
                      Score Ergonomico RULA
                    </p>
                    <p className="text-xs font-bold">Nível de Risco 3 (Baixo / Aceitável)</p>
                  </div>
                  <Badge className="bg-primary text-accent font-black text-[9px] uppercase px-3 h-6 border border-accent/20">
                    NR-17 OK
                  </Badge>
                </div>
              </div>

              {mode === "video" && isVideoScanning && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-[2.5rem]">
                  <div className="flex flex-col items-center gap-4">
                    <div className="size-20 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                      Mapeando Ângulos Articulares 3D...
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {mode === "video" ? (
            <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden p-8 text-left space-y-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent rounded-2xl shadow-xl shadow-accent/20 text-primary">
                    <Video className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-primary uppercase">
                      Analise Postural por Vídeo
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Metodologia: {videoResult?.methodology || "RULA / REBA"}
                    </p>
                  </div>
                </div>
                {!videoResult && (
                  <Button
                    onClick={startVideoScan}
                    disabled={isVideoScanning}
                    className="gradient-nextcon text-white h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                  >
                    {isVideoScanning ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Iniciar Captura Neural
                  </Button>
                )}
              </div>

              {videoResult ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-4">
                  <div className="space-y-6">
                    <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-3xl">
                      <p className="text-[9px] font-black text-red-600 uppercase mb-2">
                        Parecer Diagnóstico AI
                      </p>
                      <p className="text-sm font-bold text-red-900 italic leading-relaxed">
                        &quot;{videoResult.diagnosis}&quot;
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Achados Críticos (Ângulos):
                      </p>
                      {videoResult.findings.map((f: string, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border"
                        >
                          <AlertTriangle className="size-4 text-orange-500" />
                          <span className="text-xs font-bold text-slate-700">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-8 bg-[#090e24] rounded-[2.5rem] text-white flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Dna className="size-32" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                      Score Biomecânico
                    </p>
                    <h2 className="text-7xl font-black text-accent tabular-nums">
                      {videoResult.score}%
                    </h2>
                    <Badge className="bg-red-500 text-white border-none font-black uppercase text-[10px] px-4 h-8 flex items-center">
                      AÇÃO IMEDIATA
                    </Badge>
                    <Button
                      variant="outline"
                      onClick={() => setVideoResult(null)}
                      className="mt-4 border-white/20 text-white hover:bg-white/10 rounded-xl text-[9px] font-black uppercase h-9"
                    >
                      Novo Scan
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] opacity-30 text-center gap-4">
                  <Scan className="size-16" />
                  <p className="text-sm font-black uppercase tracking-widest">
                    Aguardando Captura de Vídeo
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6 text-left">
                  <CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2">
                    <Gauge className="size-4 text-accent" /> Percepção de Esforço (Borg)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-2">
                    {BORG_SCALE.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setBorgValue(item.value)}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-all text-left flex flex-col gap-1",
                          borgValue === item.value
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-slate-50 bg-slate-50"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase opacity-40">
                          Nível {item.value}
                        </span>
                        <span className="text-xs font-bold text-primary">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6 text-left">
                  <CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2">
                    <ClipboardList className="size-4 text-accent" /> Agravos NR-17
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {["repetitiveness", "static_posture", "heavy_lifting", "vibration"].map((id) => (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"
                      onClick={() =>
                        setChecklist((prev) => ({
                          ...prev,
                          [id]: !prev[id as keyof typeof checklist],
                        }))
                      }
                    >
                      <Checkbox checked={checklist[id as keyof typeof checklist]} />
                      <span className="text-[11px] font-bold text-slate-600 uppercase">
                        {id === "repetitiveness"
                          ? "Alta Repetitividade"
                          : id === "static_posture"
                            ? "Postura Estática"
                            : id === "heavy_lifting"
                              ? "Peso Excessivo"
                              : "Vibração"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden p-2">
            <div className="bg-[#001F3F] p-8 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Brain className="size-10 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase text-accent tracking-[0.3em]">
                    NAI Predictive Analytics
                  </p>
                  <h3 className="text-2xl font-black uppercase tracking-tight">
                    Relatório de Conformidade
                  </h3>
                </div>
              </div>
              <Button className="h-16 px-10 bg-accent text-primary font-black uppercase text-[10px] tracking-widest rounded-xl shadow-2xl hover:scale-105 active:scale-95 transition-all gap-2">
                Protocolar Laudo de Auditoria
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
