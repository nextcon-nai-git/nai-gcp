import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  processMultidisciplinarySstRequest,
  MultidisciplinarySstOutputSchema,
} from "@/ai/flows/multidisciplinary-sst-agent-flow";

const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));

const insufficientEvidence = {
  resumo_executivo: "EVIDÊNCIA INSUFICIENTE: faltam dados e documentos para análise profissional.",
  classificacao_geral: "OBSERVACAO",
  evidencias: [],
  analise_engenharia_seguranca: {
    perigos: [],
    riscos: [],
    controles_existentes: [],
    nao_conformidades: [],
    recomendacoes: [],
  },
  analise_tecnico_seguranca: {
    condicoes_inseguras: [],
    desvios: [],
    acoes_imediatas: [],
    acoes_corretivas: [],
    acoes_preventivas: [],
  },
  analise_medico_trabalho: {
    riscos_relacionados: [],
    achados: [],
    alertas: [],
    hipoteses: [],
    recomendacoes: [],
    relacao_ocupacional: "NAO AVALIAVEL",
    necessita_avaliacao_medica: false,
  },
  analise_enfermagem_trabalho: {
    dados_relevantes: [],
    sinais_alerta: [],
    conduta_sugerida: [],
    encaminhamentos: [],
    acompanhamento: [],
  },
  analise_ergonomica: {
    fatores_risco: [],
    demanda_fisica: [],
    demanda_cognitiva: [],
    organizacao_trabalho: [],
    controles_existentes: [],
    recomendacoes: [],
    necessita_aet: false,
  },
  analise_integrada: {
    consensos: [],
    divergencias: [],
    riscos_sistemicos: [],
    riscos_prioritarios: [],
  },
  plano_de_acao: [],
  fundamentacao_normativa: [],
  evidencias_faltantes: ["Documentos do caso"],
  necessita_avaliacao_presencial: false,
  necessita_avaliacao_especializada: false,
  restricao_de_acesso: "",
  confianca_analise: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  mock.generate.mockRejectedValue(new Error("Private provider error"));
});

describe("Análise multidisciplinar sem parecer de contingência inventado", () => {
  it("informa indisponibilidade sem gerar cinco análises, risco médio e confiança fixa", async () => {
    await expect(
      processMultidisciplinarySstRequest({ userPrompt: "Caso sintético sem medições ou exames." })
    ).rejects.toThrow(
      "Nenhum parecer, classificação de risco, conduta ou grau de confiança foi gerado"
    );
  });

  it.each([
    null,
    {},
    { resumo_executivo: "Parecer parcial" },
    { ...insufficientEvidence, confianca_analise: 175 },
  ])("não retorna resposta incompleta ou inválida: %j", async (output) => {
    mock.generate.mockResolvedValueOnce({ output });
    await expect(
      processMultidisciplinarySstRequest({ userPrompt: "Caso sintético." })
    ).rejects.toThrow("está indisponível");
  });

  it("preserva saída completa validada sem completar controles, condutas ou consensos", async () => {
    mock.generate.mockResolvedValueOnce({ output: insufficientEvidence });
    const result = await processMultidisciplinarySstRequest({ userPrompt: "Caso sintético." });
    expect(MultidisciplinarySstOutputSchema.safeParse(result).success).toBe(true);
    expect(result).toEqual(insufficientEvidence);
    expect(mock.generate.mock.calls[0][0]).not.toHaveProperty("model");
  });

  it("cancela o provedor no prazo e não gera análise no timeout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mock.generate.mockImplementationOnce((options: { abortSignal: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {});
    });
    try {
      const pending = processMultidisciplinarySstRequest({ userPrompt: "Caso sintético." });
      const rejection = expect(pending).rejects.toThrow("está indisponível");
      await vi.advanceTimersByTimeAsync(45000);
      await rejection;
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
