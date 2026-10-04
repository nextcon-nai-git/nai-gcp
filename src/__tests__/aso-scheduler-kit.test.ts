import { describe, it, expect } from "vitest";
import {
  processAsoSchedulerKitRequest,
  AsoSchedulerKitOutputSchema,
} from "@/ai/flows/aso-scheduler-kit-agent-flow";

describe("Agente IA Agendador de ASO & Montador de Kit para Clínicas Unit Tests", () => {
  it("deve gerar agendamento de exames e kit completo para a clínica credenciada conforme NR-07", async () => {
    const result = await processAsoSchedulerKitRequest({
      userPrompt:
        "Agendamento de exame admissional para operador de caldeira e vasos de pressão (NR-13) com exposição a ruído e calor.",
      workerData: {
        name: "Carlos Eduardo Oliveira",
        cpf: "123.456.789-00",
        roleTitle: "Operador de Caldeira",
        department: "Utilidades e Vapor",
        examType: "ADMISSIONAL",
      },
      companyContext: {
        companyName: "Indústria Química NAI S.A.",
        industrySector: "Químico",
        specificRisk: "Ruído > 85dB, Calor Radiante e Vasos sob Pressão",
      },
      clinicData: {
        clinicName: "Clínica Saúde & Vida Ocupacional",
      },
    });

    expect(result).toBeDefined();
    expect(result.resumo_agendamento).toBeTruthy();
    expect(result.tipo_aso).toBe("ADMISSIONAL");
    expect(result.exames_complementares.length).toBeGreaterThan(0);
    expect(result.kit_clinica.numero_guia).toContain("OS-NAI-");
    expect(result.kit_clinica.instrucoes_tecnicas_clinica.length).toBeGreaterThan(0);
    expect(result.kit_clinica.prazo_devolucao_aso_dias).toBeGreaterThan(0);
    expect(result.alertas_seguranca.length).toBeGreaterThan(0);

    // Validação de Schema Zod
    const parsed = AsoSchedulerKitOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
