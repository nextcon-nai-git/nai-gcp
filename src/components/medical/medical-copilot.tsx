"use client";

import * as React from "react";
import { Send, Loader2, Bot, User, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
};

interface MedicalCopilotProps {
  pacienteId: string;
  className?: string;
}

export default function MedicalCopilot({ pacienteId, className }: MedicalCopilotProps) {
  const { user } = useUser();
  const { activeClientId } = useSgi();
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content: "Olá, doutor(a). Sou a NAI. Como posso auxiliar na análise deste paciente hoje?",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !user || !activeClientId || activeClientId === "all") return;

    const userContent = input;
    const userMessageId = Date.now().toString();
    const aiMessageId = (Date.now() + 1).toString();

    setInput("");

    // Adiciona mensagem do usuário e cria placeholder para a resposta da IA
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: userContent },
      { id: aiMessageId, role: "ai", content: "" },
    ]);

    setIsTyping(true);

    try {
      const response = await fetch("/api/medical-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          mensagemMedico: userContent,
          pacienteId: pacienteId,
          companyId: activeClientId,
        }),
      });

      if (!response.ok) throw new Error("Falha na conexão com o motor NAI");
      if (!response.body) throw new Error("Stream de dados inacessível");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Atualiza a mensagem da IA progressivamente
        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg))
        );
      }
    } catch (error) {
      console.error("Erro no chat clínico:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content:
                  "⚠️ Erro na conexão neural. Por favor, verifique o histórico do paciente manualmente ou tente novamente.",
              }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-[550px] w-full border border-slate-100 rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500",
        className
      )}
    >
      {/* Header do Copilot */}
      <div className="bg-primary p-5 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Zap className="size-12 text-accent" />
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative size-10 rounded-xl overflow-hidden border border-white/20 shadow-md bg-white/10 shrink-0">
            <img
              src="/images/nai_health_avatar.png"
              alt="Avatar NAI 3D"
              className="size-full object-cover"
            />
          </div>
          <div>
            <h3 className="font-black uppercase text-[10px] tracking-[0.2em] leading-none mb-1">
              Copilot Clínico NAI
            </h3>
            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
              IA Diagnostic Support 2026
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-[8px] border-emerald-500/30 text-emerald-400 font-black uppercase h-6 bg-emerald-500/5 px-2"
        >
          <div className="size-1.5 bg-emerald-500 rounded-full animate-pulse mr-1.5" />
          Live Stream
        </Badge>
      </div>

      {/* Área de Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scrollbar-thin"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
          >
            <div
              className={cn(
                "flex items-center justify-center h-8 w-8 rounded-xl shrink-0 shadow-sm transition-all duration-500",
                msg.role === "user" ? "bg-primary text-white" : "bg-white text-slate-400 border"
              )}
            >
              {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>

            <div
              className={cn(
                "p-4 rounded-2xl max-w-[85%] text-[11px] leading-relaxed font-medium shadow-sm animate-in fade-in duration-300 whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-white rounded-tr-none"
                  : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
              )}
            >
              {msg.role === "ai" && msg.content === "" ? (
                <div className="flex items-center gap-2 text-slate-400 italic">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Consultando base CID e histórico...</span>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input de Comando */}
      <form
        onSubmit={sendMessage}
        className="p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0"
      >
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isTyping}
          placeholder="Dúvida clínica ou CID (Ex: Qual o CID para lombalgia?)"
          className="flex-1 h-12 bg-slate-50 border-none rounded-xl text-xs font-bold shadow-inner focus-visible:ring-primary/10 transition-all placeholder:text-slate-300"
        />
        <Button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="size-12 p-0 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-xl shadow-primary/10 shrink-0 transition-transform active:scale-95"
        >
          {isTyping ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send size={18} className="text-accent" />
          )}
        </Button>
      </form>
      <div className="px-4 pb-3 bg-white text-center">
        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">
          NAI Forensic Support • O parecer da IA deve ser validado pelo médico examinador.
        </p>
      </div>
    </div>
  );
}
