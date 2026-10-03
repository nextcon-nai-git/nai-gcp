"use server";
/**
 * @fileOverview Gera rascunhos de contestação de NTEP (Nexo Técnico Epidemiológico Previdenciário) usando IA.
 *
 * - generateNtepContestation - Função que gera o rascunho jurídico.
 * - NtepContestationInput - Entrada: CNAE, CID e descrição do cargo.
 * - NtepContestationOutput - Saída: Texto da contestação fundamentada.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const NtepContestationInputSchema = z.object({
  cnae: z.string().describe("CNAE da empresa cliente."),
  cid: z.string().describe("Código CID-10 do afastamento."),
  jobRole: z.string().describe("Cargo ou função do colaborador."),
  workEnvironment: z.string().describe("Descrição do ambiente de trabalho."),
});
export type NtepContestationInput = z.infer<typeof NtepContestationInputSchema>;

const NtepContestationOutputSchema = z.object({
  contestationDraft: z.string().describe("Rascunho da contestação jurídica fundamentada."),
  legalBasis: z.array(z.string()).describe("Lista de NRs ou decretos citados."),
});
export type NtepContestationOutput = z.infer<typeof NtepContestationOutputSchema>;

export async function generateNtepContestation(
  input: NtepContestationInput
): Promise<NtepContestationOutput> {
  return ntepContestationFlow(input);
}

const prompt = ai.definePrompt({
  name: "ntepContestationPrompt",
  input: { schema: NtepContestationInputSchema },
  output: { schema: NtepContestationOutputSchema },
  prompt: `Você é um advogado especialista em Direito Previdenciário e Segurança do Trabalho. 
Sua tarefa é gerar uma contestação formal contra a caracterização de Nexo Técnico Epidemiológico (NTEP).

DADOS:
- CNAE da Empresa: {{{cnae}}}
- CID-10 do Afastamento: {{{cid}}}
- Cargo: {{{jobRole}}}
- Ambiente: {{{workEnvironment}}}

INSTRUÇÕES:
1. Questione o nexo automático baseado na inexistência de riscos específicos no ambiente de trabalho citado.
2. Cite o Decreto 3.048/99 e as NRs pertinentes (como NR-01 e NR-07).
3. O tom deve ser formal, técnico e jurídico.
4. Foque na ausência de nexo causal direto entre a patologia e as atividades exercidas.`,
});

const ntepContestationFlow = ai.defineFlow(
  {
    name: "ntepContestationFlow",
    inputSchema: NtepContestationInputSchema,
    outputSchema: NtepContestationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
