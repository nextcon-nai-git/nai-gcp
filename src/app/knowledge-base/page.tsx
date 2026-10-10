"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import {
  Sparkles,
  Send,
  BookOpen,
  ShieldCheck,
  Loader2,
  Stethoscope,
  HardHat,
  Volume2,
  ShoppingCart,
  Rocket,
  AlertTriangle,
  RefreshCcw,
  Zap,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { runKnowledgeAssistant } from "@/ai/flows/knowledge-assistant-flow";
import { cn } from "@/lib/utils";
import { VoiceAssistantButton } from "@/components/voice/voice-assistant-button";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  references?: string[];
  advice?: string;
  audioUrl?: string;
}

type Persona = "comercial" | "seguranca" | "saude";

const PERSONAS = {
  comercial: {
    label: "Consultoria Estratégica",
    icon: ShoppingCart,
    color: "text-accent",
    bg: "bg-accent/5",
  },
  seguranca: {
    label: "Segurança do Trabalho",
    icon: HardHat,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  saude: {
    label: "Saúde do Trabalho",
    icon: Stethoscope,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
};

const QUICK_OBJECTIVES = [
  {
    id: "opening",
    label: "Estou abrindo a empresa agora e preciso regularizar tudo.",
    icon: Rocket,
    text: "Estou abrindo minha empresa agora e preciso de uma proposta para regularizar todos os laudos e exames de SST.",
  },
  {
    id: "notification",
    label: "Recebi uma cobrança/notificação e preciso resolver rápido.",
    icon: AlertTriangle,
    text: "Recebi uma notificação do governo e preciso resolver as pendências de SST com urgência.",
  },
  {
    id: "renewal",
    label: "Só quero renovar os exames e os laudos do ano passado.",
    icon: RefreshCcw,
    text: "Gostaria de renovar os exames periódicos e os laudos PGR/PCMSO do ano passado.",
  },
  {
    id: "esocial",
    label: "Quero apenas enviar os dados para o eSocial sem errar.",
    icon: Zap,
    text: "Preciso de ajuda apenas para garantir o envio correto dos eventos de SST para o eSocial.",
  },
];

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [activePersona, setActivePersona] = React.useState<Persona>("comercial");
  const [messages, setMessages] = React.useState<Message[]>([]);

  // Fix Hydration for initial message
  React.useEffect(() => {
    setMessages([
      {
        id: "initial",
        role: "ai",
        content:
          "Olá! Sou a NAI, a inteligência da Nextcon Saúde. Informe o Ramo da sua empresa e o número de funcionários para que eu possa gerar uma proposta estratégica de proteção agora mesmo.",
      },
    ]);
  }, []);

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = async (text?: string) => {
    const inputContent = text || query;
    if (!inputContent.trim() || isLoading) return;

    setQuery("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: inputContent },
    ]);
    setIsLoading(true);

    try {
      const result = await runKnowledgeAssistant({ query: inputContent }, await getActionIdToken());
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: result.answer,
        references: result.references,
        advice: result.advice,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na NAI", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Cérebro IA Nextcon
          </h1>
          <p className="text-muted-foreground uppercase text-[10px] font-black tracking-widest mt-2 flex items-center gap-2">
            <Sparkles className="size-3 text-accent" /> Gerador de Propostas e Inteligência Técnica.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-primary text-primary px-4 h-10 flex items-center gap-2 font-black uppercase text-[10px] bg-white"
        >
          <ShieldCheck className="size-3" /> NAI STRATEGIC ENGINE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(PERSONAS) as [Persona, typeof PERSONAS.comercial][]).map(([id, p]) => {
          const Icon = p.icon;
          const isActive = activePersona === id;
          return (
            <button
              key={id}
              onClick={() => setActivePersona(id)}
              className={cn(
                "p-4 rounded-[1.5rem] border transition-all flex items-center gap-4 text-left",
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
              <p className="text-xs font-black text-primary uppercase leading-tight">{p.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 flex flex-col h-[750px] card-shadow border-none overflow-hidden bg-white rounded-[2.5rem]">
          <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xl">
                <Bot className="size-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg font-headline font-black text-primary uppercase">
                  Painel de Consultoria
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {PERSONAS[activePersona].label}
                </CardDescription>
              </div>
            </div>
            <VoiceAssistantButton
              onTranscript={handleSend}
              isProcessing={isLoading}
              isSpeaking={isSpeaking}
            />
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col text-left">
            <ScrollArea ref={scrollAreaRef} className="flex-1 p-8">
              <div className="space-y-8">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-6 rounded-3xl ${msg.role === "user" ? "bg-primary text-white rounded-tr-none shadow-xl" : "bg-slate-50 border rounded-tl-none text-primary shadow-sm"}`}
                    >
                      <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      {msg.advice && (
                        <div className="mt-5 p-4 bg-accent/5 rounded-2xl border border-accent/10">
                          <p className="text-[9px] font-black text-primary uppercase mb-2">
                            Análise Estratégica:
                          </p>
                          <p className="text-xs italic text-primary/80 font-medium">
                            "{msg.advice}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {messages.length === 1 && !isLoading && (
                  <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 ml-2">
                      Qual seu objetivo hoje?
                    </p>
                    {QUICK_OBJECTIVES.map((obj) => (
                      <button
                        key={obj.id}
                        onClick={() => handleSend(obj.text)}
                        className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl text-left hover:border-primary/20 hover:shadow-md transition-all group"
                      >
                        <div className="p-2.5 bg-slate-50 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <obj.icon className="size-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 leading-tight uppercase">
                          {obj.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 p-6 rounded-3xl animate-pulse flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-primary flex items-center justify-center animate-bounce text-white text-xs font-black">
                        N
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">
                        NAI Processando...
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
                placeholder="Informe o Ramo, Vidas ou sua dúvida..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-14 bg-white rounded-2xl border-none shadow-inner font-medium"
                disabled={isLoading}
              />
              <Button
                type="submit"
                className="h-14 w-14 p-0 bg-primary rounded-2xl shadow-lg"
                disabled={isLoading || !query}
              >
                <Send className="size-6 text-accent" />
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="lg:col-span-1 space-y-6 text-left">
          <Card className="border-none bg-primary text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Zap className="size-20" />
            </div>
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-accent">
                <BookOpen className="size-3" /> Guia de Qualificação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <p className="text-xs text-white/60 leading-relaxed italic">
                "A NAI utiliza inteligência financeira para calcular o investimento baseado no seu
                Grau de Risco estimado."
              </p>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                <p className="text-[9px] font-black uppercase text-accent">O que informar:</p>
                <ul className="space-y-2 text-[10px] text-slate-300 font-medium">
                  <li>• Ramo de Atividade</li>
                  <li>• Quantidade de Funcionários</li>
                  <li>• Objetivo (eSocial, Laudos, etc)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
