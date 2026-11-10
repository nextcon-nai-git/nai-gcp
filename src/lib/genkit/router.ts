import { genkit } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";
import { openAI } from "@genkit-ai/compat-oai/openai";
import { anthropic } from "@genkit-ai/anthropic";
import type { AIProvider } from "./providers";

export const MODEL_MAP: Record<AIProvider, string> = {
  gemini: "vertexai/gemini-4-argon",
  gpt: "openai/gpt-4o",
  claude: "anthropic/claude-sonnet-5-5",
};

export function configured(provider: AIProvider) {
  return (
    provider === "gemini" ||
    Boolean(provider === "gpt" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY)
  );
}

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId:
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      location: process.env.NAI_VERTEX_LOCATION || "us",
    }),
    ...(configured("gpt") ? [openAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 })] : []),
    ...(configured("claude") ? [anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })] : []),
  ],
  model: MODEL_MAP.gemini,
});

export { AIProviderSchema, FALLBACK_CHAINS, type AIProvider } from "./providers";
