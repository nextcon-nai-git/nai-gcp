import { applicationDefault } from "firebase-admin/app";
import type { Genkit } from "genkit";
import { firebaseConfig } from "../../firebase/config";

export const VERTEX_MODEL = "gemini-4-argon";
export function vertexContentUrl(projectId: string, location: string) {
  if (!projectId || !["us", "eu", "global"].includes(location))
    throw new Error("Configuração Vertex indisponível.");
  const host =
    location === "global"
      ? "aiplatform.googleapis.com"
      : `aiplatform.${location}.rep.googleapis.com`;
  return `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${location}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
}

export function registerAuditVertex(ai: Genkit) {
  // This router sends one prompt containing only the closed set of S-2220 recommendation codes.
  return ai.defineModel(
    {
      apiVersion: "v2",
      name: "vertexai/" + VERTEX_MODEL,
      supports: { constrained: "all", output: ["json"] },
    },
    async (request, { abortSignal }) => {
      const projectId =
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT_ID ||
        firebaseConfig.projectId;
      const url = vertexContentUrl(projectId, process.env.NAI_VERTEX_LOCATION || "us");
      const { access_token } = await applicationDefault().getAccessToken();
      const schema = { ...request.output?.schema };
      delete schema.$schema;
      const reply = await fetch(url, {
        method: "POST",
        signal: abortSignal,
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: request.messages.map((message) => ({
            role: message.role,
            parts: message.content.map((part) => ({ text: part.text })),
          })),
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            thinkingConfig: { thinkingLevel: "LOW" },
            maxOutputTokens: 1024,
          },
        }),
      });
      if (!reply.ok)
        throw Object.assign(new Error("Falha na chamada ao Vertex."), { status: reply.status });
      const data = (await reply.json()) as {
        promptFeedback?: { blockReason?: string };
        candidates?: {
          finishReason?: string;
          content?: { parts?: { text?: string; thought?: boolean }[] };
        }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const candidate = data.candidates?.[0];
      if (
        data.promptFeedback?.blockReason ||
        [
          "SAFETY",
          "RECITATION",
          "BLOCKLIST",
          "PROHIBITED_CONTENT",
          "SPII",
          "IMAGE_SAFETY",
          "MODEL_ARMOR",
        ].includes(candidate?.finishReason || "")
      )
        throw Object.assign(new Error("Geração bloqueada."), { name: "GenerationBlockedError" });
      const text = candidate?.content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text || "")
        .join("");
      if (candidate?.finishReason !== "STOP" || !text)
        throw Object.assign(new Error("Resposta incompleta."), { name: "OutputInvalid" });
      return {
        message: { role: "model", content: [{ text }] },
        finishReason: "stop",
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        },
      };
    }
  );
}
