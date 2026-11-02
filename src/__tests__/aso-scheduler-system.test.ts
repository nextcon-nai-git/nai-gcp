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
  records.clear();
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
  return {
    adminDb: {
      collection: () => ({ doc: () => ({ collection: () => store }) }),
      runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
        const writes: Array<() => void> = [];
        const result = await fn({
          get: (ref: any) => ref.get(),
          update: (ref: any, changes: any) =>
            writes.push(() => records.set(ref.id, { ...records.get(ref.id), ...changes })),
        });
        writes.forEach((write) => write());
        return result;
      },
    },
  };
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

  it("não transforma minuta de kit nem timestamp legado em comprovante de envio", async () => {
    const existing = {
      id: "synthetic-req",
      status: "kit_montado",
      digitalKit: { kitId: "MINUTA", kitSentAt: "2026-10-20T12:00:00Z" },
      updatedAt: "2026-10-20T12:00:00Z",
    };
    records.set(existing.id, existing);
    const advanced = await advancePipelineStepAction(existing.id, "kit_enviado", "test-token");
    expect(advanced.success).toBe(false);
    expect(advanced.error).toContain("envio efetivo");
    expect(records.get(existing.id)).toEqual(existing);
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

describe("avanço com evidência e controle transacional", () => {
  const record = () => ({
    id: "synthetic-req",
    status: "solicitado",
    validationPassed: false,
    exams: [{ name: "Exame para revisão" }],
    updatedAt: "2026-10-20T12:00:00Z",
    employeeName: "Pessoa sintética",
    sourceMessageId: "origem-preservada",
    digitalKit: { kitSentAt: "2026-10-20T12:00:00Z", clinicConfirmedAt: "2026-10-20T12:00:00Z" },
  });
  it("avança só a próxima revisão, preserva identidade e não repete a escrita", async () => {
    records.set("synthetic-req", record());
    const first = await advancePipelineStepAction("synthetic-req", "validando", "test-token");
    expect(first).toMatchObject({
      success: true,
      data: { status: "validando", sourceMessageId: "origem-preservada" },
    });
    const at = records.get("synthetic-req").updatedAt;
    const again = await advancePipelineStepAction("synthetic-req", "validando", "test-token");
    expect(again.data?.updatedAt).toBe(at);
    expect(
      (await advancePipelineStepAction("synthetic-req", "solicitado", "test-token")).success
    ).toBe(false);
    expect(records.get("synthetic-req").status).toBe("validando");
  });
  it("rejeita saltos, etapa arbitrária e identificadores inválidos sem alterar dados", async () => {
    records.set("synthetic-req", record());
    for (const target of ["clinica_selecionada", "administrator", "__proto__", null]) {
      expect(
        (await advancePipelineStepAction("synthetic-req", target as any, "test-token")).success
      ).toBe(false);
    }
    expect((await advancePipelineStepAction(null as any, "validando", "test-token")).success).toBe(
      false
    );
    expect((await advancePipelineStepAction("../other", "validando", "test-token")).success).toBe(
      false
    );
    expect(records.get("synthetic-req")).toEqual(record());
  });
  it("não confirma exames sugeridos pela IA antes da revisão do PCMSO", async () => {
    records.set("synthetic-req", { ...record(), status: "validando" });
    const pending = await advancePipelineStepAction(
      "synthetic-req",
      "exames_definidos",
      "test-token"
    );
    expect(pending).toMatchObject({ success: false });
    expect(pending.error).toContain("PCMSO");
    records.set("synthetic-req", { ...record(), status: "validando", validationPassed: true });
    expect(
      (await advancePipelineStepAction("synthetic-req", "exames_definidos", "test-token")).success
    ).toBe(true);
    expect(
      (await advancePipelineStepAction("synthetic-req", "clinica_selecionada", "test-token"))
        .success
    ).toBe(false);
  });
  it.each([
    "agendado",
    "kit_montado",
    "kit_enviado",
    "clinica_confirmou",
    "exame_realizado",
    "aso_concluido",
  ] as const)(
    "exige evidência externa para %s mesmo com datas antigas e kit em memória",
    async (stage) => {
      const existing = { ...record(), status: stage, validationPassed: true };
      records.set("synthetic-req", existing);
      const result = await advancePipelineStepAction("synthetic-req", stage, "test-token");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Registre");
      expect(records.get("synthetic-req")).toEqual(existing);
    }
  );
});

describe("manual ASO intake", () => {
  const manual = {
    companyName: "TESTE NAI",
    cnpj: "00.000.000/0000-00",
    employeeName: "COLABORADOR FICTÍCIO",
    cpf: "000.000.000-00",
    roleTitle: "Homologação",
    department: "Teste",
    examType: "periodico" as const,
    declaredRisks: [],
    manualReview: true,
    manualExamNames: ["Exame fictício de homologação"],
  };
  it("persists a pending manual request even when AI is unavailable, without inventing a kit or appointment", async () => {
    model.generate.mockRejectedValue(new Error("Unavailable"));
    model.generate.mockClear();
    const result = await createAsoRequestAction(manual, "test-token");
    expect(result.success).toBe(true);
    expect(model.generate).not.toHaveBeenCalled();
    expect(records.get(result.data!.id)).toMatchObject({
      status: "solicitado",
      validationPassed: false,
      clinicId: "",
      appointmentDate: "",
      exams: [{ name: "Exame fictício de homologação", mandatory: "CONDICIONAL" }],
      alerts: [{ requiresHumanIntervention: true, status: "PENDING" }],
    });
    expect(result.data?.digitalKit).toBeUndefined();
    for (const stage of [
      "kit_montado",
      "kit_enviado",
      "clinica_confirmou",
      "exame_realizado",
      "aso_concluido",
    ] as const) {
      expect((await advancePipelineStepAction(result.data!.id, stage, "test-token")).success).toBe(
        false
      );
    }
    expect(records.get(result.data!.id).status).toBe("solicitado");
  });
  it("rejects missing manual examinations and unauthenticated writes", async () => {
    expect(
      (await createAsoRequestAction({ ...manual, manualExamNames: [] }, "test-token")).success
    ).toBe(false);
    expect((await createAsoRequestAction(manual, "")).success).toBe(false);
  });
});
