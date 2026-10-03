"use server";
/**
 * @fileOverview Fluxo de demonstração simples da NAI.
 *
 * - sayHello: Função que gera uma saudação personalizada via IA.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const HelloInputSchema = z.string().describe("O nome do usuário para a saudação.");
export type HelloInput = z.infer<typeof HelloInputSchema>;

const HelloOutputSchema = z.string().describe("A saudação gerada pela IA.");
export type HelloOutput = z.infer<typeof HelloOutputSchema>;

/**
 * Função wrapper para chamar o fluxo de saudação.
 */
export async function sayHello(name: HelloInput): Promise<HelloOutput> {
  return helloFlow(name);
}

/**
 * Definição do fluxo Genkit para saudação.
 */
const helloFlow = ai.defineFlow(
  {
    name: "helloFlow",
    inputSchema: HelloInputSchema,
    outputSchema: HelloOutputSchema,
  },
  async (name) => {
    const { text } = await ai.generate(
      `Olá Gemini, meu nome é ${name}. Responda com uma saudação amigável em português, mencionando que você é a NAI da Nextcon.`
    );
    return text;
  }
);
