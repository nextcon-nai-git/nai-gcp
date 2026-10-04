import { describe, it, expect } from "vitest";
import {
  processMultidisciplinarySstRequest,
  MultidisciplinarySstOutputSchema,
} from "@/ai/flows/multidisciplinary-sst-agent-flow";

describe("Multidisciplinary SST Agent (Prompt Mestre) Unit Tests", () => {
  it("deve retornar estrutura JSON válida e conforme com as 5 especialidades e análise cruzada", async () => {
    const output = await processMultidisciplinarySstRequest({
      userPrompt:
        "Operador de ponte rolante e prensa hidráulica relata dor lombar constante e ruído elevado no galpão industrial.",
      companyContext: {
        companyName: "Metalúrgica Teste Ltda",
        industrySector: "Metalmecânico",
        employeeCount: 150,
        specificRisk: "Ruído > 85dB e Postura Inadequada",
      },
    });

    expect(output).toBeDefined();
    expect(output.resumo_executivo).toBeTruthy();
    expect(["CRITICO", "ALTO", "MEDIO", "BAIXO", "OBSERVACAO"]).toContain(
      output.classificacao_geral
    );

    // Verificação da Análise das 5 Especialidades
    expect(output.analise_engenharia_seguranca.perigos.length).toBeGreaterThan(0);
    expect(output.analise_tecnico_seguranca.acoes_imediatas.length).toBeGreaterThan(0);
    expect(output.analise_medico_trabalho.relacao_ocupacional).toBeDefined();
    expect(output.analise_enfermagem_trabalho.conduta_sugerida.length).toBeGreaterThan(0);
    expect(output.analise_ergonomica.recomendacoes.length).toBeGreaterThan(0);

    // Análise cruzada e plano de ação
    expect(output.analise_integrada.consensos.length).toBeGreaterThan(0);
    expect(output.plano_de_acao.length).toBeGreaterThan(0);
    expect(output.fundamentacao_normativa.length).toBeGreaterThan(0);
    expect(output.confianca_analise).toBeGreaterThanOrEqual(0);
    expect(output.confianca_analise).toBeLessThanOrEqual(100);

    // Validação com o Zod Schema
    const parsed = MultidisciplinarySstOutputSchema.safeParse(output);
    expect(parsed.success).toBe(true);
  });
});
