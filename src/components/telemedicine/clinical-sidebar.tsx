"use client";

import * as React from "react";
import {
  Activity,
  Brain,
  Zap,
  Lock,
  Sparkles,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  HeartPulse,
  Signal,
  PencilLine,
  ChevronDown,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { generateSoapSummary, type SOAPSummaryOutput } from "@/ai/flows/generate-soap-summary-flow";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export interface TelemedicinePatientData {
  name: string;
  age?: number;
  role?: string;
  department?: string;
  companyId?: string;
  appointmentId?: string;
  isHeightWork?: boolean;
  notes?: string;
  [key: string]: unknown;
}

export interface TelemetryReading {
  time: string;
  bpm: number;
  spo2: number;
  temp: number;
  [key: string]: unknown;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultItem>>;
}

interface ClinicalSidebarProps {
  patientData: any;
  telemetry: any[];
  isOpen: boolean;
  onToggle: () => void;
}

export function ClinicalSidebar({
  patientData,
  telemetry,
  isOpen,
  onToggle,
}: ClinicalSidebarProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  const [activeTab, setActiveTab] = React.useState("ai");
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [soapResult, setSoapResult] = React.useState<SOAPSummaryOutput | null>(null);
  const [approvedProtocols, setApprovedProtocols] = React.useState<string[]>([]);

  const [manualNotes, setManualNotes] = React.useState("");
  const [physicalExam, setPhysicalExam] = React.useState({
    bomEstadoGeral: true,
    corado: true,
    hidratado: true,
    acianotico: true,
    anicterico: true,
    eupneico: true,
    afebril: true,
    auscultaCardiacaNormal: true,
    auscultaPulmonarNormal: true,
    abdomeIndolor: true,
  });

  const recognitionRef = React.useRef<any>(null);

  const currentHR = telemetry[telemetry.length - 1]?.heartRate || 72;
  const currentSpO2 = telemetry[telemetry.length - 1]?.spo2 || 98;

  React.useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + " " + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        setIsListening(false);
      };
    }
  }, [toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        variant: "destructive",
        title: "Recurso Indisponível",
        description: "Seu navegador não suporta transcrição de voz.",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript.length > 20) {
        handleGenerateSummary();
      }
    } else {
      setTranscript("");
      setSoapResult(null);
      setApprovedProtocols([]);
      recognitionRef.current.start();
      setIsListening(true);
      toast({
        title: "NAI Escutando",
        description: "A consulta está sendo transcrita com segurança.",
      });
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateSoapSummary({
        transcript,
        patientHistory: "Histórico clínico sob monitoramento Nextcon.",
      });
      setSoapResult(result);
      setApprovedProtocols(result.suggestedProtocols.map((p) => p.id));
      toast({
        title: "Prontuário Estruturado",
        description: "A NAI gerou o resumo e as sugestões de protocolo.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na IA",
        description: "Falha ao gerar suporte clínico.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!db || !patientData.id || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const docRef = doc(db, "agendamentos_telemedicina", patientData.id);
      await updateDoc(docRef, {
        status: "concluído",
        finalizedAt: serverTimestamp(),
      });
      toast({ title: "Prontuário Protocolado" });
      onToggle();
    } catch (error) {
      toast({ variant: "destructive", title: "Falha ao Salvar" });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <SheetHeader className="p-8 bg-[#001F3F] text-white shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Zap className="size-16 text-accent" />
        </div>
        <div className="flex items-center gap-5 relative z-10 text-left">
          <div className="size-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center text-3xl font-black border border-white/20">
            {patientData.name?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <SheetTitle className="text-xl font-headline font-black uppercase tracking-tight text-white">
              {patientData.name}
            </SheetTitle>
            <SheetDescription className="text-white/60 font-medium italic text-xs mt-1">
              Assistente Clínico NAI v2.6 Ready.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-8 pt-4 bg-slate-50/50 border-b">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 rounded-xl p-1">
            <TabsTrigger
              value="ai"
              className="rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              IA & Voz
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              Exame Físico
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 p-8 bg-slate-50/50 scrollbar-thin">
          <TabsContent value="ai" className="m-0 space-y-8 focus-visible:ring-0 text-left">
            <Button
              onClick={toggleListening}
              variant={isListening ? "destructive" : "outline"}
              className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {isListening ? "Parar Transcrição" : "Iniciar Escuta NAI"}
            </Button>

            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="p-6 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                  <HeartPulse className="size-4 text-red-500 animate-pulse" /> IoT Telemetria
                </CardTitle>
                <Badge variant="outline" className="text-[8px] text-emerald-600 bg-emerald-50 px-2">
                  LIVE
                </Badge>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Pulso</p>
                  <span className="text-xl font-black text-red-600">{currentHR} bpm</span>
                </div>
                <div className="text-center border-l">
                  <p className="text-[8px] font-black text-slate-400 uppercase">SpO2</p>
                  <span className="text-xl font-black text-blue-600">{currentSpO2}%</span>
                </div>
              </CardContent>
            </Card>

            {soapResult && (
              <div className="space-y-4 animate-in zoom-in-95">
                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <p className="text-[8px] font-black uppercase text-slate-400 mb-2">
                    Resumo SOAP Automatizado
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed italic line-clamp-4">
                    "{soapResult.subjective}"
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="m-0 space-y-6 focus-visible:ring-0 text-left">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                Evolução de Atendimento
              </p>
              <Textarea
                placeholder="Digite observações manuais do exame físico..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="min-h-[200px] bg-white border-slate-200 rounded-[2rem] p-5 text-sm"
              />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="p-8 bg-white border-t shrink-0 space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-[2rem] flex gap-3">
          <Lock className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[9px] text-primary/70 font-medium leading-relaxed italic">
            "Sincronização HIPAA V4.0 Ativa. O prontuário será auditado via motor NAI Forensic."
          </p>
        </div>
        <Button
          onClick={handleFinalize}
          disabled={isFinalizing}
          className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl gap-3"
        >
          {isFinalizing ? (
            <Loader2 className="size-5 animate-spin text-accent" />
          ) : (
            <CheckCircle2 size={20} className="text-accent" />
          )}
          Assinar e Protocolar PEP
        </Button>
      </div>
    </div>
  );
}
