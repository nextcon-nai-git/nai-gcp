"use server";
import { ZodError } from "zod/v3";
import { authorizeSst, technicalRoles, healthRoles } from "@/services/sst-analysis-access";
import { getSstModule, parseSstFields, type SstModule } from "@/lib/genkit/sst-modules";
import { ergonomicAssessmentFlow } from "@/lib/genkit/flows/ergonomic-assessment";
import { fapNtepAuditFlow } from "@/lib/genkit/flows/fap-ntep-audit";
import { aftNr28SimulatorFlow } from "@/lib/genkit/flows/aft-nr28-simulator";
import { accidentInvestigationFlow } from "@/lib/genkit/flows/accident-investigation";
import { legacyEtlMigrationFlow } from "@/lib/genkit/flows/legacy-etl-migration";
import { trainingValidationFlow } from "@/lib/genkit/flows/training-compliance";
const runners = {
  ergonomia: ergonomicAssessmentFlow,
  fap: fapNtepAuditFlow,
  fiscalizacao: aftNr28SimulatorFlow,
  acidente: accidentInvestigationFlow,
  migracao: legacyEtlMigrationFlow,
  capacitacao: trainingValidationFlow,
};
export async function runSstAnalysis(
  token: string,
  company: string,
  id: SstModule,
  data: FormData
): Promise<{ success: true; result: Record<string, unknown> } | { success: false; error: string }> {
  const config = getSstModule(id);
  if (!config) return { success: false, error: "Módulo desconhecido." };
  try {
    await authorizeSst(
      token,
      company,
      id === "fap" ? [...healthRoles, "COMPLIANCE"] : technicalRoles
    );
  } catch {
    return { success: false, error: "Confira o acesso à empresa e o perfil autorizado." };
  }
  try {
    const input = parseSstFields(id, data);
    const result = await runners[id](input, data.get("arquivo"));
    return { success: true, result };
  } catch (e) {
    if (e instanceof ZodError) {
      const keys = Array.from(
        new Set(
          e.issues.map(
            (v) => config.fields.find((f) => f.key === v.path[0])?.label ?? "dados informados"
          )
        )
      );
      return { success: false, error: "Confira os campos: " + keys.join(", ") };
    }
    return {
      success: false,
      error: "Confira os dados e o formato do arquivo. Se estiverem corretos, tente novamente.",
    };
  }
}
