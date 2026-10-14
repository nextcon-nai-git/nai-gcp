import { ai } from "@/ai/genkit";
import { z } from "zod";
import { CLINICAL_LINE_CODES, clinicalEngine } from "@/services/clinical-rules/engine";
import { logger } from "@/lib/logger";

const reportedNumber = z.number().finite().optional();

// Optional fields remain absent when they were not supplied by the caller.
export const PatientDataSchema = z
  .object({
    nome: z.string().optional().describe("Nome informado, se disponível; não completar"),
    idade: reportedNumber.describe("Idade informada em anos"),
    sexo: z.enum(["M", "F"]).optional().describe("Sexo informado, se disponível"),
    relato: z.string().optional().describe("Relato original, preservando negações e incertezas"),
    peso: reportedNumber.describe("Peso informado em kg"),
    altura: reportedNumber.describe("Altura informada em metros"),
    pas: reportedNumber.describe("Pressão arterial sistólica informada"),
    pad: reportedNumber.describe("Pressão arterial diastólica informada"),
    glicemia_jejum: reportedNumber.describe("Glicemia de jejum informada em mg/dL"),
    hba1c: reportedNumber.describe("Hemoglobina glicada informada em porcentagem"),
    katz_score: reportedNumber.describe("Escore de Katz informado"),
    das28_score: reportedNumber.describe("Escore DAS28 informado"),
    phq9: z.array(z.number().finite()).optional().describe("Respostas informadas do PHQ-9"),
    gad7: z.array(z.number().finite()).optional().describe("Respostas informadas do GAD-7"),
    idade_gestacional_semanas: reportedNumber.describe("Idade gestacional informada em semanas"),
    fatores_risco_gestacional: z
      .array(z.string())
      .optional()
      .describe("Fatores declarados; lista vazia não comprova ausência de risco"),
    mrs_escore: reportedNumber.describe("Escore MRS informado"),
    asa_score: reportedNumber.describe("Classificação ASA informada; não determina liberação"),
    exposicao_72h: z.boolean().optional().describe("Declaração de exposição nas últimas 72h"),
    risco_continuo: z.boolean().optional().describe("Declaração de risco contínuo"),
    epds_score: reportedNumber.describe("Escore EPDS informado"),
    percentil_peso: reportedNumber.describe("Percentil de peso informado"),
    linhas_ativadas: z.array(z.enum(CLINICAL_LINE_CODES)).min(1).max(CLINICAL_LINE_CODES.length),
  })
  .strict();

const reviewNotice =
  "Apresente os valores como dados informados e os totais como cálculos aritméticos. A validade da entrada é apenas estrutural. Nenhuma avaliação clínica foi realizada; interpretação e conduta dependem de revisão profissional. Preserve o relato, as negações, os dados ausentes e os indicadores de revisão pendente.";
const unavailableMessage =
  "Não foi possível organizar os dados. Confira a entrada para revisão profissional.";

export const ClinicalSummaryOutputSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("PRELIMINARY"),
      reviewRequired: z.literal(true),
      clinicallyValidated: z.literal(false),
      paciente: z
        .object({
          nome: z.string().optional(),
          idade: z.number().finite().optional(),
          sexo: z.enum(["M", "F"]).optional(),
        })
        .strict(),
      relato: z.string().optional(),
      resultados_avaliacao: z
        .array(
          z
            .object({
              linha: z.string(),
              codigo: z.enum(CLINICAL_LINE_CODES),
              escore: z.string(),
              conduta: z.string(),
              inputValidity: z.enum(["VALID", "INCOMPLETE_OR_INVALID"]),
              clinicallyValidated: z.literal(false),
              reviewRequired: z.literal(true),
              reportedData: z.record(z.unknown()),
            })
            .strict()
        )
        .min(1),
      aviso_ia: z.literal(reviewNotice),
    })
    .strict(),
  z
    .object({
      status: z.literal("UNAVAILABLE"),
      reviewRequired: z.literal(true),
      clinicallyValidated: z.literal(false),
      error: z.literal(unavailableMessage),
    })
    .strict(),
]);

export const evaluateClinicalLinesTool = ai.defineTool(
  {
    name: "evaluateClinicalLines",
    description:
      "Organiza dados declarados e calcula somente somas de questionários completos e IMC, sem interpretação clínica. Use apenas valores presentes na fonte; não complete informações ausentes. O resultado é preliminar, sem diagnóstico, prescrição ou liberação, e exige revisão profissional.",
    inputSchema: PatientDataSchema,
    outputSchema: ClinicalSummaryOutputSchema,
  },
  async (patientData): Promise<z.infer<typeof ClinicalSummaryOutputSchema>> => {
    try {
      const dados = PatientDataSchema.parse(patientData);
      const resultados = clinicalEngine.avaliarPaciente(dados);
      return ClinicalSummaryOutputSchema.parse({
        status: "PRELIMINARY",
        reviewRequired: true,
        clinicallyValidated: false,
        paciente: {
          ...(dados.nome === undefined ? {} : { nome: dados.nome }),
          ...(dados.idade === undefined ? {} : { idade: dados.idade }),
          ...(dados.sexo === undefined ? {} : { sexo: dados.sexo }),
        },
        ...(dados.relato === undefined ? {} : { relato: dados.relato }),
        resultados_avaliacao: resultados,
        aviso_ia: reviewNotice,
      });
    } catch {
      logger.warn("Resumo clínico indisponível", { code: "CLINICAL_SUMMARY_UNAVAILABLE" });
      return {
        status: "UNAVAILABLE" as const,
        reviewRequired: true as const,
        clinicallyValidated: false as const,
        error: unavailableMessage,
      };
    }
  }
);
