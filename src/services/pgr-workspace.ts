import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { isPgrGlobalAdmin, requirePgrCompany, requirePgrRole } from "@/lib/auth/require-pgr-access";
import {
  PGR_MAX_FILE_BYTES,
  PGR_VERSION,
  PgrAnalysisOutputSchema,
  cleanPgrCnpj,
  isValidPgrCnpj,
  suggestedPgrCompany,
  type PgrCompany,
  type PgrDraftView,
} from "@/lib/pgr-schema";
import { assertPgrClientBinding, buildPgrSavePlan } from "@/lib/pgr-save-plan";
import { STORAGE_PATHS } from "@/lib/storage-paths";
import { analyzePgrDocument } from "./pgr-document-analysis";

export async function getPgrCompanies(user: AuthContext): Promise<PgrCompany[]> {
  requirePgrRole(user);
  const docs = isPgrGlobalAdmin(user)
    ? (await adminDb.collection("companies").limit(5000).get()).docs
    : await Promise.all(
        [...new Set([user.tenantId, ...user.servedCompanies].filter((x): x is string => !!x))]
          .slice(0, 100)
          .map((id) => adminDb.collection("companies").doc(id).get())
      );
  return docs
    .filter((d) => d.exists)
    .map((d) => ({
      id: d.id,
      name: String(d.data()?.name || d.data()?.razaoSocial || d.id),
      cnpj: String(d.data()?.cnpj || ""),
    }));
}
function draftRef(user: AuthContext, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw badRequest("Análise inválida.");
  return adminDb.collection("users").doc(user.uid).collection("pgr_analysis_drafts").doc(id);
}
export async function preparePgrDraft(
  user: AuthContext,
  bytes: Uint8Array,
  mime: string,
  fileName: string
): Promise<PgrDraftView> {
  requirePgrRole(user);
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mime))
    throw badRequest("Use PDF, PNG, JPEG ou WebP.");
  if (!bytes.byteLength || bytes.byteLength > PGR_MAX_FILE_BYTES)
    throw new AuthError("Arquivo ausente ou acima de 12 MB.", 413);
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const draftId = createHash("sha256")
    .update(user.uid + sourceHash + PGR_VERSION)
    .digest("hex");
  const leaseRef = draftRef(user, draftId);
  const now = Date.now();
  await adminDb.runTransaction(async (tx) => {
    const old = await tx.get(leaseRef);
    if (Number(old.data()?.busyUntil) > now)
      throw new AuthError(
        "Este documento já está sendo analisado. Aguarde e tente novamente.",
        429
      );
    tx.set(leaseRef, { busyUntil: now + 120000 }, { merge: true });
  });
  try {
    const analysis = PgrAnalysisOutputSchema.parse(
      await analyzePgrDocument({
        pdfDataUri: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
        fileName,
      })
    );
    if (Buffer.byteLength(JSON.stringify(analysis)) > 800000)
      throw new Error("Resultado acima do limite; divida o documento por unidade.");
    const companies = await getPgrCompanies(user);
    const safeName = fileName.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "PGR.pdf";
    await leaseRef.set({
      sourceHash,
      fileName: safeName,
      mime,
      analysis,
      ownerUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAtMs: now + 86400000,
      busyUntil: 0,
    });
    return {
      draftId,
      sourceHash,
      fileName: safeName,
      analysis,
      companies,
      suggestedCompanyId: suggestedPgrCompany(analysis, companies),
      canCreateCompany:
        isPgrGlobalAdmin(user) &&
        analysis.identidade.status === "identificada" &&
        isValidPgrCnpj(analysis.pgrCardDetalhado.cnpj) &&
        !companies.some(
          (c) => cleanPgrCnpj(c.cnpj) === cleanPgrCnpj(analysis.pgrCardDetalhado.cnpj)
        ),
    };
  } catch (e) {
    await leaseRef.set({ busyUntil: 0 }, { merge: true });
    throw e;
  }
}
export async function savePgrDraft(
  user: AuthContext,
  params: {
    draftId: string;
    companyId: string;
    createCompany: boolean;
    confirmed: boolean;
    dueDate: string;
  },
  bytes: Uint8Array
) {
  requirePgrRole(user);
  if (!params.confirmed)
    throw badRequest("Confirme a empresa e a revisão dos dados antes de integrar.");
  if (
    params.dueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(params.dueDate) ||
      Number.isNaN(Date.parse(params.dueDate)) ||
      new Date(params.dueDate).toISOString().slice(0, 10) !== params.dueDate)
  )
    throw badRequest("Prazo inválido.");
  const draft = await draftRef(user, params.draftId).get();
  const data = draft.data();
  if (!data?.analysis || data.ownerUid !== user.uid || Number(data.expiresAtMs) < Date.now())
    throw new AuthError("A análise expirou. Reimporte o documento.", 410);
  const analysis = PgrAnalysisOutputSchema.parse(data.analysis);
  if (
    !bytes.byteLength ||
    bytes.byteLength > PGR_MAX_FILE_BYTES ||
    createHash("sha256").update(bytes).digest("hex") !== data.sourceHash
  )
    throw badRequest("O arquivo não corresponde à análise. Reimporte o documento.");
  const companyId = params.createCompany
    ? cleanPgrCnpj(analysis.pgrCardDetalhado.cnpj)
    : params.companyId;
  if (params.createCompany) {
    if (
      !isPgrGlobalAdmin(user) ||
      analysis.identidade.status !== "identificada" ||
      !isValidPgrCnpj(companyId)
    )
      throw forbidden("Não é possível criar este cliente a partir da identificação disponível.");
  } else requirePgrCompany(user, companyId);
  if (params.createCompany) {
    const registered = await getPgrCompanies(user);
    if (registered.some((c) => c.id !== companyId && cleanPgrCnpj(c.cnpj) === companyId))
      throw new AuthError(
        "Este CNPJ já tem cadastro. Selecione o cliente existente para preservar seu histórico.",
        409
      );
  }
  const companyRef = adminDb.collection("companies").doc(companyId);
  const companyDoc = await companyRef.get();
  if (!companyDoc.exists && !params.createCompany) throw badRequest("Cliente não encontrado.");
  const company: PgrCompany = companyDoc.exists
    ? {
        id: companyId,
        name: String(companyDoc.data()?.name || companyId),
        cnpj: String(companyDoc.data()?.cnpj || ""),
      }
    : {
        id: companyId,
        name: analysis.pgrCardDetalhado.razaoSocial,
        cnpj: analysis.pgrCardDetalhado.cnpj,
      };
  assertPgrClientBinding(analysis, company);
  const cardRef = companyRef.collection("pgr_cards").doc(data.sourceHash);
  const storagePath = STORAGE_PATHS.CLIENT_SST_NR(
    companyId,
    "nr01_pgr",
    `${data.sourceHash}.${data.mime === "application/pdf" ? "pdf" : data.mime.split("/")[1]}`
  );
  const file = getStorage().bucket(firebaseConfig.storageBucket).file(storagePath);
  // Upload deve existir antes de qualquer confirmação de cards ou documento salvo.
  await file.save(Buffer.from(bytes), {
    resumable: false,
    contentType: data.mime,
    metadata: { metadata: { sourceHash: data.sourceHash } },
  });
  const plan = buildPgrSavePlan(analysis, company, data.sourceHash, user.uid, params.dueDate);
  return adminDb.runTransaction(async (tx) => {
    const [freshCompany, existing] = await Promise.all([tx.get(companyRef), tx.get(cardRef)]);
    if (freshCompany.exists)
      assertPgrClientBinding(analysis, {
        id: companyId,
        name: String(freshCompany.data()?.name || companyId),
        cnpj: String(freshCompany.data()?.cnpj || ""),
      });
    else if (!params.createCompany)
      throw badRequest("O cadastro foi removido. Nenhum card foi salvo.");
    if (existing.exists)
      return {
        companyId,
        cardId: data.sourceHash,
        taskCount: existing.data()?.taskCount || 0,
        riskCount: existing.data()?.riskCount || 0,
        alreadySaved: true,
      };
    if (!freshCompany.exists)
      tx.create(companyRef, {
        id: companyId,
        name: company.name,
        cnpj: company.cnpj,
        address: analysis.pgrCardDetalhado.enderecoCompleto,
        active: true,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    tx.create(cardRef, {
      ...analysis.pgrCardDetalhado,
      analysis,
      sourceHash: data.sourceHash,
      fileName: data.fileName,
      mime: data.mime,
      storagePath,
      companyId,
      companyName: company.name,
      reviewStatus: "pending",
      taskCount: plan.tasks.length,
      riskCount: plan.risks.length,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      version: PGR_VERSION,
    });
    for (const task of plan.tasks)
      tx.create(companyRef.collection("tasks").doc(task.id), {
        ...task,
        createdAt: FieldValue.serverTimestamp(),
      });
    for (const risk of plan.risks)
      tx.create(companyRef.collection("risks").doc(risk.id), {
        ...risk,
        createdAt: FieldValue.serverTimestamp(),
      });
    tx.create(companyRef.collection("audit_logs").doc(), {
      operation: "PGR_IMPORTED",
      uid: user.uid,
      companyId,
      sourceHash: data.sourceHash,
      draftId: params.draftId,
      identityConfirmed: true,
      sourceName: data.fileName,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      companyId,
      cardId: data.sourceHash,
      taskCount: plan.tasks.length,
      riskCount: plan.risks.length,
      alreadySaved: false,
    };
  });
}
export async function getPgrRecords(user: AuthContext, companyId: string) {
  requirePgrCompany(user, companyId);
  const snap = await adminDb
    .collection("companies")
    .doc(companyId)
    .collection("pgr_cards")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      fileName: d.data().fileName,
      companyId,
      companyName: d.data().companyName,
      taskCount: d.data().taskCount,
      riskCount: d.data().riskCount,
      analysis: d.data().analysis,
    }))
    .filter((d) => d.analysis);
}
