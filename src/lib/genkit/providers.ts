import { z } from "zod/v3";

export const AIProviderSchema = z.enum(["gemini", "gpt", "claude"]).default("gemini");
export type AIProvider = z.infer<typeof AIProviderSchema>;
export const FALLBACK_CHAINS: Record<AIProvider, readonly AIProvider[]> = {
  gemini: ["gemini", "gpt", "claude"],
  gpt: ["gpt", "claude", "gemini"],
  claude: ["claude", "gpt", "gemini"],
};
