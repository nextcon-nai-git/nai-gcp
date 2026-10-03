"use server";
/**
 * @fileOverview Classificador Inteligente de Documentos SST da NextCon.
 * Identifica o tipo de laudo baseado no conteúdo textual do PDF.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ClassifierInputSchema = z.object({
  pdfDataUri: z.string().describe("O arquivo em formato PDF codificado em Base64."),
  fileName: z.string().optional(),
});
export type ClassifierInput = z.infer<typeof ClassifierInputSchema>;

const ClassifierOutputSchema = z.object({
  docType: z
    .enum([
      "pgr",
      "pcmso",
      "ltcat",
      "nr15",
      "nr16",
      "ergonomia",
      "nr10",
      "nr12",
      "os",
      "epi",
      "apr",
      "pca",
      "ppr",
    ])
    .describe("O tipo técnico identificado do documento."),
  confidence: z.number().describe("Nível de confiança da classificação (0-100)."),
  reasoning: z.string().describe("Breve explicação do porquê desta classificação."),
});
export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

export async function classifyDocument(input: ClassifierInput): Promise<ClassifierOutput> {
  return classifyFlow(input);
}

const prompt = ai.definePrompt({
  name: "documentClassifierPrompt",
  input: { schema: ClassifierInputSchema },
  output: { schema: ClassifierOutputSchema },
  prompt: `Você é o triador inteligente da NextCon Saúde Empresarial.
Analise o documento PDF em anexo e o nome do arquivo para determinar em qual categoria técnica de SST ele se enquadra.

CATEGORIAS POSSÍVEIS:
- pgr: Programa de Gerenciamento de Riscos (NR-01).
- pcmso: Programa de Controle Médico de Saúde Ocupacional (NR-07).
- ltcat: Laudo Técnico das Condições Ambientais de Trabalho (Previdenciário).
- nr15: Laudo de Insalubridade.
- nr16: Laudo de Periculosidade.
- ergonomia: AEP, AET ou Laudo Ergonômico (NR-17).
- nr10: Prontuário ou Laudo de Elétrica.
- nr12: Laudo de Segurança em Máquinas.
- os: Ordem de Serviço de Segurança.
- epi: Ficha de Entrega de EPI.
- apr: Análise Preliminar de Risco ou Checklist Diário.
- pca: Programa de Conservação Auditiva.
- ppr: Programa de Proteção Respiratória.

NOME DO ARQUIVO: {{{fileName}}}
CONTEÚDO DO DOCUMENTO: {{media url=pdfDataUri contentType="application/pdf"}}`,
});

const classifyFlow = ai.defineFlow(
  {
    name: "documentClassifierFlow",
    inputSchema: ClassifierInputSchema,
    outputSchema: ClassifierOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu identificar este tipo de documento.");
    return output;
  }
);
