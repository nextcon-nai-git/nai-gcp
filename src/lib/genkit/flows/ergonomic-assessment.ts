import { z } from "zod/v3";
import { shortText, notes, listOfNotes, positive } from "../sst-fields";
import { readMedia, privateVertexFlow } from "../private-vertex";
const integer = z.number().int().positive();
const multiplier = positive.max(1);
export const ErgonomicInputSchema = z.object({
  postoTrabalho: shortText,
  atividadeExecutada: notes,
  metodo: z.enum(["RULA", "REBA", "NIOSH"]),
  grupoA: integer.max(16).optional(),
  grupoB: integer.max(16).optional(),
  atividade: z.number().int().min(0).max(3).optional(),
  cargaKg: positive.max(1000).optional(),
  multiplicadores: z.array(multiplier).length(6).optional(),
  aplicabilidadeConfirmada: z.boolean().optional(),
});
type Input = z.infer<typeof ErgonomicInputSchema>;
// Final lookup using the adjusted group scores on the RULA/REBA worksheets (McAtamney/Corlett; Hignett/McAtamney).
const rula = [
  [1, 2, 3, 3, 4, 5, 5],
  [2, 2, 3, 3, 4, 5, 5],
  [3, 3, 3, 4, 4, 5, 6],
  [3, 3, 3, 4, 5, 6, 6],
  [4, 4, 4, 5, 6, 7, 7],
  [4, 4, 5, 6, 6, 7, 7],
  [5, 5, 6, 6, 7, 7, 7],
  [5, 5, 6, 7, 7, 7, 7],
];
const reba = [
  [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7],
  [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8],
  [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8],
  [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9],
  [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9],
  [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10],
  [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11],
  [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11],
  [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
  [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12],
  [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12],
  [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
];
export function scoreErgonomics(input: Input) {
  const { metodo, grupoA, grupoB, atividade } = input;
  if (metodo === "NIOSH") {
    if (!input.aplicabilidadeConfirmada || !input.cargaKg || !input.multiplicadores)
      return {
        pendencia:
          "Confirme a aplicabilidade da RNLE para a tarefa e informe a carga e os seis multiplicadores medidos.",
      };
    const rwl = input.multiplicadores.reduce((v, m) => v * m, 23),
      index = input.cargaKg / rwl;
    return {
      limiteRecomendadoKg: Number(rwl.toFixed(3)),
      indiceLevantamento: Number(index.toFixed(3)),
      nivelAcao:
        index > 1
          ? "Rever as condições de levantamento"
          : "Manter acompanhamento da tarefa avaliada",
    };
  }
  if (!grupoA || !grupoB || (metodo === "REBA" && atividade === undefined))
    return {
      pendencia: "Complete as pontuações ajustadas da ficha de campo para obter o resultado.",
    };
  if (metodo === "REBA" && (grupoA > 12 || grupoB > 12))
    throw new Error("REBA requer grupos de 1 a 12.");
  const score =
    metodo === "RULA"
      ? rula[Math.min(grupoA, 8) - 1][Math.min(grupoB, 7) - 1]
      : reba[grupoA - 1][grupoB - 1] + (atividade ?? 0);
  const action =
    metodo === "RULA"
      ? score <= 2
        ? "Acompanhar"
        : score <= 4
          ? "Investigar"
          : score <= 6
            ? "Investigar e adequar em breve"
            : "Investigar e adequar imediatamente"
      : score === 1
        ? "Acompanhar"
        : score <= 3
          ? "Avaliar necessidade de mudanças"
          : score <= 7
            ? "Investigar e adequar em breve"
            : score <= 10
              ? "Investigar e implementar mudanças"
              : "Implementar mudanças imediatamente";
  return { pontuacaoRisco: score, nivelAcao: action };
}
const observe = privateVertexFlow(
  "ergonomicAssessmentFlow",
  z.object({
    desviosPosturaisDetectados: z
      .array(
        z.object({
          segmento: shortText,
          evidencia: shortText,
          angulacaoEstimada: z.string().nullable(),
        })
      )
      .max(20),
    aspectosBiomecanicos: listOfNotes,
    organizacaoTrabalho: listOfNotes,
    condicoesAmbientais: listOfNotes,
    limitacoes: listOfNotes,
    planoAdequacaoAEP: listOfNotes,
  })
);
export async function ergonomicAssessmentFlow(raw: unknown, file: FormDataEntryValue | null) {
  const input = ErgonomicInputSchema.parse(raw),
    calculo = scoreErgonomics(input);
  const obs = await observe(
    "Observe a mídia do posto, com localização visual ou tempo no vídeo. Registre postura e limitações; ângulos só quando mensuráveis, sem inferir carga, repetição, diagnóstico ou condições ambientais não observáveis. Proponha medidas e observações de campo para revisão da AEP/AET. Contexto informado: " +
      JSON.stringify({ posto: input.postoTrabalho, atividade: input.atividadeExecutada }),
    await readMedia(file, ["image/png", "image/jpeg", "video/mp4"])
  );
  return {
    metodo: input.metodo,
    ...calculo,
    ...obs,
    revisao: "Conferir a ficha e a representatividade do ciclo com o responsável pela avaliação.",
  };
}
