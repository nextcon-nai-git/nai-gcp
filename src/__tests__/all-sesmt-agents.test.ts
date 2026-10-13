import { beforeEach, describe, it, expect, vi } from "vitest";
import { processSesmtAgentRequest } from "@/ai/flows/sesmt-agents-flow";
import { processMultidisciplinarySstRequest } from "@/ai/flows/multidisciplinary-sst-agent-flow";
import { processAsoSchedulerKitRequest } from "@/ai/flows/aso-scheduler-kit-agent-flow";
import { SESMT_AGENTS_CONFIG, type AgentRole } from "@/ai/sesmt-agents-config";

const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));

const roles: AgentRole[] = [
  "engenheiro_seguranca",
  "tecnico_seguranca",
  "enfermeiro_trabalho",
  "ergonomista",
  "medico_trabalho",
  "junta_sesmt",
];

beforeEach(() => {
  vi.resetAllMocks();
  mock.generate.mockRejectedValue(new Error("Provider unavailable with private details"));
});

describe("Indisponibilidade dos agentes de SST sem conclusões fabricadas", () => {
  it("não devolve parecer multidisciplinar genérico quando a IA falha", async () => {
    await expect(
      processMultidisciplinarySstRequest({ userPrompt: "Caso sintético sem documentos." })
    ).rejects.toThrow("Nenhum parecer");
  });

  it("não inventa kit de ASO quando a IA falha", async () => {
    await expect(
      processAsoSchedulerKitRequest({
        userPrompt: "Solicitação de ASO sem protocolo médico anexado.",
        workerData: { name: "Pessoa sintética", roleTitle: "Soldador" },
      })
    ).rejects.toThrow("nenhum exame");
  });

  it.each(roles)("%s informa indisponibilidade em vez de simular análise", async (agentRole) => {
    await expect(
      processSesmtAgentRequest({ agentRole, userPrompt: "Caso sintético sem evidência." })
    ).rejects.toThrow("Nenhuma conclusão técnica, conduta ou lista de ações foi gerada");
  });

  it.each(roles)(
    "%s preserva o papel correto e uma resposta validada sem inventar ações",
    async (agentRole) => {
      mock.generate.mockResolvedValueOnce({
        output: {
          agentRole: "papel retornado indevidamente pelo modelo",
          agentTitle: "Título retornado pelo modelo",
          analysis: "EVIDÊNCIA INSUFICIENTE: faltam documentos do caso para revisão profissional.",
          actionItems: [],
          relevantStandards: [],
        },
      });
      const result = await processSesmtAgentRequest({
        agentRole,
        userPrompt: "Caso sintético sem evidência.",
      });
      expect(result.agentRole).toBe(SESMT_AGENTS_CONFIG[agentRole].role);
      expect(result.agentTitle).toBe(SESMT_AGENTS_CONFIG[agentRole].title);
      expect(result.actionItems).toEqual([]);
      expect(result.relevantStandards).toEqual([]);
      expect(result.warningAlert).toBeUndefined();
    }
  );

  it.each([
    null,
    {},
    { analysis: "Resposta parcial não validada" },
    {
      agentRole: "medico_trabalho",
      agentTitle: "Médico",
      analysis: "   ",
      actionItems: [],
      relevantStandards: [],
    },
  ])("não aceita saída incompleta do provedor: %j", async (output) => {
    mock.generate.mockResolvedValueOnce({ output });
    await expect(
      processSesmtAgentRequest({ agentRole: "medico_trabalho", userPrompt: "Caso sintético." })
    ).rejects.toThrow("está indisponível");
  });

  it("cancela o processamento excedido e informa indisponibilidade", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mock.generate.mockImplementationOnce((options: { abortSignal: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {});
    });
    try {
      const pending = processSesmtAgentRequest({
        agentRole: "medico_trabalho",
        userPrompt: "Caso sintético.",
      });
      const rejection = expect(pending).rejects.toThrow("está indisponível");
      await vi.advanceTimersByTimeAsync(45000);
      await rejection;
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mantém os metadados configurados para cada agente", () => {
    roles.forEach((role) => {
      const config = SESMT_AGENTS_CONFIG[role];
      expect(config.title).toBeTruthy();
      expect(config.avatar).toBeTruthy();
      expect(config.badge).toBeTruthy();
    });
  });
});
