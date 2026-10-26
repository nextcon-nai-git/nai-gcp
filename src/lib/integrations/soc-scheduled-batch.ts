import { createHash } from "node:crypto";
import { monitoredSocRead } from "./soc-monitor";
import { socCompanyIds, socQuery, SocError, type SocResource } from "./soc";

export const SOC_EMPLOYEES_PER_BATCH = 150;
type Input = { companyId?: string; start?: string; end?: string; employeeIds?: string };
async function read(resource: SocResource, input: Input = {}) {
  const result = await monitoredSocRead(resource, input, "schedule");
  if (!result.recorded)
    throw new SocError(503, "AUDIT_UNAVAILABLE", "A consulta não foi registrada. Repita o lote.");
  return result.data;
}
export function monitoringPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const end = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(Date.parse(end) - 30 * 86400000).toISOString().slice(0, 10);
  return { start, end };
}
export async function planSocMonitoring() {
  const companies = await read("companies");
  const active = companies.filter((r) => r.active === "1").map((r) => r.id);
  const allowed = socCompanyIds();
  if (active.some((id) => !allowed.includes(id)) || new Set(active).size !== active.length)
    throw new SocError(502, "SCOPE_MISMATCH", "O cadastro SOC retornou escopo inconsistente.");
  return {
    companyIds: active.sort(),
    authorizedCompanies: allowed.length,
    returnedCompanies: companies.length,
    activeCompanies: active.length,
    missingAuthorizedCompanies: allowed.filter((id) => !companies.some((r) => r.id === id)),
    unknownActivityCompanies: companies
      .filter((r) => !["0", "1"].includes(r.active))
      .map((r) => r.id),
    ...monitoringPeriod(),
    checkedAt: new Date().toISOString(),
    scope: "active_authorized_companies",
    coverage: "issued_asos_only",
    dueDatesVerified: false,
    stalledCasesVerified: false,
  };
}
export type BatchInput = {
  companyId: string;
  start: string;
  end: string;
  offset: number;
  rosterHash?: string;
};
export function validateBatch(input: BatchInput) {
  if (
    !Number.isInteger(input.offset) ||
    input.offset < 0 ||
    input.offset > 20000 ||
    input.offset % SOC_EMPLOYEES_PER_BATCH !== 0
  )
    throw new SocError(400, "INVALID_CURSOR", "Lote inválido.");
  if (input.rosterHash !== undefined && !/^[a-f0-9]{64}$/.test(input.rosterHash))
    throw new SocError(400, "INVALID_CURSOR", "Referência do cadastro inválida.");
  // Reuse the same server-side scope and period validation as individual ASO reads.
  socQuery("asos", { ...input, employeeIds: "1" });
}
export async function monitorSocBatch(input: BatchInput) {
  validateBatch(input);
  const companies = await read("companies");
  if (!companies.some((r) => r.id === input.companyId && r.active === "1"))
    throw new SocError(
      409,
      "COMPANY_NOT_ACTIVE",
      "A empresa não foi confirmada como ativa no SOC."
    );
  const employees = await read("employees", { companyId: input.companyId });
  const ids = employees.map((r) => r.id).sort();
  if (ids.some((id) => !/^\d{1,20}$/.test(id)) || new Set(ids).size !== ids.length)
    throw new SocError(
      502,
      "ROSTER_CONTRACT",
      "Códigos de colaboradores ausentes ou duplicados; lote não concluído."
    );
  const rosterHash = createHash("sha256").update(ids.join(",")).digest("hex");
  if (
    (input.offset > 0 && input.rosterHash !== rosterHash) ||
    (input.rosterHash && input.rosterHash !== rosterHash)
  )
    throw new SocError(
      409,
      "ROSTER_CHANGED",
      "O cadastro mudou entre lotes. Reinicie a empresa; cobertura anterior é parcial."
    );
  if (input.offset >= ids.length && !(input.offset === 0 && ids.length === 0))
    throw new SocError(400, "INVALID_CURSOR", "Lote fora do cadastro atual.");
  const selected = ids.slice(input.offset, input.offset + SOC_EMPLOYEES_PER_BATCH);
  let issuedAsos = 0;
  for (let index = 0; index < selected.length; index += 50) {
    const data = await read("asos", {
      companyId: input.companyId,
      start: input.start,
      end: input.end,
      employeeIds: selected.slice(index, index + 50).join(","),
    });
    issuedAsos += data.length;
  }
  const nextOffset = input.offset + selected.length;
  return {
    companyId: input.companyId,
    start: input.start,
    end: input.end,
    offset: input.offset,
    employeesInBatch: selected.length,
    totalEmployees: ids.length,
    rosterHash,
    issuedAsosInBatch: issuedAsos,
    nextOffset: nextOffset < ids.length ? nextOffset : null,
    checkedAt: new Date().toISOString(),
    coverage: "issued_asos_only",
    dueDatesVerified: false,
    stalledCasesVerified: false,
  };
}
