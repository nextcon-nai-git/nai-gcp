import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processAsoSchedulerKitRequest,
  AsoSchedulerKitOutputSchema,
} from "@/ai/flows/aso-scheduler-kit-agent-flow";
const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));
beforeEach(() => {
  mock.generate.mockReset();
});

describe("Kit de agendamento exige dados reais e revisão médica", () => {
  it("falha da IA não prescreve exames ou gera guia fictícia para trabalhador", async () => {
    mock.generate.mockRejectedValue(new Error("private provider details"));
    await expect(
      processAsoSchedulerKitRequest({
        userPrompt: "Agendar exame para soldador",
        workerData: { name: "Pessoa sintética", examType: "ADMISSIONAL" },
      })
    ).rejects.toThrow("nenhum exame");
  });

  it("resposta malformada não passa apenas por conter um resumo", async () => {
    mock.generate.mockResolvedValue({ output: { resumo_agendamento: "Sucesso" } });
    await expect(
      processAsoSchedulerKitRequest({ userPrompt: "Preparar revisão de agenda" })
    ).rejects.toThrow("não foi gerado");
  });

  it("preserva rascunho sem converter número inventado pelo modelo em guia registrada", async () => {
    const output = {
      resumo_agendamento: "Rascunho pendente de protocolo e revisão médica.",
      tipo_aso: "Não informado",
      exames_complementares: [],
      kit_clinica: {
        numero_guia: "OS-NAI-inventada",
        dados_empresa: "Empresa sintética",
        dados_trabalhador: "Pessoa sintética",
        instrucoes_tecnicas_clinica: [],
        prazo_devolucao_aso_dias: null,
        aso_pre_preenchido: {
          riscos_ocupacionais_declarados: [],
          parecer_apto_inapto_template: "",
          observacoes_medico_examinador: "",
        },
      },
      alertas_seguranca: ["Obter protocolo médico aprovado"],
    };
    mock.generate.mockResolvedValueOnce({ output });
    const result = await processAsoSchedulerKitRequest({
      userPrompt: "Preparar uma revisão de agenda",
    });
    expect(AsoSchedulerKitOutputSchema.safeParse(result).success).toBe(true);
    expect(result.kit_clinica.numero_guia).toBe("");
    expect(result.kit_clinica.prazo_devolucao_aso_dias).toBeNull();
    expect(result.exames_complementares).toEqual([]);
    const request = mock.generate.mock.calls[0][0];
    expect(request.model).toBeUndefined();
    expect(request.prompt).not.toContain("000.000.000-00");
    expect(request.prompt).not.toContain("Ruído (>85 dBA) ->");
  });
});
