"use server";
/**
 * @fileOverview Fluxo de enriquecimento de dados de prestadores (Simulação de Cloud Function).
 *
 * - enrichProviderData - Função que busca dados via IA para preencher lacunas de cadastro.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ProviderEnrichInputSchema = z.object({
  name: z.string().describe("Nome da empresa/clínica."),
  city: z.string().describe("Cidade de atuação."),
});
export type ProviderEnrichInput = z.infer<typeof ProviderEnrichInputSchema>;

const ProviderEnrichOutputSchema = z.object({
  formatted_address: z.string().optional().describe("Endereço completo formatado."),
  international_phone_number: z.string().optional().describe("Telefone em formato internacional."),
  website: z.string().optional().describe("URL do site oficial."),
  dataEnriched: z.boolean().describe("Flag indicando que os dados foram enriquecidos por IA."),
  confidence: z.number().describe("Nível de confiança da busca (0-100)."),
});
export type ProviderEnrichOutput = z.infer<typeof ProviderEnrichOutputSchema>;

export async function enrichProviderData(
  input: ProviderEnrichInput
): Promise<ProviderEnrichOutput> {
  return enrichProviderFlow(input);
}

const prompt = ai.definePrompt({
  name: "enrichProviderPrompt",
  input: { schema: ProviderEnrichInputSchema },
  output: { schema: ProviderEnrichOutputSchema },
  prompt: `Você é a inteligência NAI da NEXTCON. Sua missão é localizar os dados corporativos oficiais da clínica "{{{name}}}" localizada em {{{city}}}.
    
    INSTRUÇÕES:
    1. Localize o endereço oficial atualizado (formatted_address).
    2. Localize o telefone de contato principal, preferencialmente no formato (XX) XXXX-XXXX (international_phone_number).
    3. Localize o site institucional oficial (website).
    4. Se você encontrar informações com clareza, defina 'dataEnriched' como true.
    5. Atribua um score de 'confidence' baseado na precisão da busca.
    6. Se não tiver certeza absoluta, retorne o campo vazio em vez de inventar.`,
});

const enrichProviderFlow = ai.defineFlow(
  {
    name: "enrichProviderFlow",
    inputSchema: ProviderEnrichInputSchema,
    outputSchema: ProviderEnrichOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
