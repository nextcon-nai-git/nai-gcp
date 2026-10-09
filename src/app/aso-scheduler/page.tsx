"use client";

import React, { useState, useEffect } from "react";
import { useSgi } from "@/contexts/sgi-context";
import { useUser } from "@/firebase";
import {
  getAsoRequestsAction,
  createAsoRequestAction,
  advancePipelineStepAction,
  runAsoOrchestratorAnalysisAction,
} from "@/actions/aso-scheduler-actions";
import { INITIAL_PARTNER_CLINICS, PIPELINE_STEPS_CONFIG } from "@/lib/aso-scheduler-data";
import {
  AsoRequest,
  AsoPipelineStep,
  ExamType,
  PartnerClinic,
  DigitalKit,
} from "@/types/aso-scheduler-types";
import { AsoSystemOrchestratorOutput } from "@/ai/flows/aso-scheduler-system-flow";
import {
  Calendar,
  ClipboardList,
  Building2,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Sparkles,
  Printer,
  Copy,
  Check,
  FileText,
  Search,
  Plus,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Activity,
  Users,
  MapPin,
  Clock,
  Star,
  Zap,
  Filter,
  CheckSquare,
  AlertCircle,
  Brain,
} from "lucide-react";

export default function AsoSchedulerPage() {
  const { activeClientId } = useSgi();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<
    "kanban" | "nova_solicitacao" | "kit_digital" | "clinicas" | "supervisor"
  >("kanban");
  const [requests, setRequests] = useState<AsoRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AsoRequest | null>(null);
  const [copiedKit, setCopiedKit] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    companyName: "CETESB - Cia Ambiental do Estado de SP",
    cnpj: "43.050.496/0001-11",
    employeeName: "",
    cpf: "",
    roleTitle: "Operador de Usinagem & Prensa",
    department: "Manutenção & Operações",
    examType: "admissional" as ExamType,
    declaredRisks:
      "Ruído contínuo > 85 dBA (NR-15), Postura em pé prolongada (NR-17), Manuseio de Óleos Minerais",
    userPrompt: "Agendar exame admissional com urgência na região da Paulista.",
  });

  const [aiAnalysisResult, setAiAnalysisResult] = useState<AsoSystemOrchestratorOutput | null>(
    null
  );
  const [analyzingAi, setAnalyzingAi] = useState(false);

  useEffect(() => {
    if (!user) return;
    let disposed = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await getAsoRequestsAction(await user.getIdToken());
        if (!disposed && res.success) {
          setRequests(res.data);
          setLoadError("");
          setSelectedRequest((current) =>
            current ? res.data.find((item) => item.id === current.id) || null : res.data[0] || null
          );
        }
      } catch {
        if (!disposed)
          setLoadError("Não foi possível atualizar as solicitações. Tentaremos novamente.");
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [user]);

  const handleRunAiTriage = async () => {
    setAnalyzingAi(true);
    setAiAnalysisResult(null);

    const risksList = formData.declaredRisks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await runAsoOrchestratorAnalysisAction(
      formData.userPrompt,
      formData.companyName,
      formData.employeeName,
      formData.roleTitle,
      formData.examType,
      await user!.getIdToken()
    );

    setAnalyzingAi(false);
    if (res.success && res.data) {
      setAiAnalysisResult(res.data);
    } else {
      alert(res.error || "Erro na análise de triagem dos Agentes de IA.");
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const risksList = formData.declaredRisks
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await createAsoRequestAction(
      {
        companyName: formData.companyName,
        cnpj: formData.cnpj,
        employeeName: formData.employeeName,
        cpf: formData.cpf,
        roleTitle: formData.roleTitle,
        department: formData.department,
        examType: formData.examType,
        declaredRisks: risksList,
        userPrompt: formData.userPrompt,
      },
      await user!.getIdToken()
    );

    setLoading(false);
    if (res.success && res.data) {
      setRequests((prev) => [res.data!, ...prev]);
      setSelectedRequest(res.data);
      setActiveTab("kanban");
      alert(
        `Solicitação de ASO ${res.data.id} criada com sucesso! Processada pelos 7 Agentes de IA.`
      );
    } else {
      alert(res.error || "Erro ao criar solicitação de ASO.");
    }
  };

  const handleAdvanceStep = async (reqId: string, currentStep: AsoPipelineStep) => {
    const pipelineOrder: AsoPipelineStep[] = [
      "solicitado",
      "validando",
      "exames_definidos",
      "clinica_selecionada",
      "agendado",
      "kit_montado",
      "kit_enviado",
      "clinica_confirmou",
      "exame_realizado",
      "aso_concluido",
    ];

    const currIdx = pipelineOrder.indexOf(currentStep);
    if (currIdx === -1 || currIdx >= pipelineOrder.length - 1) return;

    const nextStep = pipelineOrder[currIdx + 1];

    const res = await advancePipelineStepAction(reqId, nextStep, await user!.getIdToken());
    if (res.success && res.data) {
      setRequests((prev) => prev.map((r) => (r.id === reqId ? res.data! : r)));
      if (selectedRequest?.id === reqId) {
        setSelectedRequest(res.data);
      }
    } else {
      alert(res.error || "Erro ao avançar etapa.");
    }
  };

  const copyKitText = (kit: DigitalKit) => {
    const text = `=== GUIA DE ENCAMINHAMENTO OCUPACIONAL NAI (${kit.guiaNumber}) ===
Empresa: ${kit.companyDetails.name} (CNPJ: ${kit.companyDetails.cnpj})
Trabalhador: ${kit.employeeDetails.name} (CPF: ${kit.employeeDetails.cpf})
Cargo: ${kit.employeeDetails.roleTitle} | Setor: ${kit.employeeDetails.department}
Tipo de ASO: ${kit.examType.toUpperCase()}
Agendamento: ${kit.appointmentDateTime}
Clínica Parceira: ${kit.clinicDetails.name} (${kit.clinicDetails.address})

--- EXAMES COMPLEMENTARES SOLICITADOS ---
${kit.examList.map((e) => `- [${e.code}] ${e.name} (${e.mandatory})\n  Preparo: ${e.patientPreparo}`).join("\n\n")}

--- INSTRUÇÕES PARA A CLÍNICA CREDENCIADA ---
${kit.clinicInstructions.map((i) => `• ${i}`).join("\n")}
Prazo devolução ASO/XML eSocial: ${kit.returnDeadlineDays} dias úteis.`;

    navigator.clipboard.writeText(text);
    setCopiedKit(true);
    setTimeout(() => setCopiedKit(false), 3000);
  };

  // KPIs
  const totalToday = requests.length;
  const pendingTriage = requests.filter(
    (r) => r.status === "solicitado" || r.status === "validando"
  ).length;
  const kitsSent = requests.filter(
    (r) => r.status === "kit_enviado" || r.status === "clinica_confirmou"
  ).length;
  const asoCompleted = requests.filter((r) => r.status === "aso_concluido").length;
  const criticalAlertsCount = requests
    .flatMap((r) => r.alerts)
    .filter((a) => a.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                <Calendar className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Agendador de ASO + Kits para Clínicas
                  <span className="text-xs px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-medium">
                    7 Agentes de IA Ativos
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Automação de solicitações, triagem de exames PCMSO/PGR, matching de clínicas
                  credenciadas e acompanhamento eSocial S-2220.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("nova_solicitacao")}
              className="bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Solicitação de ASO
            </button>
          </div>
        </div>

        {loadError && (
          <p role="alert" className="text-sm text-amber-300">
            {loadError}
          </p>
        )}
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Solicitações Ativas
            </span>
            <div className="text-2xl font-black text-white">{totalToday}</div>
            <p className="text-[10px] text-slate-500">Total no pipeline atual</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-blue-500/20 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Em Triagem / IA
            </span>
            <div className="text-2xl font-black text-blue-300">{pendingTriage}</div>
            <p className="text-[10px] text-slate-500">Validação e exames PCMSO</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-cyan-500/20 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Kits Enviados
            </span>
            <div className="text-2xl font-black text-cyan-300">{kitsSent}</div>
            <p className="text-[10px] text-slate-500">Aguardando confirmação clínica</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-emerald-500/20 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              ASOs Concluídos
            </span>
            <div className="text-2xl font-black text-emerald-300">{asoCompleted}</div>
            <p className="text-[10px] text-slate-500">Prontos para carga eSocial S-2220</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-amber-500/20 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Alertas Supervisor
            </span>
            <div className="text-2xl font-black text-amber-300">{criticalAlertsCount}</div>
            <p className="text-[10px] text-slate-500">Intervenção humana necessária</p>
          </div>
        </div>

        {/* Operating Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab("kanban")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === "kanban"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            1. Pipeline Kanban (10 Etapas)
          </button>
          <button
            onClick={() => setActiveTab("nova_solicitacao")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === "nova_solicitacao"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Plus className="w-4 h-4" />
            2. Nova Solicitação (IA Triagem)
          </button>
          <button
            onClick={() => setActiveTab("kit_digital")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === "kit_digital"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            3. Montador de Kit Digital
          </button>
          <button
            onClick={() => setActiveTab("clinicas")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === "clinicas"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4" />
            4. Clínicas Credenciadas
          </button>
          <button
            onClick={() => setActiveTab("supervisor")}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === "supervisor"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            5. Alertas & Exceções ({criticalAlertsCount})
          </button>
        </div>

        {/* TAB 1: KANBAN PIPELINE (10 ETAPAS) */}
        {activeTab === "kanban" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Pipeline de Acompanhamento (10 Etapas Rastreáveis)
              </h2>
              <span className="text-xs text-slate-400">
                Clique no botão de cada card para avançar a etapa no fluxo automatizado.
              </span>
            </div>

            {/* Scrollable Pipeline */}
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-[1800px]">
                {(Object.keys(PIPELINE_STEPS_CONFIG) as AsoPipelineStep[]).map((stepKey) => {
                  const stepConfig = PIPELINE_STEPS_CONFIG[stepKey];
                  const stepRequests = requests.filter((r) => r.status === stepKey);

                  return (
                    <div
                      key={stepKey}
                      className="w-[280px] shrink-0 bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${stepConfig.badgeColor}`}
                        >
                          {stepConfig.label}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">
                          {stepRequests.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {stepRequests.length > 0 ? (
                          stepRequests.map((req) => (
                            <div
                              key={req.id}
                              onClick={() => setSelectedRequest(req)}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                                selectedRequest?.id === req.id
                                  ? "bg-slate-800 border-cyan-500 shadow-lg shadow-cyan-500/10"
                                  : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-bold text-cyan-400">{req.id}</span>
                                <span className="uppercase text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {req.examType}
                                </span>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold text-white line-clamp-1">
                                  {req.employeeName}
                                </h4>
                                <p className="text-[11px] text-slate-400 line-clamp-1">
                                  {req.roleTitle}
                                </p>
                                <p className="text-[10px] text-slate-500">{req.companyName}</p>
                                {req.source === "rd-conversas" && (
                                  <p className="text-[10px] text-cyan-300">
                                    RD Conversas · {req.requestedCity}
                                  </p>
                                )}
                              </div>

                              {req.clinicName && (
                                <div className="text-[10px] text-cyan-300 bg-cyan-500/10 p-1.5 rounded border border-cyan-500/20 line-clamp-1">
                                  🏥 {req.clinicName}
                                </div>
                              )}

                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500">
                                  {req.exams.length} exames PCMSO
                                </span>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdvanceStep(req.id, req.status);
                                  }}
                                  className="text-[10px] bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white px-2 py-1 rounded transition-all font-semibold flex items-center gap-1"
                                >
                                  Avançar <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-600 italic py-6 text-center border border-dashed border-slate-800 rounded-xl">
                            Nenhum pedido nesta etapa
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NOVA SOLICITAÇÃO & TRIAGEM IA */}
        {activeTab === "nova_solicitacao" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Column */}
            <form
              onSubmit={handleCreateRequest}
              className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Nova Solicitação de ASO</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Empresa Tomadora</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">CNPJ</label>
                  <input
                    type="text"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">
                    Nome do Trabalhador
                  </label>
                  <input
                    type="text"
                    value={formData.employeeName}
                    onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Cargo / Função</label>
                  <input
                    type="text"
                    value={formData.roleTitle}
                    onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Setor</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Tipo de ASO (NR-07)
                  </label>
                  <select
                    value={formData.examType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        examType: e.target.value as ExamType,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="admissional">Admissional</option>
                    <option value="periodico">Periódico</option>
                    <option value="demissional">Demissional</option>
                    <option value="retorno_trabalho">Retorno ao Trabalho</option>
                    <option value="mudanca_funcao">Mudança de Risco / Função</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Riscos Ocupacionais Declarados (PGR / eSocial S-2240)
                  </label>
                  <input
                    type="text"
                    value={formData.declaredRisks}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        declaredRisks: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500"
                    placeholder="Separe por vírgulas: Ruído, Poeira, Altura, etc."
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Observações ou Solicitação Adicional
                  </label>
                  <textarea
                    value={formData.userPrompt}
                    onChange={(e) => setFormData({ ...formData, userPrompt: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-3">
                <button
                  type="button"
                  onClick={handleRunAiTriage}
                  disabled={analyzingAi}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-slate-700"
                >
                  {analyzingAi ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  )}
                  Simular Triagem IA
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Criar & Processar com IA
                </button>
              </div>
            </form>

            {/* AI Triagem Simulation Display Column */}
            <div className="bg-slate-900/90 border border-cyan-500/30 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-cyan-400" />
                  Triagem em Tempo Real dos 7 Agentes de IA
                </h3>
                {analyzingAi && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
              </div>

              {aiAnalysisResult ? (
                <div className="space-y-4 text-xs">
                  {/* Triagem Status */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">
                      1. Agente de Triagem
                    </span>
                    <p className="text-slate-200">{aiAnalysisResult.triagem.observacoes_triagem}</p>
                  </div>

                  {/* Protocolos PCMSO */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="font-bold text-purple-400 uppercase tracking-wider text-[10px]">
                      2. Agente de Protocolos PCMSO/NR-07
                    </span>
                    <div className="space-y-1">
                      {aiAnalysisResult.protocolos.exames_obrigatorios.map((ex, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800"
                        >
                          <span className="font-semibold text-white">{ex.name}</span>
                          <span className="font-mono text-[10px] text-cyan-300">{ex.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Match da Clínica */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-teal-400 uppercase tracking-wider text-[10px]">
                      3. Agente de Agendamento Inteligente
                    </span>
                    <p className="text-white font-bold">
                      {aiAnalysisResult.agendamento_matching.clinica_recomendada_nome} (Score:{" "}
                      {aiAnalysisResult.agendamento_matching.score_compatibilidade}
                      %)
                    </p>
                    <p className="text-slate-400">
                      {aiAnalysisResult.agendamento_matching.motivo_escolha}
                    </p>
                  </div>

                  {/* Supervisor */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                      7. Agente Supervisor
                    </span>
                    <p className="text-slate-300">{aiAnalysisResult.supervisor.mensagem_alerta}</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic py-16 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-slate-700" />
                  <p>
                    Preencha os dados ao lado e clique em <strong>"Simular Triagem IA"</strong> para
                    visualizar a atuação dos 7 agentes de IA antes de enviar.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MONTADOR DE KIT DIGITAL (PREVIEW DA GUIA) */}
        {activeTab === "kit_digital" && (
          <div className="space-y-6">
            {selectedRequest?.digitalKit ? (
              <div className="bg-slate-900/90 border border-cyan-500/40 p-6 rounded-2xl shadow-2xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-2xl">
                      📄
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        Kit de Atendimento Ocupacional
                        <span className="text-xs font-mono px-2.5 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-lg">
                          {selectedRequest.digitalKit.guiaNumber}
                        </span>
                      </h3>
                      <p className="text-xs text-cyan-400 font-medium">
                        Guia Oficial NAI para Clínica Parceira • Solicitante:{" "}
                        {selectedRequest.companyName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyKitText(selectedRequest.digitalKit!)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      {copiedKit ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copiedKit ? "Kit Copiado!" : "Copiar Kit para Envio"}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Guia OS
                    </button>
                  </div>
                </div>

                {/* Printable Order Sheet */}
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6 text-xs text-slate-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                        Dados da Empresa Tomadora
                      </span>
                      <p className="text-white font-bold">
                        {selectedRequest.digitalKit.companyDetails.name}
                      </p>
                      <p>CNPJ: {selectedRequest.digitalKit.companyDetails.cnpj}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                        Dados do Trabalhador
                      </span>
                      <p className="text-white font-bold">
                        {selectedRequest.digitalKit.employeeDetails.name}
                      </p>
                      <p>
                        CPF: {selectedRequest.digitalKit.employeeDetails.cpf} • Cargo:{" "}
                        {selectedRequest.digitalKit.employeeDetails.roleTitle}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                      Exames Ocupacionais Solicitados
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-2">Código TUSS/eSocial</th>
                            <th className="p-2">Exame Complementar</th>
                            <th className="p-2">Fundamentação PCMSO</th>
                            <th className="p-2">Preparo prévio (Paciente)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {selectedRequest.digitalKit.examList.map((e, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-mono text-cyan-300 font-bold">{e.code}</td>
                              <td className="p-2 font-bold text-white">{e.name}</td>
                              <td className="p-2 text-slate-300">{e.pcmsoJustification}</td>
                              <td className="p-2 text-amber-300 bg-amber-500/5">
                                {e.patientPreparo}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <div className="space-y-2">
                      <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                        Instruções ao Paciente
                      </h4>
                      <ul className="space-y-1 list-disc list-inside text-slate-300">
                        {selectedRequest.digitalKit.patientInstructions.map((ins, i) => (
                          <li key={i}>{ins}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                        Instruções à Clínica Credenciada
                      </h4>
                      <ul className="space-y-1 list-disc list-inside text-slate-300">
                        {selectedRequest.digitalKit.clinicInstructions.map((ins, i) => (
                          <li key={i}>{ins}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-16 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-700" />
                <p>
                  Selecione uma solicitação no Pipeline Kanban para visualizar ou exportar o Kit
                  Digital de Atendimento.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLÍNICAS CREDENCIADAS */}
        {activeTab === "clinicas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-400" />
                Rede de Clínicas Credenciadas (Match & Algoritmo de IA)
              </h2>
              <span className="text-xs text-slate-400">
                Classificação por score de compatibilidade, nota e tempo de retorno.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INITIAL_PARTNER_CLINICS.map((clinic) => (
                <div
                  key={clinic.id}
                  className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{clinic.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Score IA: {clinic.performanceScore}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {clinic.address} (
                        {clinic.distanceKm} km)
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {clinic.rating}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">
                        Devolução ASO
                      </span>
                      <strong className="text-cyan-300 font-mono">
                        {clinic.turnaroundTimeDays} dia(s)
                      </strong>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">
                        Categoria Preço
                      </span>
                      <strong className="text-emerald-300 font-mono">{clinic.priceCategory}</strong>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">
                        Horários Hoje
                      </span>
                      <strong className="text-purple-300 font-mono">
                        {clinic.availableTimeSlots.length} vagas
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Exames Suportados
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {clinic.supportedExams.map((ex, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CENTRAL DO SUPERVISOR (ALERTAS & EXCEÇÕES) */}
        {activeTab === "supervisor" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Central do Agente Supervisor (Alertas & Intervenção Humana)
              </h2>
              <span className="text-xs text-slate-400">
                Situações críticas que exigem aprovação de gestor.
              </span>
            </div>

            <div className="space-y-3">
              {requests.flatMap((r) => r.alerts).length > 0 ? (
                requests
                  .flatMap((r) => r.alerts)
                  .map((alt) => (
                    <div
                      key={alt.id}
                      className="bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl mt-0.5 border border-amber-500/20">
                          <AlertCircle className="w-5 h-5" />
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{alt.agentType}</span>
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {alt.severity}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {alt.requestId}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200">{alt.message}</p>
                          <p className="text-xs text-cyan-300 font-medium">
                            Ação Sugerida: {alt.suggestedAction}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => alert(`Alerta ${alt.id} resolvido pelo Supervisor.`)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      >
                        Aprovar & Resolver
                      </button>
                    </div>
                  ))
              ) : (
                <div className="text-xs text-slate-500 italic py-16 text-center border border-dashed border-slate-800 rounded-xl">
                  Nenhum alerta crítico no momento. Todas as solicitações estão regulares.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
