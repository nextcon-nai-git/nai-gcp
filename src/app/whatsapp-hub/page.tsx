"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Phone,
  UserCheck,
  MessageSquare,
  Users,
  Sparkles,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  ChevronRight,
  Zap,
  Building,
  HeartPulse,
  HardHat,
  Stethoscope,
  DollarSign,
  Calendar,
  Briefcase,
  Copy,
  Check,
  Mic,
  Camera,
  FileCheck2,
} from "lucide-react";
import {
  WHATSAPP_DEPARTMENTS,
  NEXTCON_WHATSAPP_DISPLAY,
  NEXTCON_WHATSAPP_NUMBER,
  generateWhatsappWelcomeMenu,
} from "@/lib/whatsapp-routing";
import {
  sendSimulatedWhatsappMessage,
  sendSimulatedProviderMediaMessage,
} from "@/actions/whatsapp-bot-actions";
import type { WhatsappSessionState } from "@/ai/flows/whatsapp-agent-flow";

interface ChatItem {
  sender: "user" | "bot" | "human";
  text: string;
  time: string;
  isHandoff?: boolean;
  humanName?: string;
  directLink?: string;
}

export default function WhatsappHubPage() {
  const [activeTab, setActiveTab] = useState<"simulator" | "departments" | "webhook">("simulator");
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      sender: "bot",
      text: generateWhatsappWelcomeMenu(),
      time: "Agora",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<Partial<WhatsappSessionState>>({
    userPhone: "554199887766",
    userName: "Cliente Demonstração",
    history: [],
    activeDepartmentNumber: null,
    isHumanMode: false,
  });
  const [selectedDeptTest, setSelectedDeptTest] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newMessages: ChatItem[] = [
      ...messages,
      {
        sender: "user",
        text: text,
        time: currentTime,
      },
    ];

    setMessages(newMessages);
    if (!textToSend) setInputText("");
    setIsLoading(true);

    try {
      const response = await sendSimulatedWhatsappMessage(
        {
          phone: sessionState.userPhone || "554199887766",
          message: text,
          sessionState: sessionState,
        },
        await getActionIdToken()
      );

      setSessionState(response.updatedState);

      setMessages((prev) => [
        ...prev,
        {
          sender: response.isHumanHandoff ? "human" : "bot",
          text: response.replyText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isHandoff: response.isHumanHandoff,
          humanName: response.humanResponsible?.name,
          directLink: response.humanResponsible?.directWhatsappLink,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "⚠️ Erro ao processar mensagem. Tente novamente ou digite MENU.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulação de Áudio de Prestador/Clínica via Gemini 3.8
  const handleSimulateProviderAudio = async () => {
    const audioTranscript =
      "Doutor Rodrigo da Clínica Ocupacional São Paulo. Acabamos de realizar o exame admissional do Marcos Vinicius Almeida para a empresa CONSTRUFAM ENGENHARIA LTDA, função de Operador de Betoneira. O colaborador foi considerado APTO para a função e para trabalho em altura sem restrições. Pressão 12 por 8, eletrocardiograma e audiometria sem alterações.";
    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: `🎙️ *ÁUDIO DO PRESTADOR (0:24)*\n\n"${audioTranscript}"`,
        time: currentTime,
      },
    ]);

    setIsLoading(true);
    try {
      const res = await sendSimulatedProviderMediaMessage(
        {
          mediaType: "audio",
          textOrTranscript: audioTranscript,
          providerPhone: "5511988887777",
        },
        await getActionIdToken()
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.replyText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Simulação de Envio de Foto de ASO pela Clínica
  const handleSimulateProviderPhoto = async () => {
    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: `📷 *FOTO DO ASO IMPRESSO*\n[Documento Digitalizado: ASO_CONSTRUFAM_MARCOS_ALMEIDA.pdf/jpg - Assinado pelo Dr. Rodrigo CRM/SP 148902]`,
        time: currentTime,
      },
    ]);

    setIsLoading(true);
    try {
      const res = await sendSimulatedProviderMediaMessage(
        {
          mediaType: "image",
          textOrTranscript:
            "ASO Impresso Admissional de Marcos Vinicius Almeida pela Construfam Engenharia, apto com exames de ECG e Audiometria anexos.",
          providerPhone: "5511988887777",
        },
        await getActionIdToken()
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.replyText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setSessionState({
      userPhone: "554199887766",
      userName: "Cliente Demonstração",
      history: [],
      activeDepartmentNumber: null,
      isHumanMode: false,
    });
    setMessages([
      {
        sender: "bot",
        text: generateWhatsappWelcomeMenu(),
        time: "Agora",
      },
    ]);
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const getDeptIcon = (id: string) => {
    switch (id) {
      case "comercial":
        return <Briefcase className="w-5 h-5 text-amber-500" />;
      case "agendamento":
        return <Calendar className="w-5 h-5 text-cyan-500" />;
      case "financeiro":
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case "medico_trabalho":
        return <Stethoscope className="w-5 h-5 text-rose-500" />;
      case "ergonomista":
        return <Activity className="w-5 h-5 text-purple-500" />;
      case "engenheiro_seguranca":
        return <HardHat className="w-5 h-5 text-amber-600" />;
      case "tecnico_seguranca":
        return <Shield className="w-5 h-5 text-blue-500" />;
      case "enfermeiro_trabalho":
        return <HeartPulse className="w-5 h-5 text-teal-500" />;
      case "diretoria":
        return <Building className="w-5 h-5 text-indigo-500" />;
      default:
        return <Bot className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* HEADER PRINCIPAL */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/50">
                Central WhatsApp 24/7 Ativa
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-800/50 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> NAI 3.7 Reasoning Engine
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
              <Phone className="w-8 h-8 text-emerald-400" />
              WhatsApp Bot NAI • {NEXTCON_WHATSAPP_DISPLAY}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Central inteligente com roteamento de 1 a 9 Agentes Especialistas de IA e Transbordo
              Imediato para os Responsáveis Humanos da NextCon.
            </p>
          </div>

          {/* NAVEGAÇÃO DE ABAS */}
          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setActiveTab("simulator")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === "simulator"
                  ? "bg-emerald-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Simulador ao Vivo
            </button>
            <button
              onClick={() => setActiveTab("departments")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === "departments"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" /> 9 Agentes & Humanos
            </button>
            <button
              onClick={() => setActiveTab("webhook")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                activeTab === "webhook"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" /> API & Webhook
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* ABA 1: SIMULADOR WHATSAPP */}
        {activeTab === "simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LADO ESQUERDO: CONTROLES & ATALHOS RÁPIDOS */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Atalhos de Teste Rápido (1-Clique)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Clique nos botões abaixo para simular mensagens e testar o roteamento inteligente:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSendMessage("1")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-amber-400 block">1. Comercial</span>
                    <span className="text-slate-400">Pablo (Propostas)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("2")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-cyan-400 block">2. Agendamento</span>
                    <span className="text-slate-400">Kelly (Exames/ASO)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("3")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-emerald-400 block">3. Financeiro</span>
                    <span className="text-slate-400">Kelly (Boletos/CASSI)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("4")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-rose-400 block">4. Médico Trabalho</span>
                    <span className="text-slate-400">Dr. Rodrigo (PCMSO)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("5")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-purple-400 block">5. Ergonomista</span>
                    <span className="text-slate-400">Henrique (NR-17/AET)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("6")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-amber-500 block">6. Engenheiro</span>
                    <span className="text-slate-400">Felipe (PGR/LTCAT)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("7")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-blue-400 block">7. Técnico Campo</span>
                    <span className="text-slate-400">Plantão SST (DDS/EPI)</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("8")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition"
                  >
                    <span className="font-bold text-teal-400 block">8. Enfermagem</span>
                    <span className="text-slate-400">Ambulatório / Faltas</span>
                  </button>
                  <button
                    onClick={() => handleSendMessage("9")}
                    className="text-left text-xs bg-slate-800/80 hover:bg-slate-700/80 p-2.5 rounded-xl border border-slate-700 transition col-span-1 sm:col-span-2"
                  >
                    <span className="font-bold text-indigo-400 block">9. Diretoria Executiva</span>
                    <span className="text-slate-400">Felipe ou Thiago</span>
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSendMessage("Preciso falar com o Pablo sobre orçamento")}
                    className="text-xs bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/50 px-3 py-1.5 rounded-lg transition"
                  >
                    💬 "Orçamento com Pablo"
                  </button>
                  <button
                    onClick={() => handleSendMessage("Quero agendar exame demissional para amanhã")}
                    className="text-xs bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 px-3 py-1.5 rounded-lg transition"
                  >
                    💬 "Agendar demissional"
                  </button>
                  <button
                    onClick={() => handleSendMessage("Preciso falar com atendente humano")}
                    className="text-xs bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 px-3 py-1.5 rounded-lg transition"
                  >
                    👤 "Falar com Humano"
                  </button>
                  <button
                    onClick={() => handleSendMessage("MENU")}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"
                  >
                    🔄 "MENU"
                  </button>
                </div>
              </div>

              {/* STATUS DA SESSÃO ATUAL */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Estado da Conexão
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Número Conectado:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {NEXTCON_WHATSAPP_DISPLAY}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Setor Ativo:</span>
                    <span className="font-semibold text-slate-200">
                      {sessionState.activeDepartmentNumber
                        ? WHATSAPP_DEPARTMENTS[sessionState.activeDepartmentNumber].name
                        : "Menu Inicial (Triagem)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Modo de Atendimento:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sessionState.isHumanMode
                          ? "bg-amber-950 text-amber-400 border border-amber-800"
                          : "bg-indigo-950 text-indigo-400 border border-indigo-800"
                      }`}
                    >
                      {sessionState.isHumanMode ? "Transbordo Humano Ativo" : "IA NAI 3.8 Autônoma"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* LADO DIREITO: INTERFACE REALISTA DO WHATSAPP */}
            <div className="lg:col-span-7">
              <div className="bg-[#0b141a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[650px]">
                {/* CABEÇALHO WHATSAPP */}
                <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-[#2a3942]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-lg shadow">
                      N
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                        NextCon Intelligence (NAI)
                        <CheckCheck className="w-4 h-4 text-sky-400" />
                      </h3>
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        {NEXTCON_WHATSAPP_DISPLAY} • online
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetChat}
                      title="Reiniciar Conversa"
                      className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-[#2a3942] transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CORPO DO CHAT COM MENSAGENS */}
                <div
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]"
                  style={{
                    backgroundImage:
                      "radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                >
                  {messages.map((msg, index) => {
                    const isUser = msg.sender === "user";
                    const isHuman = msg.sender === "human";

                    return (
                      <div
                        key={index}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-md whitespace-pre-wrap ${
                            isUser
                              ? "bg-[#005c4b] text-slate-100 rounded-tr-none"
                              : isHuman
                                ? "bg-[#202c33] border border-amber-600/50 text-slate-100 rounded-tl-none"
                                : "bg-[#202c33] text-slate-100 rounded-tl-none border border-[#2a3942]"
                          }`}
                        >
                          {/* BADGE DE QUEM RESPONDEU */}
                          {!isUser && (
                            <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-slate-700/50 text-[11px] font-bold">
                              {isHuman ? (
                                <span className="text-amber-400 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Transbordo Humano: {msg.humanName || "Atendente"}
                                </span>
                              ) : (
                                <span className="text-indigo-400 flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  IA Especialista NextCon 3.7
                                </span>
                              )}
                            </div>
                          )}

                          <div className="leading-relaxed">{msg.text}</div>

                          {/* LINK DIRETO DE TRANSBORDO HUMANO */}
                          {msg.directLink && (
                            <div className="mt-3 pt-2 border-t border-slate-700/50">
                              <a
                                href={msg.directLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Iniciar Chat com {msg.humanName || "Especialista"}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
                            <span>{msg.time}</span>
                            {isUser && <CheckCheck className="w-3.5 h-3.5 text-sky-400" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex items-center gap-2 text-slate-400 bg-[#202c33] px-4 py-2 rounded-2xl rounded-tl-none w-fit text-xs border border-[#2a3942]">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      NextCon IA digitando...
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* BARRA DE ATALHOS MULTIMODAIS GEMINI 3.8 */}
                <div className="bg-[#182229] px-3 py-2 border-t border-[#2a3942] flex items-center justify-between gap-2 overflow-x-auto">
                  <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> Prestadores & Clínicas (Gemini
                    3.8):
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleSimulateProviderAudio}
                      disabled={isLoading}
                      className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      🎙️ Áudio de ASO
                    </button>
                    <button
                      onClick={handleSimulateProviderPhoto}
                      disabled={isLoading}
                      className="bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-300 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-sky-400" />
                      📷 Foto de ASO
                    </button>
                  </div>
                </div>

                {/* CAMPO DE DIGITAÇÃO */}
                <div className="bg-[#202c33] p-3 border-t border-[#2a3942] flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Digite um número de 1 a 9 ou sua mensagem..."
                    className="flex-1 bg-[#2a3942] text-slate-100 placeholder-slate-400 text-sm px-4 py-2.5 rounded-xl outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !inputText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition flex items-center justify-center shadow"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: 9 AGENTES & RESPONSÁVEIS HUMANOS */}
        {activeTab === "departments" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-400" />
                Estrutura dos 9 Departamentos & Agentes NAI 3.7
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Ao discar ou enviar mensagem para o número{" "}
                <strong>{NEXTCON_WHATSAPP_DISPLAY}</strong>, o cliente pode selecionar entre 1 e 9
                para ser atendido pela IA do setor e direcionado ao respectivo humano:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.values(WHATSAPP_DEPARTMENTS).map((dept) => (
                <div
                  key={dept.optionNumber}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition shadow-lg group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-extrabold flex items-center justify-center text-sm shadow">
                        {dept.optionNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {getDeptIcon(dept.id)}
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {dept.id}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition">
                      {dept.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {dept.description}
                    </p>

                    {/* RESPONSÁVEL HUMANO */}
                    <div className="mt-4 pt-4 border-t border-slate-800/80 bg-slate-950/50 p-3 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-300">
                          Responsável Humano: {dept.humanResponsible.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{dept.humanResponsible.role}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>📞 {dept.humanResponsible.directPhone}</span>
                        <span>✉️ {dept.humanResponsible.email}</span>
                      </div>
                    </div>

                    {/* PALAVRAS-CHAVE */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {dept.keywords.slice(0, 4).map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setActiveTab("simulator");
                        handleSendMessage(String(dept.optionNumber));
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      Testar Opção {dept.optionNumber} no Simulador
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: API & WEBHOOK */}
        {activeTab === "webhook" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-400" />
                Configuração do Webhook Oficial WhatsApp
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Conecte seu provedor de WhatsApp (Evolution API, Z-API, Baileys ou Meta Cloud API)
                diretamente ao endpoint NAI 3.7:
              </p>

              <div className="mt-4 bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4">
                <code className="text-xs font-mono text-emerald-400 break-all">
                  POST /api/whatsapp/webhook
                </code>
                <button
                  onClick={handleCopyWebhookUrl}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shrink-0 transition"
                >
                  {copiedUrl ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copiedUrl ? "Copiado!" : "Copiar URL"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  Payload de Envio Aceito (JSON)
                </h3>
                <pre className="bg-slate-950 p-4 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                  {`// Formato 1: Payload Direto
{
  "phone": "554199999999",
  "message": "1"
}

// Formato 2: Evolution API / Z-API
{
  "data": {
    "key": { "remoteJid": "554199999999@s.whatsapp.net" },
    "message": { "conversation": "Quero falar com Dr Rodrigo" }
  }
}`}
                </pre>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  Resposta do Bot NAI 3.7
                </h3>
                <pre className="bg-slate-950 p-4 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                  {`{
  "success": true,
  "officialChannel": "(41) 3358-0818",
  "from": "554199999999",
  "replyText": "...",
  "isHumanHandoff": false,
  "humanResponsible": {
    "name": "Dr. Rodrigo",
    "role": "Médico do Trabalho & Coordenador PCMSO",
    "directWhatsappLink": "https://wa.me/554133580818?text=..."
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
