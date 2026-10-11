import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import {
  canAccessClinicalImport,
  isPgrGlobalAdmin,
  requirePgrCompany,
  requirePgrDocumentAccess,
  requirePgrRole,
} from "@/lib/auth/require-pgr-access";
import {
  PGR_MAX_FILE_BYTES,
  PGR_VERSION,
  PgrAnalysisOutputSchema,
  cleanPgrCnpj,
  isValidPgrCnpj,
  suggestedPgrCompany,
  getNaiDocument,
  NAI_DOCUMENT_NAMES,
  NAI_DOCUMENT_TYPES,
  type NaiDocumentType,
  type PgrCompany,
  type PgrDraftView,
} from "@/lib/pgr-schema";
import {
  assertPgrAnalysisReady,
  assertPgrClientBinding,
  buildPgrProviderPlan,
  buildPgrSavePlan,
  getPgrImportMetadata,
  isRestrictedPgrDocumentType,
} from "@/lib/pgr-save-plan";
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
  return adminDb.collection("nai_importa_drafts").doc(id);
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
    tx.set(leaseRef, { ownerUid: user.uid, busyUntil: now + 120000 }, { merge: true });
  });
  try {
    const analysis = PgrAnalysisOutputSchema.parse(
      await analyzePgrDocument({
        pdfDataUri: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
        fileName,
        allowClinical: canAccessClinicalImport(user),
      })
    );
    requirePgrDocumentAccess(user, analysis);
    if (Buffer.byteLength(JSON.stringify(analysis)) > 800000)
      throw new Error("Resultado acima do limite; divida o documento por unidade.");
    const companies = await getPgrCompanies(user);
    const safeName = fileName.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "Documento.pdf";
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
      canRegisterProviders: isPgrGlobalAdmin(user),
      suggestedCompanyId: suggestedPgrCompany(analysis, companies),
      canCreateCompany:
        isPgrGlobalAdmin(user) &&
        getNaiDocument(analysis).statusClassificacao === "identificado" &&
        (!analysis.analiseAgente || analysis.analiseAgente.status === "concluida") &&
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
    includeProviders?: boolean;
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
  if (
    !data?.analysis ||
    data.ownerUid !== user.uid ||
    !Number.isFinite(Number(data.expiresAtMs)) ||
    Number(data.expiresAtMs) < Date.now()
  )
    throw new AuthError("A análise expirou. Reimporte o documento.", 410);
  const analysis = PgrAnalysisOutputSchema.parse(data.analysis);
  requirePgrDocumentAccess(user, analysis);
  assertPgrAnalysisReady(analysis);
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
      analysis.pgrCardDetalhado.razaoSocial.trim().length < 3 ||
      !isValidPgrCnpj(companyId)
    )
      throw forbidden("Não é possível criar este cliente a partir da identificação disponível.");
  } else requirePgrCompany(user, companyId);
  if (params.createCompany) {
    const registered = await getPgrCompanies(user);
    if (registered.length === 5000)
      throw new AuthError("Confira o cadastro existente antes de criar uma nova empresa.", 409);
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
  const metadata = getPgrImportMetadata(analysis);
  const clinicalRef = companyRef.collection("clinical_records").doc(`import_${data.sourceHash}`);
  const existingBeforeUpload = await cardRef.get();
  if (existingBeforeUpload.exists)
    return readSavedImport(user, companyId, data.sourceHash, existingBeforeUpload.data()!);
  const extension = data.mime === "application/pdf" ? "pdf" : String(data.mime).split("/")[1];
  if (!["pdf", "png", "jpeg", "webp"].includes(extension))
    throw badRequest("Formato do original inválido. Reimporte o documento.");
  const storedFileName = `${data.sourceHash}.${extension}`;
  const storagePath = metadata.restricted
    ? `clientes/${companyId}/prontuarios/importacoes/${storedFileName}`
    : metadata.documentType === "LTCAT"
      ? `clientes/${companyId}/sst_nrs/ltcat/${storedFileName}`
      : STORAGE_PATHS.CLIENT_SST_NR(
          companyId,
          ["AEP", "AET", "DADOS_ERGONOMICOS"].includes(metadata.documentType)
            ? "nr17_ergo"
            : "nr01_pgr",
          storedFileName
        );
  const plan = buildPgrSavePlan(analysis, company, data.sourceHash, user.uid, params.dueDate);
  const checklistCount = plan.tasks.reduce((count, task) => count + task.checklist.length, 0);
  const providers = await resolveImportProviders(
    params.includeProviders !== false && isPgrGlobalAdmin(user)
      ? buildPgrProviderPlan(analysis, company)
      : []
  );
  const providerIds = providers.map((provider) => provider.id);
  const file = getStorage().bucket(firebaseConfig.storageBucket).file(storagePath);
  // Upload deve existir antes de qualquer confirmação de cards ou documento salvo.
  await file.save(Buffer.from(bytes), {
    resumable: false,
    contentType: data.mime,
    metadata: { metadata: { sourceHash: data.sourceHash } },
  });
  return adminDb.runTransaction(async (tx) => {
    const [
      freshCompany,
      existing,
      clinical,
      providerSnapshots,
      linkSnapshots,
      freshProviders,
      companyIdentities,
    ] = await Promise.all([
      tx.get(companyRef),
      tx.get(cardRef),
      metadata.restricted ? tx.get(clinicalRef) : Promise.resolve(null),
      Promise.all(
        providers.map((provider) => tx.get(adminDb.collection("providers").doc(provider.id)))
      ),
      Promise.all(
        providers.map((provider) =>
          tx.get(companyRef.collection("provider_links").doc(provider.id))
        )
      ),
      resolveImportProviders(
        providers.map((provider) => provider.data),
        tx
      ),
      params.createCompany
        ? tx.get(adminDb.collection("companies").select("cnpj").limit(5001))
        : Promise.resolve(null),
    ]);
    if (
      companyIdentities &&
      (companyIdentities.size === 5001 ||
        companyIdentities.docs.some(
          (document) =>
            document.id !== companyId &&
            cleanPgrCnpj(String(document.data().cnpj || document.id)) === companyId
        ))
    )
      throw new AuthError(
        "Este CNPJ já tem cadastro ou não pôde ser conferido. Selecione o cliente existente.",
        409
      );
    if (freshCompany.exists)
      assertPgrClientBinding(analysis, {
        id: companyId,
        name: String(freshCompany.data()?.name || companyId),
        cnpj: String(freshCompany.data()?.cnpj || ""),
      });
    else if (!params.createCompany)
      throw badRequest("O cadastro foi removido. Nenhum card foi salvo.");
    if (existing.exists)
      return savedImportResult(
        user,
        companyId,
        data.sourceHash,
        existing.data()!,
        clinical?.data()
      );
    if (freshProviders.some((provider, index) => provider.id !== providers[index].id))
      throw new AuthError(
        "Um cadastro de prestador foi atualizado durante a importação. Tente novamente para preservar o cadastro existente.",
        409
      );
    // Validate all registry identities before any transaction writes. Reviewed
    // provider fields stay intact; only company links and audit metadata change.
    providers.forEach((provider, index) => {
      const snapshot = providerSnapshots[index];
      if (
        snapshot.exists &&
        cleanPgrCnpj(String(snapshot.data()?.cnpj || snapshot.id)) !== provider.data.cnpj
      )
        throw new AuthError(
          "O cadastro do prestador mudou. Confira a identidade e tente novamente.",
          409
        );
      if (!snapshot.exists && provider.existed)
        throw new AuthError(
          "Um prestador foi removido durante a importação. Tente novamente.",
          409
        );
    });
    if (!freshCompany.exists)
      tx.create(companyRef, {
        id: companyId,
        name: company.name,
        cnpj: company.cnpj,
        cnpjNormalized: cleanPgrCnpj(company.cnpj),
        ...(!metadata.restricted ? { address: analysis.pgrCardDetalhado.enderecoCompleto } : {}),
        active: true,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    const counts = {
      taskCount: plan.tasks.length,
      checklistCount,
      riskCount: plan.risks.length,
      providerCount: providers.length,
    };
    const commonRecord = {
      sourceHash: data.sourceHash,
      companyId,
      companyName: company.name,
      reviewStatus: "pending",
      ...counts,
      ...metadata,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      version: PGR_VERSION,
    };
    if (metadata.restricted) {
      tx.create(clinicalRef, {
        ...commonRecord,
        analysis,
        providerIds,
        fileName: data.fileName,
        mime: data.mime,
        storagePath,
      });
      tx.create(cardRef, {
        ...commonRecord,
        analysis: null,
        fileName: restrictedFileLabel(metadata.documentType),
        clinicalRecordId: clinicalRef.id,
      });
    } else {
      tx.create(cardRef, {
        ...analysis.pgrCardDetalhado,
        ...commonRecord,
        analysis,
        providerIds,
        fileName: data.fileName,
        mime: data.mime,
        storagePath,
      });
    }
    providers.forEach((provider, index) => {
      if (!providerSnapshots[index].exists)
        tx.create(adminDb.collection("providers").doc(provider.id), {
          ...provider.data,
          id: provider.id,
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
          isDeleted: false,
          version: PGR_VERSION,
        });
      else
        tx.update(adminDb.collection("providers").doc(provider.id), {
          servedCompanies: FieldValue.arrayUnion(companyId),
          updatedAt: FieldValue.serverTimestamp(),
          modifiedBy: user.uid,
        });
      const linkRef = companyRef.collection("provider_links").doc(provider.id);
      tx.set(
        linkRef,
        {
          providerId: provider.id,
          companyId,
          sourceLabel: "NAI importa",
          sourceHashes: FieldValue.arrayUnion(data.sourceHash),
          updatedAt: FieldValue.serverTimestamp(),
          modifiedBy: user.uid,
          ...(!linkSnapshots[index].exists
            ? { createdAt: FieldValue.serverTimestamp(), createdBy: user.uid }
            : {}),
        },
        { merge: true }
      );
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
      operation: "NAI_DOCUMENT_IMPORTED",
      uid: user.uid,
      companyId,
      sourceHash: data.sourceHash,
      draftId: params.draftId,
      identityConfirmed: true,
      ...metadata,
      ...counts,
      ...(!metadata.restricted ? { sourceName: data.fileName } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      companyId,
      cardId: data.sourceHash,
      ...counts,
      ...metadata,
      providerIds,
      alreadySaved: false,
      analysis,
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
  return Promise.all(
    snap.docs.map(async (document) => {
      const data = document.data();
      const classification = storedClassification(data);
      const envelope = {
        id: document.id,
        companyId,
        companyName: String(data.companyName || ""),
        fileName: classification.restricted
          ? restrictedFileLabel(classification.documentType)
          : String(data.fileName || "Documento"),
        taskCount: storedCount(data.taskCount),
        checklistCount: storedCount(data.checklistCount),
        riskCount: classification.restricted ? 0 : storedCount(data.riskCount),
        providerCount: storedCount(data.providerCount),
        sourceLabel: "NAI importa",
        ...classification,
        analysis: null,
      };
      if (classification.restricted && !canAccessClinicalImport(user)) return envelope;
      const saved = await readSavedImport(user, companyId, document.id, data);
      return {
        ...envelope,
        ...saved,
        id: document.id,
        // Full names and analysis are returned only after document authorization.
        fileName: saved.fileName,
      };
    })
  );
}

type ProviderPlan = ReturnType<typeof buildPgrProviderPlan>[number];

async function resolveImportProviders(planned: ProviderPlan[], transaction?: Transaction) {
  if (!planned.length) return [];
  // Existing IDs are not always CNPJs. Read only the registry identity fields,
  // preserving historical IDs and refusing to guess if the scan is incomplete.
  const query = adminDb.collection("providers").select("cnpj", "name").limit(5001);
  const registered = transaction ? await transaction.get(query) : await query.get();
  if (registered.size === 5001)
    throw new AuthError(
      "Não foi possível conferir todos os prestadores. Desative o cadastro de prestadores e revise os candidatos separadamente.",
      409
    );
  return planned.map((provider) => {
    const matches = registered.docs.filter(
      (document) => cleanPgrCnpj(String(document.data().cnpj || document.id)) === provider.cnpj
    );
    if (matches.length > 1)
      throw new AuthError(
        "Há prestadores duplicados para um CNPJ identificado. Revise os cadastros ou desative o cadastro de prestadores nesta importação.",
        409
      );
    return { id: matches[0]?.id || provider.id, data: provider, existed: matches.length === 1 };
  });
}

function restrictedFileLabel(type: NaiDocumentType) {
  return `${NAI_DOCUMENT_NAMES[type]} — documento clínico restrito`;
}

function storedCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function storedClassification(record: Record<string, unknown>) {
  const parsed = PgrAnalysisOutputSchema.safeParse(record.analysis);
  const metadata = parsed.success ? getPgrImportMetadata(parsed.data) : null;
  const documentType = NAI_DOCUMENT_TYPES.includes(record.documentType as NaiDocumentType)
    ? (record.documentType as NaiDocumentType)
    : metadata?.documentType || "PGR";
  return {
    documentType,
    restricted:
      record.restricted === true ||
      isRestrictedPgrDocumentType(documentType) ||
      metadata?.restricted === true,
  };
}

function savedImportResult(
  user: AuthContext,
  companyId: string,
  cardId: string,
  record: Record<string, unknown>,
  clinical?: Record<string, unknown>
) {
  const classification = storedClassification(record);
  if (classification.restricted && !canAccessClinicalImport(user))
    throw forbidden("Seu perfil não pode consultar dados clínicos.");
  const detail = classification.restricted ? clinical : record;
  const parsed = PgrAnalysisOutputSchema.safeParse(detail?.analysis);
  if (!parsed.success)
    throw new AuthError(
      "O registro não está disponível para consulta. Nenhum card foi duplicado.",
      503
    );
  requirePgrDocumentAccess(user, parsed.data);
  const metadata = getPgrImportMetadata(parsed.data);
  const providerIds = Array.isArray(detail?.providerIds)
    ? detail.providerIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    companyId,
    cardId,
    fileName: String(detail?.fileName || "Documento"),
    taskCount: storedCount(record.taskCount),
    checklistCount: storedCount(record.checklistCount),
    riskCount: metadata.restricted ? 0 : storedCount(record.riskCount),
    providerCount: storedCount(record.providerCount) || providerIds.length,
    providerIds,
    alreadySaved: true,
    analysis: parsed.data,
    ...metadata,
    restricted: classification.restricted || metadata.restricted,
  };
}

async function readSavedImport(
  user: AuthContext,
  companyId: string,
  cardId: string,
  record: Record<string, unknown>
) {
  const classification = storedClassification(record);
  if (classification.restricted) {
    if (!canAccessClinicalImport(user))
      throw forbidden("Seu perfil não pode consultar dados clínicos.");
    const clinical = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("clinical_records")
      .doc(`import_${cardId}`)
      .get();
    return savedImportResult(user, companyId, cardId, record, clinical.data());
  }
  return savedImportResult(user, companyId, cardId, record);
}
