import "server-only";
import { verifiedPdf } from "./client-source-pdf";
import { BRITANIA_ANCHOR } from "@/lib/britania-group";

import { adminDb } from "@/lib/firebase-admin";
import { type AuthContext } from "@/lib/auth/auth-context";
import { parseClaims } from "@/lib/auth/claims";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { aprKeys, permitCommand, readyForReview, type WorkPermit } from "@/lib/pt-apr";
import type { DocumentData } from "firebase-admin/firestore";

function checkScope(user: AuthContext, companyId: string) {
  if ([".", "..", "all", "unauthorized"].includes(companyId) || /[\\\u0000-\u001f]/.test(companyId))
    throw badRequest("Selecione uma empresa.");
  if (
    !["SUPER_ADMIN", "ADMIN", "CLIENT_ADMIN", "OPERATIONS", "SAFETY_TECH", "ENGINEER"].includes(
      user.role
    )
  )
    throw forbidden();
  requirePgrCompany(user, companyId);
}
const permits = (companyId: string) =>
  adminDb.collection("workPermitsPrivate").doc(companyId).collection("permits");
function activeEmployee(d?: DocumentData) {
  return (
    d &&
    typeof d.name === "string" &&
    d.name.trim() &&
    !d.isDeleted &&
    !d.isArchived &&
    d.active !== false &&
    !["fired", "inativo", "desligado"].includes(String(d.status).toLowerCase())
  );
}
export async function permitEmployees(user: AuthContext, companyId: string) {
  checkScope(user, companyId);
  const ref = adminDb.collection("companies").doc(companyId);
  const docs = await ref
    .collection("employees")
    .select("name", "isDeleted", "isArchived", "active", "status", "companyId")
    .get();
  return {
    employees: docs.docs
      .filter(
        (d) => activeEmployee(d.data()) && (!d.data().companyId || d.data().companyId === companyId)
      )
      .map((d) => ({ id: d.id, name: String(d.data().name) }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
export async function getPermits(user: AuthContext, companyId: string, after?: string | null) {
  checkScope(user, companyId);
  const company = adminDb.collection("companies").doc(companyId);
  // Document ID is part of the cursor, so simultaneous creations don't skip a record.
  let queue = permits(companyId).orderBy("createdAt", "desc").orderBy("__name__", "desc").limit(51);
  if (after) {
    if (!/^[\da-f-]{36}$/.test(after)) throw badRequest("Página inválida.");
    const cursor = await permits(companyId).doc(after).get();
    if (!cursor.exists) throw badRequest("Atualize a fila.");
    queue = queue.startAfter(cursor);
  }
  const [unit, records] = await Promise.all([company.get(), queue.get()]);
  if (!unit.exists || unit.data()?.isDeleted) throw new AuthError("Empresa não encontrada.", 404);
  return {
    items: records.docs.slice(0, 50).map((d) => ({ ...d.data(), id: d.id }) as WorkPermit),
    next: records.size > 50 ? records.docs[49].id : null,
    canReview: ["SAFETY_TECH", "ENGINEER"].includes(user.role),
  };
}
export async function savePermit(user: AuthContext, input: unknown, signal: AbortSignal) {
  const result = permitCommand.safeParse(input);
  if (!result.success)
    throw badRequest("Confira empresa, colaborador, dados da atividade e evidências da APR.");
  const c = result.data;
  checkScope(user, c.companyId);
  const ref = permits(c.companyId).doc(c.permitId);
  const company = adminDb.collection("companies").doc(c.companyId);
  if (c.action === "review") {
    if (!["SAFETY_TECH", "ENGINEER"].includes(user.role))
      throw forbidden("A revisão exige um técnico ou engenheiro de segurança autorizado.");
    if (c.companyId === BRITANIA_ANCHOR)
      throw forbidden("Use o acervo da unidade para documentos de PT.");
    if (!readyForReview(c.evidence))
      throw badRequest(
        "Confira todos os itens e registre as evidências da equipe antes de concluir a APR."
      );
    const source = await company.collection("sourceDocuments").doc(c.evidence.teamEvidence).get();
    if (source.data()?.companyId !== c.companyId || source.data()?.isDeleted)
      throw badRequest("Comprovante da equipe não localizado no acervo desta empresa.");
    await verifiedPdf(c.companyId, c.evidence.teamEvidence, signal);
  }
  return adminDb.runTransaction(async (tx) => {
    const [profile, unit, existing] = await tx.getAll(
      adminDb.collection("users").doc(user.uid),
      company,
      ref
    );
    const p = profile.data();
    if (!p || p.accessEnabled === false || p.isDeleted) throw forbidden();
    const claims = parseClaims(p);
    checkScope(
      {
        ...user,
        role: claims.role,
        tenantId: claims.tenantId || null,
        servedCompanies: claims.servedCompanies || [],
      },
      c.companyId
    );
    if (!unit.exists || unit.data()?.isDeleted || unit.data()?.active === false)
      throw badRequest("Empresa inativa ou ausente.");
    const prior = existing.data() as WorkPermit | undefined;
    if (c.action === "create") {
      if (prior) {
        if (
          prior.createdBy === user.uid &&
          prior.employeeId === c.employeeId &&
          prior.task === c.task &&
          prior.location === c.location
        )
          return prior;
        throw new AuthError("Esta permissão já existe com dados diferentes.", 409);
      }
      const worker = (await tx.get(company.collection("employees").doc(c.employeeId))).data();
      if (!activeEmployee(worker) || (worker?.companyId && worker.companyId !== c.companyId))
        throw badRequest("Colaborador ativo não encontrado nesta empresa.");
      const record: WorkPermit = {
        id: ref.id,
        status: "awaiting_review",
        employeeId: c.employeeId,
        employeeName: worker!.name,
        task: c.task,
        location: c.location,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };
      tx.create(ref, record);
      return record;
    }
    if (!["SAFETY_TECH", "ENGINEER"].includes(claims.role))
      throw forbidden("A revisão exige um técnico ou engenheiro de segurança autorizado.");
    if (!prior) throw new AuthError("Permissão não encontrada.", 404);
    if (prior.status !== "awaiting_review") {
      const saved = prior.evidence;
      if (
        prior.status === "awaiting_signature" &&
        prior.reviewerUid === user.uid &&
        saved &&
        saved.controls === c.evidence.controls &&
        saved.hazards === c.evidence.hazards &&
        saved.teamEvidence === c.evidence.teamEvidence &&
        aprKeys.every(
          (k) =>
            saved.answers[k].status === c.evidence.answers[k].status &&
            saved.answers[k].note === c.evidence.answers[k].note
        )
      )
        return prior;
      throw new AuthError("A APR já foi concluída. Atualize a fila para conferir.", 409);
    }
    const worker = (await tx.get(company.collection("employees").doc(prior.employeeId))).data();
    if (!activeEmployee(worker) || (worker?.companyId && worker.companyId !== c.companyId))
      throw badRequest("Confira o vínculo do colaborador antes de concluir.");
    const source = (
      await tx.get(company.collection("sourceDocuments").doc(c.evidence.teamEvidence))
    ).data();
    if (source?.companyId !== c.companyId || source.isDeleted || typeof source.name !== "string")
      throw badRequest("O comprovante da equipe mudou. Confira o acervo.");
    const record: WorkPermit = {
      ...prior,
      evidenceName: source.name,
      status: "awaiting_signature",
      reviewerUid: user.uid,
      reviewerName: String(p.displayName || p.name || user.email || user.uid),
      reviewedAt: new Date().toISOString(),
      evidence: c.evidence,
    };
    tx.set(ref, record);
    return record;
  });
}
