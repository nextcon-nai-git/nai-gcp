import { z } from "zod/v3";
import { ESOCIAL_UFS, EsocialCpfSchema, EsocialDaySchema } from "../esocial-events";
import { AIProviderSchema, type AIProvider } from "./providers";

export const ESocialS2220InputSchema = z
  .object({
    selectedProvider: AIProviderSchema,
    cpfTrabalhador: z
      .string()
      .regex(/^\d{11}$/)
      .pipe(EsocialCpfSchema),
    tipoExame: z.enum(["0", "1", "2", "3", "4", "9"]),
    dataAso: EsocialDaySchema,
    resultadoAso: z.enum(["1", "2"]).optional(),
    medicoEmitente: z
      .object({
        nome: z.string().trim().min(2).max(70),
        crm: z.string().trim().min(1).max(10).optional(),
        ufCrm: z.enum(ESOCIAL_UFS).optional(),
      })
      .strict(),
    trabalhadorNoExterior: z.boolean().optional(),
    divulgacaoResultadoAutorizada: z.boolean().optional(),
    // Todos os procedimentos a declarar, inclusive avaliação clínica quando realizada.
    examesComplementares: z
      .array(
        z
          .object({
            codigoProcedimento: z.string().min(1).max(20),
            dataExame: EsocialDaySchema,
            resultado: z.enum(["1", "2", "3", "4"]).optional(),
            ordemExame: z.enum(["1", "2"]).optional(),
            observacao: z.string().trim().max(999).optional(),
          })
          .strict()
      )
      .max(99),
    agentesNocivosRelacionados: z.array(z.string().min(1).max(20)).max(99).optional(),
  })
  .strict();
export const SSTAuditOutputSchema = z.object({
  modeloUtilizado: z.string().nullable(),
  fallbackAcionado: z.boolean(),
  tentativas: z.number().int().nonnegative(),
  latenciaMs: z.number().nonnegative(),
  statusConformidade: z.enum(["CONFORME", "ATENCAO", "NAO_CONFORME"]),
  scoreRisco: z.number().min(0).max(100),
  inconsistenciasDetectadas: z.array(
    z.object({
      campo: z.string(),
      descricaoErro: z.string(),
      gravidade: z.enum(["CRITICA", "MEDIA", "BAIXA"]),
      regraEsocialViolada: z.string().optional(),
    })
  ),
  validacaoTabelasEsocial: z.object({
    tabela24Conforme: z.boolean().nullable(),
    tabela27Conforme: z.boolean().nullable(),
  }),
  recomendacoesCorrecao: z.array(z.string()),
  revisaoMedicaPrioritaria: z.boolean(),
  escopo: z.string(),
});
export type SSTAuditOutput = z.infer<typeof SSTAuditOutputSchema>;
export type AuditActionResult =
  | { success: true; data: SSTAuditOutput }
  | { success: false; error: string; validationErrors?: Record<string, string[]> };
const stringCode = z.union([z.string(), z.number()]).transform(String);
const optionalCode = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  stringCode.optional()
);
// Project only fields in the audit contract. Semantic errors must reach the auditor.
export const AuditFormFields = z.object({
  eventType: z.literal("S2220"),
  ideVinculo: z.object({ cpfTrab: EsocialCpfSchema }),
  context: z.object({ workerAbroad: z.boolean().optional() }).optional(),
  aso: z.object({
    tpAso: stringCode,
    dtAso: z.string(),
    resAso: optionalCode,
    medico: z.object({
      nmMed: z.string(),
      nrCrm: z.string().optional(),
      ufCrm: z.string().optional(),
    }),
    resultDisclosureAuthorized: z.boolean().optional(),
    exames: z
      .array(
        z.object({
          dtExm: z.string(),
          procRealizado: z.string(),
          ordExame: optionalCode,
          indResult: optionalCode,
          obsProc: z.string().optional(),
        })
      )
      .max(99),
  }),
});
export function auditInputFromEvent(
  event: z.infer<typeof AuditFormFields>,
  selectedProvider: AIProvider
) {
  const { aso, ideVinculo, context } = event;
  return {
    selectedProvider,
    cpfTrabalhador: ideVinculo.cpfTrab,
    tipoExame: aso.tpAso,
    dataAso: aso.dtAso,
    resultadoAso: aso.resAso,
    medicoEmitente: {
      nome: aso.medico.nmMed,
      crm: aso.medico.nrCrm || undefined,
      ufCrm: aso.medico.ufCrm || undefined,
    },
    trabalhadorNoExterior: context?.workerAbroad,
    divulgacaoResultadoAutorizada: aso.resultDisclosureAuthorized,
    examesComplementares: aso.exames.map((exame) => ({
      codigoProcedimento: exame.procRealizado,
      dataExame: exame.dtExm,
      resultado: exame.indResult,
      ordemExame: exame.ordExame,
      observacao: exame.obsProc,
    })),
  };
}
