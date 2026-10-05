import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireClinicalAccess } from "@/lib/auth/require-clinical-access";
import { badRequest } from "@/lib/auth/errors";

export async function getAuthorizedMedicalHistory(
  user: AuthContext,
  companyId: string,
  patientId: string
) {
  requireClinicalAccess(user, companyId);
  if (!patientId || patientId.length > 128 || /[\/\u0000]/.test(patientId))
    throw badRequest("Paciente inválido.");
  try {
    const snapshot = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("aso_attendances")
      .where("employeeId", "==", patientId)
      .orderBy("data_emissao", "desc")
      .limit(1)
      .get();
    if (snapshot.empty)
      return {
        statusConsulta: "SEM_REGISTROS",
        aviso:
          "Nenhum ASO foi encontrado para este identificador nesta empresa. Não inferir aptidão ou ausência de restrições.",
      };
    const data = snapshot.docs[0].data();
    return {
      statusConsulta: "CONSULTADO",
      data: data.data_emissao || null,
      resultado: data.resultado || null,
      restricoes: Array.isArray(data.restricoes)
        ? data.restricoes.filter((value: unknown) => typeof value === "string").slice(0, 30)
        : null,
    };
  } catch {
    return {
      statusConsulta: "INDISPONIVEL",
      aviso:
        "A consulta do histórico falhou. Verifique o prontuário manualmente; não inferir aptidão ou dados normais.",
    };
  }
}
