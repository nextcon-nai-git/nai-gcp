import { z } from "zod/v3";
import tabela from "../tables/nr28.json";
import { shortText } from "../sst-fields";
const count = z.number().int().min(0).max(1e7);
export const AuditSimulationInputSchema = z.object({
  numeroColaboradores: count.min(1),
  grauRiscoEmpresa: z.number().int().min(1).max(4),
  regime: z.enum(["Geral", "Rural", "Portuário"]),
  asosVencidos: count,
  treinamentosPendentes: count,
  eventosS2210: count.optional(),
  eventosS2220: count.optional(),
  eventosS2240: count.optional(),
  laudosPendentes: z.string().max(2000).optional(),
  itens: z.array(z.string().regex(/^\d{6}-\d$/)).max(50),
  valorUnidade: z.number().positive().max(10000).optional(),
  referenciaConversao: shortText.optional(),
});
export function aftNr28SimulatorFlow(raw: unknown) {
  const i = AuditSimulationInputSchema.parse(raw),
    limites = [10, 25, 50, 100, 250, 500, 1000, Infinity],
    linha = tabela.faixas[limites.findIndex((l) => i.numeroColaboradores <= l)];
  const catalog: Record<string, string> = tabela.itens,
    pendencias: string[] = [];
  if (i.regime !== "Geral")
    pendencias.push("Consultar os critérios específicos do trabalho rural ou portuário.");
  if (i.asosVencidos)
    pendencias.push("Conferir os ASOs sinalizados, os vencimentos e os documentos individuais.");
  if (i.treinamentosPendentes)
    pendencias.push("Conferir as capacitações pendentes, a atividade e o anexo aplicável.");
  if (i.laudosPendentes) pendencias.push("Revisar a documentação indicada: " + i.laudosPendentes);
  const achados = Array.from(new Set(i.itens)).flatMap((codigo) => {
    const entrada = catalog[codigo];
    if (!entrada) {
      pendencias.push(
        "Conferir o código " + codigo + " no Anexo II. Código fora do catálogo local."
      );
      return [];
    }
    const [item, grau, tipo] = entrada.split("|"),
      faixa = i.regime === "Geral" ? linha[(tipo === "M" ? 4 : 0) + Number(grau) - 1] : null;
    return [
      {
        codigo,
        item,
        graduacao: "I" + grau,
        natureza: tipo === "M" ? "Medicina" : "Segurança",
        minimoBtn: faixa?.[0] ?? null,
        maximoBtn: faixa?.[1] ?? null,
      },
    ];
  });
  const completo =
    i.regime === "Geral" && achados.length > 0 && achados.length === new Set(i.itens).size;
  const min = completo ? achados.reduce((s, a) => s + (a.minimoBtn ?? 0), 0) : null,
    max = completo ? achados.reduce((s, a) => s + (a.maximoBtn ?? 0), 0) : null;
  const reais = (v: number | null) =>
    v !== null && i.valorUnidade && i.referenciaConversao
      ? Math.round(v * i.valorUnidade * 100) / 100
      : null;
  return {
    escopo:
      "Simulação por códigos de infração conferidos. Catálogo local de itens das NR-07/10/12/33/35. Uma ocorrência por código. Anexo I geral da NR-28, texto de 2026.",
    indicadores: {
      asosVencidos: i.asosVencidos,
      treinamentosPendentes: i.treinamentosPendentes,
      eventosS2210: i.eventosS2210 ?? null,
      eventosS2220: i.eventosS2220 ?? null,
      eventosS2240: i.eventosS2240 ?? null,
    },
    achados,
    estimativa: {
      minimoBtn: min,
      maximoBtn: max,
      minimoReais: reais(min),
      maximoReais: reais(max),
      referenciaConversao: i.referenciaConversao ?? null,
    },
    planoAcao: pendencias.length
      ? pendencias
      : ["Conferir a evidência de cada item com o responsável de SST."],
    nota: "Contagens de eventos e pendências servem para triagem. A conversão em reais depende de base monetária e referência vigentes informadas pelo responsável.",
  };
}
