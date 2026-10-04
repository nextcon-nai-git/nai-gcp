"use server";

/**
 * @fileOverview NAI Master PGR & LTCAT Analyzer - Versão 3.0 SGI Core.
 * Realiza a auditoria técnica de PGR, LTCAT e Laudos SST, sugerindo ações
 * preventivas, corretivas, não conformidades, melhorias e gerando o Card Mestre do PGR com Mapa.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const ActionItemSchema = z.object({
  tipoAcao: z
    .enum(["Preventiva", "Corretiva", "Não Conformidade", "Melhoria Contínua", "Treinamento NR"])
    .describe("Classificação da ação de segurança."),
  titulo: z.string().describe("Título direto da ação para o Kanban de Segurança."),
  descricaoDetalhada: z
    .string()
    .describe("Detalhamento técnico da não conformidade ou ação preventiva."),
  prioridade: z.enum(["high", "critical", "medium", "low"]).default("high"),
  colunaKanban: z.enum(["todo", "doing", "review"]).default("todo"),
  referenciaLegal: z
    .string()
    .describe("Item normativo de referência (ex: NR-01.5.4, NR-35.3, NR-12.2).")
    .default("NR-01"),
  responsavelSugerido: z
    .string()
    .describe("Engenheiro de Segurança, Técnico SST, Manutenção ou RH.")
    .default("Engenharia de Segurança"),
});

const PgrAnalysisInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe("Arquivo PGR/LTCAT em formato PDF (Base64 ou URL) ou texto bruto."),
  fileName: z.string().optional(),
});

export type PgrAnalysisInput = z.infer<typeof PgrAnalysisInputSchema>;

const PgrAnalysisOutputSchema = z.object({
  pgrCardDetalhado: z.object({
    razaoSocial: z
      .string()
      .describe("Razão Social identificada no documento.")
      .default("Empresa Cliente"),
    cnpj: z.string().describe("CNPJ formatado.").default("00.000.000/0001-00"),
    cnae: z.string().describe("Código CNAE e descrição.").default(""),
    grauDeRisco: z.number().describe("Grau de Risco (1 a 4 conforme NR-04).").default(3),
    enderecoCompleto: z
      .string()
      .describe("Endereço físico completo da unidade/obra.")
      .default("Endereço não especificado"),
    cidadeUf: z
      .string()
      .describe("Cidade e Estado (ex: Joinville - SC, São Paulo - SP).")
      .default(""),
    dataEmissao: z.string().describe("Data de emissão do documento (YYYY-MM-DD).").default(""),
    dataValidade: z
      .string()
      .describe("Data de validade ou renovação do PGR (YYYY-MM-DD).")
      .default(""),
    coordenadasGps: z
      .string()
      .describe("Coordenadas aproximadas para exibição no mapa (Lat, Lng) se inferido.")
      .default("-26.3045, -48.8464"),
    totalRiscosMapeados: z
      .number()
      .describe("Quantidade total de agentes de risco mapeados.")
      .default(0),
    ghesIdentificados: z
      .array(z.string())
      .describe("Lista de GHEs (Grupos Homogêneos de Exposição).")
      .default([]),
    esocialS2240Status: z
      .string()
      .describe("Diagnóstico eSocial S-2240 (Insalubridade / Aposentadoria Especial).")
      .default("Gatilhos S-2240 elegíveis para transmissão."),
  }),
  acoesCategorizadas: z
    .array(ActionItemSchema)
    .describe("Ações preventivas, corretivas, não conformidades e melhorias."),
  actionPlanTriggers: z
    .array(
      z.object({
        origin: z.string().default("PGR NR-01 / LTCAT"),
        category: z.enum(["Engenharia", "Medicina", "Treinamento", "Higiene"]),
        title: z.string().describe("Título da tarefa para o Kanban"),
        reason: z.string().describe("Justificativa técnica da necessidade"),
        column: z.enum(["todo", "doing", "review"]).describe("Coluna sugerida no Kanban"),
        priority: z.enum(["high", "critical", "medium"]),
        legalRef: z.string().describe("Item da NR correspondente"),
      })
    )
    .describe("Ações técnicas para o Centro de Operação Kanban."),
  parecerTecnicoIA: z
    .string()
    .describe("Síntese do Engenheiro de Segurança de IA com parecer de blindagem e ROI."),
});

export type PgrAnalysisOutput = z.infer<typeof PgrAnalysisOutputSchema>;

export async function analyzePgrPdf(input: PgrAnalysisInput): Promise<PgrAnalysisOutput> {
  const isDataUri = input.pdfDataUri.startsWith("data:");

  const promptContent: any = [
    {
      text: `Você é a NAI, Inteligência de Elite de Engenharia de Segurança do Trabalho e Medicina Ocupacional da Nextcon.
      Sua missão é realizar a LEITURA E AUDITORIA TÉCNICA COMPLETA do documento PGR / LTCAT / Laudo de Riscos em anexo.

      INSTRUÇÕES OBRIGATÓRIAS:
      1. Monte o CARD DO PGR DETALHADO (Razão Social, CNPJ, CNAE, Grau de Risco, Endereço Completo, Cidade/UF, Datas de Emissão e Validade, GHEs e Diagnóstico eSocial S-2240).
      2. Extraia e categorize AÇÕES PREVENTIVAS, AÇÕES CORRETIVAS, CORREÇÕES DE NÃO CONFORMIDADES e MELHORIAS CONTÍNUAS.
      3. Crie gatilhos diretos para o Kanban de Segurança (actionPlanTriggers).
      4. Elabore um parecer técnico focado em blindagem jurídica contra multas do MTE e eSocial S-2240.`,
    },
  ];

  if (isDataUri) {
    promptContent.push({
      media: { url: input.pdfDataUri },
    });
  } else {
    promptContent.push({
      text: `CONTEÚDO DO DOCUMENTO PGR/LTCAT:
      """
      ${input.pdfDataUri}
      """`,
    });
  }

  try {
    const aiPromise = ai.generate({
      prompt: promptContent,
      output: { schema: PgrAnalysisOutputSchema },
    });

    const timeoutPromise = new Promise<{ output: null }>((resolve) =>
      setTimeout(() => resolve({ output: null }), 2800)
    );

    const { output } = await Promise.race([aiPromise, timeoutPromise]);

    if (output && output.pgrCardDetalhado && output.pgrCardDetalhado.razaoSocial) {
      return output;
    }
  } catch (err: any) {
    console.warn(
      "⚠️ [NAI PGR Analysis] API restrita ou timeout. Executando motor regulatório heurístico:",
      err?.message || err
    );
  }

  // FALLBACK REGULATÓRIO HEURÍSTICO ROBUSTO (NR-01, NR-09, NR-15, NR-17)
  const { parsePgrWithHeuristics } = await import("./pgr-heuristic-parser");
  return parsePgrWithHeuristics(input.pdfDataUri, input.fileName);
}

ai.defineFlow(
  {
    name: "pgrAnalysisFlow",
    inputSchema: PgrAnalysisInputSchema,
    outputSchema: PgrAnalysisOutputSchema,
  },
  async (input) => {
    return analyzePgrPdf(input);
  }
);
