"use server";

import {
  processAsoSystemOrchestration,
  AsoSystemOrchestratorOutput,
} from "@/ai/flows/aso-scheduler-system-flow";
import { AsoRequest, AsoPipelineStep, ExamType, DigitalKit } from "@/types/aso-scheduler-types";
import { INITIAL_PARTNER_CLINICS } from "@/lib/aso-scheduler-data";

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { adminDb } from "@/lib/firebase-admin";
import { canManageRdAso } from "@/lib/integrations/rd-aso-request";
import { forbidden } from "@/lib/auth/errors";

async function schedulerUser(token: string) {
  const user = await requireAuth(
    new NextRequest("https://nai.local", {
      headers: { authorization: `Bearer ${token}` },
    })
  );
  if (user.role === "GUEST") throw forbidden();
  return user;
}

async function requestStore(token: string) {
  const user = await schedulerUser(token);
  return adminDb.collection("users").doc(user.uid).collection("asoRequests");
}

function rdRequestStore() {
  return adminDb.collection("integrations").doc("rd-conversas-avp").collection("asoRequests");
}

export async function getAsoRequestsAction(
  token = ""
): Promise<{ success: boolean; data: AsoRequest[] }> {
  const user = await schedulerUser(token);
  const ownStore = adminDb.collection("users").doc(user.uid).collection("asoRequests");
  const [own, rd] = await Promise.all([
    ownStore.orderBy("createdAt", "desc").limit(500).get(),
    canManageRdAso(user.role)
      ? rdRequestStore().orderBy("createdAt", "desc").limit(500).get()
      : null,
  ]);
  const data = [...own.docs, ...(rd?.docs || [])].map((doc) => doc.data() as AsoRequest);
  data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { success: true, data };
}

export async function createAsoRequestAction(
  payload: {
    companyName: string;
    cnpj: string;
    employeeName: string;
    cpf: string;
    roleTitle: string;
    department: string;
    examType: ExamType;
    declaredRisks: string[];
    userPrompt?: string;
    manualReview?: boolean;
    manualExamNames?: string[];
  },
  token = ""
): Promise<{ success: boolean; data?: AsoRequest; error?: string }> {
  try {
    const store = await requestStore(token);
    const newId = store.doc().id;

    if (payload.manualReview === true) {
      const names = payload.manualExamNames;
      if (
        !Array.isArray(names) ||
        names.length < 1 ||
        names.length > 50 ||
        names.some((name) => typeof name !== "string" || !name.trim() || name.length > 200) ||
        [
          payload.companyName,
          payload.cnpj,
          payload.employeeName,
          payload.cpf,
          payload.roleTitle,
        ].some((value) => typeof value !== "string" || !value.trim() || value.length > 500)
      )
        throw new Error(
          "Preencha empresa, colaborador, documentos, cargo e de 1 a 50 exames para revisão."
        );
      const at = new Date().toISOString();
      const pending: AsoRequest = {
        id: newId,
        companyName: payload.companyName,
        cnpj: payload.cnpj,
        employeeName: payload.employeeName,
        cpf: payload.cpf,
        roleTitle: payload.roleTitle,
        department: payload.department,
        examType: payload.examType,
        declaredRisks: payload.declaredRisks,
        status: "solicitado",
        clinicId: "",
        clinicName: "A confirmar",
        appointmentDate: "",
        appointmentTime: "",
        validationPassed: false,
        validationNotes: [
          "Registro manual. Exames informados pela equipe; conferir com o PCMSO antes do atendimento.",
          payload.userPrompt || "",
        ],
        exams: names.map((name, index) => ({
          code: `manual-${index + 1}`,
          name: name.trim(),
          mandatory: "CONDICIONAL",
          pcmsoJustification: "Informado pela equipe; pendente de conferência do PCMSO.",
          patientPreparo: "Confirmar com a clínica.",
        })),
        alerts: [
          {
            id: `ALT-${newId}`,
            requestId: newId,
            agentType: "SUPERVISOR",
            severity: "WARNING",
            message: "Solicitação manual pendente de revisão profissional.",
            suggestedAction: "Conferir PCMSO, exames e clínica antes do atendimento.",
            requiresHumanIntervention: true,
            status: "PENDING",
            createdAt: at,
          },
        ],
        createdAt: at,
        updatedAt: at,
      };
      await store.doc(newId).set(pending);
      return { success: true, data: pending };
    }

    // Executa Orquestração dos 7 Agentes de IA
    const aiResult: AsoSystemOrchestratorOutput = await processAsoSystemOrchestration({
      userPrompt:
        payload.userPrompt || `Solicitação de ASO ${payload.examType} para ${payload.roleTitle}`,
      companyName: payload.companyName,
      cnpj: payload.cnpj,
      employeeName: payload.employeeName,
      cpf: payload.cpf,
      roleTitle: payload.roleTitle,
      department: payload.department,
      examType: payload.examType,
      declaredRisks: payload.declaredRisks,
    });

    const newRequest: AsoRequest = {
      id: newId,
      companyName: payload.companyName,
      cnpj: payload.cnpj,
      employeeName: payload.employeeName,
      cpf: payload.cpf,
      roleTitle: payload.roleTitle,
      department: payload.department,
      examType: payload.examType,
      declaredRisks: payload.declaredRisks,
      status: "validando",
      clinicId: "",
      clinicName: "A confirmar",
      appointmentDate: "",
      appointmentTime: "",
      validationPassed: false,
      validationNotes: [
        aiResult.triagem.observacoes_triagem,
        aiResult.protocolos.justificativa_normativa,
        aiResult.agendamento_matching.motivo_escolha,
      ],
      exams: aiResult.protocolos.exames_obrigatorios,
      alerts: aiResult.supervisor.requer_intervencao_humana
        ? [
            {
              id: `ALT-${Date.now()}`,
              requestId: newId,
              agentType: "SUPERVISOR",
              severity:
                aiResult.supervisor.severidade_alerta === "NONE"
                  ? "WARNING"
                  : aiResult.supervisor.severidade_alerta,
              message: aiResult.supervisor.mensagem_alerta,
              suggestedAction: aiResult.supervisor.acao_recomendada,
              requiresHumanIntervention: true,
              status: "PENDING",
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Monta o Kit Digital se o agendamento já foi avançado
    const digitalKit: DigitalKit = {
      kitId: `KIT-${Math.floor(1000 + Math.random() * 9000)}`,
      requestId: newId,
      guiaNumber: `MINUTA-${newId}`,
      generatedAt: new Date().toISOString(),
      companyDetails: {
        name: payload.companyName,
        cnpj: payload.cnpj,
        contact: "",
      },
      employeeDetails: {
        name: payload.employeeName,
        cpf: payload.cpf,
        roleTitle: payload.roleTitle,
        department: payload.department,
      },
      examType: payload.examType,
      clinicDetails: {
        name: "A confirmar",
        address: "",
        phone: "",
      },
      appointmentDateTime: "A confirmar com a clínica",
      examList: newRequest.exams,
      patientInstructions: aiResult.kit_digital.instrucoes_paciente,
      clinicInstructions: aiResult.kit_digital.instrucoes_clinica,
      returnDeadlineDays: aiResult.kit_digital.prazo_devolucao_dias,
      asoTemplate: {
        declaredRisks: payload.declaredRisks,
        fitnessChecklist:
          "[ ] APTO para a função declarada\n[ ] INAPTO para a função declarada\n[ ] APTO com restrições temporárias",
        doctorNotes: "Pendente de exame e preenchimento pelo médico responsável.",
      },
      qrCodeUrl: "",
    };

    newRequest.digitalKit = digitalKit;

    await store.doc(newId).set(newRequest);

    return { success: true, data: newRequest };
  } catch (err: any) {
    console.error("[Create ASO Request Action Error]", err);
    return {
      success: false,
      error: err.message || "Erro ao criar solicitação de ASO.",
    };
  }
}

export async function advancePipelineStepAction(
  requestId: string,
  targetStep: AsoPipelineStep,
  token = ""
): Promise<{ success: boolean; data?: AsoRequest; error?: string }> {
  try {
    const user = await schedulerUser(token);
    if (requestId.startsWith("rd-") && !canManageRdAso(user.role)) throw forbidden();
    const store = requestId.startsWith("rd-")
      ? rdRequestStore()
      : adminDb.collection("users").doc(user.uid).collection("asoRequests");
    if (!requestId || requestId.includes("/"))
      return { success: false, error: "Solicitação inválida." };
    const snapshot = await store.doc(requestId).get();
    if (!snapshot.exists) {
      return { success: false, error: "Solicitação de ASO não encontrada." };
    }

    const existing = snapshot.data() as AsoRequest;
    if (
      [
        "kit_montado",
        "kit_enviado",
        "clinica_confirmou",
        "exame_realizado",
        "aso_concluido",
      ].includes(targetStep) &&
      !existing.digitalKit
    )
      return {
        success: false,
        error: "Revise os exames e gere o kit antes de avançar para esta etapa.",
      };

    const updated = {
      ...existing,
      status: targetStep,
      updatedAt: new Date().toISOString(),
    };

    // Se avançou para kit_enviado, adiciona a data de envio
    if (targetStep === "kit_enviado" && updated.digitalKit) {
      updated.digitalKit.kitSentAt = new Date().toISOString();
    }

    // Se avançou para clinica_confirmou
    if (targetStep === "clinica_confirmou" && updated.digitalKit) {
      updated.digitalKit.clinicConfirmedAt = new Date().toISOString();
    }

    await store.doc(requestId).set(updated);

    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[Advance Pipeline Action Error]", err);
    return {
      success: false,
      error: err.message || "Erro ao atualizar etapa do pipeline.",
    };
  }
}

export async function runAsoOrchestratorAnalysisAction(
  userPrompt: string,
  companyName?: string,
  employeeName?: string,
  roleTitle?: string,
  examType?: ExamType,
  token = ""
): Promise<{
  success: boolean;
  data?: AsoSystemOrchestratorOutput;
  error?: string;
}> {
  try {
    await requestStore(token);
    const result = await processAsoSystemOrchestration({
      userPrompt,
      companyName,
      employeeName,
      roleTitle,
      examType,
    });

    return { success: true, data: result };
  } catch (err: any) {
    console.error("[Run ASO Orchestrator Action Error]", err);
    return {
      success: false,
      error: err.message || "Erro na análise dos 7 agentes de IA.",
    };
  }
}
