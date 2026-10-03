"use server";
/**
 * @fileOverview NAI Medical Intelligence - Recomendador de Exames Ocupacionais.
 *
 * - suggestExams - Função que analisa riscos e cargo para sugerir exames (NR-07).
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const SuggestExamsInputSchema = z.object({
  jobTitle: z.string().describe("Cargo ou função do colaborador."),
  companyRisks: z.array(z.string()).describe("Lista de riscos identificados no PGR."),
  age: z.number().describe("Idade do colaborador."),
});
export type SuggestExamsInput = z.infer<typeof SuggestExamsInputSchema>;

const SuggestExamsOutputSchema = z.object({
  recommendedExams: z.array(
    z.object({
      examName: z.string().describe("Nome do exame (ex: Audiometria, Espirometria)."),
      reason: z.string().describe("Justificativa técnica baseada na NR-07 ou riscos."),
    })
  ),
});
export type SuggestExamsOutput = z.infer<typeof SuggestExamsOutputSchema>;

/**
 * Wrapper para chamar o fluxo de sugestão de exames.
 */
export async function suggestExams(input: SuggestExamsInput): Promise<SuggestExamsOutput> {
  return suggestExamsFlow(input);
}

/**
 * Definição do fluxo Genkit para inteligência médica ocupacional.
 */
const suggestExamsFlow = ai.defineFlow(
  {
    name: "suggestExamsFlow",
    inputSchema: SuggestExamsInputSchema,
    outputSchema: SuggestExamsOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Você é um Médico do Trabalho sênior da Nextcon, especialista em PCMSO (NR-07).
      Sua missão é analisar os dados do colaborador e recomendar o protocolo de exames ocupacionais.

      DADOS:
      - Cargo: {{{jobTitle}}}
      - Idade: {{{age}}} anos
      - Riscos Ambientais (PGR): {{#each companyRisks}}- {{this}} {{/each}}

      REGRAS DE RECOMENDAÇÃO:
      1. Se houver Ruído, recomende Audiometria.
      2. Se houver Poeiras/Fumos, recomende Espirometria e RX de Tórax (OIT).
      3. Se houver Trabalho em Altura (NR-35) ou Espaço Confinado (NR-33), recomende ECG, EEG e Glicemia.
      4. Considere exames de rotina (Hemograma, Urina) se o cargo for operacional pesado.
      5. Cite a norma ou o perigo na justificativa.
      
      Retorne a lista no formato estruturado solicitado.`,
      output: { schema: SuggestExamsOutputSchema },
    });

    if (!output) throw new Error("A NAI não conseguiu processar a sugestão de exames.");
    return output;
  }
);
