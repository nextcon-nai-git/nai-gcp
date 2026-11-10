import { z, GenerationBlockedError } from "genkit";
import { setTimeout as delay } from "node:timers/promises";
import { ai, configured, MODEL_MAP } from "./router";
import { FALLBACK_CHAINS, type AIProvider } from "./providers";
import {
  logResilienceEvent,
  type FailureReason,
  type ProviderFailure,
} from "../logging/gcp-logger";

export class GenerationUnavailable extends Error {
  constructor(
    readonly attemptsCount: number,
    readonly latencyMs: number,
    readonly failedProviders: ProviderFailure[],
    readonly fallbackOccurred: boolean
  ) {
    super("Assistência de IA indisponível.");
  }
}
function classify(error: unknown): FailureReason {
  if (!error || typeof error !== "object") return "unknown";
  const e = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    name?: string;
    cause?: { code?: unknown };
  };
  if (error instanceof GenerationBlockedError || e.name === "GenerationBlockedError")
    return "blocked";
  if (e.name === "TimeoutError" || e.name === "APIConnectionTimeoutError") return "timeout";
  if (e.name === "ZodError" || e.name === "GenerationResponseError" || e.name === "OutputInvalid")
    return "invalid_output";
  const status = String(e.status ?? e.statusCode ?? e.code ?? e.cause?.code);
  if (["429", "RESOURCE_EXHAUSTED", "8"].includes(status)) return "quota";
  if (["408", "504", "DEADLINE_EXCEEDED", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(status))
    return "timeout";
  if (
    [
      "500",
      "502",
      "503",
      "529",
      "INTERNAL",
      "UNAVAILABLE",
      "ECONNRESET",
      "EAI_AGAIN",
      "ENOTFOUND",
      "ECONNREFUSED",
    ].includes(status) ||
    e.name === "APIConnectionError"
  )
    return "unavailable";
  if (["401", "403", "PERMISSION_DENIED", "UNAUTHENTICATED"].includes(status)) return "denied";
  if (["404", "NOT_FOUND"].includes(status)) return "unconfigured";
  if (["400", "422", "INVALID_ARGUMENT"].includes(status)) return "invalid_request";
  return "unknown";
}
export async function generateWithFallback<S extends z.ZodTypeAny>({
  primaryProvider = "gemini",
  prompt,
  outputSchema,
  temperature = 0.1,
}: {
  primaryProvider?: AIProvider;
  prompt: string;
  outputSchema: S;
  temperature?: number;
}) {
  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);
  const failedProviders: ProviderFailure[] = [];
  let attemptsCount = 0;
  let fallbackOccurred = false;
  for (const provider of FALLBACK_CHAINS[primaryProvider]) {
    const model = MODEL_MAP[provider];
    if (!configured(provider)) {
      failedProviders.push({ provider, error: "unconfigured", retriesTried: 0 });
      continue;
    }
    fallbackOccurred ||= provider !== primaryProvider;
    for (let attempt = 1; attempt <= 3; attempt++) {
      attemptsCount++;
      const metrics = {
        primaryProvider,
        executedProvider: provider,
        executedModel: model,
        attemptsCount,
        fallbackOccurred,
        failedProviders,
      };
      if (attempt > 1)
        logResilienceEvent({ ...metrics, event: "AI_RETRY_ATTEMPT", latencyMs: latency() });
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const error = new DOMException("Prazo da tentativa excedido.", "TimeoutError");
            controller.abort(error);
            reject(error);
          }, 4500);
        });
        const response = await Promise.race([
          ai.generate({
            model,
            prompt,
            output: { schema: outputSchema },
            config: provider === "claude" ? {} : { temperature },
            abortSignal: controller.signal,
          }),
          timeout,
        ]);
        if (response.finishReason === "blocked")
          throw Object.assign(new Error(), { name: "GenerationBlockedError" });
        const parsed = outputSchema.safeParse(response.output);
        if (!parsed.success || response.output == null)
          throw Object.assign(new Error(), { name: "OutputInvalid" });
        const latencyMs = latency();
        logResilienceEvent({
          ...metrics,
          event: fallbackOccurred ? "AI_FALLBACK_TRIGGERED" : "AI_EXECUTION_SUCCESS",
          latencyMs,
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
        });
        return {
          output: parsed.data as z.infer<S>,
          executedModel: model,
          fallbackOccurred,
          attemptsCount,
          latencyMs,
          failedProviders,
        };
      } catch (error) {
        const reason = controller.signal.aborted ? "timeout" : classify(error);
        const transient = ["quota", "timeout", "unavailable"].includes(reason);
        if (transient && attempt < 3) {
          await delay(150 * 2 ** (attempt - 1) + Math.floor(Math.random() * 80));
          continue;
        }
        failedProviders.push({ provider, error: reason, retriesTried: attempt - 1 });
        if (["blocked", "invalid_request", "unknown"].includes(reason)) {
          logResilienceEvent({ ...metrics, event: "AI_EXECUTION_STOPPED", latencyMs: latency() });
          throw new GenerationUnavailable(
            attemptsCount,
            latency(),
            failedProviders,
            fallbackOccurred
          );
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  const latencyMs = latency();
  logResilienceEvent({
    event: "AI_ALL_PROVIDERS_FAILED",
    primaryProvider,
    attemptsCount,
    latencyMs,
    fallbackOccurred,
    failedProviders,
  });
  throw new GenerationUnavailable(attemptsCount, latencyMs, failedProviders, fallbackOccurred);
}
