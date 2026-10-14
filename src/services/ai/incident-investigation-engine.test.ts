import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ generate: vi.fn(), retrieve: vi.fn() }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));
vi.mock("./normative-kb", () => ({ retrieveApplicableNorms: mock.retrieve }));
import { analyzeIncidentWithNormativeGrounding } from "./incident-investigation-engine";

const description =
  "Durante a inspeção visual da prensa P1, a pessoa relatou um ruído. Capacete citado no relato.";
const reference = {
  source: "REFERENCIA-SINTETICA",
  section: "1.2",
  title: "Referência para revisão em teste",
  revision: "Revisão sintética",
  text: "Conteúdo de teste sem validade normativa.",
  keywords: ["prensa"],
  riskCategory: "TESTE",
};
const citation = {
  source: reference.source,
  section: reference.section,
  revision: reference.revision,
};
const emptyDraft = () => ({
  extractedFacts: { activity: null, equipment: [], location: null, ppeMentioned: [] },
  reviewPoints: [],
});
const supportedDraft = () => ({
  extractedFacts: {
    activity: {
      value: "inspeção visual",
      evidence: "Durante a inspeção visual da prensa P1",
      source: "DESCRIPTION",
    },
    equipment: [
      {
        value: "prensa P1",
        evidence: "Durante a inspeção visual da prensa P1",
        source: "DESCRIPTION",
      },
    ],
    location: { value: "Setor Leste", evidence: "Setor Leste", source: "LOCATION" },
    ppeMentioned: [
      { value: "Capacete", evidence: "Capacete citado no relato.", source: "DESCRIPTION" },
    ],
  },
  reviewPoints: [
    {
      question: "Há registro da inspeção relatada para revisão profissional?",
      evidence: "a pessoa relatou um ruído.",
      reference: citation,
    },
  ],
});
const analyze = (text = description) =>
  analyzeIncidentWithNormativeGrounding("incident-a", "company-a", text, {
    location: "Setor Leste",
  });

beforeEach(() => {
  vi.resetAllMocks();
  mock.retrieve.mockReturnValue([reference]);
  mock.generate.mockResolvedValue({ output: emptyDraft() });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("investigação de incidente com fonte e revisão obrigatória", () => {
  it.each([
    "Não houve óbito, queda, fratura, lesão ou afastamento.",
    "Sem morte e sem afastamento; a testemunha negou choque elétrico.",
    "Afastamento aparece apenas como pergunta do formulário; duração não informada.",
    "A testemunha relata óbito; a ocorrência ainda depende de verificação.",
    "Foi mencionado um atestado, sem identificação ou prazo de afastamento.",
  ])("não transforma palavras do relato em conclusão: %s", async (text) => {
    const result = await analyzeIncidentWithNormativeGrounding("incident-a", "company-a", text);
    expect(result).toMatchObject({
      analysisStatus: "PRELIMINARY",
      reviewRequired: true,
      sourceStatus: "REPORTED_UNVERIFIED",
      severity: null,
      riskCategories: [],
      findings: [],
      extractedFacts: {
        summary: text,
        activity: "",
        location: "",
        equipment: [],
        ppeMentioned: [],
        injuryType: null,
        hasLeave: null,
        estimatedDaysOfLeave: null,
      },
      esocialImpact: {
        requiresCatS2210: null,
        deadlineCat: null,
        catDeadlineIso: null,
        catDeadlineTimestamp: null,
        pgrUpdateRequired: null,
      },
    });
    expect(mock.retrieve).toHaveBeenCalledWith(text, []);
  });

  it("preserva transcrições sustentadas e referências candidatas, sem confiança ou gravidade presumidas", async () => {
    mock.generate.mockResolvedValueOnce({ output: supportedDraft() });
    const result = await analyze();
    expect(result.extractedFacts).toMatchObject({
      activity: "Durante a inspeção visual da prensa P1, a pessoa relatou um ruído.",
      equipment: ["Durante a inspeção visual da prensa P1, a pessoa relatou um ruído."],
      location: "Setor Leste",
      ppeMentioned: ["Capacete citado no relato."],
    });
    expect(result.sourceEvidence).toContainEqual({
      field: "equipment",
      evidence: "Durante a inspeção visual da prensa P1, a pessoa relatou um ruído.",
      source: "DESCRIPTION",
    });
    expect(result.findings).toEqual([
      expect.objectContaining({
        status: "PRELIMINARY",
        severity: null,
        confidence: null,
        finding:
          "Pergunta para revisão: Há registro da inspeção relatada para revisão profissional?",
        legalBasis: {
          ...citation,
          evidence: "Durante a inspeção visual da prensa P1, a pessoa relatou um ruído.",
          verificationStatus: "PENDING_REVIEW",
        },
      }),
    ]);
    expect(result.retrievedNorms[0].verificationStatus).toBe("PENDING_REVIEW");
  });

  it.each([
    ["activity", "Não houve trabalho em altura.", "trabalho em altura", "houve trabalho em altura"],
    ["equipment", "Não houve operação da prensa P1.", "prensa P1", "operação da prensa P1"],
    ["ppeMentioned", "Não houve uso de capacete.", "capacete", "uso de capacete"],
  ] as const)(
    "preserva a negação ao exibir %s, mesmo se o modelo a omitir do valor/trecho",
    async (field, text, value, evidence) => {
      const fragment = { value, evidence, source: "DESCRIPTION" };
      mock.generate.mockResolvedValueOnce({
        output: {
          ...emptyDraft(),
          extractedFacts: {
            ...emptyDraft().extractedFacts,
            [field]: field === "activity" ? fragment : [fragment],
          },
        },
      });
      const result = await analyze(text);
      expect(result.extractedFacts[field]).toEqual(field === "activity" ? text : [text]);
      expect(result.sourceEvidence[0].evidence).toBe(text);
      expect(result.sourceEvidence[0]).not.toHaveProperty("value");
    }
  );

  it("não afirma análise da foto que não foi lida", async () => {
    const photoUrl = "https://example.invalid/private-photo.jpg";
    const result = await analyzeIncidentWithNormativeGrounding(
      "incident-a",
      "company-a",
      description,
      { photoUrl }
    );
    expect(result.limitations).toContain("Foto informada não foi analisada por este fluxo.");
    expect(mock.generate.mock.calls[0][0].prompt).not.toContain(photoUrl);
  });

  it("mantém o SHA-256 como comparação do conteúdo completo, sem assinatura", async () => {
    const result = await analyze();
    const { immutableDigest, ...content } = result;
    expect(immutableDigest).toBe(
      createHash("sha256").update(JSON.stringify(content)).digest("hex")
    );
    const changed = { ...content, companyId: "company-b" };
    expect(createHash("sha256").update(JSON.stringify(changed)).digest("hex")).not.toBe(
      immutableDigest
    );
  });
});

describe("falha e evidência insuficiente não produzem parecer simulado", () => {
  it("sem IA informa indisponibilidade e não expõe erro privado ou relato nos logs", async () => {
    mock.generate.mockRejectedValueOnce(new Error("Private API key detail and patient data"));
    await expect(analyze()).rejects.toThrow(
      "Nenhum parecer clínico, afastamento, obrigação ou prazo de CAT foi gerado"
    );
    const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logs).not.toContain("Private API key");
    expect(logs).not.toContain(description);
    expect(logs).toContain("UNAVAILABLE");
  });

  it.each([
    null,
    {},
    { extractedFacts: {} },
    { ...emptyDraft(), severity: "FATAL" },
    { ...emptyDraft(), esocialImpact: { requiresCatS2210: true, deadlineCat: "4 horas" } },
    {
      ...emptyDraft(),
      extractedFacts: {
        ...emptyDraft().extractedFacts,
        injuryType: "fratura",
        hasLeave: true,
        estimatedDaysOfLeave: 15,
      },
    },
  ])("rejeita resposta inválida ou campos clínicos/regulatórios indevidos: %j", async (output) => {
    mock.generate.mockResolvedValueOnce({ output });
    await expect(analyze()).rejects.toThrow("está indisponível ou sem evidência suficiente");
  });

  it.each([
    [
      "atividade inventada",
      {
        ...supportedDraft(),
        extractedFacts: {
          ...supportedDraft().extractedFacts,
          activity: {
            value: "Soldagem",
            evidence: "Durante a inspeção visual da prensa P1",
            source: "DESCRIPTION",
          },
        },
      },
    ],
    [
      "local sem fonte",
      {
        ...supportedDraft(),
        extractedFacts: {
          ...supportedDraft().extractedFacts,
          location: {
            value: "Área Operacional",
            evidence: "Área Operacional",
            source: "DESCRIPTION",
          },
        },
      },
    ],
    [
      "equipamento extraído do campo de local",
      {
        ...supportedDraft(),
        extractedFacts: {
          ...supportedDraft().extractedFacts,
          equipment: [{ value: "Setor Leste", evidence: "Setor Leste", source: "LOCATION" }],
        },
      },
    ],
    [
      "trecho jurídico inventado",
      {
        ...supportedDraft(),
        reviewPoints: [
          {
            ...supportedDraft().reviewPoints[0],
            evidence: "Houve amputação e violação normativa.",
          },
        ],
      },
    ],
    [
      "referência não recuperada",
      {
        ...supportedDraft(),
        reviewPoints: [
          {
            ...supportedDraft().reviewPoints[0],
            reference: { ...citation, source: "NORMA-INVENTADA" },
          },
        ],
      },
    ],
    [
      "item não recuperado",
      {
        ...supportedDraft(),
        reviewPoints: [
          { ...supportedDraft().reviewPoints[0], reference: { ...citation, section: "999.9" } },
        ],
      },
    ],
    [
      "revisão inventada",
      {
        ...supportedDraft(),
        reviewPoints: [
          {
            ...supportedDraft().reviewPoints[0],
            reference: { ...citation, revision: "Revisão não recuperada" },
          },
        ],
      },
    ],
    [
      "conclusão em vez de pergunta",
      {
        ...supportedDraft(),
        reviewPoints: [
          { ...supportedDraft().reviewPoints[0], question: "Infração confirmada pelo relato." },
        ],
      },
    ],
  ])("recusa %s", async (_case, output) => {
    mock.generate.mockResolvedValueOnce({ output });
    await expect(analyze()).rejects.toThrow("sem evidência suficiente");
  });

  it("aceita pergunta com fonte sem atribuir norma quando nenhuma foi recuperada", async () => {
    mock.retrieve.mockReturnValueOnce([]);
    mock.generate.mockResolvedValueOnce({
      output: {
        ...emptyDraft(),
        reviewPoints: [
          {
            question: "Existe registro da inspeção relatada?",
            evidence: "Durante a inspeção visual da prensa P1",
            reference: null,
          },
        ],
      },
    });
    const result = await analyze();
    expect(result.findings).toEqual([]);
    expect(result.retrievedNorms).toEqual([]);
    expect(result.reviewQuestions).toHaveLength(1);
  });

  it("cancela a chamada que excede o prazo sem usar data atual como prazo de CAT", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mock.generate.mockImplementationOnce((options: { abortSignal: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {});
    });
    const pending = analyze("Não houve óbito nem afastamento.");
    const rejection = expect(pending).rejects.toThrow("está indisponível");
    await vi.advanceTimersByTimeAsync(45000);
    await rejection;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
