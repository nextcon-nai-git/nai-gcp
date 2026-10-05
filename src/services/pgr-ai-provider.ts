import "server-only";
import { genkit } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";
import { ai } from "@/ai/genkit";
import { firebaseConfig } from "@/firebase/config";

let vertexRuntime: ReturnType<typeof genkit> | undefined;
// App Hosting uses its runtime service account (ADC), never a downloaded key.
export function getPgrAi() {
  if (process.env.PGR_AI_PROVIDER === "disabled") return null;
  if (process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    return ai;
  if (process.env.PGR_AI_PROVIDER !== "vertex" && !process.env.K_SERVICE) return null;
  vertexRuntime ??= genkit({
    plugins: [
      vertexAI({
        projectId: process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId,
        location: "global",
      }),
    ],
    model: vertexAI.model(process.env.GEMINI_MODEL || "gemini-3.8-flash"),
  });
  return vertexRuntime;
}
