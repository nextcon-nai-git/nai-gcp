import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export interface MaterializedAccessRecord {
  employeeId: string;
  employeeName: string;
  companyId: string;
  badgeCode: string;
  cpf: string;
  status: "ACTIVE" | "BLOCKED" | "SUSPENDED";
  asoValidUntil: string | null;
  trainingValidUntil: string | null;
  missingNrs: string[];
  version: number;
  lastMaterializedAt: string;
}

export type AccessEmployee = Record<string, unknown> & { id: string };
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
export const isAccessDocumentId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  !/[\/\u0000]/.test(value) &&
  ![".", "..", "GLOBAL", "ALL_TENANTS", "all", "unauthorized"].includes(value);

export function accessToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function accessCalendarDate(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(
      value
    ) ||
    !Number.isFinite(new Date(value).getTime())
  )
    return null;
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

export function hashBadgeCode(companyId: string, badgeCode: string): string {
  return createHash("sha256")
    .update(`${companyId}:${badgeCode.trim().toLowerCase()}`)
    .digest("hex");
}

/** Recompute from the current employee record, including fitness and training dates. */
export function buildMaterializedAccessRecord(
  companyId: string,
  employee: AccessEmployee,
  now = new Date()
): MaterializedAccessRecord {
  if (!isAccessDocumentId(companyId) || !isAccessDocumentId(employee.id))
    throw new Error("Vínculo de acesso inválido.");
  const cleanCpf = text(employee.cpf).replace(/\D/g, "");
  const cleanBadge = text(employee.badgeCode) || cleanCpf || employee.id;
  if (!isAccessDocumentId(cleanBadge)) throw new Error("Identificação de crachá inválida.");
  const today = accessToday(now);
  const requiredNrs = Array.isArray(employee.requiredNrs) ? employee.requiredNrs : [];
  const malformedRequirements =
    employee.requiredNrs !== undefined &&
    (!Array.isArray(employee.requiredNrs) || requiredNrs.some((nr) => !text(nr)));
  const trainings = Array.isArray(employee.trainings) ? employee.trainings : [];
  const completed =
    employee.completedNrs &&
    typeof employee.completedNrs === "object" &&
    !Array.isArray(employee.completedNrs)
      ? (employee.completedNrs as Record<string, unknown>)
      : {};
  const missingNrs: string[] = [];
  let trainingValidUntil: string | null = null;
  for (const nr of requiredNrs.filter(
    (nr): nr is string => typeof nr === "string" && Boolean(nr.trim())
  )) {
    const expiries = [
      completed[nr],
      ...trainings.flatMap((training) =>
        training && typeof training === "object" && training.nr === nr ? [training.validUntil] : []
      ),
    ]
      .map(accessCalendarDate)
      .filter((date): date is string => date !== null && date >= today)
      .sort();
    const latest = expiries.at(-1);
    if (!latest) missingNrs.push(nr);
    else if (!trainingValidUntil || latest < trainingValidUntil) trainingValidUntil = latest;
  }

  const status = text(employee.status).toUpperCase();
  const fitness = text(employee.fitnessStatus).toUpperCase();
  const blocked =
    employee.active === false ||
    employee.isDeleted === true ||
    employee.isArchived === true ||
    [
      "INACTIVE",
      "INATIVO",
      "TERMINATED",
      "FIRED",
      "DESLIGADO",
      "LEAVE",
      "AFASTADO",
      "SUSPENDED",
      "BLOCKED",
    ].includes(status) ||
    ["INAPTO", "UNFIT"].includes(fitness);
  const verifiedActive =
    ["ACTIVE", "ATIVO"].includes(status) &&
    ["APTO", "FIT"].includes(fitness) &&
    !malformedRequirements &&
    (!employee.companyId || employee.companyId === companyId);
  return {
    employeeId: employee.id,
    employeeName: text(employee.name),
    companyId,
    badgeCode: cleanBadge,
    cpf: cleanCpf,
    status: blocked ? "BLOCKED" : verifiedActive ? "ACTIVE" : "SUSPENDED",
    asoValidUntil: accessCalendarDate(employee.nextAsoDate),
    trainingValidUntil,
    missingNrs,
    version: 2,
    lastMaterializedAt: now.toISOString(),
  };
}

/** Keep all cache aliases in one batch. These records are hints, never authorization evidence. */
export async function syncMaterializedAccessRecord(
  companyId: string,
  employee: AccessEmployee,
  now = new Date()
): Promise<MaterializedAccessRecord> {
  const record = buildMaterializedAccessRecord(companyId, employee, now);
  const payload = { ...record, updatedAt: FieldValue.serverTimestamp() };
  const index = adminDb.collection("companies").doc(companyId).collection("access_index");
  const batch = adminDb.batch();
  batch.set(index.doc(record.badgeCode), payload);
  if (/^\d{11}$/.test(record.cpf) && record.cpf !== record.badgeCode)
    batch.set(index.doc(record.cpf), payload);
  batch.set(
    adminDb.collection("access_cards").doc(hashBadgeCode(companyId, record.badgeCode)),
    payload
  );
  await batch.commit();
  return record;
}
