export const OPERATIONS = [
  { id: "esocial-query", label: "Consultas eSocial", staleAfterMinutes: 20 },
  { id: "aso-mail", label: "Retornos de ASO", staleAfterMinutes: 60 },
  { id: "avp-sheets", label: "Planilhas AVP", staleAfterMinutes: 120 },
  { id: "webhook-deliveries", label: "Entregas de integrações", staleAfterMinutes: 15 },
] as const;

export type OperationId = (typeof OPERATIONS)[number]["id"];
export type OperationOutcome = "completed" | "partial" | "failed" | "unverified";
export type OperationCounters = Record<string, number>;
export type OperationRun = {
  schemaVersion: 1;
  operation: OperationId;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  outcome: OperationOutcome;
  counters: OperationCounters;
};

export type OperationEvidence = {
  latest: OperationRun | null;
  lastFailure: OperationRun | null;
  state: "unobserved" | "invalid" | "stale" | OperationOutcome;
};

export type OperationalStatus = {
  generatedAt: string;
  controls: { esocialTransmissionBlocked: boolean; clientEmailBlocked: boolean };
  operations: Array<{
    id: OperationId;
    label: string;
    staleAfterMinutes: number;
    configuration: { present: boolean; missing: string[] };
    evidence: OperationEvidence;
  }>;
};

const counterNames: Record<OperationId, readonly string[]> = {
  "esocial-query": ["checked", "waiting", "unavailable"],
  "aso-mail": ["saved", "skipped", "examined", "hasMore"],
  "avp-sheets": ["queueUpdated", "periodicUpdated", "rowCount", "sourceRows"],
  "webhook-deliveries": ["examined"],
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;

/** Keep only fixed numeric counters; provider payloads and error text never become telemetry. */
export function summarizeOperation(operation: OperationId, value: unknown) {
  const result = object(value);
  const counters: OperationCounters = {};
  let outcome: OperationOutcome = "unverified";
  if (operation === "avp-sheets") {
    const periodic = object(result.periodic);
    const failed = Number("error" in result) + Number("error" in periodic);
    if (typeof result.started === "boolean" && typeof periodic.started === "boolean") {
      counters.queueUpdated = Number(result.started && !("error" in result));
      counters.periodicUpdated = Number(periodic.started && !("error" in periodic));
      if (
        (!result.started || count(result.rowCount)) &&
        (!periodic.started || count(periodic.sourceRows))
      )
        outcome = "completed";
    }
    if (count(result.rowCount)) counters.rowCount = result.rowCount;
    if (count(periodic.sourceRows)) counters.sourceRows = periodic.sourceRows;
    if (failed) outcome = failed === 2 ? "failed" : "partial";
    return { outcome, counters };
  }
  for (const name of counterNames[operation]) {
    if (name === "hasMore") {
      if (typeof result.hasMore === "boolean") counters.hasMore = Number(result.hasMore);
    } else if (count(result[name])) counters[name] = result[name] as number;
  }
  const expected = counterNames[operation];
  if (expected.every((name) => name in counters)) outcome = "completed";
  if (operation === "esocial-query" && counters.unavailable > 0) outcome = "partial";
  if (operation === "aso-mail" && counters.hasMore === 1) outcome = "partial";
  return { outcome, counters };
}

/** Parse stored evidence again: never spread a database record into an admin response. */
export function parseOperationRun(
  operation: OperationId,
  value: unknown,
  now = Date.now()
): OperationRun | null {
  const data = object(value);
  if (
    data.schemaVersion !== 1 ||
    data.operation !== operation ||
    typeof data.runId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.runId) ||
    typeof data.startedAt !== "string" ||
    typeof data.finishedAt !== "string" ||
    !["completed", "partial", "failed", "unverified"].includes(String(data.outcome))
  )
    return null;
  const start = Date.parse(data.startedAt),
    end = Date.parse(data.finishedAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end > now + 60_000 ||
    end - start > 24 * 60 * 60 * 1000 ||
    data.durationMs !== end - start
  )
    return null;
  const rawCounters = object(data.counters);
  const counters: OperationCounters = {};
  for (const name of counterNames[operation])
    if (
      count(rawCounters[name]) &&
      (!["hasMore", "queueUpdated", "periodicUpdated"].includes(name) ||
        Number(rawCounters[name]) <= 1)
    )
      counters[name] = rawCounters[name] as number;
  const required =
    operation === "avp-sheets" ? ["queueUpdated", "periodicUpdated"] : counterNames[operation];
  if (data.outcome === "completed" && !required.every((name) => name in counters)) return null;
  if (
    data.outcome === "completed" &&
    ((operation === "esocial-query" && counters.unavailable !== 0) ||
      (operation === "aso-mail" && counters.hasMore !== 0) ||
      (operation === "avp-sheets" &&
        ((counters.queueUpdated === 1 && !("rowCount" in counters)) ||
          (counters.periodicUpdated === 1 && !("sourceRows" in counters)))))
  )
    return null;
  return {
    schemaVersion: 1,
    operation,
    runId: data.runId,
    startedAt: new Date(start).toISOString(),
    finishedAt: new Date(end).toISOString(),
    durationMs: end - start,
    outcome: data.outcome as OperationOutcome,
    counters,
  };
}

export function operationEvidence(
  operation: OperationId,
  stored: unknown,
  now = Date.now()
): OperationEvidence {
  const data = object(stored);
  const latest = parseOperationRun(operation, data.latest, now);
  const lastFailure = parseOperationRun(operation, data.lastFailure, now);
  const threshold = OPERATIONS.find((item) => item.id === operation)!.staleAfterMinutes;
  return {
    latest,
    lastFailure:
      lastFailure?.outcome === "failed" || lastFailure?.outcome === "partial" ? lastFailure : null,
    state: !latest
      ? data.latest === undefined
        ? "unobserved"
        : "invalid"
      : now - Date.parse(latest.finishedAt) > threshold * 60_000
        ? "stale"
        : latest.outcome,
  };
}

/** Invocation configuration is only a prerequisite, never proof of a deployed scheduler. */
export function operationConfiguration(
  operation: OperationId,
  env: Record<string, string | undefined>
) {
  const required: Record<OperationId, readonly [string, string][]> = {
    "esocial-query": [
      ["ESOCIAL_SYNC_INVOKER_EMAIL", "Identidade do agendador"],
      ["ESOCIAL_SYNC_AUDIENCE", "Destino autenticado"],
    ],
    "aso-mail": [
      ["ASO_MAIL_SYNC_INVOKER_EMAIL", "Identidade do agendador"],
      ["ASO_MAIL_SYNC_AUDIENCE", "Destino autenticado"],
      ["ASO_MAIL_OPERATOR_UID", "Operador autorizado"],
      ["ASO_GMAIL_MAILBOX", "Caixa de e-mail"],
      ["ASO_GMAIL_CLIENT_ID", "Conexão da caixa de e-mail"],
      ["ASO_GMAIL_CLIENT_SECRET", "Credencial da caixa de e-mail"],
      ["ASO_GMAIL_REFRESH_TOKEN", "Autorização da caixa de e-mail"],
    ],
    "avp-sheets": [
      ["AVP_SYNC_INVOKER_EMAIL", "Identidade do agendador"],
      ["AVP_SYNC_AUDIENCE", "Destino autenticado"],
    ],
    "webhook-deliveries": [
      ["WEBHOOK_INVOKER_EMAIL", "Identidade do agendador"],
      ["WEBHOOK_WORKER_AUDIENCE", "Destino autenticado"],
    ],
  };
  const missing = required[operation]
    .filter(([key]) => !env[key]?.trim())
    .map(([, label]) => label);
  if (operation === "esocial-query" && env.ESOCIAL_SYNC_ENABLED !== "true")
    missing.push("Consulta automática habilitada");
  if (operation === "aso-mail" && env.ASO_GMAIL_ENABLED !== "true")
    missing.push("Leitura da caixa habilitada");
  return { present: missing.length === 0, missing };
}
