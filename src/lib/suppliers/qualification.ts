import { OmieExport } from "@/lib/financial/omie-export";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError } from "@/lib/auth/errors";
import { brazilToday } from "@/lib/financial/treasury";
import { isCalendarDate } from "@/lib/financial/omie-dre";
const text = z.string().trim().min(1).max(180),
  id = z.string().uuid();
const date = z.string().refine(isCalendarDate, "Data inválida");
const reason = z.string().trim().min(3).max(1000);
export const SupplierProfile = z.object({
  name: text,
  document: z
    .string()
    .trim()
    .min(11)
    .max(20)
    .refine(
      (v) => /^(?:[A-Z0-9]{12}\d{2}|\d{11})$/.test(v.replace(/[^a-z0-9]/gi, "").toUpperCase()),
      "Informe CPF ou CNPJ completo"
    ),
  email: z.string().email().max(180),
  phone: z.string().trim().max(40),
  services: reason,
  city: text,
});
export const Requirement = z.object({ id, label: text, required: z.boolean() });
export const SupplierDocument = z.object({
  id,
  requirementId: id,
  name: text,
  mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  size: z
    .number()
    .int()
    .positive()
    .max(8 * 1024 * 1024),
  sha256: z.string().length(64),
  expires: date.nullable(),
  uploadedBy: text,
  uploadedAt: z.string(),
  review: z.enum(["pending", "accepted", "rejected"]),
  reviewer: z.string().nullable(),
  reason: z.string().max(1000),
});
export const Application = z.object({
  id,
  owner: text,
  profile: SupplierProfile,
  requirements: z.array(Requirement).max(30),
  documents: z.array(SupplierDocument).max(100),
  status: z.enum(["draft", "submitted", "changes", "approved", "rejected", "suspended"]),
  validUntil: date.nullable(),
  decision: z.string().max(1000),
  reviewedBy: z.string().nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastEditedBy: text,
});
export const SupplierBook = z.object({
  omieExports: z.array(OmieExport).max(5000).default([]),
  version: z.number().int().nonnegative(),
  applications: z.array(Application).max(5000),
  audit: z
    .array(
      z.object({
        id,
        actor: text,
        applicationId: id,
        at: z.string(),
        action: text,
        hash: z.string(),
        details: z.string().max(10000),
      })
    )
    .max(50000),
});
export type SupplierBookType = z.infer<typeof SupplierBook>;
export type SupplierApplication = z.infer<typeof Application>;
const common = { requestId: id, expectedVersion: z.number().int().nonnegative() };
export const SupplierCommand = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.literal("create"), profile: SupplierProfile }).strict(),
  z.object({ ...common, action: z.literal("edit"), id, profile: SupplierProfile }).strict(),
  z
    .object({
      ...common,
      action: z.literal("requirements"),
      id,
      requirements: z.array(Requirement).min(1).max(30),
      reason,
    })
    .strict(),
  z.object({ ...common, action: z.literal("submit"), id }).strict(),
  z
    .object({
      ...common,
      action: z.literal("reviewDocument"),
      id,
      documentId: id,
      review: z.enum(["accepted", "rejected"]),
      reason,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("decide"),
      id,
      status: z.enum(["changes", "approved", "rejected", "suspended"]),
      validUntil: date.nullable(),
      reason,
    })
    .strict(),
]);
export const internalReviewer = (u: AuthContext) =>
  u.role === "SUPER_ADMIN" || (u.role === "ADMIN" && !u.tenantId);
export function requireSupplierAccess(u: AuthContext) {
  if (!internalReviewer(u) && u.role !== "PROVIDER")
    throw new AuthError("Acesso restrito à homologação de fornecedores.", 403);
}
export function accessApplication(b: SupplierBookType, id: string, u: AuthContext) {
  requireSupplierAccess(u);
  const a = b.applications.find((a) => a.id === id);
  if (!a || (!internalReviewer(u) && a.owner !== u.uid))
    throw new AuthError("Processo não encontrado.", 404);
  return a;
}
function fail(s: string): never {
  throw new AuthError(s, 409);
}
export function qualificationIssues(a: SupplierApplication, today: string) {
  const issues: string[] = [];
  for (const req of a.requirements.filter((r) => r.required)) {
    const latest = a.documents.filter((d) => d.requirementId === req.id).at(-1);
    if (!latest) issues.push(`${req.label}: documento ausente.`);
    else if (latest.review !== "accepted")
      issues.push(`${req.label}: revisão pendente ou recusada.`);
    else if (latest.expires && latest.expires < today)
      issues.push(`${req.label}: documento vencido.`);
  }
  if (!a.requirements.some((r) => r.required))
    issues.push("Defina pelo menos um requisito obrigatório.");
  return issues;
}
export function qualificationCurrent(a: SupplierApplication, today: string) {
  return (
    a.status === "approved" &&
    Boolean(a.validUntil && a.validUntil >= today) &&
    qualificationIssues(a, today).length === 0
  );
}
export function applySupplierCommand(
  current: SupplierBookType,
  c: z.infer<typeof SupplierCommand>,
  u: AuthContext,
  now: string,
  hash: string
): SupplierBookType {
  requireSupplierAccess(u);
  const prior = current.audit.find((a) => a.id === c.requestId);
  if (prior) {
    if (prior.actor !== u.uid || prior.hash !== hash) fail("Identificador já utilizado.");
    return current;
  }
  const b = structuredClone(current);
  const today = brazilToday(new Date(now));
  let a: SupplierApplication;
  if (c.action === "create") {
    if (c.expectedVersion !== 0) fail("Nova solicitação deve iniciar na versão zero.");
    if (
      b.applications.some(
        (a) =>
          a.profile.document.replace(/[^a-z0-9]/gi, "").toUpperCase() ===
          c.profile.document.replace(/[^a-z0-9]/gi, "").toUpperCase()
      )
    )
      fail("Identificação já possui um processo. Contate a equipe interna.");
    a = {
      id: c.requestId,
      owner: u.uid,
      profile: c.profile,
      requirements: [],
      documents: [],
      status: "draft",
      validUntil: null,
      decision: "",
      reviewedBy: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      lastEditedBy: u.uid,
    };
    b.applications.push(a);
  } else {
    a = accessApplication(b, c.id, u);
    if (a.version !== c.expectedVersion) fail("Processo alterado. Atualize antes de salvar.");
    if (c.action === "edit") {
      if (!["draft", "changes"].includes(a.status))
        fail("Solicite devolução antes de alterar um processo em revisão ou concluído.");
      if (c.profile.document !== a.profile.document) fail("Identificação do processo é imutável.");
      a.profile = c.profile;
      a.lastEditedBy = u.uid;
      // Changes invalidate every prior acceptance; reviewers must inspect the current dossier.
      a.documents.forEach((d) => {
        d.review = "pending";
        d.reviewer = null;
        d.reason = "";
      });
    } else if (c.action === "requirements") {
      if (!internalReviewer(u))
        throw new AuthError("Somente a equipe interna define requisitos.", 403);
      if (!["draft", "changes"].includes(a.status))
        fail("Devolva o processo para definir requisitos.");
      if (new Set(c.requirements.map((r) => r.id)).size !== c.requirements.length)
        fail("Requisito repetido.");
      if (a.documents.some((d) => !c.requirements.some((r) => r.id === d.requirementId)))
        fail("Requisitos com documentos devem ser preservados; marque como opcional.");
      a.requirements = c.requirements;
      a.lastEditedBy = u.uid;
      a.documents.forEach((d) => {
        d.review = "pending";
        d.reviewer = null;
        d.reason = "";
      });
    } else if (c.action === "submit") {
      if (!["draft", "changes"].includes(a.status)) fail("Processo não está aberto para envio.");
      if (!a.requirements.some((r) => r.required)) fail("Aguarde a equipe definir o checklist.");
      if (
        a.requirements.some((r) => r.required && !a.documents.some((d) => d.requirementId === r.id))
      )
        fail("Anexe os documentos obrigatórios.");
      a.status = "submitted";
      a.lastEditedBy = u.uid;
    } else {
      if (!internalReviewer(u)) throw new AuthError("Somente a equipe interna pode revisar.", 403);
      if (c.action === "reviewDocument") {
        if (a.status !== "submitted") fail("Envie o processo para revisão primeiro.");
        const d = a.documents.find((d) => d.id === c.documentId);
        if (!d) fail("Documento não encontrado.");
        if (d.uploadedBy === u.uid)
          fail("Outro administrador deve revisar o documento que você enviou.");
        if (a.documents.filter((x) => x.requirementId === d.requirementId).at(-1)?.id !== d.id)
          fail("Revise a versão mais recente do documento.");
        if (c.review === "accepted" && d.expires && d.expires < today) fail("Documento vencido.");
        d.review = c.review;
        d.reason = c.reason;
        d.reviewer = u.uid;
      } else {
        const allowed =
          c.status === "suspended"
            ? a.status === "approved"
            : c.status === "changes"
              ? ["submitted", "approved", "rejected", "suspended"].includes(a.status)
              : a.status === "submitted";
        if (!allowed) fail("Transição de homologação inválida.");
        if (c.status === "approved") {
          if (a.owner === u.uid || a.lastEditedBy === u.uid)
            fail("Outro administrador deve concluir a homologação.");
          const issues = qualificationIssues(a, today);
          if (issues.length) fail(issues.join(" "));
          if (!c.validUntil || c.validUntil < today) fail("Informe uma validade vigente.");
          const expiries = a.requirements
            .filter((r) => r.required)
            .map((r) => a.documents.filter((d) => d.requirementId === r.id).at(-1)?.expires)
            .filter((d): d is string => Boolean(d));
          if (expiries.some((d) => d < c.validUntil!))
            fail("Homologação não pode ultrapassar a validade dos documentos obrigatórios.");
        }
        a.status = c.status;
        a.validUntil = c.status === "approved" ? c.validUntil : null;
        a.decision = c.reason;
        a.reviewedBy = u.uid;
      }
    }
  }
  a.version++;
  a.updatedAt = now;
  b.version++;
  b.audit.push({
    id: c.requestId,
    actor: u.uid,
    applicationId: a.id,
    at: now,
    action: c.action,
    hash,
    details: JSON.stringify(c),
  });
  return SupplierBook.parse(b);
}
export function supplierView(b: SupplierBookType, u: AuthContext, today: string) {
  requireSupplierAccess(u);
  const admin = internalReviewer(u);
  return {
    admin,
    applications: b.applications
      .filter((a) => admin || a.owner === u.uid)
      .map((a) => ({
        ...a,
        owner: admin ? a.owner : "",
        lastEditedBy: admin ? a.lastEditedBy : "",
        reviewedBy: admin ? a.reviewedBy : null,
        documents: a.documents.map((d) => ({
          ...d,
          uploadedBy: admin ? d.uploadedBy : "",
          reviewer: admin ? d.reviewer : null,
        })),
        current: qualificationCurrent(a, today),
        issues: qualificationIssues(a, today),
      })),
    audit: admin ? b.audit : [],
  };
}
