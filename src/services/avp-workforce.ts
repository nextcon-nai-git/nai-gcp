import "server-only";
import { socEmployeeStatus } from "@/lib/integrations/soc-employee-status";
import { socConfiguration, SocError } from "@/lib/integrations/soc";
import { monitoredSocRead } from "@/lib/integrations/soc-monitor";
import {
  ASSOBES_SOC_COMPANY,
  knownAvpUnits,
  type AvpRosterReading,
  type AvpWorkforce,
} from "@/lib/avp-workforce";

const historical = { records: 5685, observedOn: "2026-10-16" };
const ttlMs = 60 * 60 * 1000;

// One aggregate per server instance. Concurrent requests share the read; failures never extend its TTL.
let cached: AvpRosterReading | undefined;
let pending: Promise<AvpRosterReading> | undefined;

async function readRoster(): Promise<AvpRosterReading> {
  const { data, checkedAt } = await monitoredSocRead(
    "employees",
    { companyId: ASSOBES_SOC_COMPANY },
    "dashboard"
  );
  const ids = new Set<string>();
  const units = new Set<string>();
  let active = 0,
    other = 0,
    unknown = 0,
    unmappedUnitRecords = 0;
  for (const row of data) {
    if (row.companyId !== ASSOBES_SOC_COMPANY || !/^\d{1,20}$/.test(row.id) || ids.has(row.id))
      throw new SocError(502, "ROSTER_INTEGRITY", "Código de vínculo inconsistente.");
    ids.add(row.id);
    const status = socEmployeeStatus(row.status || "");
    if (status === "active") active++;
    else if (status === "other") other++;
    else unknown++;
    if (knownAvpUnits.has(row.unitId)) units.add(row.unitId);
    else unmappedUnitRecords++;
  }
  return {
    checkedAt,
    records: ids.size,
    active,
    other,
    unknown,
    observedUnits: [...units],
    unmappedUnitRecords,
  };
}

export async function getAvpWorkforce(): Promise<AvpWorkforce> {
  const config = socConfiguration();
  if (
    !config.companyIds.includes(ASSOBES_SOC_COMPANY) ||
    !config.resources.employees.configured ||
    process.env.SOC_EMPLOYEES_CODE !== "155091"
  )
    return { historical, source: "manual", reading: null, issue: "configuration" };
  const cacheAge = cached ? Date.now() - Date.parse(cached.checkedAt) : Infinity;
  if (cached && cacheAge >= 0 && cacheAge < ttlMs)
    return { historical, source: "cache", reading: cached, issue: null };
  const request = (pending ??= readRoster());
  try {
    cached = await request;
    return { historical, source: "connector", reading: cached, issue: null };
  } catch (error) {
    const integrity =
      error instanceof SocError &&
      ["ROSTER_INTEGRITY", "SCOPE_MISMATCH", "RESPONSE_CONTRACT"].includes(error.code);
    return {
      historical,
      source: "manual",
      reading: null,
      issue: integrity ? "integrity" : "provider",
    };
  } finally {
    if (pending === request) pending = undefined;
  }
}
