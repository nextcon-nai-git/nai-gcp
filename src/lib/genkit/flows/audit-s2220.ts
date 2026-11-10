import { z } from "genkit";
import { isEsocialTableCode } from "../../esocial-codes";
import { EsocialExamSchema, ESOCIAL_LAYOUT } from "../../esocial-events";
import { ai } from "../router";
import { AIProviderSchema } from "../providers";
import { GenerationUnavailable, generateWithFallback } from "../resilient-runner";
import {
  ESocialS2220InputSchema,
  SSTAuditOutputSchema,
  type SSTAuditOutput,
} from "../s2220-contract";

export { ESocialS2220InputSchema, SSTAuditOutputSchema };
const corrections = {
  cronologia: "Confira as datas do ASO e dos procedimentos.",
  procedimento: "Confira o procedimento e os campos exigidos na Tabela 27.",
  agente: "Confira o código e a vigência do agente na Tabela 24.",
  medico: "Confira o CRM e a UF do médico emitente.",
  divulgacao: "Confira a autorização expressa para informar o resultado do exame.",
  duplicidade: "Confira os procedimentos repetidos na mesma data.",
  pcmso: "Compare os procedimentos com o PCMSO e o histórico de exposição.",
  conclusao: "Confira o evento completo e o vínculo no RET antes de transmitir.",
};
const code = z.enum([
  "cronologia",
  "procedimento",
  "agente",
  "medico",
  "divulgacao",
  "duplicidade",
  "pcmso",
  "conclusao",
]);
type Code = keyof typeof corrections;
const priorityOutput = z.object({ prioridades: z.array(code) });
// Somente códigos fechados entram nos traces do Genkit e nos provedores.
const prioritize = ai.defineFlow(
  {
    name: "priorizarRecomendacoesS2220",
    inputSchema: z.object({
      selectedProvider: z.enum(AIProviderSchema.removeDefault().options),
      codes: z.array(code),
    }),
  },
  async ({ selectedProvider, codes }) =>
    generateWithFallback({
      primaryProvider: selectedProvider,
      prompt:
        "Ordene as categorias de revisão de um formulário ocupacional. Devolva apenas as categorias recebidas, sem repetir: " +
        codes.join(", "),
      outputSchema: priorityOutput,
    })
);

export async function auditS2220EventFlow(input: unknown): Promise<SSTAuditOutput> {
  const e = ESocialS2220InputSchema.parse(input);
  const issues: SSTAuditOutput["inconsistenciasDetectadas"] = [];
  const actions = new Set<Code>();
  const issue = (
    campo: string,
    descricaoErro: string,
    action: Code,
    regraEsocialViolada: string
  ) => {
    issues.push({ campo, descricaoErro, gravidade: "CRITICA", regraEsocialViolada });
    actions.add(action);
  };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );
  if (e.dataAso > today) issue("dataAso", "ASO com data futura.", "cronologia", "S-2220/dtAso");
  const { crm, ufCrm } = e.medicoEmitente;
  if ((!e.trabalhadorNoExterior && (!crm || !ufCrm)) || Boolean(crm) !== Boolean(ufCrm))
    issue(
      "medicoEmitente",
      "Confira CRM, UF e a condição de trabalho no exterior.",
      "medico",
      "S-2220/medico"
    );
  let tabela27: boolean | null = e.examesComplementares.length ? true : null;
  if (!e.examesComplementares.length)
    issue(
      "examesComplementares",
      "Informe ao menos um procedimento realizado para o evento.",
      "procedimento",
      "S-2220/exame"
    );
  const seen = new Set<string>();
  e.examesComplementares.forEach((exam, i) => {
    const path = "examesComplementares." + i;
    const key = exam.dataExame + "|" + exam.codigoProcedimento;
    if (seen.has(key))
      issue(path, "Procedimento repetido na mesma data.", "duplicidade", "S-2220/exame");
    seen.add(key);
    if (exam.dataExame > e.dataAso)
      issue(path + ".dataExame", "Exame posterior ao ASO.", "cronologia", "S-2220/dtExm");
    if (exam.resultado && !e.divulgacaoResultadoAutorizada)
      issue(
        path + ".resultado",
        "Resultado informado sem confirmação da autorização.",
        "divulgacao",
        "S-2220/indResult"
      );
    if (!isEsocialTableCode("27", exam.codigoProcedimento, exam.dataExame)) {
      tabela27 = false;
      issue(
        path + ".codigoProcedimento",
        "Procedimento ausente ou fora de vigência.",
        "procedimento",
        "Tabela 27"
      );
    }
    const parsed = EsocialExamSchema.safeParse({
      dtExm: exam.dataExame,
      procRealizado: exam.codigoProcedimento,
      obsProc: exam.observacao,
      ordExame: exam.ordemExame && Number(exam.ordemExame),
      indResult: exam.resultado && Number(exam.resultado),
    });
    if (!parsed.success)
      for (const problem of parsed.error.issues) {
        if (problem.path[0] === "ordExame")
          issue(
            path + ".ordemExame",
            "Informe a ordem da audiometria.",
            "procedimento",
            "S-2220/ordExame"
          );
        if (problem.path[0] === "obsProc")
          issue(
            path + ".observacao",
            "Confira a observação exigida para o procedimento.",
            "procedimento",
            "S-2220/obsProc"
          );
      }
  });
  let tabela24: boolean | null = e.agentesNocivosRelacionados?.length ? true : null;
  e.agentesNocivosRelacionados?.forEach((agent, i) => {
    if (!isEsocialTableCode("24", agent, e.dataAso)) {
      tabela24 = false;
      issue(
        "agentesNocivosRelacionados." + i,
        "Agente ausente ou fora de vigência.",
        "agente",
        "Tabela 24"
      );
    }
  });
  if (e.agentesNocivosRelacionados?.length) actions.add("pcmso");
  actions.add("conclusao");
  let order = [...actions],
    modeloUtilizado: string | null = null,
    fallbackAcionado = false,
    tentativas = 0,
    latenciaMs = 0;
  try {
    const result = await prioritize({ selectedProvider: e.selectedProvider, codes: order });
    order = [
      ...new Set([
        ...priorityOutput.parse(result.output).prioridades.filter((c) => actions.has(c)),
        ...order,
      ]),
    ];
    modeloUtilizado = result.executedModel;
    fallbackAcionado = result.fallbackOccurred;
    tentativas = result.attemptsCount;
    latenciaMs = result.latencyMs;
  } catch (error) {
    if (!(error instanceof GenerationUnavailable)) throw error;
    fallbackAcionado = error.fallbackOccurred;
    tentativas = error.attemptsCount;
    latenciaMs = error.latencyMs;
  }
  return SSTAuditOutputSchema.parse({
    modeloUtilizado,
    fallbackAcionado,
    tentativas,
    latenciaMs,
    statusConformidade: issues.length
      ? "NAO_CONFORME"
      : actions.has("pcmso")
        ? "ATENCAO"
        : "CONFORME",
    scoreRisco: Math.min(100, issues.length * 25),
    inconsistenciasDetectadas: issues,
    validacaoTabelasEsocial: { tabela24Conforme: tabela24, tabela27Conforme: tabela27 },
    recomendacoesCorrecao: order.map((c) => corrections[c]),
    revisaoMedicaPrioritaria: e.resultadoAso === "2",
    escopo:
      "Validação documental local " +
      ESOCIAL_LAYOUT +
      ". O índice resume pendências. A adequação clínica depende do PCMSO e a aceitação depende do eSocial.",
  });
}
