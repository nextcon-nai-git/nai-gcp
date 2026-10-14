"use server";
import { requireAiAction, CLINICAL_AI_ROLES } from "@/lib/auth/ai-action";

/**
 * @fileOverview NAI Superauditoria Cruzada eSocial - Powered by Gemini 3.8 Flash
 * Cruza em profundidade:
 * 1. Evento S-2240 (Condições Ambientais do Trabalho / Riscos PGR / LTCAT)
 * 2. Evento S-2220 (Monitoramento da Saúde do Trabalhador / ASO / PCMSO)
 * 3. Evento S-1200 / Folha de Pagamento (Adicionais de Insalubridade e Periculosidade)
 * Identifica passivos fiscais ocultos e calcula a estimativa de multas administrativas em Reais (Art. 201 CLT).
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

export const CrossAuditItemSchema = z.object({
  id: z.string(),
  employeeName: z.string(),
  cpf: z.string(),
  jobRole: z.string(),
  sector: z.string(),
  hazardDetected: z
    .string()
    .describe(
      "Agente nocivo informado no S-2240 ou folha (ex: Ruído > 85dB, Sílica, Trabalho em Altura, Benzeno, Eletricidade)."
    ),
  requiredExam: z.string().describe("Exame médico periódico ou complementar exigido pela NR-07."),
  currentStatus: z.enum(["MISSING", "EXPIRED", "INCONSISTENT", "COMPLIANT"]),
  riskSeverity: z.enum(["ALTO", "MEDIO", "CRITICO"]),
  legalViolation: z.string().describe("Artigo da CLT, item da NR ou regra eSocial violada."),
  estimatedFineMin: z.number().describe("Valor mínimo da multa em Reais (R$)."),
  estimatedFineMax: z.number().describe("Valor máximo da multa em Reais (R$)."),
  correctiveAction: z
    .string()
    .describe("Medida técnica ou médica imediata para sanar a inconsistência."),
});

export const CrossAuditReportSchema = z.object({
  companyName: z.string(),
  cnpj: z.string(),
  auditDate: z.string(),
  overallComplianceScore: z.number().describe("Score de conformidade de 0 a 100."),
  totalAuditedEmployees: z.number(),
  nonCompliantCount: z.number(),
  totalEstimatedFineExposure: z
    .number()
    .describe("Exposição financeira total estimada em Reais (R$)."),
  crossAudits: z.array(CrossAuditItemSchema),
  executiveStrategicAdvice: z
    .string()
    .describe("Recomendação estratégica da IA Gemini 3.8 para o C-Level e Diretor de RH."),
});

export type CrossAuditReport = z.infer<typeof CrossAuditReportSchema>;

export async function runEsocialCrossAudit(
  input: {
    companyName: string;
    cnpj?: string;
    employeesData?: Array<{
      name: string;
      cpf: string;
      role: string;
      sector: string;
      hazards: string[];
      examsDone: string[];
      hasInsalubrityAddon?: boolean;
      hasPerilousnessAddon?: boolean;
    }>;
  },
  idToken?: string
): Promise<CrossAuditReport> {
  await requireAiAction(idToken, CLINICAL_AI_ROLES, [input]);

  if (!input.employeesData?.length)
    throw new Error("Forneça dados dos colaboradores e documentos de origem para a auditoria.");
  const systemPrompt = `Revise somente os registros fornecidos. Não invente trabalhadores, exames, medições, multas ou dados de eventos eSocial.
Não presuma que um exame é obrigatório somente pelo cargo. Use o PCMSO, o PGR e evidências datadas; ausência de documento não comprova infração.
Não determine aptidão, nexo causal, direito a adicional ou conclusão jurídica. Sinalize pendências para revisão médica, técnica e jurídica.
Sem base normativa vigente e contexto suficiente, valores de multas devem ser zero e a justificativa deve indicar não calculado.
Retorne uma análise preliminar, sem declarar certificação ou transmissão de evento.`;

  try {
    const { output } = await ai.generate({
      system: systemPrompt,
      prompt: `EMPRESA: ${input.companyName} (CNPJ: ${input.cnpj || "Matriz"})
DADOS DISPONÍVEIS: ${JSON.stringify(input.employeesData || [])}`,
      output: { schema: CrossAuditReportSchema },
    });

    if (output && output.companyName) {
      return output as CrossAuditReport;
    }
  } catch (err) {
    // Provider errors must never manufacture findings or expose document data.
  }
  throw new Error(
    "A auditoria não foi concluída pela IA. Nenhum resultado foi gerado; tente novamente."
  );
}
