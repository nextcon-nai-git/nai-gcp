"use server";
import { requireAiAction, FINANCIAL_AI_ROLES } from "@/lib/auth/ai-action";
/**
 * @fileOverview Agente "nai" - Comercial Nextcon de Elite.
 * Responsável por elaborar propostas comerciais de SST com foco em ROI,
 * conformidade legal (NR-01/07) e viabilidade financeira.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const DadosEmpresaInputSchema = z.object({
  nomeEmpresa: z.string(),
  nomeSolicitante: z.string().describe("Nome da pessoa que está pedindo o orçamento"),
  setor: z.string().describe("Setor de atuação (ex: Construção, Indústria, Varejo)"),
  cidade: z.string(),
  estado: z.string(),
  email: z.string().email(),
  telefone: z.string(),
  quantidadeFuncionarios: z.number().describe("Número total de funcionários"),
  grauDeRisco: z.number().min(1).max(4).describe("Grau de Risco da empresa (1 a 4)"),
  servicosDesejados: z
    .string()
    .optional()
    .describe("Lista de serviços extras como LTCAT, ASOs, Treinamentos"),
  necessidades: z.string().describe("Contexto ou dor do cliente"),
});
export type DadosEmpresaInput = z.infer<typeof DadosEmpresaInputSchema>;

const OrcamentoOutputSchema = z.object({
  propostaExecutiva: z.object({
    apresentacao: z.string().describe("Saudação comercial e contextualização técnica."),
    justificativaNormativa: z.string().describe("Menção aos itens da NR-01 (GRO) e NR-07 (PCMSO)."),
    analiseImpactoFinanceiro: z
      .string()
      .describe("Impacto da não conformidade com decretos de penalidades."),
  }),
  roiEstimado: z.object({
    valorEconomiaAnual: z
      .number()
      .describe("Estimativa de redução de passivo trabalhista e multas."),
    descricaoBeneficio: z
      .string()
      .describe("Explicação de como o ASO Digital e Gestão Ativa geram ganho."),
  }),
  cronograma: z
    .array(
      z.object({
        fase: z.string().describe("Etapa (ex: Diagnóstico, Implantação GRO, Treinamentos)"),
        prazo: z.string(),
        atactivities: z.array(z.string()).describe("Lista de atividades técnicas desta fase"),
      })
    )
    .describe("Etapas de implementação segmentadas"),
  pacotes: z
    .array(
      z.object({
        nome: z.string().describe("Ex: Essencial, Intermediário, Elite"),
        servicosInclusos: z.array(z.string()),
        valorImplementacao: z.number(),
        valorMensal: z.number().optional(),
        destaque: z.string().describe("Vantagem deste pacote"),
      })
    )
    .describe("3 opções de pacotes com descontos progressivos"),
  dicaEstrategica: z.string().describe("Insight Nextcon para fechamento do contrato."),
});
export type OrcamentoOutput = z.infer<typeof OrcamentoOutputSchema>;

const quotePrompt = ai.definePrompt({
  name: "nai_Commercial_Elite_Prompt",
  input: { schema: DadosEmpresaInputSchema },
  output: { schema: OrcamentoOutputSchema },
  prompt: `Você é o braço Comercial de Elite da Nextcon. Sua missão é elaborar uma proposta comercial detalhada e persuasiva conforme as diretrizes 2026.

DIRETRIZES DA PROPOSTA:
1. FOCO EM ROI: Demonstre que investir em SST é economia, não custo. Estime a redução de passivos com base na folha para {{{quantidadeFuncionarios}}} funcionários.
2. CONFORMIDADE LEGAL: Cite especificamente itens da NR-01 (sobre GRO/PGR) e NR-07 (abrangência do PCMSO). Mencione o Decreto de multas.
3. SEGMENTAÇÃO: Divida a entrega em fases (Diagnóstico, Implementação GRO/PGR, PCMSO, Treinamentos).
4. PACOTES: Ofereça 3 opções (Essencial, Intermediário e Elite) com descontos progressivos por volume.
5. PENALIDADES: Avalie o impacto financeiro da não conformidade conforme decretos de multas de SST.
6. ASO DIGITAL: Destaque os benefícios da integração total e agilidade jurídica conforme legislação 2026.

DADOS DO PROSPECT:
- Empresa: {{{nomeEmpresa}}}
- Setor: {{{setor}}}
- Vidas: {{{quantidadeFuncionarios}}}
- Risco: {{{grauDeRisco}}}
- Serviços Específicos: {{{servicosDesejados}}}
- Contexto: {{{necessidades}}}

ESTRUTURA DE PREÇOS BASE (USE COMO REFERÊNCIA):
- PGR: R$ 850 a R$ 2.500 (depende do risco)
- PCMSO: R$ 650 a R$ 1.500
- Gestão Mensal: R$ 15 a R$ 45 por vida.`,
});

export async function generateNaiQuote(
  input: DadosEmpresaInput,
  idToken?: string
): Promise<OrcamentoOutput> {
  await requireAiAction(idToken, FINANCIAL_AI_ROLES, [input]);

  const { output } = await quotePrompt(input);
  if (!output) throw new Error("O motor comercial NAI falhou ao estruturar a proposta de elite.");
  return output;
}

ai.defineFlow(
  {
    name: "nai_Commercial_Elite_Flow",
    inputSchema: DadosEmpresaInputSchema,
    outputSchema: OrcamentoOutputSchema,
  },
  async (input) => {
    return generateNaiQuote(input);
  }
);
