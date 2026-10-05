import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import { initializeFirebaseTelemetry, shouldEnableFirebaseTelemetry } from "./telemetry";

/**
 * @fileOverview Configuração central do motor Genkit 1.x para a Nextcon.
 * Ativa plugins de IA e telemetria do Firebase para monitoramento de fluxos.
 */

// Habilita o rastreamento e telemetria via Firebase (Genkit 1.x)
if (shouldEnableFirebaseTelemetry(process.env)) {
  void initializeFirebaseTelemetry(() => enableFirebaseTelemetry());
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey:
        process.env.GOOGLE_GENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY,
    }),
  ],
  model: `googleai/${process.env.GEMINI_MODEL || "gemini-3.8-flash"}`,
});
