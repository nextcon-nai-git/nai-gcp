import { z } from "zod/v3";
import { isValidCnpj } from "@/lib/cnpj";
import { isoDate, shortText } from "../sst-fields";
import lista from "../tables/ntep-lista-c.json";
const factor = z.number().min(0.5).max(2).multipleOf(0.0001);
export const FapContestInputSchema = z
  .object({
    cnpjEmpresa: shortText.refine(isValidCnpj),
    cnaePrincipal: z.string().regex(/^\d{4}(?:-?\d\/?\d{2})?$/),
    cid10: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]\d{2}(?:\.?[A-Z0-9])?$/),
    especie: z.enum(["B31", "B91"]),
    numeroBeneficio: shortText,
    dataInicio: isoDate,
    dataFim: isoDate.optional(),
    cat: z.enum(["Sim", "Não", "Desconhecido"]),
    exposicao: shortText,
    aso: shortText.optional(),
    folhaAnual: z.number().min(0).max(1e12),
    rat: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    fapAtual: factor,
    fapSimulado: factor,
  })
  .refine((i) => !i.dataFim || i.dataFim >= i.dataInicio, {
    path: ["dataFim"],
    message: "O fim é anterior ao início.",
  });
export function fapNtepAuditFlow(raw: unknown) {
  const i = FapContestInputSchema.parse(raw),
    classe = i.cnaePrincipal.slice(0, 4),
    cid = i.cid10.slice(0, 3);
  const faixa = Object.entries(lista).find(([intervalo]) => {
    const [inicio, fim] = intervalo.split("-");
    return inicio <= cid && cid <= fim;
  });
  const par = !!faixa?.[1].split(" ").includes(classe);
  const atual = Math.round(i.folhaAnual * i.rat * i.fapAtual),
    simulado = Math.round(i.folhaAnual * i.rat * i.fapSimulado);
  return {
    parecer: "Triagem para revisão previdenciária",
    nexoTecnicoEpidemiologico: {
      classeCnae: classe,
      categoriaCid: cid,
      intervalo: faixa?.[0] ?? null,
      parNaListaC: par,
      referencia: "Decreto 3.048/1999, art. 337 e Anexo II, Lista C (Decreto 6.957/2009).",
    },
    evidencias: {
      especie: i.especie,
      catInformada: i.cat,
      exposicaoInformada: i.exposicao,
      asoInformado: i.aso ?? null,
    },
    impactoFinanceiroEstimado: {
      ratPercentual: i.rat,
      fapAtual: i.fapAtual,
      fapSimulado: i.fapSimulado,
      ratAjustadoAtualAnualReais: atual / 100,
      ratAjustadoSimuladoAnualReais: simulado / 100,
      diferencaAnualReais: (atual - simulado) / 100,
    },
    minutaParaRevisao:
      "Ao responsável pela análise do estabelecimento " +
      i.cnpjEmpresa +
      ": solicita-se conferência da inclusão do benefício " +
      i.numeroBeneficio +
      " (" +
      i.especie +
      ", início " +
      i.dataInicio +
      ") nos elementos do FAP. O cruzamento CNAE " +
      classe +
      " / CID " +
      cid +
      (par ? " consta" : " não foi identificado") +
      " na Lista C consultada. Apreciar a decisão do INSS, a vigência e as evidências individuais antes de fundamentar pedido de retificação.",
    pendencias: [
      "Conferir o extrato do FAP, a base de incidência e a vigência do estabelecimento.",
      "Revisar espécie, outros nexos e documentos do processo. A ausência de CAT ou de registro de exposição, isoladamente, não caracteriza concessão indevida.",
      "Identificar o procedimento e o prazo aplicáveis antes de protocolar.",
    ],
  };
}
