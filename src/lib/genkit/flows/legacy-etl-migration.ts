import { z } from "zod/v3";
import { esocialTableOptions } from "@/lib/esocial-codes";
import { privateVertexFlow } from "../private-vertex";
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
export function mapLegacyRecords(raw: unknown) {
  const i = LegacyMigrationInputSchema.parse(raw),
    catalog = esocialTableOptions("24", i.dataReferencia);
  const registros = i.registros.map((row) => {
    const s = normal(row.descricaoAgenteNocivo),
      matches = catalog.filter(
        (v) => v.value === row.descricaoAgenteNocivo || normal(v.label) === s
      ),
      match = matches.length === 1 ? matches[0] : null;
    const terms = s.split(" ").filter((t) => t.length >= 4);
    if (terms.includes("barulho")) terms.push("ruido");
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

const suggest = privateVertexFlow(
  "legacyEtlMigrationFlow",
  z.object({
    sugestoes: z
      .array(
        z.object({
          linha: z.number().int().min(0).max(29),
          codigos: z.array(z.string().max(16)).max(3),
        })
      )
      .max(30),
  })
);
export async function legacyEtlMigrationFlow(raw: unknown) {
  const result = mapLegacyRecords(raw);
  const revisar = result.registrosMapeados.filter((r) => !r.codigoEsocialTabela24).slice(0, 30);
  if (!revisar.length)
    return { ...result, assistenciaIa: "Todos os registros têm correspondência exata." };
  const catalog = esocialTableOptions("24", result.dataReferencia);
  try {
    const { sugestoes } = await suggest(
      "Para as descrições legadas, proponha até três códigos plausíveis do catálogo vigente por linha (índice a partir de zero). Omitir linha se não houver evidência. Não afirmar enquadramento, intensidade, EPI ou medição. Catálogo: " +
        JSON.stringify(catalog.map((c) => [c.value, c.label])) +
        " Linhas: " +
        JSON.stringify(revisar.map((r) => r.descricaoAgenteNocivo))
    );
    for (const proposta of sugestoes) {
      const linha = revisar[proposta.linha];
      if (!linha) continue;
      const candidatos = proposta.codigos.flatMap((codigo) => {
        const ref = catalog.find((v) => v.value === codigo);
        return ref ? [{ codigo, descricao: ref.label }] : [];
      });
      linha.candidatos = Array.from(
        new Map([...candidatos, ...linha.candidatos].map((c) => [c.codigo, c])).values()
      ).slice(0, 5);
    }
    return {
      ...result,
      assistenciaIa: "Sugestões para até 30 linhas pendentes, sujeitas a conferência.",
    };
  } catch {
    return { ...result, assistenciaIa: "IA indisponível. Conferência pelo catálogo concluída." };
  }
}
