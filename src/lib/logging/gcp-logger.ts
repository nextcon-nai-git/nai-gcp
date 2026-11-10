import type { AIProvider } from "../genkit/providers";

export type FailureReason =
  | "quota"
  | "timeout"
  | "unavailable"
  | "invalid_output"
  | "unconfigured"
  | "denied"
  | "invalid_request"
  | "blocked"
  | "unknown";
export type ProviderFailure = { provider: AIProvider; error: FailureReason; retriesTried: number };
interface Metrics {
  event:
    | "AI_EXECUTION_SUCCESS"
    | "AI_RETRY_ATTEMPT"
    | "AI_FALLBACK_TRIGGERED"
    | "AI_ALL_PROVIDERS_FAILED"
    | "AI_EXECUTION_STOPPED";
  primaryProvider: AIProvider;
  executedProvider?: AIProvider;
  executedModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  attemptsCount: number;
  fallbackOccurred: boolean;
  latencyMs: number;
  failedProviders: ProviderFailure[];
}
const messages: Record<Metrics["event"], string> = {
  AI_EXECUTION_SUCCESS: "Geração concluída",
  AI_RETRY_ATTEMPT: "Nova tentativa no provedor",
  AI_FALLBACK_TRIGGERED: "Provedor alternativo concluiu a geração",
  AI_ALL_PROVIDERS_FAILED: "Cadeia de provedores esgotada",
  AI_EXECUTION_STOPPED: "Geração encerrada sem nova tentativa",
};
let localLog: Promise<import("@google-cloud/logging").Log> | undefined;
export function logResilienceEvent(metrics: Metrics) {
  const severity =
    metrics.event === "AI_EXECUTION_SUCCESS"
      ? "INFO"
      : metrics.event === "AI_ALL_PROVIDERS_FAILED" || metrics.event === "AI_EXECUTION_STOPPED"
        ? "ERROR"
        : "WARNING";
  const entry = {
    severity,
    message: messages[metrics.event],
    timestamp: new Date().toISOString(),
    serviceContext: {
      service: "nai-gcp-ai-engine",
      version: process.env.K_REVISION || process.env.NEXT_PUBLIC_APP_VERSION || "local",
    },
    naiMetrics: { ...metrics, failedProviders: [...metrics.failedProviders] },
  };
  if (process.env.NODE_ENV !== "development") {
    console.log(JSON.stringify(entry));
    return;
  }
  // Local development uses ADC. Logging is best effort and never delays fallback.
  localLog ??= import("@google-cloud/logging").then(({ Logging }) =>
    new Logging({
      projectId:
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    }).log("nai-ai-resilience-log")
  );
  void localLog
    .then((log) =>
      log.write(log.entry({ severity }, entry), { gaxOptions: { timeout: 1500, retry: null } })
    )
    .catch(() => console.log(JSON.stringify(entry)));
}
