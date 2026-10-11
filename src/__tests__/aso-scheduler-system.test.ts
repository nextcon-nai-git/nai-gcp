import { describe, it, expect, vi, beforeEach } from "vitest";
const model = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/ai/genkit", () => ({ ai: model }));
const output = () => ({
  triagem: {
    valido: true,
    dados_faltantes: [],
    observacoes_triagem: "Dados sintéticos para teste",
  },
  protocolos: {
    tipo_aso_confirmado: "ADMISSIONAL",
    exames_obrigatorios: [
      {
        code: "test",
        name: "Exame sugerido para revisão",
        mandatory: "CONDICIONAL",
        pcmsoJustification: "Conferir PCMSO",
        patientPreparo: "Conferir clínica",
      },
    ],
    justificativa_normativa: "Revisar PCMSO",
  },
  agendamento_matching: {
    clinica_recomendada_id: "unverified",
    clinica_recomendada_nome: "Não verificada",
    score_compatibilidade: 50,
    motivo_escolha: "Sugestão",
    horarios_sugeridos: ["09:00"],
  },
  kit_digital: {
    guia_numero: "unverified",
    instrucoes_paciente: [],
    instrucoes_clinica: [],
    prazo_devolucao_dias: 1,
    preparacao_impressao_pronta: true,
  },
  comunicacao: { mensagem_trabalhador_whatsapp: "Minuta", email_clinica_parceira: "Minuta" },
  followup: { status_inicial_pipeline: "agendado", proxima_acao_automática: "enviar" },
  supervisor: {
    requer_intervencao_humana: false,
    severidade_alerta: "NONE",
    mensagem_alerta: "",
    acao_recomendada: "Conferir",
  },
});
beforeEach(() => {
  model.generate.mockResolvedValue({ output: output() });
});
const records = vi.hoisted(() => new Map<string, any>());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(async (req) => {
    if (req.headers.get("authorization") !== "Bearer test-token")
      throw new Error("Sessão inválida");
    return { uid: "test-user", role: "ADMIN" };
  }),
}));
vi.mock("@/lib/firebase-admin", () => {
  const store: any = {
    doc: (id = "synthetic-req") => ({
      id,
      set: async (data: any) => records.set(id, data),
      get: async () => ({ exists: records.has(id), data: () => records.get(id) }),
    }),
    orderBy: () => store,
    limit: () => store,
    get: async () => ({ docs: [...records.values()].map((data) => ({ data: () => data })) }),
  };
  return { adminDb: { collection: () => ({ doc: () => ({ collection: () => store }) }) } };
});
import {
  processAsoSystemOrchestration,
  AsoSystemOrchestratorOutputSchema,
} from "@/ai/flows/aso-scheduler-system-flow";
import {
  createAsoRequestAction,
  advancePipelineStepAction,
  getAsoRequestsAction,
} from "@/actions/aso-scheduler-actions";
import { INITIAL_PARTNER_CLINICS } from "@/lib/aso-scheduler-data";

describe("Suíte do Sistema Agendador de ASOs + Montador de Kits", () => {
  it("1. Deve testar a orquestração dos 7 agentes de IA no fluxo de solicitação de ASO", async () => {
    const res = await processAsoSystemOrchestration({
      userPrompt:
        "Agendar admissional para Operador de Guindaste com exames NR-35 e NR-33 na área da Vila Olímpia.",
      companyName: "Engenharia & Construções NAI",
      employeeName: "Marcos Vinicius Mendes",
      roleTitle: "Operador de Guindaste",
      examType: "admissional",
    });

    expect(res).toBeDefined();
    expect(res.triagem.valido).toBe(true);
    expect(res.protocolos.exames_obrigatorios.length).toBeGreaterThan(0);
    expect(res.agendamento_matching.score_compatibilidade).toBeGreaterThan(0);
    expect(res.kit_digital.guia_numero).toBeTruthy();
    expect(res.comunicacao.mensagem_trabalhador_whatsapp).toBeTruthy();

    const parsed = AsoSystemOrchestratorOutputSchema.safeParse(res);
    expect(parsed.success).toBe(true);
    expect(res.supervisor.requer_intervencao_humana).toBe(true);
    expect(res.kit_digital.preparacao_impressao_pronta).toBe(false);
    expect(res.followup.status_inicial_pipeline).toBe("pendente_revisao");
  });

  it("2. Deve criar uma nova solicitação e gerar o Kit Digital automaticamente", async () => {
    const created = await createAsoRequestAction(
      {
        companyName: "CETESB SP",
        cnpj: "43.050.496/0001-11",
        employeeName: "Amanda Fernandes Lima",
        cpf: "987.654.321-00",
        roleTitle: "Analista de Laboratório Químico",
        department: "Laboratório Central",
        examType: "admissional",
        declaredRisks: [
          "Químico: Solventes e Reagentes",
          "Biológico: Amostras de solo e efluentes",
        ],
        userPrompt: "Agendar exames admissionais para analista de laboratório.",
      },
      "test-token"
    );

    expect(created.success).toBe(true);
    expect(created.data).toBeDefined();
    expect(created.data?.digitalKit).toBeDefined();
    expect(created.data?.digitalKit?.guiaNumber).toBeTruthy();
    expect(created.data?.exams.length).toBeGreaterThan(0);
    expect(created.data?.clinicId).toBe("");
    expect(created.data?.appointmentTime).toBe("");
    expect(created.data?.validationPassed).toBe(false);
  });

  it("3. Deve avançar no pipeline de 10 etapas (ex: de solicitado para agendado e kit_enviado)", async () => {
    const requestsRes = await getAsoRequestsAction("test-token");
    const req = requestsRes.data[0];

    expect(req).toBeDefined();

    const advanced = await advancePipelineStepAction(req.id, "kit_enviado", "test-token");
    expect(advanced.success).toBe(true);
    expect(advanced.data?.status).toBe("kit_enviado");
    expect(advanced.data?.digitalKit?.kitSentAt).toBeDefined();
  });

  it("não fabrica um agendamento quando o provedor falha", async () => {
    model.generate.mockRejectedValue(new Error("provider error with private content"));
    await expect(processAsoSystemOrchestration({ userPrompt: "Teste sintético" })).rejects.toThrow(
      "Nenhum agendamento"
    );
  });

  it("nega leitura sem sessão autenticada", async () => {
    await expect(getAsoRequestsAction()).rejects.toThrow("Sessão inválida");
  });

  it("4. Deve validar se todas as clínicas credenciadas possuem notas e exames suportados", () => {
    expect(INITIAL_PARTNER_CLINICS.length).toBeGreaterThan(0);
    INITIAL_PARTNER_CLINICS.forEach((clinic) => {
      expect(clinic.name).toBeTruthy();
      expect(clinic.distanceKm).toBeGreaterThan(0);
      expect(clinic.rating).toBeGreaterThan(0);
      expect(clinic.supportedExams.length).toBeGreaterThan(0);
    });
  });
});
