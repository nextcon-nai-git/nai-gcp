"use client";

import * as React from "react";
import {
  Sparkles,
  Send,
  BookOpen,
  Scale,
  ShieldCheck,
  Loader2,
  Info,
  SearchCheck,
  AlertTriangle,
  MapPin,
  User,
  Stethoscope,
  HardHat,
  Volume2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { runKnowledgeAssistant, type KnowledgeOutput } from "@/ai/flows/knowledge-assistant-flow";
import { generateVoiceResponse } from "@/ai/flows/voice-response-flow";
import { cn } from "@/lib/utils";
import { VoiceAssistantButton } from "@/components/voice/voice-assistant-button";

interface Message {
  role: "user" | "ai";
  content: string;
  references?: string[];
  advice?: string;
  audioUrl?: string;
}

type Persona = "auditor" | "engineer" | "doctor";

const PERSONAS = {
  auditor: { label: "Auditoria Legal", icon: Scale, color: "text-blue-600", bg: "bg-blue-50" },
  engineer: {
    label: "Engenharia SST",
    icon: HardHat,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  doctor: {
    label: "Medicina Trabalho",
    icon: Stethoscope,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [activePersona, setActivePersona] = React.useState<Persona>("auditor");
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "ai",
      content:
        "Olá! Sou a NAI, a Inteligência Artificial da Nextcon. Minha missão é simplificar a gestão de SST para sua equipe e clientes. Posso auditar inconsistências do eSocial, gerar contestações de NTEP ou tirar dúvidas técnicas sobre as NRs 2026. Como posso ajudar hoje?",
    },
  ]);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleSend = async (text?: string) => {
    const inputContent = text || query;
    if (!inputContent.trim() || isLoading) return;

    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: inputContent }]);
    setIsLoading(true);

    try {
      // 1. Processa a dúvida via Genkit
      const result = await runKnowledgeAssistant({
        query: `(Persona: ${activePersona}) ${inputContent}`,
      });

      // 2. Opcional: Gera áudio para a resposta (apenas se foi via voz ou desejado)
      let audioUrl = "";
      if (text) {
        // Se veio por voz, gera áudio automaticamente
        const voiceRes = await generateVoiceResponse(result.answer);
        audioUrl = voiceRes.audioDataUri;
      }

      const aiMsg: Message = {
        role: "ai",
        content: result.answer,
        references: result.references,
        advice: result.advice,
        audioUrl: audioUrl,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Reproduz áudio se disponível
      if (audioUrl) {
        playAudio(audioUrl);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro na NAI",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => setIsSpeaking(false);
    audio.play().catch((e) => console.error("Audio playback error:", e));
  };

  const suggestedSkills = [
    {
      label: "Auditar eSocial",
      icon: SearchCheck,
      query: "Como a NAI audita a inconsistência entre o PGR e o PCMSO?",
    },
    {
      label: "Contestar NTEP",
      icon: AlertTriangle,
      query: "Quais são os fundamentos legais para contestar um nexo epidemiológico em 2026?",
    },
    {
      label: "Validade NR-35",
      icon: ShieldCheck,
      query: "Qual a periodicidade de treinamento de NR-35 em 2026?",
    },
    {
      label: "Enriquecer Rede",
      icon: MapPin,
      query: "Como a NAI encontra endereços de clínicas parceiras automaticamente?",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Cérebro NAI Intelligence
          </h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-widest mt-2 flex items-center gap-2">
            <Sparkles className="size-3 text-accent" /> Motor Gemini 2.0 Flash ativo com Voz.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-primary text-primary px-4 py-1.5 font-black uppercase text-[10px] bg-white h-10 flex items-center"
        >
          <ShieldCheck className="size-3 mr-2" /> BASE LEGAL ATUALIZADA 2026
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(Object.entries(PERSONAS) as [Persona, typeof PERSONAS.auditor][]).map(([id, p]) => {
          const Icon = p.icon;
          const isActive = activePersona === id;
          return (
            <button
              key={id}
              onClick={() => setActivePersona(id)}
              className={cn(
                "p-4 rounded-2xl border transition-all flex items-center gap-4 text-left",
                isActive
                  ? "bg-white border-primary shadow-lg ring-2 ring-primary/5 scale-[1.02]"
                  : "bg-slate-50 border-transparent hover:border-slate-200"
              )}
            >
              <div
                className={cn(
                  "p-2.5 rounded-xl",
                  isActive ? "bg-primary text-white" : p.bg + " " + p.color
                )}
              >
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">
                  Especialista
                </p>
                <p className="text-xs font-black text-primary uppercase">{p.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 flex flex-col h-[650px] card-shadow border-none overflow-hidden bg-white rounded-[2.5rem]">
          <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
                <Sparkles className="size-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg font-headline font-black text-primary uppercase">
                  NAI Chat Assistant
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Contexto: {PERSONAS[activePersona].label}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <VoiceAssistantButton
                onTranscript={(text) => handleSend(text)}
                isProcessing={isLoading}
                isSpeaking={isSpeaking}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
            <ScrollArea className="flex-1 p-8">
              <div className="space-y-8">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-6 rounded-3xl ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-tr-none shadow-xl"
                          : "bg-slate-50 border rounded-tl-none text-primary shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-sm leading-relaxed font-medium">{msg.content}</p>
                        {msg.audioUrl && (
                          <button
                            onClick={() => playAudio(msg.audioUrl!)}
                            className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
                          >
                            <Volume2 className="size-4 text-primary" />
                          </button>
                        )}
                      </div>

                      {msg.references && msg.references.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-primary/10">
                          {msg.references.map((ref, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[9px] font-black uppercase bg-primary/10 text-primary border-none h-6"
                            >
                              <BookOpen className="size-2.5 mr-1" /> {ref}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {msg.advice && (
                        <div className="mt-5 p-4 bg-accent/5 rounded-2xl border border-accent/10 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                            <Info className="size-8" />
                          </div>
                          <p className="text-[9px] font-black text-primary uppercase flex items-center gap-1.5 mb-2 tracking-widest">
                            <Sparkles className="size-3 text-accent fill-current" /> Insight
                            Estratégico Nextcon:
                          </p>
                          <p className="text-xs italic text-primary/80 leading-relaxed font-medium">
                            "{msg.advice}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 p-6 rounded-3xl rounded-tl-none animate-pulse flex items-center gap-3 border shadow-sm">
                      <div className="size-8 rounded-xl bg-primary flex items-center justify-center animate-bounce">
                        <span className="font-black text-white text-xs">N</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">
                        NAI Neural Processing...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-6 border-t bg-slate-50/50 flex gap-3"
            >
              <Input
                placeholder="Pergunte sobre eSocial, NRs ou Contestações..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-14 bg-white border-none shadow-inner rounded-2xl font-medium px-6 focus-visible:ring-primary/5"
                disabled={isLoading}
              />
              <Button
                type="submit"
                className="h-14 w-14 p-0 bg-primary hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20"
                disabled={isLoading || !query}
              >
                <Send className="size-6" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary text-white pb-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="size-3 text-accent" /> Habilidades Ativas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {suggestedSkills.map((skill) => {
                const SkillIcon = skill.icon;
                return (
                  <button
                    key={skill.label}
                    onClick={() => setQuery(skill.query)}
                    className="w-full text-left p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group shadow-sm bg-white"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-slate-50 rounded-lg text-primary/40 group-hover:bg-primary group-hover:text-white transition-all">
                        <SkillIcon className="size-3.5" />
                      </div>
                      <span className="text-[10px] font-black uppercase text-primary/60 group-hover:text-primary tracking-tighter">
                        {skill.label}
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground group-hover:text-primary/80 line-clamp-2 italic font-medium">
                      "{skill.query}"
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-slate-900 text-white rounded-[2rem] overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
              <Scale className="size-24 text-accent" />
            </div>
            <CardHeader>
              <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2 tracking-widest text-accent">
                <Volume2 className="size-3" /> Modo Mãos Livres
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] leading-relaxed opacity-60 italic font-medium">
                Utilize o microfone para interagir com a NAI durante vistorias de campo. A IA
                processará sua fala e responderá em áudio para maior agilidade.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
