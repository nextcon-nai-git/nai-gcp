import { z } from "zod/v3";
import { esocialTableOptions } from "@/lib/esocial-codes";
import { isoDate, shortText } from "../sst-fields";
export const LegacyMigrationInputSchema = z
  .object({
    sistemaOrigem: z.enum(["SOC", "SENIOR", "TOTVS", "EXCEL_CUSTOM"]),
    dataReferencia: isoDate,
    registros: z
      .array(
        z.object({
          idOriginal: shortText,
          descricaoAgenteNocivo: shortText,
          intensidadeMedida: shortText.optional(),
          equipamentoProtecao: shortText.optional(),
        })
      )
      .min(1)
      .max(500),
  })
  .refine((i) => new Set(i.registros.map((r) => r.idOriginal)).size === i.registros.length, {
    path: ["registros"],
    message: "Há identificadores de origem repetidos.",
  });
const normal = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function legacyEtlMigrationFlow(raw: unknown) {
  const i = LegacyMigrationInputSchema.parse(raw),
    catalog = esocialTableOptions("24", i.dataReferencia);
  const registros = i.registros.map((row) => {
    const s = normal(row.descricaoAgenteNocivo),
      matches = catalog.filter(
        (v) => v.value === row.descricaoAgenteNocivo || normal(v.label) === s
      ),
      match = matches.length === 1 ? matches[0] : null;
    const terms = s.split(" ").filter((t) => t.length >= 4);
    const candidatos = match
      ? []
      : catalog
          .filter((v) => terms.some((t) => normal(v.label).split(" ").includes(t)))
          .slice(0, 5)
          .map((v) => ({ codigo: v.value, descricao: v.label }));
    return {
      ...row,
      codigoEsocialTabela24: match?.value ?? null,
      nomeAgentePadronizado: match?.label ?? null,
      status: match ? "Correspondência exata" : "Revisar com o inventário de riscos",
      necessitaMedicaoQuantitativa: null,
      candidatos,
    };
  });
  const mapeados = registros.filter((v) => v.codigoEsocialTabela24 !== null).length;
  return {
    sistemaOrigem: i.sistemaOrigem,
    dataReferencia: i.dataReferencia,
    registrosMapeados: registros,
    mapeados,
    total: registros.length,
    taxaSucessoMapeamentoPercent: Math.round((10000 * mapeados) / registros.length) / 100,
  };
}
