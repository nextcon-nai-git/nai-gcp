import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { forbidden } from "@/lib/auth/errors";
import {
  OPERATIONS,
  operationConfiguration,
  operationEvidence,
  parseOperationRun,
  summarizeOperation,
  type OperationId,
  type OperationRun,
} from "@/lib/operational-status";

// Existing rules deny ALL direct client access to this namespace, including administrators.
// Four singleton documents keep telemetry bounded; provider payloads are never persisted here.
const runRef = (operation: OperationId) =>
  adminDb
    .collection("clinic_portal_private")
    .doc("operations")
    .collection("worker_status")
    .doc(operation);

async function persistRun(run: OperationRun) {
  const ref = runRef(run.operation);
  return adminDb.runTransaction(async (tx) => {
    const stored = (await tx.get(ref)).data() || {};
    const latest = parseOperationRun(run.operation, stored.latest);
    const lastFailure = parseOperationRun(run.operation, stored.lastFailure);
    const update: Record<string, OperationRun> = {};
    // Start time orders runs; UUID breaks same-millisecond ties deterministically.
    // This is a display order, not a global execution sequence across replicas.
    const isNewer = (previous: OperationRun | null) =>
      !previous ||
      run.startedAt > previous.startedAt ||
      (run.startedAt === previous.startedAt && run.runId > previous.runId);
    if (isNewer(latest)) update.latest = run;
    if (["partial", "failed"].includes(run.outcome) && isNewer(lastFailure))
      update.lastFailure = run;
    if (Object.keys(update).length) tx.set(ref, update, { mergeFields: Object.keys(update) });
    return Object.keys(update).length > 0;
  });
}

async function recordRun(run: OperationRun) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let recorded = false;
  try {
    recorded = await Promise.race([
      persistRun(run),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), 2500);
      }),
    ]);
  } catch {
    // Telemetry must not retry a business operation or replace its result/error.
  } finally {
    if (timer) clearTimeout(timer);
  }
  try {
    // A timed-out transaction can still finish later; false means not confirmed here.
    console.info(
      JSON.stringify({
        event: "nai_worker_run",
        message: "nai_worker_run",
        severity:
          run.outcome === "failed" ? "ERROR" : run.outcome === "completed" ? "INFO" : "WARNING",
        ...run,
        evidencePersistenceConfirmed: recorded,
      })
    );
  } catch {
    // Logging must not change the outcome of an operation that already executed.
  }
}

async function observe(operation: OperationId, started: number, result: unknown, failed: boolean) {
  try {
    const finished = Math.max(started, Date.now());
    await recordRun({
      schemaVersion: 1,
      operation,
      runId: randomUUID(),
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      ...(failed
        ? { outcome: "failed" as const, counters: {} }
        : summarizeOperation(operation, result)),
    });
  } catch {
    // Summarization, identifiers and persistence are all best-effort telemetry.
  }
}

/** Call only after OIDC and current operator authorization have both succeeded. */
export async function monitorOperation<T>(
  operation: OperationId,
  execute: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  let result: T;
  try {
    result = await execute();
  } catch (error) {
    await observe(operation, started, undefined, true);
    throw error;
  }
  await observe(operation, started, result, false);
  return result;
}

export async function getOperationalStatus(actor: AuthContext) {
  // SUPER_ADMIN is global in the existing authorization policy, including legacy
  // internal profiles whose companyId is parsed as the "nextcon" tenant.
  if (actor.role !== "SUPER_ADMIN")
    throw forbidden("Acompanhamento disponível para a administração global.");
  const snapshots = await adminDb.getAll(...OPERATIONS.map(({ id }) => runRef(id)));
  const now = Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    controls: {
      esocialTransmissionBlocked: process.env.ESOCIAL_TRANSMISSION_ENABLED !== "true",
      clientEmailBlocked: process.env.ASO_CLIENT_EMAIL_SEND_ENABLED !== "true",
    },
    operations: OPERATIONS.map((operation, index) => ({
      ...operation,
      configuration: operationConfiguration(operation.id, process.env),
      evidence: operationEvidence(operation.id, snapshots[index]?.data(), now),
    })),
  };
}
