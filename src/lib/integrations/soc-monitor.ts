import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { SocError, socRead, socCompanyIds, type SocResource, type SocRow } from "./soc";

export const socRuns = () =>
  adminDb.collection("webhook_deliveries").doc("soc-monitor").collection("runs");
export async function monitoredSocRead(
  resource: SocResource,
  input: { companyId?: string; start?: string; end?: string; employeeIds?: string },
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
    periodStart: result && resource === "asos" ? input.start : null,
    periodEnd: result && resource === "asos" ? input.end : null,
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
