/**
 * NextCon Intelligence (NAI) - Genkit AI eSocial Pre-Audit Flow
 * Realiza varredura de inconsistências pré-transmissão nos eventos S-2210, S-2220 e S-2240.
 */

import { ai } from "../genkit";
import { z } from "zod";

export const ESocialPreAuditInputSchema = z.object({
  eventType: z.enum(["S-2210", "S-2220", "S-2240"]),
  companyCnpj: z.string(),
  employeeCpf: z.string(),
  cboCode: z.string().optional(),
  tussCode: z.string().optional(),
  riskFactors: z.array(z.string()).optional(),
  examType: z.string().optional(),
  doctorCrm: z.string().optional(),
});

export const ESocialPreAuditOutputSchema = z.object({
  valid: z.boolean(),
  complianceScore: z.number().min(0).max(100),
  inconsistencies: z.array(
    z.object({
      code: z.string(),
      field: z.string(),
      issue: z.string(),
      recommendation: z.string(),
      severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
    })
  ),
  suggestedXmlFixes: z.array(z.string()),
});

export const esocialPreAuditFlow = ai.defineFlow(
  {
    name: "esocialPreAuditFlow",
    inputSchema: ESocialPreAuditInputSchema,
    outputSchema: ESocialPreAuditOutputSchema,
  },
  async (input) => {
    const prompt = `
      Você é um auditor especialista da Receita Federal e MTE para o eSocial Saúde e Segurança do Trabalho (SST).
      Analise o seguinte evento eSocial (${input.eventType}) antes da transmissão oficial:

      - CNPJ da Empresa: ${input.companyCnpj}
      - CPF do Colaborador: ${input.employeeCpf}
      - CBO do Cargo: ${input.cboCode || "Não informado"}
      - Código TUSS do Exame: ${input.tussCode || "Não informado"}
      - Fatores de Risco (S-2240): ${JSON.stringify(input.riskFactors || [])}
      - Tipo de Exame (S-2220): ${input.examType || "Não informado"}
      - CRM do Médico Responsável: ${input.doctorCrm || "Não informado"}

      Verifique:
      1. Compatibilidade do CBO com os fatores de risco do S-2240.
      2. Validade do TUSS para a tabela eSocial.
      3. Obrigatoriedade do ASO prévio para admissional/periódico.
      4. CRM e UF do médico examinador.

      Retorne uma estrutura JSON válida com a nota de compliance (0 a 100) e os alertas detalhados.
    `;

    const { output } = await ai.generate({
      prompt,
      output: { schema: ESocialPreAuditOutputSchema },
    });

    if (!output) {
      throw new Error("Falha ao gerar auditoria prévia do eSocial.");
    }

    return output;
  }
);
