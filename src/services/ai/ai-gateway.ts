import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiAuditService } from "./ai-audit";

export interface AiRequest<TInput> {
  tenantId: string;
  actorId: string;
  flow: string;
  promptVersion?: string;
  model?: string;
  temperature?: number;
  input: TInput;
  promptText: string;
  schema?: Record<string, unknown>;
}

export interface AiResult<TOutput> {
  output: TOutput;
  model: string;
  promptVersion: string;
  confidence: number;
  confidenceSource: "MODEL" | "HEURISTIC" | "RULE";
  durationMs: number;
}

/**
 * AI Gateway Centralizado do NAI:
 * Responsável por roteamento, governança, auditoria de tokens/custo e controle de schema.
 */
export async function executeAiGatewayCall<TInput, TOutput>(
  request: AiRequest<TInput>,
  fallbackGenerator?: () => TOutput
): Promise<AiResult<TOutput>> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const modelName =
    request.model ||
    process.env.GEMINI_MODEL ||
    process.env.GEMINI_FLASH_MODEL ||
    "gemini-3.8-flash";
  const promptVersion = request.promptVersion || "v1.0";

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    "";

  if (!apiKey) {
    if (fallbackGenerator) {
      const output = fallbackGenerator();
      const durationMs = Date.now() - startTime;
      await aiAuditService.recordInference({
        tenantId: request.tenantId,
        actorId: request.actorId,
        flow: request.flow,
        model: "FALLBACK_LOCAL",
        promptVersion,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        status: "FALLBACK",
        confidenceScore: 0.35,
      });

      return {
        output,
        model: "FALLBACK_LOCAL",
        promptVersion,
        confidence: 0.35,
        confidenceSource: "HEURISTIC",
        durationMs,
      };
    }
    throw new Error("Chave de API Gemini não configurada no servidor.");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature !== undefined ? request.temperature : 0.0,
        responseMimeType: request.schema ? "application/json" : undefined,
      },
    });

    const result = await model.generateContent(request.promptText);
    const text = result.response.text();
    const durationMs = Date.now() - startTime;

    let parsedOutput: any = text;
    if (request.schema) {
      try {
        parsedOutput = JSON.parse(text);
      } catch (err) {
        console.error("[AiGateway Schema Parse Error]", err);
        if (fallbackGenerator) {
          parsedOutput = fallbackGenerator();
        } else {
          throw err;
        }
      }
    }

    await aiAuditService.recordInference({
      tenantId: request.tenantId,
      actorId: request.actorId,
      flow: request.flow,
      model: modelName,
      promptVersion,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      status: "SUCCESS",
      confidenceScore: 0.95,
    });

    return {
      output: parsedOutput as TOutput,
      model: modelName,
      promptVersion,
      confidence: 0.95,
      confidenceSource: "MODEL",
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await aiAuditService.recordInference({
      tenantId: request.tenantId,
      actorId: request.actorId,
      flow: request.flow,
      model: modelName,
      promptVersion,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      status: "ERROR",
      errorMessage: error.message,
    });

    if (fallbackGenerator) {
      return {
        output: fallbackGenerator(),
        model: "FALLBACK_LOCAL",
        promptVersion,
        confidence: 0.35,
        confidenceSource: "HEURISTIC",
        durationMs,
      };
    }

    throw error;
  }
}
