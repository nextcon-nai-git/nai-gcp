"use client";

import React, { useState, useEffect } from "react";
import { useSgi } from "@/contexts/sgi-context";
import { useUser } from "@/firebase";
import { askSesmtAgentAction } from "@/actions/sesmt-agents-actions";
import { SESMT_AGENTS_CONFIG, AgentRole } from "@/ai/sesmt-agents-config";
import type { SesmtAgentOutput } from "@/ai/flows/sesmt-agents-flow";
import { getAllowedAgentsForUser } from "@/lib/agent-access-control";
import {
  ShieldAlert,
  HardHat,
  Stethoscope,
  Activity,
  HeartPulse,
  Brain,
  MessageSquare,
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Send,
  Loader2,
  Building2,
  Zap,
  Bot,
  Lock,
  UserCheck,
} from "lucide-react";

export default function AgentesIaPage() {
  const { activeClientId } = useSgi();
  const { user, role } = useUser();

  // Access Control Calculation
  const permissionInfo = getAllowedAgentsForUser({
    userRole: role,
    userEmail: user?.email,
    userName: user?.displayName,
  });

  const { allowedRoles, isFullAccess, userTitle } = permissionInfo;

  const [selectedAgentRole, setSelectedAgentRole] = useState<AgentRole>(
    allowedRoles[0] || "engenheiro_seguranca"
  );
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"individual" | "mesaredonda">("individual");
  const [activeOutput, setActiveOutput] = useState<SesmtAgentOutput | null>(null);

  // Mesa redonda state
  const [roundTableOutputs, setRoundTableOutputs] = useState<Record<string, SesmtAgentOutput>>({});
  const [roundTableLoading, setRoundTableRoundTableLoading] = useState(false);

  useEffect(() => {
    if (!allowedRoles.includes(selectedAgentRole)) {
      setSelectedAgentRole(allowedRoles[0] || "engenheiro_seguranca");
    }
  }, [allowedRoles, selectedAgentRole]);

  const activeClientName =
    activeClientId && activeClientId !== "all" && activeClientId !== "unauthorized"
      ? activeClientId.replace(/_/g, " ").toUpperCase()
      : "Visão Global / Todas as Empresas";

  const handleAskIndividualAgent = async (roleToAsk?: AgentRole, queryOverride?: string) => {
    const role = roleToAsk || selectedAgentRole;
    const query = queryOverride || promptInput;

    if (!query.trim()) return;

    if (!allowedRoles.includes(role)) {
      alert(
        `Acesso não permitido. Seu perfil profssional (${userTitle}) possui acesso exclusivo ao seu agente especializado.`
      );
      return;
    }

    setLoading(true);
    setActiveOutput(null);

    const res = await askSesmtAgentAction(
      role,
      query,
      {
        companyName:
          activeClientName !== "Visão Global / Todas as Empresas" ? activeClientName : undefined,
      },
      await user!.getIdToken()
    );

    setLoading(false);
    if (res.success && res.data) {
      setActiveOutput(res.data);
    } else {
      alert(res.error || "Erro ao consultar o Agente.");
    }
  };

  const handleRunRoundTable = async (queryOverride?: string) => {
    if (!isFullAccess) {
      alert(
        "A Mesa Redonda com as 5 IAs simultâneas é restrita a Gestores e Engenheiros do SESMT."
      );
      return;
    }

    const query = queryOverride || promptInput;
    if (!query.trim()) return;

    setRoundTableRoundTableLoading(true);
    setRoundTableOutputs({});

    const results: Record<string, SesmtAgentOutput> = {};

    for (const r of allowedRoles) {
      const res = await askSesmtAgentAction(
        r,
        query,
        {
          companyName:
            activeClientName !== "Visão Global / Todas as Empresas" ? activeClientName : undefined,
        },
        await user!.getIdToken()
      );
      if (res.success && res.data) {
        results[r] = res.data;
        setRoundTableOutputs({ ...results });
      }
    }

    setRoundTableRoundTableLoading(false);
  };

  const quickPrompts = [
    {
      title: "PGR & Risco de Máquinas",
      query:
        "Como estruturar a gestão de riscos e inventário para prensas hidráulicas e dobradeiras com base na NR-12 e NR-01?",
      role: "engenheiro_seguranca" as AgentRole,
    },
    {
      title: "Ronda de EPIs em Canteiro",
      query:
        "Quais os procedimentos de inspeção em campo para verificar o uso correto de cinto de paraquedista e trava-quedas na NR-35?",
      role: "tecnico_seguranca" as AgentRole,
    },
    {
      title: "Primeiros Socorros & Vacinação",
      query:
        "Como montar o protocolo de primeiros socorros e a campanha anual de vacinação ocupacional para a equipe de fábrica?",
      role: "enfermeiro_trabalho" as AgentRole,
    },
    {
      title: "Análise Ergonômica (AET / AEP)",
      query:
        "Como realizar a Análise Ergonômica Preliminar (AEP) para operadores de teleatendimento e montagem conforme a NR-17?",
      role: "ergonomista" as AgentRole,
    },
    {
      title: "PCMSO & Exames de Altura",
      query:
        "Quais os exames complementares obrigatórios e critérios de aptidão no ASO para trabalhadores em trabalho em altura e espaço confinado?",
      role: "medico_trabalho" as AgentRole,
    },
  ].filter((p) => allowedRoles.includes(p.role));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Brain className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Agentes de IA do SESMT
                  <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-medium">
                    RBAC Profissional Ativo
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Perfil Identificado: <strong className="text-slate-200">{userTitle}</strong>
                  {user?.email && <span className="text-slate-500">({user.email})</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 p-2 border border-slate-800 rounded-xl text-xs text-slate-300">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>Empresa Ativa:</span>
            <span className="font-semibold text-white bg-slate-800 px-2.5 py-1 rounded-lg">
              {activeClientName}
            </span>
          </div>
        </div>

        {/* Mode Switcher Tabs (Only for Full Access) */}
        {isFullAccess ? (
          <div className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 max-w-md">
            <button
              onClick={() => setMode("individual")}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                mode === "individual"
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Bot className="w-4 h-4" />
              Consulta Individual
            </button>
            <button
              onClick={() => setMode("mesaredonda")}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                mode === "mesaredonda"
                  ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              Mesa Redonda SESMT (5 IAs)
            </button>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300 flex items-center gap-2 max-w-xl">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Acesso Profissional Direcionado: Você tem acesso ao Agente de IA correspondente à sua
              especialidade ({userTitle}).
            </span>
          </div>
        )}

        {/* 5 Agents Grid with Lock State */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.values(SESMT_AGENTS_CONFIG).map((agent) => {
            const isAllowed = allowedRoles.includes(agent.role);
            const isSelected = selectedAgentRole === agent.role;

            return (
              <div
                key={agent.role}
                onClick={() => {
                  if (isAllowed) {
                    setSelectedAgentRole(agent.role);
                  }
                }}
                className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
                  !isAllowed
                    ? "opacity-40 bg-slate-950/40 border-slate-900 cursor-not-allowed"
                    : isSelected
                      ? "cursor-pointer bg-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/30"
                      : "cursor-pointer bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${agent.color}`}
                />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{agent.avatar}</span>
                  {isAllowed ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {agent.badge}
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Restrito
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {agent.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{agent.subtitle}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Suggestion Chips */}
        {quickPrompts.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Prompts Rápidos da sua Especialidade:
            </label>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedAgentRole(item.role);
                    setPromptInput(item.query);
                    handleAskIndividualAgent(item.role, item.query);
                  }}
                  className="text-xs bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-500/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <span>{SESMT_AGENTS_CONFIG[item.role]?.avatar || "🤖"}</span>
                  <span className="font-medium">{item.title}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="text-lg">
                {SESMT_AGENTS_CONFIG[selectedAgentRole]?.avatar || "🤖"}
              </span>
              Agente IA Selecionado:{" "}
              <strong className="text-white">
                {SESMT_AGENTS_CONFIG[selectedAgentRole]?.title || "Agente IA"}
              </strong>
            </span>
            <span>
              {isFullAccess && mode === "mesaredonda"
                ? "Modo: Mesa Redonda (Ativa as 5 IAs)"
                : "Atendimento Direto da Especialidade"}
            </span>
          </div>

          <div className="relative flex items-center">
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={`Digite sua dúvida ou parecer técnico para o ${SESMT_AGENTS_CONFIG[selectedAgentRole]?.title || "Especialista"}...`}
              rows={3}
              className="w-[100%] bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3.5 pr-28 text-sm text-white placeholder-slate-500 outline-none resize-none transition-all"
            />
            <div className="absolute right-3 bottom-3 flex gap-2">
              <button
                onClick={() => handleAskIndividualAgent()}
                disabled={loading || !promptInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Consultar IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Display - Individual Mode */}
        {activeOutput && (
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {SESMT_AGENTS_CONFIG[activeOutput.agentRole as AgentRole]?.avatar || "🤖"}
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">{activeOutput.agentTitle}</h2>
                  <p className="text-xs text-indigo-400 font-medium">
                    Parecer Técnico Especializado & Diretrizes NRs
                  </p>
                </div>
              </div>

              {activeOutput.warningAlert && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3 py-1.5 rounded-xl font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {activeOutput.warningAlert}
                </div>
              )}
            </div>

            {/* Analysis Text */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Análise Especializada
              </h3>
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {activeOutput.analysis}
              </div>
            </div>

            {/* Action Items */}
            {activeOutput.actionItems && activeOutput.actionItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Ações Recomendadas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeOutput.actionItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 text-xs text-slate-300"
                    >
                      <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Standards */}
            {activeOutput.relevantStandards && activeOutput.relevantStandards.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  Normas Regulamentadoras
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activeOutput.relevantStandards.map((std, i) => (
                    <span
                      key={i}
                      className="text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 px-3 py-1 rounded-lg"
                    >
                      {std}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Output Display - Mesa Redonda Mode (Only for Full Access) */}
        {isFullAccess && mode === "mesaredonda" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Parecer Integrado da Junta Técnica SESMT (5 IAs)
              </h2>
              {roundTableLoading && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando em conjunto...
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6">
              {Object.values(SESMT_AGENTS_CONFIG).map((agent) => {
                const out = roundTableOutputs[agent.role];
                return (
                  <div
                    key={agent.role}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{agent.avatar}</span>
                        <div>
                          <h3 className="text-base font-bold text-white">{agent.title}</h3>
                          <span className="text-xs text-slate-400">{agent.subtitle}</span>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
                        {agent.badge}
                      </span>
                    </div>

                    {out ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                          {out.analysis}
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic py-4 text-center">
                        {roundTableLoading
                          ? "Aguardando análise..."
                          : "Aguardando consulta na Mesa Redonda."}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
