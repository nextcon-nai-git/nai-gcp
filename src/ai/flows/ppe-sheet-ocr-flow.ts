"use server";
/**
 * @fileOverview Fluxo NAI para leitura e extração estruturada de Fichas de EPI e C.A. (Certificado de Aprovação).
 * Utiliza o modelo Gemini para identificar colaborador, EPIs fornecidos, números de C.A., datas e conformidade NR-06.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const PpeItemSchema = z.object({
  epiNome: z
    .string()
    .describe(
      "Nome/Descrição do equipamento de proteção individual em CAIXA ALTA (Ex: CAPACETE ABA FRONTAL CLASSE B)."
    ),
  numeroCA: z
    .string()
    .describe("Número do Certificado de Aprovação (C.A.) do EPI emitido pelo MTE/MTP."),
  fabricanteMarca: z.string().optional().describe("Marca ou fabricante do EPI."),
  dataEntrega: z.string().describe("Data de entrega ao colaborador no formato ISO (YYYY-MM-DD)."),
  quantidade: z.number().default(1).describe("Quantidade entregue."),
  assinado: z
    .boolean()
    .default(true)
    .describe("Indica se há rubrica ou assinatura na linha correspondente."),
});

const ExtractPpeSheetInputSchema = z
  .string()
  .describe("O texto da Ficha de EPI (extraído via OCR ou cópia de documento).");

const ExtractPpeSheetOutputSchema = z.object({
  nomeColaborador: z.string().describe("Nome completo do colaborador em CAIXA ALTA."),
  cpfMatricula: z.string().optional().describe("CPF ou Matrícula do colaborador se disponível."),
  setorFuncao: z.string().optional().describe("Setor ou Função do colaborador."),
  dataFicha: z
    .string()
    .optional()
    .describe("Data geral de abertura ou atualização da ficha (YYYY-MM-DD)."),
  itens: z.array(PpeItemSchema).describe("Lista de EPIs registrados na ficha."),
  parecerCompliance: z
    .string()
    .describe("Resumo da conformidade com a NR-06 e recomendação para o eSocial S-2240."),
});

export type ExtractPpeSheetOutput = z.infer<typeof ExtractPpeSheetOutputSchema>;
export type PpeItem = z.infer<typeof PpeItemSchema>;

/**
 * Função pública para invocar o fluxo de leitura inteligente de Fichas de EPI.
 */
export async function extractPpeSheetData(rawText: string): Promise<ExtractPpeSheetOutput> {
  return extractPpeSheetFlow(rawText);
}

/**
 * Definição do fluxo Genkit para OCR e estruturação de Ficha de EPI.
 */
const extractPpeSheetFlow = ai.defineFlow(
  {
    name: "extractPpeSheetFlow",
    inputSchema: ExtractPpeSheetInputSchema,
    outputSchema: ExtractPpeSheetOutputSchema,
  },
  async (rawText) => {
    const { output } = await ai.generate({
      prompt: `Você é a NAI, a Inteligência Artificial especialista em Engenharia de Segurança do Trabalho e Medicina Ocupacional da NextCon.
      Sua missão é analisar o texto digitado ou extraído de uma Ficha de EPI (Equipamento de Proteção Individual) e estruturar os dados conforme a norma NR-06 e os requisitos do eSocial S-2240.

      TEXTO DA FICHA DE EPI:
      """
      ${rawText}
      """

      INSTRUÇÕES E REGRAS DE EXTRAÇÃO:
      1. Extraia o Nome do Colaborador e formate-o em CAIXA ALTA.
      2. Mapeie cada linha/item de EPI entregue:
         - Identifique a Descrição do EPI.
         - Localize o Número do C.A. (Certificado de Aprovação) exato (apenas dígitos numéricos ou texto do CA).
         - Identifique a data de entrega (formato YYYY-MM-DD). Se não especificada, use a data atual.
         - Verifique se há indicação de assinatura do colaborador.
      3. Forneça um parecer sintético de compliance focando no cumprimento da NR-06 e na rastreabilidade jurídica do fornecimento.
      4. Responda rigorosamente no formato do schema fornecido.`,
      output: { schema: ExtractPpeSheetOutputSchema },
    });

    if (!output) {
      throw new Error(
        "A NAI não conseguiu interpretar a Ficha de EPI fornecida. Verifique a clareza do texto."
      );
    }

    return output;
  }
);
