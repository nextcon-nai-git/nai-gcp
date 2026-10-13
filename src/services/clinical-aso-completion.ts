import "server-only";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firebaseConfig } from "@/firebase/config";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { PGR_MAX_FILE_BYTES, PgrAnalysisOutputSchema } from "@/lib/pgr-schema";

type AsoDocumentInput = {
  companyId: string;
  cardId: string;
};

type AsoLinkInput = AsoDocumentInput & {
  employeeId: string;
};

type AsoReviewInput = AsoLinkInput & { confirmedOriginal: true };
type AsoCompletionInput = AsoLinkInput & { appointmentId: string };

function requireId(value: string, label: string) {
  if (
    !value ||
    value.length > 128 ||
    /[\/\u0000]/.test(value) ||
    ["all", "unauthorized", ".", ".."].includes(value)
  )
    throw badRequest(`${label} inválido.`);
}

function refs(input: AsoLinkInput) {
  requireId(input.companyId, "Empresa");
  requireId(input.employeeId, "Colaborador");
  if (!/^[a-f0-9]{64}$/.test(input.cardId)) throw badRequest("Documento ASO inválido.");
  const companyRef = adminDb.collection("companies").doc(input.companyId);
  return {
    companyRef,
    employeeRef: companyRef.collection("employees").doc(input.employeeId),
    cardRef: companyRef.collection("pgr_cards").doc(input.cardId),
    clinicalRef: companyRef.collection("clinical_records").doc(`import_${input.cardId}`),
  };
}

function requireCurrentDoctor(
  profile: DocumentData | undefined,
  user: AuthContext,
  companyId: string
) {
  const servedCompanies = Array.isArray(profile?.servedCompanies) ? profile.servedCompanies : [];
  if (
    user.role !== "DOCTOR" ||
    profile?.role !== "DOCTOR" ||
    !(
      profile.companyId === companyId ||
      profile.tenantId === companyId ||
      servedCompanies.includes(companyId)
    )
  )
    throw forbidden("A revisão clínica exige um médico atualmente autorizado para esta empresa.");
}

function requireAsoRecord(
  card: DocumentData | undefined,
  clinical: DocumentData | undefined,
  input: AsoDocumentInput
) {
  if (
    card?.companyId !== input.companyId ||
    card?.sourceHash !== input.cardId ||
    card?.documentType !== "ASO" ||
    card?.restricted !== true ||
    clinical?.companyId !== input.companyId ||
    clinical?.sourceHash !== input.cardId ||
    clinical?.documentType !== "ASO" ||
    clinical?.restricted !== true
  )
    throw badRequest("ASO original não encontrado nesta empresa. A fila permanece aberta.");

  const originalPrefix = `clientes/${input.companyId}/prontuarios/importacoes/${input.cardId}.`;
  if (
    typeof clinical.storagePath !== "string" ||
    !clinical.storagePath.startsWith(originalPrefix) ||
    !["pdf", "png", "jpeg", "webp"].includes(clinical.storagePath.slice(originalPrefix.length))
  )
    throw badRequest("O original do ASO não está preservado no vínculo importado.");

  const parsed = PgrAnalysisOutputSchema.safeParse(clinical.analysis);
  const document = parsed.success ? parsed.data.documento : undefined;
  if (
    !document ||
    document.tipo !== "ASO" ||
    document.agenteResponsavel !== "medico_trabalho" ||
    document.statusClassificacao !== "identificado"
  )
    throw new AuthError(
      "A classificação do ASO ainda está pendente ou incompatível. Revise o documento original.",
      409
    );
}

export async function reviewClinicalAso(user: AuthContext, input: AsoReviewInput) {
  if (input.confirmedOriginal !== true)
    throw badRequest("Confirme a conferência da identidade no ASO original.");
  const { companyRef, employeeRef, cardRef, clinicalRef } = refs(input);
  await adminDb.runTransaction(async (tx) => {
    const profile = await tx.get(adminDb.collection("users").doc(user.uid));
    requireCurrentDoctor(profile.data(), user, input.companyId);
    const [company, employee, card, clinical] = await Promise.all([
      tx.get(companyRef),
      tx.get(employeeRef),
      tx.get(cardRef),
      tx.get(clinicalRef),
    ]);
    const companyData = company.data();
    const employeeData = employee.data();
    if (
      !company.exists ||
      !employee.exists ||
      companyData?.isDeleted === true ||
      employeeData?.isDeleted === true ||
      (employeeData?.companyId && employeeData.companyId !== input.companyId) ||
      typeof employeeData?.name !== "string" ||
      !employeeData.name.trim()
    )
      throw new AuthError("Empresa ou colaborador não corresponde ao vínculo selecionado.", 409);
    requireAsoRecord(card.data(), clinical.data(), input);
    const priorReview = clinical.data()?.clinicalReview;
    if (priorReview) {
      if (
        priorReview.status === "reviewed" &&
        priorReview.reviewerUid === user.uid &&
        priorReview.companyId === input.companyId &&
        priorReview.employeeId === input.employeeId &&
        priorReview.sourceHash === input.cardId &&
        priorReview.identityConfirmedFromOriginal === true
      )
        return;
      throw new AuthError("Este ASO já possui uma revisão clínica vinculada.", 409);
    }
    if (clinical.data()?.linkedAppointmentId)
      throw new AuthError("Este ASO já está vinculado a um atendimento.", 409);
    tx.update(clinicalRef, {
      clinicalReview: {
        status: "reviewed",
        reviewerUid: user.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        companyId: input.companyId,
        employeeId: input.employeeId,
        sourceHash: input.cardId,
        identityConfirmedFromOriginal: input.confirmedOriginal,
      },
    });
  });

  const saved = await clinicalRef.get();
  const review = saved.data()?.clinicalReview;
  if (
    !saved.exists ||
    review?.status !== "reviewed" ||
    review.reviewerUid !== user.uid ||
    review.companyId !== input.companyId ||
    review.employeeId !== input.employeeId ||
    review.sourceHash !== input.cardId ||
    review.identityConfirmedFromOriginal !== true ||
    !review.reviewedAt
  )
    throw new AuthError("A revisão clínica não pôde ser confirmada. Tente novamente.", 503);
  return { status: "reviewed" as const };
}

export async function readClinicalAsoOriginal(user: AuthContext, input: AsoDocumentInput) {
  requireId(input.companyId, "Empresa");
  if (!/^[a-f0-9]{64}$/.test(input.cardId)) throw badRequest("Documento ASO inválido.");
  const companyRef = adminDb.collection("companies").doc(input.companyId);
  const profile = await adminDb.collection("users").doc(user.uid).get();
  requireCurrentDoctor(profile.data(), user, input.companyId);
  const [company, card, clinical] = await Promise.all([
    companyRef.get(),
    companyRef.collection("pgr_cards").doc(input.cardId).get(),
    companyRef.collection("clinical_records").doc(`import_${input.cardId}`).get(),
  ]);
  if (!company.exists || company.data()?.isDeleted === true)
    throw new AuthError("Empresa não encontrada ou indisponível.", 404);
  requireAsoRecord(card.data(), clinical.data(), input);
  const storagePath = clinical.data()?.storagePath as string;
  const extension = storagePath.slice(storagePath.lastIndexOf(".") + 1);
  const mime = {
    pdf: "application/pdf",
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  }[extension];
  if (!mime) throw badRequest("Formato do original do ASO inválido.");
  const file = getStorage().bucket(firebaseConfig.storageBucket).file(storagePath);
  const [metadata] = await file.getMetadata();
  if (
    !Number.isSafeInteger(Number(metadata.size)) ||
    Number(metadata.size) <= 0 ||
    Number(metadata.size) > PGR_MAX_FILE_BYTES
  )
    throw new AuthError("O original do ASO está indisponível ou excede o limite permitido.", 404);
  const [bytes] = await file.download();
  if (bytes.byteLength !== Number(metadata.size))
    throw new AuthError("A leitura do original do ASO não foi confirmada.", 503);
  return { bytes, mime };
}

export async function completeClinicalAppointmentWithAso(
  user: AuthContext,
  input: AsoCompletionInput
) {
  const { companyRef, employeeRef, cardRef, clinicalRef } = refs(input);
  requireId(input.appointmentId, "Agendamento");
  const appointmentRef = companyRef.collection("agendamentos").doc(input.appointmentId);
  const auditRef = clinicalRef
    .collection("attendance_audit")
    .doc(`appointment_${input.appointmentId}`);

  await adminDb.runTransaction(async (tx) => {
    const profile = await tx.get(adminDb.collection("users").doc(user.uid));
    requireCurrentDoctor(profile.data(), user, input.companyId);
    const [company, employee, card, clinical, appointment, audit] = await Promise.all([
      tx.get(companyRef),
      tx.get(employeeRef),
      tx.get(cardRef),
      tx.get(clinicalRef),
      tx.get(appointmentRef),
      tx.get(auditRef),
    ]);
    const companyData = company.data();
    const employeeData = employee.data();
    const clinicalData = clinical.data();
    const appointmentData = appointment.data();
    if (!clinical.exists || !clinicalData || !appointment.exists || !appointmentData)
      throw new AuthError("ASO ou agendamento não encontrado. A fila permanece aberta.", 409);
    if (
      !company.exists ||
      !employee.exists ||
      companyData?.isDeleted === true ||
      employeeData?.isDeleted === true ||
      (employeeData?.companyId && employeeData.companyId !== input.companyId) ||
      appointmentData?.companyId !== input.companyId ||
      appointmentData?.colaborador_id !== input.employeeId
    )
      throw new AuthError(
        "Empresa, colaborador e agendamento não correspondem. A fila permanece aberta.",
        409
      );
    requireAsoRecord(card.data(), clinicalData, input);
    const review = clinicalData?.clinicalReview;
    if (
      review?.status !== "reviewed" ||
      review.companyId !== input.companyId ||
      review.employeeId !== input.employeeId ||
      review.sourceHash !== input.cardId ||
      review.identityConfirmedFromOriginal !== true ||
      !review.reviewedAt ||
      typeof review.reviewerUid !== "string"
    )
      throw new AuthError(
        "Este ASO ainda não possui revisão clínica vinculada a este colaborador.",
        409
      );

    const alreadyLinked =
      clinicalData.linkedAppointmentId === input.appointmentId &&
      clinicalData.linkedEmployeeId === input.employeeId &&
      appointmentData?.status === "Concluído" &&
      appointmentData?.clinicalRecordId === clinicalRef.id &&
      appointmentData?.asoSourceHash === input.cardId;
    const auditData = audit.data();
    if (
      alreadyLinked &&
      audit.exists &&
      auditData?.type === "ASO_LINKED_AND_ATTENDANCE_COMPLETED" &&
      auditData.companyId === input.companyId &&
      auditData.employeeId === input.employeeId &&
      auditData.appointmentId === input.appointmentId &&
      auditData.sourceHash === input.cardId
    )
      return;
    if (
      clinicalData.linkedAppointmentId ||
      appointmentData?.status !== "Em Atendimento" ||
      audit.exists
    )
      throw new AuthError(
        "O ASO ou o agendamento já foi vinculado ou mudou de estado. Atualize a fila para conferir.",
        409
      );

    const event = {
      type: "ASO_LINKED_AND_ATTENDANCE_COMPLETED",
      companyId: input.companyId,
      employeeId: input.employeeId,
      appointmentId: input.appointmentId,
      clinicalRecordId: clinicalRef.id,
      sourceHash: input.cardId,
      reviewerUid: review.reviewerUid,
      reviewedAt: review.reviewedAt,
      completedBy: user.uid,
      completedAt: FieldValue.serverTimestamp(),
    };
    tx.update(appointmentRef, {
      status: "Concluído",
      clinicalRecordId: clinicalRef.id,
      asoSourceHash: input.cardId,
      completedBy: user.uid,
      completedAt: FieldValue.serverTimestamp(),
    });
    tx.update(clinicalRef, {
      linkedAppointmentId: input.appointmentId,
      linkedEmployeeId: input.employeeId,
      linkedAt: FieldValue.serverTimestamp(),
    });
    tx.create(auditRef, event);
  });

  const [savedAppointment, savedClinical, savedAudit] = await Promise.all([
    appointmentRef.get(),
    clinicalRef.get(),
    auditRef.get(),
  ]);
  const appointmentData = savedAppointment.data();
  const clinicalData = savedClinical.data();
  if (
    !savedAppointment.exists ||
    !savedClinical.exists ||
    !savedAudit.exists ||
    appointmentData?.status !== "Concluído" ||
    appointmentData.clinicalRecordId !== clinicalRef.id ||
    appointmentData.asoSourceHash !== input.cardId ||
    clinicalData?.linkedAppointmentId !== input.appointmentId ||
    clinicalData?.linkedEmployeeId !== input.employeeId ||
    savedAudit.data()?.companyId !== input.companyId ||
    savedAudit.data()?.employeeId !== input.employeeId ||
    savedAudit.data()?.appointmentId !== input.appointmentId ||
    savedAudit.data()?.sourceHash !== input.cardId
  )
    throw new AuthError(
      "A conclusão não pôde ser confirmada. O atendimento permanece disponível para retomada.",
      503
    );
  return { status: "completed" as const };
}
