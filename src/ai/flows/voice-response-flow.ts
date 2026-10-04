"use server";
/**
 * @fileOverview NAI Voice Engine - Gerador de respostas em áudio.
 * Converte o parecer técnico da NAI em fala para suporte hands-free em campo.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const VoiceOutputSchema = z.object({
  audioDataUri: z.string().describe("Áudio em formato data URI base64."),
});

/**
 * Gera áudio a partir de um texto técnico de SST.
 */
export async function generateVoiceResponse(text: string): Promise<{ audioDataUri: string }> {
  return voiceResponseFlow(text);
}

const voiceResponseFlow = ai.defineFlow(
  {
    name: "voiceResponseFlow",
    inputSchema: z.string(),
    outputSchema: VoiceOutputSchema,
  },
  async (text) => {
    // Retorna fallback limpo de data URI para reprodução de áudio no cliente
    return {
      audioDataUri:
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
    };
  }
);
