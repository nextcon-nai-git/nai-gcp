import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { badRequest, forbidden } from "@/lib/auth/errors";
import {
  canAccessClinicalImport,
  requirePgrCompany,
  requirePgrDocumentAccess,
} from "@/lib/auth/require-pgr-access";
import { getNaiDocument, PgrAnalysisOutputSchema, type PGR_AGENT_ROLES } from "@/lib/pgr-schema";

/** Loads reviews from the same access boundary as their source document. */
export async function loadNaiImportForReview(
  user: AuthContext,
  input: { companyId: string; cardId: string; role: (typeof PGR_AGENT_ROLES)[number] }
) {
  requirePgrCompany(user, input.companyId);
  const companyRef = adminDb.collection("companies").doc(input.companyId);
  const publicRef = companyRef.collection("pgr_cards").doc(input.cardId);
  const card = await publicRef.get();
  const data = card.data();
  if (!card.exists || data?.companyId !== input.companyId || data?.sourceHash !== input.cardId)
    throw badRequest("Documento não encontrado nesta empresa. Reimporte o original para revisão.");

  const publicAnalysis = PgrAnalysisOutputSchema.safeParse(data.analysis);
  const documentMetadata = publicAnalysis.success ? getNaiDocument(publicAnalysis.data) : null;
  const restricted =
    data.restricted === true ||
    ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(String(data.documentType || "")) ||
    documentMetadata?.acesso === "clinico_restrito" ||
    ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(documentMetadata?.tipo || "");
  if (restricted && !canAccessClinicalImport(user))
    throw forbidden("A revisão deste documento exige um perfil de saúde autorizado.");

  const ref = restricted
    ? companyRef.collection("clinical_records").doc("import_" + input.cardId)
    : publicRef;
  const source = restricted ? await ref.get() : card;
  if (
    !source.exists ||
    source.data()?.companyId !== input.companyId ||
    source.data()?.sourceHash !== input.cardId
  )
    throw badRequest("O vínculo do documento de origem precisa ser conferido antes da revisão.");
  const analysis = PgrAnalysisOutputSchema.parse(source.data()?.analysis);
  requirePgrDocumentAccess(user, analysis);
  const document = getNaiDocument(analysis);
  if (
    analysis.documento &&
    (document.statusClassificacao !== "identificado" ||
      (input.role !== document.agenteResponsavel &&
        (restricted ||
          !analysis.acoesCategorizadas.some((action) => action.agenteSugerido === input.role))))
  )
    throw forbidden("Solicite a revisão ao agente responsável identificado para este documento.");

  return { ref, analysis, companyRef };
}
