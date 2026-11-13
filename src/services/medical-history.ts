import "server-only";
import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireClinicalAccess } from "@/lib/auth/require-clinical-access";
import { canAccessClinicalImport } from "@/lib/auth/require-pgr-access";
import { badRequest } from "@/lib/auth/errors";
import { dateOnly } from "@/lib/executive-dashboard";

type History = {
  data: string | null;
  tipoData: "emissao" | "atendimento";
  origem: "aso_attendances" | "clinical_records";
  referencia: string;
  resultado: string | null;
  restricoes: string[] | null;
};

function legacyHistory(id: string, data: DocumentData): History {
  return {
    data: dateOnly(data.data_emissao),
    tipoData: "emissao",
    origem: "aso_attendances",
    referencia: id,
    resultado: typeof data.resultado === "string" ? data.resultado.slice(0, 240) : null,
    restricoes: Array.isArray(data.restricoes)
      ? data.restricoes.filter((v: unknown) => typeof v === "string").slice(0, 30)
      : null,
  };
}

function linkedHistory(
  doc: QueryDocumentSnapshot,
  companyId: string,
  patientId: string
): History | null {
  const d = doc.data(),
    r = d.clinicalReview,
    appointment = r?.appointmentSnapshot;
  if (
    !/^import_[0-9a-f]{64}$/.test(doc.id) ||
    d.isDeleted ||
    d.documentType !== "ASO" ||
    !d.restricted ||
    d.companyId !== companyId ||
    d.sourceHash !== doc.id.slice(7) ||
    !d.linkedAt ||
    !d.linkedAppointmentId ||
    d.linkedEmployeeId !== patientId ||
    r?.status !== "reviewed" ||
    r.identityConfirmedFromOriginal !== true ||
    !r.reviewerUid ||
    !r.reviewedAt ||
    r.companyId !== companyId ||
    r.employeeId !== patientId ||
    r.appointmentId !== d.linkedAppointmentId ||
    r.sourceHash !== d.sourceHash ||
    !d.storageGeneration ||
    r.storageGeneration !== d.storageGeneration ||
    d.storageSha256 !== d.sourceHash ||
    appointment?.appointmentId !== r.appointmentId ||
    appointment?.employeeId !== patientId ||
    appointment?.companyId !== companyId
  )
    return null;
  // The reviewed snapshot attests the appointment date, not issuance or fitness.
  const dateTime = appointment.dateTime;
  const day =
    typeof dateTime === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(dateTime)
      ? dateOnly(dateTime.slice(0, 10))
      : dateOnly(dateTime);
  return {
    data: day,
    tipoData: "atendimento",
    origem: "clinical_records",
    referencia: doc.id,
    resultado: null,
    restricoes: null,
  };
}

export async function getAuthorizedMedicalHistory(
  user: AuthContext,
  companyId: string,
  patientId: string
) {
  requireClinicalAccess(user, companyId);
  if (
    typeof patientId !== "string" ||
    !patientId.trim() ||
    patientId !== patientId.trim() ||
    patientId.length > 128 ||
    /[\/\\\u0000-\u001f]/.test(patientId)
  )
    throw badRequest("Paciente inválido.");
  try {
    const company = adminDb.collection("companies").doc(companyId);
    const [legacy, linked] = await Promise.all([
      company
        .collection("aso_attendances")
        .where("employeeId", "==", patientId)
        .select("data_emissao", "resultado", "restricoes", "isDeleted")
        .get(),
      canAccessClinicalImport(user)
        ? company
            .collection("clinical_records")
            .where("linkedEmployeeId", "==", patientId)
            .select(
              "isDeleted",
              "documentType",
              "restricted",
              "companyId",
              "sourceHash",
              "linkedAt",
              "linkedAppointmentId",
              "linkedEmployeeId",
              "clinicalReview",
              "storageGeneration",
              "storageSha256"
            )
            .get()
        : null,
    ]);
    const records: History[] = legacy.docs
      .filter((d) => !d.data().isDeleted)
      .map((d) => legacyHistory(d.id, d.data()));
    for (const doc of linked?.docs || []) {
      const record = linkedHistory(doc, companyId, patientId);
      if (record) records.push(record);
    }
    if (!records.length)
      return {
        statusConsulta: "SEM_REGISTROS" as const,
        aviso:
          "Nenhum ASO foi encontrado nas fontes autorizadas. Não inferir aptidão ou ausência de restrições.",
      };
    records.sort(
      (a, b) =>
        (b.data || "").localeCompare(a.data || "") ||
        b.origem.localeCompare(a.origem) ||
        a.referencia.localeCompare(b.referencia)
    );
    const latest = records[0];
    const sameDay = records.filter((r) => r.data === latest.data);
    const warnings: string[] = [];
    if (records.some((r) => !r.data))
      warnings.push("Há ASO sem data confirmada. A ordem cronológica precisa de conferência.");
    if (sameDay.length > 1)
      warnings.push(
        "Há registros com a mesma data de referência. Confira os originais antes de interpretar resultados ou restrições."
      );
    if (latest.origem === "clinical_records")
      warnings.push(
        "Original revisado e vinculado ao atendimento. Data de emissão, resultado e restrições exigem consulta ao original."
      );
    return {
      statusConsulta: "CONSULTADO" as const,
      ...latest,
      ...(warnings.length ? { aviso: warnings.join(" ") } : {}),
    };
  } catch {
    return {
      statusConsulta: "INDISPONIVEL" as const,
      aviso:
        "A consulta do histórico falhou. Verifique o prontuário manualmente; não inferir aptidão ou dados normais.",
    };
  }
}
