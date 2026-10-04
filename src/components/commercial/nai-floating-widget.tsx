"use client";

import * as React from "react";
import {
  X,
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Bot,
  FileText,
  Calendar,
  Send,
  Menu,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runKnowledgeAssistant } from "@/ai/flows/knowledge-assistant-flow";
import { CLINICAS_BRASIL_MESTRE } from "@/components/providers/occupational-clinics-map";
import { salvarLeadNai } from "@/actions/save-nai-lead";

const NAI_AVATAR_URL =
  "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/logo%2FAvatar%20Nextcon%20NAI.png?alt=media&token=1bd23213-6ca1-427b-bbb2-41fa944ae861";

interface SkillItem {
  id: string;
  title: string;
  desc: string;
  icon: any;
  color: string;
  initialPrompt: string;
  firstAiQuestion: string;
}

const AGENT_CONFIG = {
  header: {
    title: "NAI",
    subtitle: "Consultora Comercial Estratégica",
  },
  skills: [
    {
      id: "documentos",
      title: "Elaboração de Documentos (PGR, LTCAT, etc.)",
      desc: "Gestão e emissão completa de PGR, PCMSO, LTCAT e programas de SST com conformidade eSocial.",
      icon: FileText,
      color: "text-emerald-600",
      initialPrompt:
        "Quero elaborar ou renovar os documentos de SST da minha empresa (PGR, PCMSO, LTCAT, etc.). Como você pode me ajudar?",
      firstAiQuestion:
        "Perfeito! A elaboração dos programas de SST (PGR, PCMSO e LTCAT) é essencial para garantir a conformidade legal da sua empresa e evitar multas do eSocial.\n\nPara que eu possa desdobrar sua proposta estratégica, por favor me informe:\n\n1️⃣ Qual o ramo de atuação da sua empresa?\n2️⃣ Quantos colaboradores você possui?\n3️⃣ Em qual cidade/estado você está?",
    },
    {
      id: "exames",
      title: "Agendamento de Exames (ASO)",
      desc: "Agendamento ágil de ASOs e exames complementares em clínicas credenciadas em todo o Brasil.",
      icon: Calendar,
      color: "text-accent",
      initialPrompt:
        "Preciso agendar exames ocupacionais (ASO) para meus colaboradores. Quais informações você precisa?",
      firstAiQuestion:
        "Excelente! Agendamos ASOs (Admissional, Periódico, Demissional) em rede credenciada por todo o Brasil com integração ao eSocial.\n\nPoderia me informar o **seu nome, bairro e número de WhatsApp** para enviarmos a autorização da clínica mais próxima?",
    },
    {
      id: "outros",
      title: "Outras Demandas de SST (Especificar)",
      desc: "Consultoria personalizada para envio ao eSocial, treinamentos de NRs e soluções sob medida.",
      icon: Sparkles,
      color: "text-orange-600",
      initialPrompt:
        "Tenho uma demanda específica de SST e gostaria de uma consultoria personalizada.",
      firstAiQuestion:
        "Com certeza! Sou especialista em soluções estratégicas de Saúde e Segurança do Trabalho.\n\nPor favor, me informe:\n\n📌 Qual a necessidade exata da sua empresa hoje? (Ex: Treinamentos de NRs, envio eSocial S-2220/S-2240, Laudos ou suporte para fiscalização)",
    },
  ] as SkillItem[],
  welcome_msg:
    "Olá! Sou a NAI, consultora especialista em gestão estratégica de SST da Nextcon. Como posso ajudar sua empresa hoje?",
};

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  advice?: string;
  whatsappAction?: boolean;
}

export function NaiFloatingWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [chatMode, setChatMode] = React.useState(false);
  const [selectedSkill, setSelectedSkill] = React.useState<SkillItem | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    if (chatMode) {
      scrollToBottom();
    }
  }, [messages, isLoading, chatMode]);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSelectSkill = (skill: SkillItem) => {
    setSelectedSkill(skill);
    setChatMode(true);
    setMessages([
      { id: "1", role: "user", content: skill.initialPrompt },
      { id: "2", role: "ai", content: skill.firstAiQuestion },
    ]);
  };

  const handleBackToMenu = () => {
    setChatMode(false);
    setSelectedSkill(null);
    setMessages([]);
    setInput("");
  };

  const generateResponse = async (
    userText: string,
    currentSkill: SkillItem,
    history: Message[]
  ) => {
    // 1. Try Genkit AI Server Action
    try {
      const contextPrompt = history
        .map((m) => `${m.role === "user" ? "Cliente" : "NAI"}: ${m.content}`)
        .join("\n");

      const fullQuery = `ESPECIALIDADE SELECIONADA: ${currentSkill.title}\n\nHISTÓRICO:\n${contextPrompt}\n\nNOVA MENSAGEM DO CLIENTE: ${userText}\n\nINSTRUÇÃO: Como NAI (consultora especialista de SST da Nextcon), responda de forma muito atenciosa, analisando a resposta do cliente. Se ele já forneceu os dados (ramo, colaboradores, local), monte uma síntese/proposta com estimativa e próximos passos. Se faltou algo, pergunte objetivamente para concluir a proposta.`;

      const res = await runKnowledgeAssistant({ query: fullQuery });
      if (res && res.answer) {
        return { content: res.answer, advice: res.advice };
      }
    } catch (e) {
      console.warn("AI server action fallback activated:", e);
    }

    // 2. Intelligent Fallback Strategy
    const textLower = userText.toLowerCase();

    if (currentSkill.id === "documentos") {
      if (
        textLower.includes("sim") ||
        textLower.includes("quero") ||
        textLower.includes("enviar") ||
        textLower.includes("whatsapp") ||
        textLower.includes("fechar") ||
        textLower.includes("ok")
      ) {
        return {
          content:
            "Ótimo! Por favor, informe o **Nome da sua Empresa**, seu **Nome** e **WhatsApp com DDD** para que um de nossos consultores envie a proposta oficial para assinatura digital. 🚀",
          advice: "Atendimento prioritário em minutos pelo WhatsApp Comercial.",
          whatsappAction: true,
        };
      }
      return {
        content: `Perfeito! Analisei suas informações referente à **${currentSkill.title}**.\n\n📊 **Estimativa de Investimento Nextcon:**\n• **PGR + PCMSO + LTCAT:** A partir de R$ 950,00 (anual)\n• **Gestão eSocial (S-2220 / S-2240):** R$ 20,00 a R$ 30,00 por vida/mês\n\n📌 **Benefícios inclusos:**\n✅ Laudos com ART/CRM e assinatura digital\n✅ Envio automatizado ao eSocial sem risco de multas\n✅ Suporte técnico com Engenheiro e Médico do Trabalho\n\nGostaria que um consultor formalize esta proposta e envie os detalhes no seu WhatsApp ou Email?`,
        advice: "Sem fidelidade abusiva e com suporte técnico especializado.",
      };
    }

    if (currentSkill.id === "exames") {
      // User agreement to proposed clinic unit
      if (
        textLower.includes("sim") ||
        textLower.includes("de acordo") ||
        textLower.includes("concordo") ||
        textLower.includes("pode ser") ||
        textLower.includes("ok") ||
        textLower.includes("fechado") ||
        textLower.includes("perfeito")
      ) {
        return {
          content: `Perfeito! Confirmação registrada com sucesso. 🚀\n\nPara concluirmos a reserva da vaga e emitirmos a **Guia de Encaminhamento Ocupacional**, por favor me informe:\n\n1️⃣ **Nome Completo do Colaborador**\n2️⃣ **CPF do Colaborador**\n3️⃣ **Cargo / Função**\n4️⃣ **Tipo do Exame** (Admissional, Periódico, Demissional)\n\nEnviaremos a autorização imediatamente!`,
          advice: "Guia de autorização enviada digitalmente em minutos.",
          whatsappAction: true,
        };
      }

      // User rejected clinic or requested another location
      if (
        textLower.includes("não") ||
        textLower.includes("nao") ||
        textLower.includes("outra") ||
        textLower.includes("mudar") ||
        textLower.includes("diferente")
      ) {
        return {
          content:
            "Entendido! Sem problemas.\n\nPor favor, me informe o nome de outro **bairro, cidade ou região** de sua preferência para localizarmos uma nova unidade credenciada!",
          advice: "Atendimento em mais de 3.500 clínicas credenciadas no Brasil.",
        };
      }

      // User entered location/neighborhood details -> Search nearest clinic!
      const matchedClinic = CLINICAS_BRASIL_MESTRE.find(
        (c) =>
          c.city.toLowerCase().includes(textLower) ||
          c.address.toLowerCase().includes(textLower) ||
          c.name.toLowerCase().includes(textLower)
      );

      const clinicName = matchedClinic
        ? matchedClinic.name
        : `Clínica Credenciada Nextcon (${userText})`;
      const clinicAddress = matchedClinic
        ? matchedClinic.address
        : `Região do ${userText} (Unidade Credenciada mais próxima)`;

      return {
        content: `Localizei a clínica credenciada mais próxima para o seu atendimento:\n\n🏥 **${clinicName}**\n📍 **Endereço:** ${clinicAddress}\n🩺 **Exames atendidos:** ASO (Admissional, Periódico, Demissional), Audiometria, Análises Clínicas e Exames Complementares\n\n**Você está de acordo em realizarmos o agendamento nesta unidade?**`,
        advice: "Clínica parceira com laudo e ASO integrados ao eSocial.",
      };
    }

    // Default Fallback
    if (
      textLower.includes("sim") ||
      textLower.includes("quero") ||
      textLower.includes("contato") ||
      textLower.includes("ok")
    ) {
      return {
        content:
          "Ótimo! Qual o melhor **WhatsApp com DDD** e **Nome do Responsável** para enviarmos o direcionamento técnico?",
        advice: "Consultoria personalizada Nextcon Saúde.",
        whatsappAction: true,
      };
    }

    return {
      content: `Anotado! Compreendi sua solicitação sobre **${currentSkill.title}**.\n\nNossa equipe de Engenharia de Segurança do Trabalho e Medicina Ocupacional está pronta para atender essa necessidade com agilidade.\n\nPara que um consultor sênior entre em contato com a proposta ideal, por favor informe seu **Nome**, **Nome da Empresa** e **WhatsApp ou E-mail**.`,
      advice: "Solução sob medida para o seu negócio.",
    };
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input.trim();
    if (!textToSend || isLoading || !selectedSkill) return;

    if (!customText) setInput("");

    // Add user message
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: textToSend };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await generateResponse(textToSend, selectedSkill, updatedMessages);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.content,
        advice: response.advice,
        whatsappAction: response.whatsappAction,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Persist Lead in Firestore nai_leads collection non-blocking
      salvarLeadNai({
        skillTitle: selectedSkill.title,
        userText: textToSend,
        aiResponse: response.content,
        summary: `Especialidade: ${selectedSkill.title} | Mensagem: ${textToSend}`,
      }).catch((err) => console.warn("Lead storage warning:", err));
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content:
            "Entendido! Registrei suas informações. Por favor, informe seu **Nome** e **WhatsApp com DDD** para formalizarmos o atendimento.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const openWhatsAppDirect = (customMsg?: string) => {
    const text =
      customMsg ||
      `Olá, equipe Nextcon Saúde! Estava conversando com a NAI sobre ${selectedSkill?.title || "SST"} e gostaria de concluir meu atendimento.`;
    const url = `https://wa.me/554135007984?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const getQuickReplies = () => {
    if (!selectedSkill) return [];
    if (selectedSkill.id === "exames") {
      return [
        "Sim, de acordo com a clínica!",
        "Prefiro buscar em outro bairro",
        "Chamar no WhatsApp Comercial",
      ];
    }
    if (selectedSkill.id === "documentos") {
      return [
        "Sim, formalizar proposta por e-mail",
        "Quero falar no WhatsApp",
        "Dúvidas de eSocial",
      ];
    }
    return ["Falar no WhatsApp", "Solicitar Ligação de Consultor"];
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <Card className="w-[calc(100vw-1.5rem)] max-w-[420px] border-none shadow-2xl rounded-[2.5rem] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 bg-white flex flex-col h-[520px] sm:h-[590px] max-h-[82vh]">
          {/* Header */}
          <CardHeader className="bg-primary text-white p-5 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bot className="size-32" />
            </div>

            <div className="flex items-center justify-between relative z-20 mb-2">
              {chatMode ? (
                <button
                  onClick={handleBackToMenu}
                  className="flex items-center gap-1.5 text-[11px] font-black uppercase text-accent hover:text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl backdrop-blur-md transition-all shadow-sm cursor-pointer"
                  title="Voltar ao Menu Principal"
                >
                  <ArrowLeft className="size-3.5" /> Voltar ao Menu
                </button>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent bg-white/10 px-3 py-1 rounded-full">
                  Inteligência NAI SST
                </span>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 relative z-10 text-left">
              <div className="size-12 rounded-2xl bg-[#090e24] flex items-center justify-center border-2 border-white/20 overflow-hidden relative shadow-2xl shrink-0">
                <Image src={NAI_AVATAR_URL} alt="NAI" fill className="object-cover" priority />
              </div>
              <div>
                <CardTitle className="text-base font-black uppercase tracking-tight font-headline text-white">
                  {AGENT_CONFIG.header.title}
                </CardTitle>
                <CardDescription className="text-[10px] font-black text-accent uppercase tracking-[0.15em] truncate max-w-[220px]">
                  {chatMode ? selectedSkill?.title : AGENT_CONFIG.header.subtitle}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {/* Body Content */}
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden text-left bg-slate-50/50">
            {!chatMode ? (
              /* Specialty Selection Menu View */
              <div className="p-6 overflow-y-auto space-y-6 flex-1 max-h-[480px]">
                <div className="bg-white p-5 rounded-[2rem] rounded-tl-none border-l-4 border-accent shadow-sm relative">
                  <Sparkles className="absolute -top-2 -right-2 size-5 text-accent animate-pulse" />
                  <p className="text-xs italic text-slate-700 font-bold leading-relaxed">
                    &quot;{AGENT_CONFIG.welcome_msg}&quot;
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Selecione uma Especialidade para Iniciar:
                  </p>

                  {AGENT_CONFIG.skills.map((skill) => {
                    const Icon = skill.icon;
                    return (
                      <button
                        key={skill.id}
                        onClick={() => handleSelectSkill(skill)}
                        className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-primary hover:shadow-md transition-all group flex gap-4 items-start cursor-pointer active:scale-[0.98]"
                      >
                        <div
                          className={cn(
                            "p-2.5 rounded-xl bg-slate-50 transition-colors group-hover:bg-primary group-hover:text-white shadow-inner shrink-0",
                            skill.color
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black text-primary uppercase mb-1">
                              {skill.title}
                            </h4>
                            <ArrowRight className="size-3.5 text-slate-300 group-hover:text-primary transition-colors" />
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium leading-tight">
                            {skill.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-dashed space-y-3">
                  <Button
                    asChild
                    className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg gap-2 hover:scale-[1.01] transition-transform"
                  >
                    <Link href="/knowledge-base" onClick={() => setIsOpen(false)}>
                      Cérebro IA Completo <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                  <p className="text-[8px] font-black text-slate-300 text-center uppercase tracking-[0.3em]">
                    Nextcon Saúde Empresarial 2026
                  </p>
                </div>
              </div>
            ) : (
              /* Active Chat View with Native Overflow Y Scrolling */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div
                  ref={chatScrollContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px] scrollbar-thin scroll-smooth"
                >
                  <div className="space-y-4 pb-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2.5 max-w-[92%] text-xs font-medium leading-relaxed animate-in fade-in duration-300",
                          msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        {msg.role === "ai" && (
                          <div className="size-7 rounded-xl bg-[#090e24] flex items-center justify-center border border-white/20 overflow-hidden relative shrink-0 shadow-sm mt-0.5">
                            <Image
                              src={NAI_AVATAR_URL}
                              alt="NAI"
                              fill
                              className="object-cover"
                              sizes="28px"
                            />
                          </div>
                        )}
                        <div
                          className={cn(
                            "p-3.5 rounded-2xl shadow-sm text-left whitespace-pre-line text-[11px]",
                            msg.role === "user"
                              ? "bg-primary text-white rounded-tr-none font-semibold"
                              : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                          )}
                        >
                          {msg.content}
                          {msg.advice && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[9px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="size-3 text-accent" /> {msg.advice}
                            </div>
                          )}

                          {msg.whatsappAction && (
                            <Button
                              onClick={() => openWhatsAppDirect()}
                              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] rounded-xl h-10 gap-2 shadow-md"
                            >
                              <MessageSquare className="size-4" /> Finalizar no WhatsApp Comercial
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-bold p-3 bg-white rounded-2xl border border-slate-100 w-fit animate-pulse">
                        <Loader2 className="size-4 animate-spin text-primary" />
                        NAI está analisando suas informações...
                      </div>
                    )}

                    {/* Auto-scroll Target */}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Quick Reply Pills */}
                <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                  {getQuickReplies().map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (reply.toLowerCase().includes("whatsapp")) {
                          openWhatsAppDirect();
                        } else {
                          handleSend(reply);
                        }
                      }}
                      className="px-2.5 py-1 text-[9px] font-bold uppercase text-primary bg-slate-100 hover:bg-primary hover:text-white rounded-lg whitespace-nowrap transition-colors cursor-pointer border border-slate-200/60 shrink-0"
                    >
                      {reply}
                    </button>
                  ))}
                </div>

                {/* Back to Menu Bar */}
                <div className="px-4 py-1.5 bg-slate-100/70 border-t border-slate-100 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={handleBackToMenu}
                    className="text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Menu className="size-3 text-accent" /> Voltar ao Menu Principal
                  </button>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">
                    IA NAI Assist
                  </span>
                </div>

                {/* Chat Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite seu bairro, dúvida ou resposta..."
                    className="flex-1 h-10 bg-slate-50 border-none rounded-xl text-xs font-medium focus-visible:ring-primary"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="h-10 w-10 p-0 rounded-xl bg-primary text-white hover:bg-primary/90 shrink-0 shadow-md cursor-pointer"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={handleToggle}
        className={cn(
          "h-12 sm:h-16 px-4 sm:px-8 rounded-full shadow-2xl transition-all duration-500 flex items-center gap-2.5 sm:gap-3 hover:scale-105 active:scale-90 group overflow-hidden border-2 border-white/20 cursor-pointer",
          isOpen ? "bg-primary text-white" : "gradient-nextcon text-white"
        )}
      >
        <div className="relative size-8 sm:size-10 rounded-full overflow-hidden border-2 border-white/20 bg-[#090e24] flex items-center justify-center shrink-0">
          <Image src={NAI_AVATAR_URL} alt="NAI" fill className="object-cover" sizes="40px" />
          {!isOpen && (
            <span className="absolute top-0 right-0 size-2 bg-accent rounded-full border-2 border-primary animate-ping" />
          )}
        </div>
        <span className="font-black uppercase text-[10px] sm:text-xs tracking-widest">
          {isOpen ? "Fechar" : "NAI"}
        </span>
      </button>
    </div>
  );
}
