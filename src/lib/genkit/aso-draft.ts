import { z } from "zod/v3";
import { ESOCIAL_UFS } from "../esocial-events";
const text = z.string().max(160).nullable();
export const AsoDraftSchema = z.object({
  documento: z.enum(["ASO_INDIVIDUAL", "MULTIPLOS_TRABALHADORES", "INDETERMINADO"]),
  cpfTrabalhador: text,
  tipoExame: z.enum(["0", "1", "2", "3", "4", "9"]).nullable(),
  dataAso: text,
  resultadoAso: z.enum(["1", "2"]).nullable(),
  medicoEmitente: z.object({ nome: text, crm: text, ufCrm: z.enum(ESOCIAL_UFS).nullable() }),
  exames: z
    .array(
      z.object({
        descricao: text,
        codigoProcedimento: text,
        dataExame: text,
        ordemExame: z.enum(["1", "2"]).nullable(),
        resultado: z.enum(["1", "2", "3", "4"]).nullable(),
      })
    )
    .max(99),
  agentesNocivosRelacionados: z.array(z.string().max(16)).max(99),
  pendencias: z.array(z.string().max(200)).max(40),
});
export type AsoDraft = z.infer<typeof AsoDraftSchema>;
export function applyAsoDraft(
  current: Record<string, unknown>,
  draft: AsoDraft,
  lockWorker: boolean
) {
  if (draft.documento !== "ASO_INDIVIDUAL") throw new Error("Selecione um ASO individual.");
  const currentWorker = (current.ideVinculo || {}) as Record<string, unknown>;
  const currentAso = (current.aso || {}) as Record<string, unknown>;
  const cpf = (draft.cpfTrabalhador || "").replace(/[^\d]/g, "");
  if (lockWorker && (!cpf || cpf !== String(currentWorker.cpfTrab || "").replace(/[^\d]/g, "")))
    throw new Error("O CPF do arquivo precisa coincidir com o vínculo fixado no evento.");
  const workerChanged = cpf !== String(currentWorker.cpfTrab || "").replace(/[^\d]/g, "");
  return {
    ...current,
    ideVinculo: lockWorker
      ? currentWorker
      : { ...(workerChanged ? {} : currentWorker), cpfTrab: cpf },
    aso: {
      ...currentAso,
      dtAso: draft.dataAso || "",
      tpAso: draft.tipoExame === null ? "" : Number(draft.tipoExame),
      resAso: draft.resultadoAso === null ? "" : Number(draft.resultadoAso),
      medico: {
        nmMed: draft.medicoEmitente.nome || "",
        nrCrm: draft.medicoEmitente.crm || "",
        ufCrm: draft.medicoEmitente.ufCrm || "",
      },
      exames: draft.exames.map((e) => ({
        dtExm: e.dataExame || "",
        procRealizado: e.codigoProcedimento || "",
        obsProc: e.descricao || "",
        ...(e.ordemExame ? { ordExame: Number(e.ordemExame) } : {}),
        ...(e.resultado ? { indResult: Number(e.resultado) } : {}),
      })),
      resultDisclosureAuthorized: false,
    },
  };
}
