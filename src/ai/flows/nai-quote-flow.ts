"use server";
/**
 * @fileOverview Agente "nai" - Comercial Nextcon.
 * Responsável por elaborar propostas comerciais e garantir a compreensão do cliente.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const DadosEmpresaInputSchema = z.object({
  nomeEmpresa: z.string(),
  nomeSolicitante: z.string().describe("Nome da pessoa que está pedindo o orçamento"),
  cidade: z.string(),
  estado: z.string(),
  email: z.string().email(),
  telefone: z.string(),
  quantidadeFuncionarios: z.number().describe("Número total de funcionários"),
  grauDeRisco: z.number().min(1).max(4).describe("Grau de Risco da empresa (1 a 4)"),
  necessidades: z.string().describe("O que o cliente pediu"),
});
export type DadosEmpresaInput = z.infer<typeof DadosEmpresaInputSchema>;

const OrcamentoOutputSchema = z.object({
  mensagemIntrodutoria: z.string().describe("Saudação comercial"),
  servicosRecomendados: z.array(
    z.object({
      categoria: z.string(),
      nomeServico: z.string(),
      justificativaLegal: z.string(),
      valorEstimado: z.number(),
    })
  ),
  valorTotalAvulso: z.number(),
  valorTotalMensal: z.number().optional(),
  instrucoesConfirmacao: z
    .string()
    .describe("Texto solicitando assinatura e confirmação de leitura."),
  dicaDaNai: z.string(),
});
export type OrcamentoOutput = z.infer<typeof OrcamentoOutputSchema>;

const quotePrompt = ai.definePrompt({
  name: "nai_Commercial_Prompt",
  input: { schema: DadosEmpresaInputSchema },
  output: { schema: OrcamentoOutputSchema },
  prompt: `Você é o agente "nai", responsável pelo braço Comercial da Nextcon.
Sua tarefa é elaborar e enviar propostas comerciais de SST altamente estratégicas.

INSTRUÇÕES DO AGENTE:
1. Elabore a proposta baseada nas necessidades: "{{{necessidades}}}".
2. Utilize precificação baseada em R$ 850 para PGR e R$ 650 para PCMSO como valores base.
3. Ao finalizar a elaboração, você DEVE obrigatoriamente solicitar ao cliente a ASSINATURA e a CONFIRMAÇÃO DE LEITURA E COMPREENSÃO da proposta no campo 'instrucoesConfirmacao'.
4. Utilize tom vendedor, porém consultivo.

DADOS DO CLIENTE:
- Empresa: {{{nomeEmpresa}}}
- Solicitante: {{{nomeSolicitante}}}
- Vidas: {{{quantidadeFuncionarios}}}
- Risco: {{{grauDeRisco}}}`,
});

export async function generateNaiQuote(input: DadosEmpresaInput): Promise<OrcamentoOutput> {
  const { output } = await quotePrompt(input);
  if (!output) throw new Error('O agente comercial "nai" falhou ao gerar a proposta.');
  return output;
}

ai.defineFlow(
  {
    name: "nai_Commercial_Flow",
    inputSchema: DadosEmpresaInputSchema,
    outputSchema: OrcamentoOutputSchema,
  },
  async (input) => {
    return generateNaiQuote(input);
  }
);
