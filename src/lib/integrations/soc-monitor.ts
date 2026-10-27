import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { SocError, socRead, socCompanyIds, type SocResource, type SocRow } from "./soc";

export const socRuns = () =>
  adminDb.collection("webhook_deliveries").doc("soc-monitor").collection("runs");
type SocReadInput = { companyId?: string; start?: string; end?: string; employeeIds?: string };
const validPeriodDate = (value?: string) =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

export async function monitoredSocRead(
  resource: SocResource,
  input: SocReadInput,
  source: "manual" | "schedule"
) {
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  let result: SocRow[] | undefined;
  let failure: unknown;
  try {
    result = await socRead(resource, input);
  } catch (error) {
    failure = error;
  }
  const summary = {
    id: runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    source,
    resource,
    companyId: socCompanyIds().includes(input.companyId || "") ? input.companyId : "",
    status: failure ? "error" : "success",
    code: failure instanceof SocError ? failure.code : failure ? "INTERNAL_ERROR" : "OK",
    // Preserve valid requested dates for failed ASO reads; never echo malformed input.
    periodStart: resource === "asos" && validPeriodDate(input.start) ? input.start : null,
    periodEnd: resource === "asos" && validPeriodDate(input.end) ? input.end : null,
    records: result?.length ?? null,
    needsReview: result?.filter((r) => "review" in r && r.review).length ?? null,
  };
  let recorded = true;
  // Store outcome and counts only, never payload, names, keys, registration numbers or provider messages.
  try {
    await socRuns().doc(runId).set(summary);
  } catch {
    recorded = false;
  }
  if (failure) throw failure;
  return { data: result!, summary, recorded, checkedAt: summary.finishedAt };
}

export type SocBatchFailure = {
  companyId: string;
  start: string;
  end: string;
  offset: number;
  code: string;
};

/**
 * Record a failed scheduled batch separately from the provider reads that preceded it.
 * This makes interrupted/partial company coverage visible in the same protected run history.
 */
export async function recordSocBatchFailure(input: SocBatchFailure): Promise<boolean> {
  const allowed = socCompanyIds();
  if (
    !allowed.includes(input.companyId) ||
    !validPeriodDate(input.start) ||
    !validPeriodDate(input.end) ||
    input.end < input.start ||
    !Number.isInteger(input.offset) ||
    input.offset < 0 ||
    !/^[A-Z0-9_]{1,64}$/.test(input.code)
  )
    return false;

  const finishedAt = new Date().toISOString();
  const summary = {
    id: randomUUID(),
    startedAt: finishedAt,
    finishedAt,
    source: "schedule",
    resource: "asos",
    companyId: input.companyId,
    status: "partial",
    code: input.code,
    periodStart: input.start,
    periodEnd: input.end,
    records: null,
    needsReview: null,
    coverage: "partial",
    batchOffset: input.offset,
  };
  try {
    await socRuns().doc(summary.id).set(summary);
    return true;
  } catch {
    return false;
  }
}
