import { ai } from "@/ai/genkit";
import { z } from "zod";
import { clinicalEngine } from "@/services/clinical-rules/engine";

// Esquema Zod detalhado para forçar a IA a preencher as variáveis vitais corretas
export const PatientDataSchema = z.object({
  nome: z.string().describe("Nome completo do paciente"),
  idade: z.number().describe("Idade em anos"),
  sexo: z.enum(["M", "F"]).describe("Sexo biológico (M ou F)"),
  peso: z.number().optional().describe("Peso em kg (ex: 75)"),
  altura: z.number().optional().describe("Altura em metros (ex: 1.75)"),
  pas: z.number().optional().describe("Pressão Arterial Sistólica (ex: 120)"),
  pad: z.number().optional().describe("Pressão Arterial Diastólica (ex: 80)"),
  glicemia_jejum: z.number().optional().describe("Glicemia de jejum em mg/dL"),
  hba1c: z.number().optional().describe("Hemoglobina Glicada em %"),
  katz_score: z.number().optional().describe("Escore do Índice de Katz (0 a 6) para idosos"),
  das28_score: z
    .number()
    .optional()
    .describe("Escore DAS28 para atividade de doença reumatológica"),
  phq9: z
    .array(z.number())
    .optional()
    .describe("Array com 9 inteiros (0 a 3) referentes às respostas do PHQ-9"),
  gad7: z
    .array(z.number())
    .optional()
    .describe("Array com 7 inteiros (0 a 3) referentes às respostas do GAD-7"),
  idade_gestacional_semanas: z.number().optional().describe("Idade gestacional atual em semanas"),
  fatores_risco_gestacional: z
    .array(z.string())
    .optional()
    .describe("Lista de fatores de risco na gestação (ex: Trombofilia, HAS)"),
  mrs_escore: z.number().optional().describe("Escore MRS (Menopause Rating Scale) de 0 a 44"),
  asa_score: z.number().optional().describe("Classificação ASA de Risco Cirúrgico (1 a 4)"),
  exposicao_72h: z
    .boolean()
    .optional()
    .describe("Se houve exposição de risco ao HIV nas últimas 72h"),
  risco_continuo: z.boolean().optional().describe("Se há risco contínuo ou frequente para HIV"),
  epds_score: z.number().optional().describe("Escore da Escala de Edimburgo (Depressão Pós-Parto)"),
  percentil_peso: z.number().optional().describe("Percentil de peso pediátrico"),
  linhas_ativadas: z
    .array(z.string())
    .describe(
      "Lista de strings das linhas que a IA quer avaliar. Valores aceitos: saude_mental, diabetes, hipertensao, climaterio, cirurgia, prep_pep, obesidade, neoplasias, idoso, gestacao_risco, gestacao, puerperio, puericultura, reumatologia."
    ),
});

export const evaluateClinicalLinesTool = ai.defineTool(
  {
    name: "evaluateClinicalLines",
    description:
      "Avalia dados clínicos de um paciente e retorna condutas e escores exatos baseados em diretrizes médicas oficiais da Nextcon. Sempre use esta ferramenta antes de sugerir condutas médicas para hipertensão, diabetes, gravidez, idosos, psiquiatria, obesidade ou oncologia.",
    inputSchema: PatientDataSchema,
    outputSchema: z.any(),
  },
  async (patientData) => {
    try {
      const resultados = clinicalEngine.avaliarPaciente(patientData);

      return {
        paciente: { nome: patientData.nome, idade: patientData.idade, sexo: patientData.sexo },
        resultados_avaliacao: resultados,
        aviso_ia:
          "Por favor, exiba estas condutas EXATAMENTE como retornadas pelo motor. Não modifique a conduta clínica.",
      };
    } catch (error: any) {
      console.error("[evaluateClinicalLinesTool] Erro:", error);
      return { error: error.message };
    }
  }
);
