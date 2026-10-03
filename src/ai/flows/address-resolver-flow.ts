"use server";
/**
 * @fileOverview Fluxo da NAI para encontrar endereços de empresas pelo nome comercial.
 *
 * - resolveCompanyAddress - Busca o endereço provável de uma empresa.
 * - AddressInput - Nome da empresa e cidade opcional.
 * - AddressOutput - Endereço estruturado.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const AddressInputSchema = z.object({
  companyName: z.string().describe("Nome da empresa cliente."),
  city: z.string().optional().describe("Cidade provável da empresa."),
});
export type AddressInput = z.infer<typeof AddressInputSchema>;

const AddressOutputSchema = z.object({
  fullAddress: z.string().describe("Endereço completo sugerido pela IA."),
  confidence: z.number().describe("Nível de confiança da busca de 0 a 100."),
  formattedString: z.string().describe("String formatada para busca no Google Maps."),
});
export type AddressOutput = z.infer<typeof AddressOutputSchema>;

const prompt = ai.definePrompt({
  name: "addressResolverPrompt",
  input: { schema: AddressInputSchema },
  output: { schema: AddressOutputSchema },
  prompt: `Você é a NAI, assistente de inteligência artificial da Nextcon.
Sua tarefa é encontrar o endereço comercial provável da empresa "{{{companyName}}}"{{#if city}} localizada em {{{city}}}{{/if}}.

INSTRUÇÕES:
1. Pesquise em sua base de conhecimento o endereço oficial ou sede desta empresa.
2. Se não encontrar o endereço exato, tente localizar a sede administrativa ou unidade principal.
3. Retorne o endereço completo no campo 'fullAddress'.
4. No campo 'formattedString', retorne uma string otimizada para busca no Google Maps (ex: "Nome da Empresa, Rua, Numero, Cidade, Estado").
5. Defina a confiança da informação.`,
});

export async function resolveCompanyAddress(input: AddressInput): Promise<AddressOutput> {
  const { output } = await prompt(input);
  if (!output) {
    throw new Error("A NAI não conseguiu localizar o endereço desta empresa.");
  }
  return output;
}

ai.defineFlow(
  {
    name: "addressResolverFlow",
    inputSchema: AddressInputSchema,
    outputSchema: AddressOutputSchema,
  },
  async (input) => {
    return resolveCompanyAddress(input);
  }
);
