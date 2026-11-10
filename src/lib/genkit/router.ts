import { genkit } from "genkit";
import { registerAuditVertex, VERTEX_MODEL } from "./vertex-content";
import { openAI } from "@genkit-ai/compat-oai/openai";
import { anthropic } from "@genkit-ai/anthropic";
import type { AIProvider } from "./providers";

export const MODEL_MAP: Record<AIProvider, string> = {
  gemini: "vertexai/" + VERTEX_MODEL,
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
    ...(configured("gpt") ? [openAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 })] : []),
    ...(configured("claude") ? [anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })] : []),
  ],
  model: MODEL_MAP.gemini,
});

registerAuditVertex(ai);

export { AIProviderSchema, FALLBACK_CHAINS, type AIProvider } from "./providers";
