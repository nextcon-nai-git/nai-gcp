"use server";
import { requireAiAction, FINANCIAL_AI_ROLES } from "@/lib/auth/ai-action";
/**
 * @fileOverview NAI Contract Intelligence - Analisador Forense de Contratos SST.
 * Extrai dados do cliente, direitos/deveres e gera tarefas operacionais.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const ContractAnalysisInputSchema = z.object({
  pdfDataUri: z.string().describe("O arquivo do contrato em formato PDF codificado em Base64."),
  fileName: z.string().optional(),
});

const ContractAnalysisOutputSchema = z.object({
  summary: z
    .string()
    .describe("Resumo executivo do contrato destacando obrigações, prazos e pontos críticos."),
  clientInfo: z.object({
    name: z.string().describe("Razão Social identificada."),
    cnpj: z.string().describe("CNPJ limpo."),
    segment: z.string().describe("Setor de atuação."),
    riskDegree: z.number().describe("Grau de Risco (1-4)."),
    address: z.string().describe("Endereço da sede."),
  }),
  clauses: z.object({
    rights: z.array(z.string()).describe("Lista de direitos do contratante."),
    duties: z.array(z.string()).describe("Lista de obrigações da Nextcon (Contratada)."),
  }),
  operationalTasks: z
    .array(
      z.object({
        title: z.string().describe("Título curto para o card no Kanban."),
        description: z.string().describe("Detalhamento da obrigação contratual."),
        category: z.enum(["pgr", "pcmso", "treinamento", "faturamento", "vistoria"]),
        frequency: z.enum(["fixo", "mensal", "anual", "sob_demanda"]),
        checklist: z.array(z.string()).describe("Itens de verificação para esta tarefa."),
      })
    )
    .describe("Principais tarefas operacionais extraídas dos deveres contratuais."),
});

export type ContractAnalysisOutput = z.infer<typeof ContractAnalysisOutputSchema>;

export async function analyzeContract(input: { pdfDataUri: string }, idToken?: string) {
  await requireAiAction(idToken, FINANCIAL_AI_ROLES, [input]);

  const { output } = await contractPrompt(input);
  if (!output) throw new Error("A NAI falhou ao analisar as cláusulas do contrato.");
  return output;
}

const contractPrompt = ai.definePrompt({
  name: "contractAnalysisPrompt",
  input: { schema: ContractAnalysisInputSchema },
  output: { schema: ContractAnalysisOutputSchema },
  config: {
    temperature: 0.2,
  },
  prompt: `Você é a NAI, advogada especialista em SST e SGI da Nextcon.
Sua missão é ler este contrato e estruturar a operação técnica para garantir conformidade plena.

INSTRUÇÕES:
1. Resuma o contrato em 'summary' focando em vigência e penalidades.
2. Identifique os dados do cliente (CNPJ, Nome, Endereço).
3. Identifique o Grau de Risco com base no segmento ou CNAE citado.
4. Extraia os deveres técnicos da Nextcon. Transforme os deveres mais relevantes (máximo 15) em 'operationalTasks'.
5. Crie checklists práticos para cada tarefa baseada na cláusula lida.

IMPORTANTE: O retorno deve ser um JSON completo e válido, respeitando rigorosamente o esquema de saída.

Contrato: {{media url=pdfDataUri contentType="application/pdf"}}`,
});

ai.defineFlow(
  {
    name: "contractAnalysisFlow",
    inputSchema: ContractAnalysisInputSchema,
    outputSchema: ContractAnalysisOutputSchema,
  },
  async (input) => {
    return analyzeContract(input);
  }
);
